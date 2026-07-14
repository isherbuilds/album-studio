import { and, asc, eq } from "drizzle-orm";

import {
  PaymentDetailSchema,
  PaymentLedgerSchema,
  PaymentSummarySchema,
  type PaymentDetail,
  type PaymentSummary
} from "@tsu-stack/contract/payment";
import { type DatabaseOrTransaction } from "@tsu-stack/db";
import { customerOrder, offlinePayment, user } from "@tsu-stack/db/schema";

export function createPaymentSummary(
  total: { amountMinor: number; currency: string },
  paidMinor: number
): PaymentSummary {
  if (paidMinor < 0 || paidMinor > total.amountMinor) {
    throw new Error("Paid amount is outside Order total");
  }
  return PaymentSummarySchema.parse({
    balance: { amountMinor: total.amountMinor - paidMinor, currency: total.currency },
    paid: { amountMinor: paidMinor, currency: total.currency },
    state: paidMinor === total.amountMinor ? "paid" : paidMinor === 0 ? "unpaid" : "partially_paid",
    total
  });
}

export function parsePayment(
  row: typeof offlinePayment.$inferSelect,
  actorName: string,
  currency: PaymentSummary["total"]["currency"]
): PaymentDetail {
  return PaymentDetailSchema.parse({
    actorName,
    amount: { amountMinor: row.amountMinor, currency },
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    method: row.method,
    note: row.note,
    reversalOfId: row.reversalOfId
  });
}

export async function listPaymentsByOrder(
  db: DatabaseOrTransaction,
  input: { customerId?: string; orderNumber: string; organizationId: string }
) {
  const orders = await db
    .select({ id: customerOrder.id, total: customerOrder.snapshot })
    .from(customerOrder)
    .where(
      and(
        eq(customerOrder.number, input.orderNumber),
        eq(customerOrder.organizationId, input.organizationId),
        input.customerId ? eq(customerOrder.customerId, input.customerId) : undefined
      )
    )
    .limit(1);
  const order = orders[0];
  if (!order) return undefined;

  const rows = await db
    .select({ actorName: user.name, payment: offlinePayment })
    .from(offlinePayment)
    .innerJoin(user, eq(user.id, offlinePayment.actorUserId))
    .where(
      and(
        eq(offlinePayment.organizationId, input.organizationId),
        eq(offlinePayment.orderId, order.id)
      )
    )
    .orderBy(asc(offlinePayment.createdAt), asc(offlinePayment.id));
  const payments = rows.map((row) =>
    parsePayment(row.payment, row.actorName, order.total.orderTotal.currency)
  );
  const paidMinor = payments.reduce((sum, payment) => sum + payment.amount.amountMinor, 0);
  return PaymentLedgerSchema.parse({
    payments,
    summary: createPaymentSummary(order.total.orderTotal, paidMinor)
  });
}
