import { and, DrizzleQueryError, eq, inArray, sql } from "drizzle-orm";

import {
  type ProductContent,
  type ProductDefinitionValidationIssue,
  type ProductEditPricingInput,
  type ProductEditorConfiguration,
  type ProductRevision,
  type ProductStatus
} from "@tsu-stack/contract/product";
import { type Database, type Transaction } from "@tsu-stack/db";
import {
  auditEvent,
  component,
  configurationDraft,
  customerOrder,
  optionGroup,
  optionValue,
  optionValueComponent,
  optionValueRequirement,
  product
} from "@tsu-stack/db/schema";

import { loadProductEditor, parseProductEditorDefinition } from "#@/product/queries";

function validationIssue(
  message: string,
  path: (string | number)[] = []
): ProductDefinitionValidationIssue {
  return { message, path };
}

async function lockProduct(
  tx: Transaction,
  input: { organizationId: string; productSlug: string }
) {
  const rows = await tx
    .select()
    .from(product)
    .where(
      and(eq(product.organizationId, input.organizationId), eq(product.slug, input.productSlug))
    )
    .limit(1)
    .for("update");
  return rows[0];
}

function checkRevision(current: number, expected: ProductRevision) {
  return current === expected ? undefined : ({ kind: "conflict", revision: current } as const);
}

export async function createProduct(
  db: Pick<Database, "transaction">,
  input: ProductContent & { actorUserId: string; organizationId: string }
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(product)
      .values({
        description: input.description,
        imageUrls: input.imageUrls,
        name: input.name,
        organizationId: input.organizationId,
        slug: input.slug
      })
      .onConflictDoNothing({ target: [product.organizationId, product.slug] })
      .returning({ id: product.id });
    const created = rows[0];
    if (!created) return { kind: "slug_taken" } as const;
    await tx.insert(auditEvent).values({
      action: "product.created",
      actorUserId: input.actorUserId,
      entityId: created.id,
      entityType: "product",
      metadata: { slug: input.slug },
      organizationId: input.organizationId
    });
    return { id: created.id, kind: "created" } as const;
  });
}

export async function editProductContent(
  db: Pick<Database, "transaction">,
  input: ProductContent & {
    actorUserId: string;
    expectedRevision: ProductRevision;
    organizationId: string;
    productSlug: string;
  }
) {
  return db.transaction(async (tx) => {
    const current = await lockProduct(tx, input);
    if (!current) return { kind: "not_found" } as const;
    const conflict = checkRevision(current.revision, input.expectedRevision);
    if (conflict) return conflict;

    let rows;
    try {
      rows = await tx.transaction((savepoint) =>
        savepoint
          .update(product)
          .set({
            description: input.description,
            imageUrls: input.imageUrls,
            name: input.name,
            revision: sql`${product.revision} + 1`,
            slug: input.slug
          })
          .where(and(eq(product.id, current.id), eq(product.organizationId, input.organizationId)))
          .returning({ revision: product.revision, slug: product.slug })
      );
    } catch (error) {
      if (
        error instanceof DrizzleQueryError &&
        error.cause &&
        "code" in error.cause &&
        error.cause.code === "23505" &&
        "constraint_name" in error.cause &&
        error.cause.constraint_name === "product_organization_slug_uidx"
      ) {
        return { kind: "slug_taken" } as const;
      }
      throw error;
    }
    const updated = rows[0];
    if (!updated) throw new Error("Product content update returned no row");
    await tx.insert(auditEvent).values({
      action: "product.content_edited",
      actorUserId: input.actorUserId,
      entityId: current.id,
      entityType: "product",
      metadata: { fromSlug: current.slug, toSlug: updated.slug },
      organizationId: input.organizationId
    });
    return { id: current.id, kind: "updated", ...updated } as const;
  });
}

