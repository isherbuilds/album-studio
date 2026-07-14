import { and, asc, eq, inArray } from "drizzle-orm";

import {
  type ComponentAvailability,
  type ProductDefinition,
  ProductDefinitionSchema
} from "@tsu-stack/contract/configuration";
import {
  type ProductDefinitionValidationIssue,
  type ProductEditor,
  ProductEditorSchema,
  type ProductListItem
} from "@tsu-stack/contract/product";
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

import { computeEffectiveAvailability } from "#@/inventory/queries";

export async function listProducts(
  db: DatabaseOrTransaction,
  input: { organizationId: string }
): Promise<ProductListItem[]> {
  const rows = await db
    .select({
      basePriceMinor: product.basePriceMinor,
      imageUrls: product.imageUrls,
      name: product.name,
      revision: product.revision,
      slug: product.slug,
      status: product.status
    })
    .from(product)
    .where(eq(product.organizationId, input.organizationId))
    .orderBy(asc(product.name), asc(product.slug));

  return rows.map((row) => {
    return {
      basePriceMinor: row.basePriceMinor,
      name: row.name,
      revision: row.revision,
      slug: row.slug,
      status: row.status,
      thumbnailUrl: row.imageUrls[0] ?? null
    };
  });
}

export async function loadProductEditor(
  db: DatabaseOrTransaction,
  input: { organizationId: string } & ({ productId: string } | { productSlug: string })
): Promise<ProductEditor | undefined> {
  const locator =
    "productId" in input ? eq(product.id, input.productId) : eq(product.slug, input.productSlug);
  const productRows = await db
    .select({
      basePriceMinor: product.basePriceMinor,
      currency: organization.currency,
      description: product.description,
      id: product.id,
      imageUrls: product.imageUrls,
      name: product.name,
      revision: product.revision,
      slug: product.slug,
      status: product.status
    })
    .from(product)
    .innerJoin(organization, eq(organization.id, product.organizationId))
    .where(and(eq(product.organizationId, input.organizationId), locator))
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
    groupIds.length === 0
      ? []
      : await db
          .select()
          .from(optionValue)
          .where(inArray(optionValue.optionGroupId, groupIds))
          .orderBy(asc(optionValue.optionGroupId), asc(optionValue.position), asc(optionValue.id));
  const valueIds = valueRows.map((value) => value.id);
  const [requirementRows, componentLinkRows] =
    valueIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select()
            .from(optionValueRequirement)
            .where(inArray(optionValueRequirement.optionValueId, valueIds)),
          db
            .select()
            .from(optionValueComponent)
            .where(inArray(optionValueComponent.optionValueId, valueIds))
        ]);

  const groupById = new Map(groupRows.map((group) => [group.id, group]));
  const valueById = new Map(valueRows.map((value) => [value.id, value]));
  const requirementValuesByOwnerAndGroup = new Map<string, Map<string, string[]>>();
  for (const requirement of requirementRows) {
    const prerequisite = valueById.get(requirement.prerequisiteOptionValueId);
    const prerequisiteGroup = prerequisite ? groupById.get(prerequisite.optionGroupId) : undefined;
    const owner = valueById.get(requirement.optionValueId);
    if (!prerequisite || !prerequisiteGroup || !owner) {
      throw new Error(`Product ${productRow.id} contains an invalid Option Value requirement`);
    }
    const byGroup = requirementValuesByOwnerAndGroup.get(owner.id) ?? new Map<string, string[]>();
    const values = byGroup.get(prerequisiteGroup.key) ?? [];
    values.push(prerequisite.id);
    byGroup.set(prerequisiteGroup.key, values);
    requirementValuesByOwnerAndGroup.set(owner.id, byGroup);
  }

  const requirementsByValue = new Map<string, { groupKey: string; optionValueIds: string[] }[]>();
  for (const [valueId, byGroup] of requirementValuesByOwnerAndGroup) {
    requirementsByValue.set(
      valueId,
      groupRows.flatMap((group) => {
        const optionValueIds = byGroup.get(group.key);
        return optionValueIds ? [{ groupKey: group.key, optionValueIds }] : [];
      })
    );
  }

  const componentIdsByValue = new Map<string, string[]>();
  for (const link of componentLinkRows) {
    const componentIds = componentIdsByValue.get(link.optionValueId) ?? [];
    componentIds.push(link.componentId);
    componentIdsByValue.set(link.optionValueId, componentIds);
  }

  const valuesByGroup = new Map<string, (typeof valueRows)[number][]>();
  for (const value of valueRows) {
    const values = valuesByGroup.get(value.optionGroupId) ?? [];
    values.push(value);
    valuesByGroup.set(value.optionGroupId, values);
  }

  const groups = groupRows.map((group) => {
    if (group.type === "number") {
      if (
        group.included === null ||
        group.maximum === null ||
        group.minimum === null ||
        group.step === null
      ) {
        throw new Error(`Numeric Option Group ${group.id} has incomplete bounds`);
      }
      return {
        additionalUnitPriceMinor: group.additionalUnitPriceMinor,
        included: group.included,
        key: group.key,
        label: group.label,
        maximum: group.maximum,
        minimum: group.minimum,
        required: group.required,
        step: group.step,
        type: "number" as const
      };
    }
    return {
      key: group.key,
      label: group.label,
      required: group.required,
      type: group.type,
      values: (valuesByGroup.get(group.id) ?? []).map((value) => {
        return {
          componentIds: componentIdsByValue.get(value.id) ?? [],
          id: value.id,
          imageUrl: value.imageUrl,
          label: value.label,
          priceAdjustmentMinor: value.priceAdjustmentMinor,
          requirements: requirementsByValue.get(value.id) ?? []
        };
      })
    };
  });

  const editorWithoutIssues = {
    basePriceMinor: productRow.basePriceMinor,
    currency: productRow.currency,
    description: productRow.description,
    groups,
    id: productRow.id,
    imageUrls: productRow.imageUrls,
    name: productRow.name,
    revision: productRow.revision,
    slug: productRow.slug,
    status: productRow.status
  };
  const validationIssues = validateProductEditorDefinition({
    ...editorWithoutIssues,
    currency: ProductEditorSchema.shape.currency.parse(productRow.currency)
  });

  return ProductEditorSchema.parse({ ...editorWithoutIssues, validationIssues });
}

