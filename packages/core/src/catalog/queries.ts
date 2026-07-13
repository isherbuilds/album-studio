import { and, asc, eq, inArray } from "drizzle-orm";

import {
  type PublicProductDefinition,
  type PublicProductSummary
} from "@tsu-stack/contract/catalog";
import {
  type ComponentAvailability,
  type ComponentAvailabilityStatus,
  CurrencyCodeSchema,
  type OptionValueRequirement,
  ProductDefinitionSchema
} from "@tsu-stack/contract/configuration";
import { type DatabaseOrTransaction } from "@tsu-stack/db";
import {
  component,
  optionGroup,
  optionValue,
  optionValueComponent,
  optionValueRequirement,
  organization,
  product
} from "@tsu-stack/db/schema";

/**
 * Derives a Component's effective availability: an explicit override wins; under
 * `automatic`, qty <= 0 is `out`, qty <= threshold is `low`, else `available`.
 */
export function computeEffectiveAvailability(
  input: Pick<
    typeof component.$inferSelect,
    "availabilityOverride" | "lowStockThreshold" | "quantity"
  >
): ComponentAvailabilityStatus {
  if (input.availabilityOverride !== "automatic") return input.availabilityOverride;
  const qty = Number(input.quantity);
  const threshold = Number(input.lowStockThreshold);
  if (qty <= 0) return "out";
  if (qty <= threshold) return "low";
  return "available";
}

/**
 * Lists an Organization's published Products as customer-facing catalog cards in
 * one query, joined to the Organization for its display currency. Ordered by name
 * then slug for a deterministic listing.
 */
export async function listPublishedProductSummaries(
  db: DatabaseOrTransaction,
  input: { organizationId: string }
): Promise<PublicProductSummary[]> {
  const rows = await db
    .select({
      slug: product.slug,
      name: product.name,
      imageUrls: product.imageUrls,
      basePriceMinor: product.basePriceMinor,
      currency: organization.currency
    })
    .from(product)
    .innerJoin(organization, eq(organization.id, product.organizationId))
    .where(and(eq(product.organizationId, input.organizationId), eq(product.status, "published")))
    .orderBy(asc(product.name), asc(product.slug));

  return rows.map((row) => {
    return {
      slug: row.slug,
      name: row.name,
      thumbnailUrl: row.imageUrls[0] ?? null,
      basePriceMinor: row.basePriceMinor,
      currency: CurrencyCodeSchema.parse(row.currency)
    };
  });
}

/**
 * Loads one published Product as a complete, evaluator-ready catalog definition,
 * or `undefined` when none matches (the router maps that to NOT_FOUND). Fixed
 * batched queries, no N+1; `availability` covers every referenced Component
 * (a missing one throws); raw stock fields never leave this layer.
 */
