import { z } from "zod";

import {
  ConfigurationEvaluationSchema,
  ConfigurationSelectionsSchema,
  CurrencyCodeSchema,
  MAX_OPTION_GROUP_KEY_LENGTH,
  MAX_PRODUCT_OPTION_GROUPS,
  MinorUnitAmountSchema,
  OptionGroupKeySchema,
  OptionValueIdSchema
} from "@tsu-stack/contract/configuration";
import { OrgSlugInputSchema } from "@tsu-stack/contract/organization";

const IdSchema = z.string().min(1);
const ProductNameSchema = z.string().trim().min(1).max(200);
const ProductDescriptionSchema = z.string().trim().max(5_000).nullable();
const ProductImageUrlSchema = z.string().trim().min(1).max(2_048);
const ProductImageUrlsSchema = z
  .array(ProductImageUrlSchema)
  .max(20)
  .refine((imageUrls) => new Set(imageUrls).size === imageUrls.length, {
    message: "Product image URLs must be unique"
  });
const ProductLabelSchema = z.string().trim().min(1).max(200);

export const ProductSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Product slug must use lowercase kebab-case");
export const ProductRevisionSchema = z.number().int().positive();
export const ProductStatusSchema = z.enum(["draft", "published", "archived"]);

const EditorRequirementSchema = z
  .object({
    groupKey: OptionGroupKeySchema,
    optionValueIds: z.array(OptionValueIdSchema).min(1)
  })
  .strict();

const EditorOptionValueSchema = z
  .object({
    componentIds: z.array(IdSchema),
    id: OptionValueIdSchema,
    imageUrl: ProductImageUrlSchema.nullable(),
    label: ProductLabelSchema,
    requirements: z.array(EditorRequirementSchema)
  })
  .strict();

const CommonEditorGroupFields = {
  key: z.string().trim().min(1).max(MAX_OPTION_GROUP_KEY_LENGTH),
  label: ProductLabelSchema,
  required: z.boolean()
};

const EditorOptionGroupSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...CommonEditorGroupFields,
      type: z.literal("single"),
      values: z.array(EditorOptionValueSchema)
    })
    .strict(),
  z
    .object({
      ...CommonEditorGroupFields,
      type: z.literal("boolean"),
      values: z.array(EditorOptionValueSchema)
    })
    .strict(),
  z
    .object({
      ...CommonEditorGroupFields,
      included: z.number().int().nonnegative(),
      maximum: z.number().int().nonnegative(),
      minimum: z.number().int().nonnegative(),
      step: z.number().int().positive(),
      type: z.literal("number")
    })
    .strict()
]);

function validateEditorGroups(
  groups: z.infer<typeof EditorOptionGroupSchema>[],
  context: z.RefinementCtx
) {
  const groupKeys = new Set<string>();
  const allValueIds = new Set<string>();
  const previousValuesByGroup = new Map<string, Set<string>>();

  for (const [groupIndex, group] of groups.entries()) {
    if (groupKeys.has(group.key)) {
      context.addIssue({
        code: "custom",
        message: "Option Group keys must be unique",
        path: [groupIndex, "key"]
      });
    }
    groupKeys.add(group.key);

    if (group.type === "number") {
      if (group.minimum > group.maximum) {
        context.addIssue({
          code: "custom",
          message: "Numeric minimum must not exceed maximum",
          path: [groupIndex, "minimum"]
        });
      }
      if (group.included < group.minimum || group.included > group.maximum) {
        context.addIssue({
          code: "custom",
          message: "Numeric included value must be within minimum and maximum",
          path: [groupIndex, "included"]
        });
      }
      if ((group.maximum - group.minimum) % group.step !== 0) {
        context.addIssue({
          code: "custom",
          message: "Numeric maximum must align to step from minimum",
          path: [groupIndex, "maximum"]
        });
      }
      if ((group.included - group.minimum) % group.step !== 0) {
        context.addIssue({
          code: "custom",
          message: "Numeric included value must align to step from minimum",
          path: [groupIndex, "included"]
        });
      }
      continue;
    }

    const valueIds = new Set<string>();
    for (const [valueIndex, value] of group.values.entries()) {
      if (allValueIds.has(value.id)) {
        context.addIssue({
          code: "custom",
          message: "Option Value IDs must be unique across the Product",
          path: [groupIndex, "values", valueIndex, "id"]
        });
      }
      allValueIds.add(value.id);
      valueIds.add(value.id);

      const componentIds = new Set<string>();
      for (const [componentIndex, componentId] of value.componentIds.entries()) {
        if (componentIds.has(componentId)) {
          context.addIssue({
            code: "custom",
            message: "Component IDs must be unique within an Option Value",
            path: [groupIndex, "values", valueIndex, "componentIds", componentIndex]
          });
        }
        componentIds.add(componentId);
      }

      const requirementGroupKeys = new Set<string>();
      for (const [requirementIndex, requirement] of value.requirements.entries()) {
        if (requirementGroupKeys.has(requirement.groupKey)) {
          context.addIssue({
            code: "custom",
            message: "Requirement group keys must be unique within an Option Value",
            path: [groupIndex, "values", valueIndex, "requirements", requirementIndex, "groupKey"]
          });
        }
        requirementGroupKeys.add(requirement.groupKey);

        const prerequisiteValues = previousValuesByGroup.get(requirement.groupKey);
        for (const [optionValueIndex, optionValueId] of requirement.optionValueIds.entries()) {
          if (!prerequisiteValues?.has(optionValueId)) {
            context.addIssue({
              code: "custom",
              message: "Requirements must reference Option Values in an earlier group",
              path: [
                groupIndex,
                "values",
                valueIndex,
                "requirements",
                requirementIndex,
                "optionValueIds",
                optionValueIndex
              ]
            });
          }
        }
        if (new Set(requirement.optionValueIds).size !== requirement.optionValueIds.length) {
          context.addIssue({
            code: "custom",
            message: "Requirement Option Value IDs must be unique within a clause",
            path: [
              groupIndex,
              "values",
              valueIndex,
              "requirements",
              requirementIndex,
              "optionValueIds"
            ]
          });
        }
      }
    }
    previousValuesByGroup.set(group.key, valueIds);
  }
}