export async function replaceProductConfiguration(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    expectedRevision: ProductRevision;
    groups: ProductEditorConfiguration;
    organizationId: string;
    productSlug: string;
  }
) {
  return db.transaction(async (tx) => {
    const current = await lockProduct(tx, input);
    if (!current) return { kind: "not_found" } as const;
    const conflict = checkRevision(current.revision, input.expectedRevision);
    if (conflict) return conflict;

    const currentGroups = await tx
      .select()
      .from(optionGroup)
      .where(eq(optionGroup.productId, current.id));
    const currentGroupIds = currentGroups.map((group) => group.id);
    const currentValues =
      currentGroupIds.length === 0
        ? []
        : await tx
            .select()
            .from(optionValue)
            .where(inArray(optionValue.optionGroupId, currentGroupIds));
    const currentGroupById = new Map(currentGroups.map((group) => [group.id, group]));
    const currentValueGroupKey = new Map(
      currentValues.map((value) => [value.id, currentGroupById.get(value.optionGroupId)?.key])
    );
    const currentValuePrice = new Map(
      currentValues.map((value) => [value.id, value.priceAdjustmentMinor])
    );
    const currentNumericPrice = new Map(
      currentGroups
        .filter((group) => group.type === "number")
        .map((group) => [group.key, group.additionalUnitPriceMinor])
    );

    const requestedValues = input.groups.flatMap((group) =>
      group.type === "number"
        ? []
        : group.values.map((value, position) => {
            return { groupKey: group.key, position, value };
          })
    );
    const requestedValueIds = requestedValues.map(({ value }) => value.id);
    if (requestedValueIds.length > 0) {
      const existingRequestedValues = await tx
        .select({ id: optionValue.id, productId: optionValue.productId })
        .from(optionValue)
        .where(inArray(optionValue.id, requestedValueIds));
      const foreignValue = existingRequestedValues.find((value) => value.productId !== current.id);
      if (foreignValue) {
        return {
          issues: [validationIssue("Option Value ID belongs to another Product", ["groups"])],
          kind: "invalid"
        } as const;
      }
    }

    for (const { groupKey, value } of requestedValues) {
      const previousGroupKey = currentValueGroupKey.get(value.id);
      if (previousGroupKey !== undefined && previousGroupKey !== groupKey) {
        return {
          issues: [
            validationIssue("An existing Option Value cannot move to another Option Group", [
              "groups"
            ])
          ],
          kind: "invalid"
        } as const;
      }
    }

    const componentIds = [...new Set(requestedValues.flatMap(({ value }) => value.componentIds))];
    if (componentIds.length > 0) {
      const componentRows = await tx
        .select({ id: component.id })
        .from(component)
        .where(
          and(
            eq(component.organizationId, input.organizationId),
            inArray(component.id, componentIds)
          )
        );
      if (componentRows.length !== componentIds.length) {
        return {
          issues: [
            validationIssue("Every linked Component must belong to this Organization", ["groups"])
          ],
          kind: "invalid"
        } as const;
      }
    }

    await tx.delete(optionGroup).where(eq(optionGroup.productId, current.id));

    const groupRows = input.groups.map((group, position) => {
      return {
        additionalUnitPriceMinor:
          group.type === "number" ? (currentNumericPrice.get(group.key) ?? null) : null,
        id: crypto.randomUUID(),
        included: group.type === "number" ? group.included : null,
        key: group.key,
        label: group.label,
        maximum: group.type === "number" ? group.maximum : null,
        minimum: group.type === "number" ? group.minimum : null,
        position,
        productId: current.id,
        required: group.required,
        step: group.type === "number" ? group.step : null,
        type: group.type
      };
    });
    if (groupRows.length > 0) await tx.insert(optionGroup).values(groupRows);
    const groupIdByKey = new Map(groupRows.map((group) => [group.key, group.id]));

    const valueRows = requestedValues.map(({ groupKey, position, value }) => {
      return {
        id: value.id,
        imageUrl: value.imageUrl,
        label: value.label,
        optionGroupId: groupIdByKey.get(groupKey) ?? "",
        organizationId: input.organizationId,
        position,
        priceAdjustmentMinor: currentValuePrice.get(value.id) ?? null,
        productId: current.id
      };
    });
    if (valueRows.some((value) => !value.optionGroupId)) {
      throw new Error("Product configuration contains an unmapped Option Group");
    }
    if (valueRows.length > 0) await tx.insert(optionValue).values(valueRows);

    const requirementRows = requestedValues.flatMap(({ value }) =>
      value.requirements.flatMap((requirement) =>
        requirement.optionValueIds.map((prerequisiteOptionValueId) => {
          return {
            optionValueId: value.id,
            prerequisiteOptionValueId,
            productId: current.id
          };
        })
      )
    );
    if (requirementRows.length > 0) {
      await tx.insert(optionValueRequirement).values(requirementRows);
    }
    const componentLinkRows = requestedValues.flatMap(({ value }) =>
      value.componentIds.map((componentId) => {
        return {
          componentId,
          optionValueId: value.id,
          organizationId: input.organizationId
        };
      })
    );
    if (componentLinkRows.length > 0) {
      await tx.insert(optionValueComponent).values(componentLinkRows);
    }

    const editor = await loadProductEditor(tx, {
      organizationId: input.organizationId,
      productId: current.id
    });
    if (!editor) throw new Error("Updated Product could not be loaded");
    // A published Product whose new definition no longer validates falls back to
    // draft. Fold that into the single revision bump so `revision` advances by one
    // (a bare `set({ status })` would re-trigger the column's `$onUpdate` and bump twice).
    const downgraded = current.status === "published" && editor.validationIssues.length > 0;
    const updatedRows = await tx
      .update(product)
      .set({
        revision: sql`${product.revision} + 1`,
        status: downgraded ? "draft" : current.status
      })
      .where(and(eq(product.id, current.id), eq(product.organizationId, input.organizationId)))
      .returning({ revision: product.revision });
    const updated = updatedRows[0];
    if (!updated) throw new Error("Product configuration update returned no row");

    if (downgraded) {
      await tx.insert(auditEvent).values({
        action: "product.status_changed",
        actorUserId: input.actorUserId,
        entityId: current.id,
        entityType: "product",
        metadata: { from: current.status, reason: "configuration_invalidated", to: "draft" },
        organizationId: input.organizationId
      });
    }
    await tx.insert(auditEvent).values({
      action: "product.configuration_edited",
      actorUserId: input.actorUserId,
      entityId: current.id,
      entityType: "product",
      metadata: { groupCount: input.groups.length, valueCount: requestedValues.length },
      organizationId: input.organizationId
    });
    return { id: current.id, kind: "updated", revision: updated.revision } as const;
  });
}