export function parseProductEditorDefinition(
  editor: ProductEditor
):
  | { definition: ProductDefinition; issues: []; success: true }
  | { issues: ProductDefinitionValidationIssue[]; success: false } {
  const result = ProductDefinitionSchema.safeParse({
    basePriceMinor: editor.basePriceMinor,
    groups: editor.groups,
    id: editor.id
  });
  if (result.success) return { definition: result.data, issues: [], success: true };
  return {
    issues: result.error.issues.map((issue) => {
      return {
        message: issue.message,
        path: issue.path.map((part) => (typeof part === "symbol" ? String(part) : part))
      };
    }),
    success: false
  };
}

function validateProductEditorDefinition(
  editor: Omit<ProductEditor, "validationIssues">
): ProductDefinitionValidationIssue[] {
  return parseProductEditorDefinition({ ...editor, validationIssues: [] } as ProductEditor).issues;
}

export async function loadProductAvailability(
  db: DatabaseOrTransaction,
  input: { editor: ProductEditor; organizationId: string }
): Promise<ComponentAvailability> {
  const componentIds = [
    ...new Set(
      input.editor.groups.flatMap((group) =>
        group.type === "number" ? [] : group.values.flatMap((value) => value.componentIds)
      )
    )
  ];
  if (componentIds.length === 0) return {};
  const rows = await db
    .select()
    .from(component)
    .where(
      and(eq(component.organizationId, input.organizationId), inArray(component.id, componentIds))
    );
  if (rows.length !== componentIds.length) {
    throw new Error(`Product ${input.editor.id} references a Component outside its Organization`);
  }
  return Object.fromEntries(rows.map((row) => [row.id, computeEffectiveAvailability(row)]));
}