export const ProductEditorConfigurationSchema = z
  .array(EditorOptionGroupSchema)
  .max(MAX_PRODUCT_OPTION_GROUPS)
  .superRefine(validateEditorGroups);

export const ProductContentSchema = z
  .object({
    description: ProductDescriptionSchema,
    imageUrls: ProductImageUrlsSchema,
    name: ProductNameSchema,
    slug: ProductSlugSchema
  })
  .strict();

const ProductLocatorSchema = OrgSlugInputSchema.extend({
  productSlug: ProductSlugSchema
}).strict();

const VersionedProductLocatorSchema = ProductLocatorSchema.extend({
  expectedRevision: ProductRevisionSchema
}).strict();

export const ProductListInputSchema = OrgSlugInputSchema.extend({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).default(""),
  status: ProductStatusSchema.optional()
}).strict();
export const ProductBySlugInputSchema = ProductLocatorSchema;
export const ProductCreateInputSchema = OrgSlugInputSchema.extend(
  ProductContentSchema.shape
).strict();
export const ProductEditContentInputSchema = VersionedProductLocatorSchema.extend(
  ProductContentSchema.shape
).strict();
export const ProductEditConfigurationInputSchema = VersionedProductLocatorSchema.extend({
  groups: ProductEditorConfigurationSchema
}).strict();

const NumericGroupPriceSchema = z
  .object({
    additionalUnitPriceMinor: MinorUnitAmountSchema.nonnegative(),
    groupKey: OptionGroupKeySchema
  })
  .strict();
const OptionValuePriceSchema = z
  .object({
    optionValueId: OptionValueIdSchema,
    priceAdjustmentMinor: MinorUnitAmountSchema.nonnegative()
  })
  .strict();

export const ProductEditPricingInputSchema = VersionedProductLocatorSchema.extend({
  basePriceMinor: MinorUnitAmountSchema.nonnegative(),
  numericGroupPrices: z.array(NumericGroupPriceSchema),
  optionValuePrices: z.array(OptionValuePriceSchema)
})
  .strict()
  .superRefine((input, context) => {
    if (
      new Set(input.numericGroupPrices.map((entry) => entry.groupKey)).size !==
      input.numericGroupPrices.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Numeric Group pricing targets must be unique",
        path: ["numericGroupPrices"]
      });
    }
    if (
      new Set(input.optionValuePrices.map((entry) => entry.optionValueId)).size !==
      input.optionValuePrices.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Option Value pricing targets must be unique",
        path: ["optionValuePrices"]
      });
    }
  });

export const ProductPreviewInputSchema = ProductLocatorSchema.extend({
  quantity: z.number(),
  selections: ConfigurationSelectionsSchema
}).strict();
export const ProductPublishInputSchema = VersionedProductLocatorSchema;
export const ProductArchiveInputSchema = VersionedProductLocatorSchema;
export const ProductRemoveInputSchema = VersionedProductLocatorSchema;