export async function editProductPricing(
  db: Pick<Database, "transaction">,
  input: Omit<ProductEditPricingInput, "organizationSlug"> & {
    actorUserId: string;
    organizationId: string;
  }
) {
  return db.transaction(async (tx) => {
    const current = await lockProduct(tx, input);
    if (!current) return { kind: "not_found" } as const;
    const conflict = checkRevision(current.revision, input.expectedRevision);
    if (conflict) return conflict;

    const groups = await tx.select().from(optionGroup).where(eq(optionGroup.productId, current.id));
    const groupIds = groups.map((group) => group.id);
    const values =
      groupIds.length === 0
        ? []
        : await tx.select().from(optionValue).where(inArray(optionValue.optionGroupId, groupIds));
    const expectedNumericKeys = groups
      .filter((group) => group.type === "number")
      .map((group) => group.key);
    const requestedNumericKeys = new Set(input.numericGroupPrices.map((entry) => entry.groupKey));
    const requestedValueIds = new Set(input.optionValuePrices.map((entry) => entry.optionValueId));
    if (
      expectedNumericKeys.length !== requestedNumericKeys.size ||
      expectedNumericKeys.some((key) => !requestedNumericKeys.has(key)) ||
      values.length !== requestedValueIds.size ||
      values.some((value) => !requestedValueIds.has(value.id))
    ) {
      return {
        issues: [
          validationIssue("Pricing must include every numeric Group and discrete Option Value", [
            "pricing"
          ])
        ],
        kind: "invalid"
      } as const;
    }

    for (const entry of input.numericGroupPrices) {
      await tx
        .update(optionGroup)
        .set({ additionalUnitPriceMinor: entry.additionalUnitPriceMinor })
        .where(and(eq(optionGroup.productId, current.id), eq(optionGroup.key, entry.groupKey)));
    }
    for (const entry of input.optionValuePrices) {
      await tx
        .update(optionValue)
        .set({ priceAdjustmentMinor: entry.priceAdjustmentMinor })
        .where(and(eq(optionValue.productId, current.id), eq(optionValue.id, entry.optionValueId)));
    }
    const updatedRows = await tx
      .update(product)
      .set({
        basePriceMinor: input.basePriceMinor,
        revision: sql`${product.revision} + 1`
      })
      .where(and(eq(product.id, current.id), eq(product.organizationId, input.organizationId)))
      .returning({ revision: product.revision });
    const updated = updatedRows[0];
    if (!updated) throw new Error("Product pricing update returned no row");

    await tx.insert(auditEvent).values({
      action: "product.pricing_edited",
      actorUserId: input.actorUserId,
      entityId: current.id,
      entityType: "product",
      metadata: {
        basePriceMinor: { from: current.basePriceMinor, to: input.basePriceMinor },
        numericGroupKeys: input.numericGroupPrices.map((entry) => entry.groupKey),
        optionValueIds: input.optionValuePrices.map((entry) => entry.optionValueId)
      },
      organizationId: input.organizationId
    });
    return { id: current.id, kind: "updated", revision: updated.revision } as const;
  });
}

