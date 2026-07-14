import {
  PaymentLedgerSchema,
  PaymentListByOrderInputSchema,
  PaymentMutationOutputSchema,
  PaymentRecordInputSchema,
  PaymentReverseInputSchema
} from "@tsu-stack/contract/payment";
import {
  listPaymentsByOrder,
  recordOfflinePayment,
  reverseOfflinePayment
} from "@tsu-stack/core/payment";

import { organizationActionProcedure, organizationProcedure } from "#@/lib/procedures/factory";

const paymentErrors = {
  PAYMENT_OVERAGE: {
    message: "Payment would move paid total outside Order balance",
    status: 409
  }
} as const;

export const paymentsRouter = {
  listByOrder: organizationProcedure(PaymentListByOrderInputSchema)
    .route({ description: "List offline Payments for one Order", method: "GET" })
    .output(PaymentLedgerSchema)
    .handler(async ({ context, errors, input }) => {
      const ledger = await listPaymentsByOrder(context.db, {
        customerId: context.role === "customer" ? context.authSession.user.id : undefined,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id
      });
      if (!ledger) throw errors.NOT_FOUND({ message: "Order not found" });
      return ledger;
    }),
  record: organizationActionProcedure(PaymentRecordInputSchema, "payment.manage")
    .route({ description: "Record an offline Order receipt", method: "POST" })
    .errors(paymentErrors)
    .output(PaymentMutationOutputSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await recordOfflinePayment(context.db, {
        actorUserId: context.authSession.user.id,
        amountMinor: input.amountMinor,
        method: input.method,
        note: input.note,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Order not found" });
      if (result.kind === "overage") throw errors.PAYMENT_OVERAGE();
      return { payment: result.payment, summary: result.summary };
    }),
  reverse: organizationActionProcedure(PaymentReverseInputSchema, "payment.manage")
    .route({ description: "Reverse part or all of an offline Order receipt", method: "POST" })
    .errors(paymentErrors)
    .output(PaymentMutationOutputSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await reverseOfflinePayment(context.db, {
        actorUserId: context.authSession.user.id,
        amountMinor: input.amountMinor,
        note: input.note,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id,
        receiptId: input.receiptId
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Receipt not found" });
      if (result.kind === "overage") throw errors.PAYMENT_OVERAGE();
      return { payment: result.payment, summary: result.summary };
    })
};