const EditorOutputOptionValueSchema = EditorOptionValueSchema.extend({
  priceAdjustmentMinor: MinorUnitAmountSchema.nonnegative().nullable()
}).strict();
const EditorOutputGroupSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...CommonEditorGroupFields,
      type: z.literal("single"),
      values: z.array(EditorOutputOptionValueSchema)
    })
    .strict(),
  z
    .object({
      ...CommonEditorGroupFields,
      type: z.literal("boolean"),
      values: z.array(EditorOutputOptionValueSchema)
    })
    .strict(),
  z
    .object({
      ...CommonEditorGroupFields,
      additionalUnitPriceMinor: MinorUnitAmountSchema.nonnegative().nullable(),
      included: z.number().int().nonnegative(),
      maximum: z.number().int().nonnegative(),
      minimum: z.number().int().nonnegative(),
      step: z.number().int().positive(),
      type: z.literal("number")
    })
    .strict()
]);

export const ProductDefinitionValidationIssueSchema = z.object({
  message: z.string().min(1),
  path: z.array(z.union([z.string(), z.number()]))
});

export const ProductListItemSchema = z.object({
  basePriceMinor: MinorUnitAmountSchema.nonnegative().nullable(),
  name: ProductNameSchema,
  revision: ProductRevisionSchema,
  slug: ProductSlugSchema,
  status: ProductStatusSchema,
  thumbnailUrl: ProductImageUrlSchema.nullable()
});

export const ProductListResultSchema = z.object({
  counts: z.object({
    archived: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    published: z.number().int().nonnegative()
  }),
  items: z.array(ProductListItemSchema),
  page: z.number().int().positive(),
  pageCount: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative()
});

export const ProductEditorSchema = z.object({
  basePriceMinor: MinorUnitAmountSchema.nonnegative().nullable(),
  currency: CurrencyCodeSchema,
  description: ProductDescriptionSchema,
  groups: z.array(EditorOutputGroupSchema).max(MAX_PRODUCT_OPTION_GROUPS),
  id: IdSchema,
  imageUrls: ProductImageUrlsSchema,
  name: ProductNameSchema,
  revision: ProductRevisionSchema,
  slug: ProductSlugSchema,
  status: ProductStatusSchema,
  validationIssues: z.array(ProductDefinitionValidationIssueSchema)
});

export const ProductPreviewResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("incomplete"),
    issues: z.array(ProductDefinitionValidationIssueSchema).min(1)
  }),
  z.object({ kind: z.literal("evaluation"), evaluation: ConfigurationEvaluationSchema })
]);

export const ProductRemoveResultSchema = z.object({
  id: IdSchema,
  result: z.enum(["archived", "deleted"])
});

export type ProductSlug = z.infer<typeof ProductSlugSchema>;
export type ProductRevision = z.infer<typeof ProductRevisionSchema>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type ProductContent = z.infer<typeof ProductContentSchema>;
export type ProductEditorConfiguration = z.infer<typeof ProductEditorConfigurationSchema>;
export type ProductListInput = z.infer<typeof ProductListInputSchema>;
export type ProductBySlugInput = z.infer<typeof ProductBySlugInputSchema>;
export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;
export type ProductEditContentInput = z.infer<typeof ProductEditContentInputSchema>;
export type ProductEditConfigurationInput = z.infer<typeof ProductEditConfigurationInputSchema>;
export type ProductEditPricingInput = z.infer<typeof ProductEditPricingInputSchema>;
export type ProductPreviewInput = z.infer<typeof ProductPreviewInputSchema>;
export type ProductPublishInput = z.infer<typeof ProductPublishInputSchema>;
export type ProductArchiveInput = z.infer<typeof ProductArchiveInputSchema>;
export type ProductRemoveInput = z.infer<typeof ProductRemoveInputSchema>;
export type ProductRemoveResult = z.infer<typeof ProductRemoveResultSchema>;
export type ProductListItem = z.infer<typeof ProductListItemSchema>;
export type ProductListResult = z.infer<typeof ProductListResultSchema>;
export type ProductEditor = z.infer<typeof ProductEditorSchema>;
export type ProductDefinitionValidationIssue = z.infer<
  typeof ProductDefinitionValidationIssueSchema
>;
export type ProductPreviewResult = z.infer<typeof ProductPreviewResultSchema>;