export async function publishProduct(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    expectedRevision: ProductRevision;
    organizationId: string;
    productSlug: string;
  }
) {
  return db.transaction(async (tx) => {
    const current = await lockProduct(tx, input);
    if (!current) return { kind: "not_found" } as const;
    const conflict = checkRevision(current.revision, input.expectedRevision);
    if (conflict) return conflict;

    const editor = await loadProductEditor(tx, {
      organizationId: input.organizationId,
      productId: current.id
    });
    if (!editor) throw new Error("Locked Product could not be loaded");
    const definition = parseProductEditorDefinition(editor);
    if (!definition.success) return { issues: definition.issues, kind: "invalid" } as const;

    const updated = await setProductStatus(tx, {
      actorUserId: input.actorUserId,
      currentId: current.id,
      from: current.status,
      organizationId: input.organizationId,
      status: "published"
    });
    return { id: current.id, kind: "updated", revision: updated.revision } as const;
  });
}

export async function archiveProduct(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    expectedRevision: ProductRevision;
    organizationId: string;
    productSlug: string;
  }
) {
  return db.transaction(async (tx) => {
    const current = await lockProduct(tx, input);
    if (!current) return { kind: "not_found" } as const;
    const conflict = checkRevision(current.revision, input.expectedRevision);
    if (conflict) return conflict;
    const updated = await setProductStatus(tx, {
      actorUserId: input.actorUserId,
      currentId: current.id,
      from: current.status,
      organizationId: input.organizationId,
      status: "archived"
    });
    return { id: current.id, kind: "updated", revision: updated.revision } as const;
  });
}

async function setProductStatus(
  tx: Transaction,
  input: {
    actorUserId: string;
    currentId: string;
    from: ProductStatus;
    organizationId: string;
    status: ProductStatus;
  }
) {
  const rows = await tx
    .update(product)
    .set({ revision: sql`${product.revision} + 1`, status: input.status })
    .where(and(eq(product.id, input.currentId), eq(product.organizationId, input.organizationId)))
    .returning({ revision: product.revision });
  const updated = rows[0];
  if (!updated) throw new Error("Product status update returned no row");
  await tx.insert(auditEvent).values({
    action: "product.status_changed",
    actorUserId: input.actorUserId,
    entityId: input.currentId,
    entityType: "product",
    metadata: { from: input.from, to: input.status },
    organizationId: input.organizationId
  });
  return updated;
}

export async function removeProduct(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    expectedRevision: ProductRevision;
    organizationId: string;
    productSlug: string;
  }
) {
  return db.transaction(async (tx) => {
    const current = await lockProduct(tx, input);
    if (!current) return { kind: "not_found" } as const;
    const conflict = checkRevision(current.revision, input.expectedRevision);
    if (conflict) return conflict;

    const draftReferences = await tx
      .select({ id: configurationDraft.id })
      .from(configurationDraft)
      .where(
        and(
          eq(configurationDraft.organizationId, input.organizationId),
          eq(configurationDraft.productId, current.id)
        )
      )
      .limit(1);
    const orderReferences = await tx
      .select({ id: customerOrder.id })
      .from(customerOrder)
      .where(
        and(
          eq(customerOrder.organizationId, input.organizationId),
          eq(customerOrder.productId, current.id)
        )
      )
      .limit(1);
    if (draftReferences[0] || orderReferences[0]) {
      await setProductStatus(tx, {
        actorUserId: input.actorUserId,
        currentId: current.id,
        from: current.status,
        organizationId: input.organizationId,
        status: "archived"
      });
      return { id: current.id, kind: "archived" } as const;
    }

    await tx.insert(auditEvent).values({
      action: "product.deleted",
      actorUserId: input.actorUserId,
      entityId: current.id,
      entityType: "product",
      metadata: { slug: current.slug },
      organizationId: input.organizationId
    });
    await tx
      .delete(product)
      .where(and(eq(product.id, current.id), eq(product.organizationId, input.organizationId)));
    return { id: current.id, kind: "deleted" } as const;
  });
}
