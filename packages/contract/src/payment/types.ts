import { z } from "zod";

import { MinorUnitAmountSchema, MoneySchema } from "@tsu-stack/contract/configuration";
import { OrgSlugInputSchema } from "@tsu-stack/contract/organization";

const IdSchema = z.string().min(1);
const OrderNumberSchema = z.string().min(1);

export const OfflinePaymentMethodSchema = z.enum([
  "cash",
  "bank_transfer",
  "upi",
  "cheque",
  "other"
]);
export const PaymentStateSchema = z.enum(["unpaid", "partially_paid", "paid"]);
export const PaymentNoteSchema = z
  .string()
  .trim()
  .max(500)
  .transform((note) => note || null)
  .nullable();
export const PaymentAmountMinorSchema = MinorUnitAmountSchema.positive();

export const PaymentDetailSchema = z.object({
  actorName: z.string().min(1),
  amount: MoneySchema,
  createdAt: z.string().datetime(),
  id: IdSchema,
  method: OfflinePaymentMethodSchema,
  note: PaymentNoteSchema,
  reversalOfId: IdSchema.nullable()
});

export const PaymentSummarySchema = z.object({
  balance: MoneySchema,
  paid: MoneySchema,
  state: PaymentStateSchema,
  total: MoneySchema
});

export const PaymentLedgerSchema = z.object({
  payments: z.array(PaymentDetailSchema),
  summary: PaymentSummarySchema
});

export const PaymentMutationOutputSchema = z.object({
  payment: PaymentDetailSchema,
  summary: PaymentSummarySchema
});

export const PaymentListByOrderInputSchema = OrgSlugInputSchema.extend({
  orderNumber: OrderNumberSchema
});
export const PaymentRecordInputSchema = PaymentListByOrderInputSchema.extend({
  amountMinor: PaymentAmountMinorSchema,
  method: OfflinePaymentMethodSchema,
  note: PaymentNoteSchema
});
export const PaymentReverseInputSchema = PaymentListByOrderInputSchema.extend({
  amountMinor: PaymentAmountMinorSchema,
  note: PaymentNoteSchema,
  receiptId: IdSchema
});

export type OfflinePaymentMethod = z.infer<typeof OfflinePaymentMethodSchema>;
export type PaymentAmountMinor = z.infer<typeof PaymentAmountMinorSchema>;
export type PaymentDetail = z.infer<typeof PaymentDetailSchema>;
export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;
export type PaymentLedger = z.infer<typeof PaymentLedgerSchema>;
export type PaymentRecordInput = z.infer<typeof PaymentRecordInputSchema>;
export type PaymentReverseInput = z.infer<typeof PaymentReverseInputSchema>;
