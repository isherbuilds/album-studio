import { z } from "zod";

const IdSchema = z.string().min(1);
const NonEmptyStringSchema = z.string().min(1);
const supportedCurrencyCodes =
  typeof Intl.supportedValuesOf === "function"
    ? new Set(Intl.supportedValuesOf("currency"))
    : undefined;

export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine(
    (currency) => supportedCurrencyCodes === undefined || supportedCurrencyCodes.has(currency),
    "Unsupported ISO 4217 currency code"
  )
  .brand<"CurrencyCode">();

export const MinorUnitAmountSchema = z.number().int();

export const MoneySchema = z.object({
  amountMinor: MinorUnitAmountSchema,
  currency: CurrencyCodeSchema
});

export const ComponentAvailabilityStatusSchema = z.enum(["available", "low", "out"]);

export const ComponentAvailabilitySchema = z.record(IdSchema, ComponentAvailabilityStatusSchema);

export const OptionValueRequirementSchema = z.object({
  groupKey: IdSchema,
  optionValueIds: z.array(IdSchema).min(1)
});

export const ProductOptionValueSchema = z.object({
  id: IdSchema,
  label: NonEmptyStringSchema,
  priceAdjustmentMinor: MinorUnitAmountSchema.nonnegative(),
  requirements: z.array(OptionValueRequirementSchema),
  componentIds: z.array(IdSchema),
  // Optional per-value preview image. Presentation-only: never read by the evaluator,
  // so it stays nullish and existing definitions/fixtures need not supply it.
  imageUrl: z.string().min(1).nullish()
});

const CommonOptionGroupFields = {
  key: IdSchema,
  label: NonEmptyStringSchema,
  required: z.boolean()
};

const DiscreteOptionGroupFields = {
  ...CommonOptionGroupFields,
  values: z.array(ProductOptionValueSchema).min(1)
};

export const ProductOptionGroupSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single"),
    ...DiscreteOptionGroupFields
  }),
  z.object({
    type: z.literal("boolean"),
    ...DiscreteOptionGroupFields,
    values: z.array(ProductOptionValueSchema).length(2)
  }),
  z.object({
    type: z.literal("number"),
    ...CommonOptionGroupFields,
    minimum: z.number().int().nonnegative(),
    maximum: z.number().int().nonnegative(),
    step: z.number().int().positive(),
    included: z.number().int().nonnegative(),
    additionalUnitPriceMinor: MinorUnitAmountSchema.nonnegative()
  })
]);

export const ProductDefinitionSchema = z
  .object({
    id: IdSchema,
    basePriceMinor: MinorUnitAmountSchema.nonnegative(),
    groups: z.array(ProductOptionGroupSchema)
  })
  .superRefine((product, context) => {
    const groupKeys = new Set<string>();
    const previousValuesByGroup = new Map<string, Set<string>>();

    for (const [groupIndex, group] of product.groups.entries()) {
      if (groupKeys.has(group.key)) {
        context.addIssue({
          code: "custom",
          message: "Option Group keys must be unique",
          path: ["groups", groupIndex, "key"]
        });
      }
      groupKeys.add(group.key);

      if (group.type === "number") {
        if (group.minimum > group.maximum) {
          context.addIssue({
            code: "custom",
            message: "Numeric minimum must not exceed maximum",
            path: ["groups", groupIndex, "minimum"]
          });
        }
        if (group.included < group.minimum || group.included > group.maximum) {
          context.addIssue({
            code: "custom",
            message: "Numeric included value must be within minimum and maximum",
            path: ["groups", groupIndex, "included"]
          });
        }
        if ((group.maximum - group.minimum) % group.step !== 0) {
          context.addIssue({
            code: "custom",
            message: "Numeric maximum must align to step from minimum",
            path: ["groups", groupIndex, "maximum"]
          });
        }
        if ((group.included - group.minimum) % group.step !== 0) {
          context.addIssue({
            code: "custom",
            message: "Numeric included value must align to step from minimum",
            path: ["groups", groupIndex, "included"]
          });
        }
        continue;
      }

      const valueIds = new Set<string>();
      for (const [valueIndex, value] of group.values.entries()) {
        if (valueIds.has(value.id)) {
          context.addIssue({
            code: "custom",
            message: "Option Value IDs must be unique within their group",
            path: ["groups", groupIndex, "values", valueIndex, "id"]
          });
        }
        valueIds.add(value.id);

        const componentIds = new Set<string>();
        for (const [componentIdIndex, componentId] of value.componentIds.entries()) {
          if (componentIds.has(componentId)) {
            context.addIssue({
              code: "custom",
              message: "Component IDs must be unique within an Option Value",
              path: ["groups", groupIndex, "values", valueIndex, "componentIds", componentIdIndex]
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
              path: [
                "groups",
                groupIndex,
                "values",
                valueIndex,
                "requirements",
                requirementIndex,
                "groupKey"
              ]
            });
          }
          requirementGroupKeys.add(requirement.groupKey);

          const prerequisiteValues = previousValuesByGroup.get(requirement.groupKey);
          const requirementOptionValueIds = new Set<string>();
          for (const [optionValueIdIndex, optionValueId] of requirement.optionValueIds.entries()) {
            if (requirementOptionValueIds.has(optionValueId)) {
              context.addIssue({
                code: "custom",
                message: "Requirement Option Value IDs must be unique within a clause",
                path: [
                  "groups",
                  groupIndex,
                  "values",
                  valueIndex,
                  "requirements",
                  requirementIndex,
                  "optionValueIds",
                  optionValueIdIndex
                ]
              });
            }
            requirementOptionValueIds.add(optionValueId);

            if (!prerequisiteValues?.has(optionValueId)) {
              context.addIssue({
                code: "custom",
                message: "Requirements must reference Option Values in an earlier group",
                path: [
                  "groups",
                  groupIndex,
                  "values",
                  valueIndex,
                  "requirements",
                  requirementIndex,
                  "optionValueIds",
                  optionValueIdIndex
                ]
              });
            }
          }
        }
      }

      previousValuesByGroup.set(group.key, valueIds);
    }
  })
  .brand<"ProductDefinition">();

