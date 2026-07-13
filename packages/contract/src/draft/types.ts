import { z } from "zod";

import { PublicProductDefinitionSchema } from "@tsu-stack/contract/catalog";
import {
  ConfigurationIssueSchema,
  ConfigurationSelectionsSchema,
  MAX_PRODUCT_OPTION_GROUPS,
  MoneySchema,
  OptionGroupKeySchema
} from "@tsu-stack/contract/configuration";
import { OrgSlugInputSchema } from "@tsu-stack/contract/organization";

const IdSchema = z.string().min(1);

export const ConfigurationDraftStatusSchema = z.enum(["active", "converted"]);

export const ConfigurationDraftSelectionsSchema = ConfigurationSelectionsSchema.refine(
  (selections) => Object.keys(selections).length <= MAX_PRODUCT_OPTION_GROUPS,
  `Configuration Draft cannot contain more than ${MAX_PRODUCT_OPTION_GROUPS} selections`
);

export const ConfigurationDraftStepSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("group"), groupKey: OptionGroupKeySchema }),
  z.object({ kind: z.literal("review") })
]);

export const ConfigurationDraftProjectNameSchema = z
  .string()
  .trim()
  .max(120)
  .transform((projectName) => projectName || null)
  .nullable();

export const ConfigurationDraftQuantitySchema = z
  .number()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

export const ConfigurationDraftEvaluationSummarySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("valid"), orderTotal: MoneySchema }),
  z.object({ status: z.literal("invalid"), issues: z.array(ConfigurationIssueSchema).min(1) })
]);

export const ConfigurationDraftSnapshotSchema = z.object({
  evaluationSummary: ConfigurationDraftEvaluationSummarySchema,
  projectName: ConfigurationDraftProjectNameSchema,
  quantity: ConfigurationDraftQuantitySchema,
  selections: ConfigurationDraftSelectionsSchema,
  step: ConfigurationDraftStepSchema
});

export const ConfigurationDraftDetailSchema = z.object({
  createdAt: z.string().datetime(),
  id: IdSchema,
  productId: IdSchema,
  productSlug: IdSchema,
  revision: z.number().int().positive(),
  status: ConfigurationDraftStatusSchema,
  updatedAt: z.string().datetime(),
  ...ConfigurationDraftSnapshotSchema.shape
});

export const ConfigurationDraftListItemSchema = ConfigurationDraftDetailSchema.pick({
  evaluationSummary: true,
  id: true,
  productId: true,
  productSlug: true,
  projectName: true,
  quantity: true,
  revision: true,
  updatedAt: true
}).extend({
  productName: z.string().min(1),
  resumable: z.boolean(),
  thumbnailUrl: z.string().nullable()
});

export const ConfigurationDraftEditorSchema = z.object({
  draft: ConfigurationDraftDetailSchema,
  product: PublicProductDefinitionSchema
});

export const DraftListInputSchema = OrgSlugInputSchema;

export const DraftByIdInputSchema = OrgSlugInputSchema.extend({ draftId: IdSchema });

export const DraftCreateInputSchema = OrgSlugInputSchema.extend({
  productSlug: IdSchema,
  projectName: ConfigurationDraftProjectNameSchema.optional()
});

export const DraftSaveInputSchema = OrgSlugInputSchema.extend({
  draftId: IdSchema,
  expectedRevision: z.number().int().positive(),
  projectName: ConfigurationDraftProjectNameSchema,
  quantity: ConfigurationDraftQuantitySchema,
  selections: ConfigurationDraftSelectionsSchema,
  step: ConfigurationDraftStepSchema
});

export const DraftRemoveInputSchema = DraftByIdInputSchema;

export const DraftRemoveOutputSchema = z.object({ id: IdSchema });

export type ConfigurationDraftStatus = z.infer<typeof ConfigurationDraftStatusSchema>;
export type ConfigurationDraftSelections = z.infer<typeof ConfigurationDraftSelectionsSchema>;
export type ConfigurationDraftStep = z.infer<typeof ConfigurationDraftStepSchema>;
export type ConfigurationDraftProjectName = z.infer<typeof ConfigurationDraftProjectNameSchema>;
export type ConfigurationDraftQuantity = z.infer<typeof ConfigurationDraftQuantitySchema>;
export type ConfigurationDraftEvaluationSummary = z.infer<
  typeof ConfigurationDraftEvaluationSummarySchema
>;
export type ConfigurationDraftSnapshot = z.infer<typeof ConfigurationDraftSnapshotSchema>;
export type ConfigurationDraftDetail = z.infer<typeof ConfigurationDraftDetailSchema>;
export type ConfigurationDraftListItem = z.infer<typeof ConfigurationDraftListItemSchema>;
export type ConfigurationDraftEditor = z.infer<typeof ConfigurationDraftEditorSchema>;
export type DraftListInput = z.infer<typeof DraftListInputSchema>;
export type DraftByIdInput = z.infer<typeof DraftByIdInputSchema>;
export type DraftCreateInput = z.infer<typeof DraftCreateInputSchema>;
export type DraftSaveInput = z.infer<typeof DraftSaveInputSchema>;
export type DraftRemoveInput = z.infer<typeof DraftRemoveInputSchema>;
export type DraftRemoveOutput = z.infer<typeof DraftRemoveOutputSchema>;