export async function loadPublicProductDefinition(
  db: DatabaseOrTransaction,
  input:
    | { organizationId: string; productId: string }
    | { organizationId: string; productSlug: string }
): Promise<PublicProductDefinition | undefined> {
  const productLocator =
    "productId" in input ? eq(product.id, input.productId) : eq(product.slug, input.productSlug);
  const productRows = await db
    .select({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      imageUrls: product.imageUrls,
      basePriceMinor: product.basePriceMinor,
      currency: organization.currency
    })
    .from(product)
    .innerJoin(organization, eq(organization.id, product.organizationId))
    .where(
      and(
        eq(product.organizationId, input.organizationId),
        productLocator,
        eq(product.status, "published")
      )
    )
    .limit(1);

  const productRow = productRows[0];
  if (!productRow) return undefined;

  const groupRows = await db
    .select()
    .from(optionGroup)
    .where(eq(optionGroup.productId, productRow.id))
    .orderBy(asc(optionGroup.position));

  const groupIds = groupRows.map((group) => group.id);
  const valueRows =
    groupIds.length > 0
      ? await db
          .select()
          .from(optionValue)
          .where(inArray(optionValue.optionGroupId, groupIds))
          .orderBy(asc(optionValue.optionGroupId), asc(optionValue.position), asc(optionValue.id))
      : [];

  // Requirement edges and component links both key off valueIds and don't depend on
  // each other — fetch them in one round-trip instead of two serial awaits.
  const valueIds = valueRows.map((value) => value.id);
  const [requirementRows, valueComponentRows] = await Promise.all([
    valueIds.length > 0
      ? db
          .select()
          .from(optionValueRequirement)
          .where(inArray(optionValueRequirement.optionValueId, valueIds))
      : [],
    valueIds.length > 0
      ? db
          .select()
          .from(optionValueComponent)
          .where(inArray(optionValueComponent.optionValueId, valueIds))
      : []
  ]);

  const referencedComponentIds = [...new Set(valueComponentRows.map((link) => link.componentId))];
  const componentRows =
    referencedComponentIds.length > 0
      ? await db
          .select()
          .from(component)
          .where(
            and(
              inArray(component.id, referencedComponentIds),
              eq(component.organizationId, input.organizationId)
            )
          )
      : [];

  const groupById = new Map(groupRows.map((group) => [group.id, group]));
  const valueById = new Map(valueRows.map((value) => [value.id, value]));
  const requirementsByPrerequisite = new Map<string, typeof requirementRows>();
  for (const requirement of requirementRows) {
    const requirements =
      requirementsByPrerequisite.get(requirement.prerequisiteOptionValueId) ?? [];
    requirements.push(requirement);
    requirementsByPrerequisite.set(requirement.prerequisiteOptionValueId, requirements);
  }

  const requirementValuesByOwnerAndGroup = new Map<string, Map<string, string[]>>();
  let mappedRequirementCount = 0;
  for (const prerequisiteValue of valueRows) {
    for (const requirement of requirementsByPrerequisite.get(prerequisiteValue.id) ?? []) {
      const prerequisiteGroup = groupById.get(prerequisiteValue.optionGroupId);
      const ownerValue = valueById.get(requirement.optionValueId);
      const ownerGroup = ownerValue ? groupById.get(ownerValue.optionGroupId) : undefined;
      if (!prerequisiteGroup || !ownerGroup || prerequisiteGroup.position >= ownerGroup.position) {
        throw new Error(
          `Option Value ${requirement.optionValueId} has invalid prerequisite Option Value ${requirement.prerequisiteOptionValueId}`
        );
      }

      const requirementsByGroup =
        requirementValuesByOwnerAndGroup.get(requirement.optionValueId) ?? new Map();
      const optionValueIds = requirementsByGroup.get(prerequisiteGroup.key) ?? [];
      optionValueIds.push(requirement.prerequisiteOptionValueId);
      requirementsByGroup.set(prerequisiteGroup.key, optionValueIds);
      requirementValuesByOwnerAndGroup.set(requirement.optionValueId, requirementsByGroup);
      mappedRequirementCount += 1;
    }
  }
  if (mappedRequirementCount !== requirementRows.length) {
    throw new Error(
      `Product ${productRow.id} has a prerequisite Option Value outside its definition`
    );
  }

  const requirementsByValue = new Map<string, OptionValueRequirement[]>();
  for (const [optionValueId, requirementsByGroup] of requirementValuesByOwnerAndGroup) {
    requirementsByValue.set(
      optionValueId,
      groupRows.flatMap((group) => {
        const optionValueIds = requirementsByGroup.get(group.key);
        return optionValueIds ? [{ groupKey: group.key, optionValueIds }] : [];
      })
    );
  }

  const componentIdsByValue = new Map<string, string[]>();
  for (const link of valueComponentRows) {
    const componentIds = componentIdsByValue.get(link.optionValueId) ?? [];
    componentIds.push(link.componentId);
    componentIdsByValue.set(link.optionValueId, componentIds);
  }

  const valuesByGroup = new Map<string, unknown[]>();
  for (const value of valueRows) {
    const values = valuesByGroup.get(value.optionGroupId) ?? [];
    values.push({
      id: value.id,
      label: value.label,
      priceAdjustmentMinor: value.priceAdjustmentMinor,
      requirements: requirementsByValue.get(value.id) ?? [],
      componentIds: componentIdsByValue.get(value.id) ?? [],
      imageUrl: value.imageUrl ?? null
    });
    valuesByGroup.set(value.optionGroupId, values);
  }

  // Number-group numeric columns are nullable at the DB layer but non-null in
  // practice; a stray null flows straight into the parse below and fails loud.
  const groups = groupRows.map((group) =>
    group.type === "number"
      ? {
          type: "number",
          key: group.key,
          label: group.label,
          required: group.required,
          minimum: group.minimum,
          maximum: group.maximum,
          step: group.step,
          included: group.included,
          additionalUnitPriceMinor: group.additionalUnitPriceMinor
        }
      : {
          type: group.type,
          key: group.key,
          label: group.label,
          required: group.required,
          values: valuesByGroup.get(group.id) ?? []
        }
  );

  const definition = ProductDefinitionSchema.parse({
    id: productRow.id,
    basePriceMinor: productRow.basePriceMinor,
    groups
  });

  const availabilityByComponent = new Map(
    componentRows.map((row) => [row.id, computeEffectiveAvailability(row)])
  );
  const availability: ComponentAvailability = Object.fromEntries(
    referencedComponentIds.map((componentId) => {
      const status = availabilityByComponent.get(componentId);
      if (status === undefined) {
        throw new Error(`Missing Component ${componentId} for Product ${productRow.id}`);
      }
      return [componentId, status];
    })
  );

  return {
    slug: productRow.slug,
    name: productRow.name,
    description: productRow.description,
    imageUrls: productRow.imageUrls,
    currency: CurrencyCodeSchema.parse(productRow.currency),
    definition,
    availability
  };
}