export const ConfigurationSelectionValueSchema = z.union([IdSchema, z.number()]);

export const ConfigurationSelectionsSchema = z.record(IdSchema, ConfigurationSelectionValueSchema);

export const ConfigurationIssueLocationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("group"), groupKey: IdSchema }),
  z.object({ kind: z.literal("quantity") })
]);

export const ConfigurationIssueCodeSchema = z.enum([
  "missing_selection",
  "unknown_group",
  "unknown_selection",
  "invalid_selection_type",
  "number_out_of_range",
  "number_step_mismatch",
  "selection_invalidated",
  "component_unavailable",
  "money_overflow",
  "quantity_invalid"
]);

export const ConfigurationDisplayParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.array(z.string())])
);

export const ConfigurationIssueSchema = z.object({
  code: ConfigurationIssueCodeSchema,
  location: ConfigurationIssueLocationSchema,
  params: ConfigurationDisplayParamsSchema
});

export const DisabledOptionReasonCodeSchema = z.enum([
  "requirement_unmet",
  "component_unavailable"
]);

export const DisabledOptionReasonSchema = z.object({
  code: DisabledOptionReasonCodeSchema,
  params: ConfigurationDisplayParamsSchema
});

export const DisabledOptionExplanationSchema = z.object({
  groupKey: IdSchema,
  optionValueId: IdSchema,
  reasons: z.array(DisabledOptionReasonSchema).min(1)
});

export const PriceBreakdownLineSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("base"),
    amountMinor: MinorUnitAmountSchema
  }),
  z.object({
    kind: z.literal("option"),
    groupKey: IdSchema,
    optionValueId: IdSchema,
    amountMinor: MinorUnitAmountSchema
  }),
  z.object({
    kind: z.literal("number"),
    groupKey: IdSchema,
    selected: z.number().int(),
    additionalUnits: z.number().int().nonnegative(),
    unitPriceMinor: MinorUnitAmountSchema.nonnegative(),
    amountMinor: MinorUnitAmountSchema
  })
]);

export const EvaluateConfigurationInputSchema = z.object({
  product: ProductDefinitionSchema,
  selections: ConfigurationSelectionsSchema,
  quantity: z.number(),
  availability: ComponentAvailabilitySchema,
  currency: CurrencyCodeSchema
});

export const ConfigurationEvaluationStatusSchema = z.enum(["valid", "invalid"]);

const ConfigurationEvaluationCommonFields = {
  normalizedSelections: ConfigurationSelectionsSchema,
  disabledExplanations: z.array(DisabledOptionExplanationSchema)
};

export const ConfigurationEvaluationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("valid"),
    ...ConfigurationEvaluationCommonFields,
    perUnitBreakdown: z.array(PriceBreakdownLineSchema),
    perUnitTotal: MoneySchema,
    orderTotal: MoneySchema
  }),
  z.object({
    status: z.literal("invalid"),
    ...ConfigurationEvaluationCommonFields,
    issues: z.array(ConfigurationIssueSchema).min(1)
  })
]);

export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export type MinorUnitAmount = z.infer<typeof MinorUnitAmountSchema>;
export type Money = z.infer<typeof MoneySchema>;
export type ComponentAvailabilityStatus = z.infer<typeof ComponentAvailabilityStatusSchema>;
export type ComponentAvailability = z.infer<typeof ComponentAvailabilitySchema>;
export type OptionValueRequirement = z.infer<typeof OptionValueRequirementSchema>;
export type ProductOptionValue = z.infer<typeof ProductOptionValueSchema>;
export type ProductOptionGroup = z.infer<typeof ProductOptionGroupSchema>;
export type ProductDefinition = z.infer<typeof ProductDefinitionSchema>;
export type ConfigurationSelectionValue = z.infer<typeof ConfigurationSelectionValueSchema>;
export type ConfigurationSelections = z.infer<typeof ConfigurationSelectionsSchema>;
export type ConfigurationIssueLocation = z.infer<typeof ConfigurationIssueLocationSchema>;
export type ConfigurationIssueCode = z.infer<typeof ConfigurationIssueCodeSchema>;
export type ConfigurationDisplayParams = z.infer<typeof ConfigurationDisplayParamsSchema>;
export type ConfigurationIssue = z.infer<typeof ConfigurationIssueSchema>;
export type DisabledOptionReasonCode = z.infer<typeof DisabledOptionReasonCodeSchema>;
export type DisabledOptionReason = z.infer<typeof DisabledOptionReasonSchema>;
export type DisabledOptionExplanation = z.infer<typeof DisabledOptionExplanationSchema>;
export type PriceBreakdownLine = z.infer<typeof PriceBreakdownLineSchema>;
export type EvaluateConfigurationInput = z.infer<typeof EvaluateConfigurationInputSchema>;
export type ConfigurationEvaluationStatus = z.infer<typeof ConfigurationEvaluationStatusSchema>;
export type ConfigurationEvaluation = z.infer<typeof ConfigurationEvaluationSchema>;
