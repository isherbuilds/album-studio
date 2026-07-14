import { z } from "zod";

import { OrgSlugInputSchema } from "@tsu-stack/contract/organization";

const IdSchema = z.string().min(1);
const DecimalMagnitudePattern = "(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,4})?";

export const InventoryDecimalSchema = z
  .string()
  .regex(new RegExp(`^-?${DecimalMagnitudePattern}$`));
export const InventoryNonnegativeDecimalSchema = z
  .string()
  .regex(new RegExp(`^${DecimalMagnitudePattern}$`));
export const InventoryDeltaSchema = InventoryDecimalSchema.refine(
  (value) => !/^-?0(?:\.0+)?$/.test(value),
  "Movement delta must not be zero"
);
export const ComponentAvailabilityOverrideSchema = z.enum(["automatic", "available", "low", "out"]);
export const ComponentNameSchema = z.string().trim().min(1).max(200);
export const ComponentUnitSchema = z.string().trim().min(1).max(40);
export const InventoryMovementReasonSchema = z.string().trim().min(1).max(500);

export const InventoryListInputSchema = OrgSlugInputSchema;
export const InventoryComponentByIdInputSchema = OrgSlugInputSchema.extend({
  componentId: IdSchema
});
export const InventoryCreateComponentInputSchema = OrgSlugInputSchema.extend({
  lowStockThreshold: InventoryNonnegativeDecimalSchema,
  name: ComponentNameSchema,
  unit: ComponentUnitSchema
});
export const InventoryEditComponentInputSchema = InventoryComponentByIdInputSchema.extend({
  lowStockThreshold: InventoryNonnegativeDecimalSchema,
  name: ComponentNameSchema,
  unit: ComponentUnitSchema
});
export const InventoryRecordMovementInputSchema = InventoryComponentByIdInputSchema.extend({
  delta: InventoryDeltaSchema,
  reason: InventoryMovementReasonSchema
});
export const InventorySetAvailabilityInputSchema = InventoryComponentByIdInputSchema.extend({
  availabilityOverride: ComponentAvailabilityOverrideSchema
});

export type ComponentAvailabilityOverride = z.infer<typeof ComponentAvailabilityOverrideSchema>;
export type InventoryDecimal = z.infer<typeof InventoryDecimalSchema>;
export type InventoryNonnegativeDecimal = z.infer<typeof InventoryNonnegativeDecimalSchema>;
export type InventoryDelta = z.infer<typeof InventoryDeltaSchema>;
export type ComponentName = z.infer<typeof ComponentNameSchema>;
export type ComponentUnit = z.infer<typeof ComponentUnitSchema>;
export type InventoryMovementReason = z.infer<typeof InventoryMovementReasonSchema>;
export type InventoryListInput = z.infer<typeof InventoryListInputSchema>;
export type InventoryComponentByIdInput = z.infer<typeof InventoryComponentByIdInputSchema>;
export type InventoryCreateComponentInput = z.infer<typeof InventoryCreateComponentInputSchema>;
export type InventoryEditComponentInput = z.infer<typeof InventoryEditComponentInputSchema>;
export type InventoryRecordMovementInput = z.infer<typeof InventoryRecordMovementInputSchema>;
export type InventorySetAvailabilityInput = z.infer<typeof InventorySetAvailabilityInputSchema>;
