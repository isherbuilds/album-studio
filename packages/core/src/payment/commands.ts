import { and, eq } from "drizzle-orm";

import {
  type OfflinePaymentMethod,
  type PaymentDetail,
  type PaymentSummary
} from "@tsu-stack/contract/payment";
import { type Database, type DatabaseOrTransaction } from "@tsu-stack/db";
import { customerOrder, offlinePayment, user } from "@tsu-stack/db/schema";

import { createPaymentSummary, parsePayment } from "#@/payment/queries";

type PaymentMutationResult =
  | { kind: "currency_mismatch" }
  | { kind: "not_found" }
  | { kind: "overage" }
  | { kind: "recorded"; payment: PaymentDetail; summary: PaymentSummary };

async function loadOrderForPayment(
  tx: DatabaseOrTransaction,
  input: { orderNumber: string; organizationId: string }
) {
  const rows = await tx
    .select()
    .from(customerOrder)
    .where(
      and(
        eq(customerOrder.number, input.orderNumber),
        eq(customerOrder.organizationId, input.organizationId)
      )
    )
    .limit(1)
    .for("update");
  return rows[0];
}

async function loadPaidMinor(
  tx: DatabaseOrTransaction,
  input: { orderId: string; organizationId: string }
) {
  const rows = await tx
    .select({ amountMinor: offlinePayment.amountMinor })
    .from(offlinePayment)
    .where(
      and(
        eq(offlinePayment.orderId, input.orderId),
        eq(offlinePayment.organizationId, input.organizationId)
      )
    );
  return rows.reduce((sum, row) => sum + row.amountMinor, 0);
}

async function loadActorName(tx: DatabaseOrTransaction, actorUserId: string) {
  const rows = await tx
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);
  if (!rows[0]) throw new Error("Offline Payment actor not found");
  return rows[0].name;
}

export async function recordOfflinePayment(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    amountMinor: number;
    currency: string;
    method: OfflinePaymentMethod;
    note: string | null;
    orderNumber: string;
    organizationId: string;
  }
): Promise<PaymentMutationResult> {
  return db.transaction(async (tx) => {
    const order = await loadOrderForPayment(tx, input);
    if (!order) return { kind: "not_found" };
    if (order.snapshot.orderTotal.currency !== input.currency) return { kind: "currency_mismatch" };
    const paidMinor = await loadPaidMinor(tx, {
      orderId: order.id,
      organizationId: input.organizationId
    });
    const nextPaidMinor = paidMinor + input.amountMinor;
    if (nextPaidMinor > order.snapshot.orderTotal.amountMinor) return { kind: "overage" };

    const rows = await tx
      .insert(offlinePayment)
      .values({
        actorUserId: input.actorUserId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        method: input.method,
        note: input.note,
        orderId: order.id,
        organizationId: input.organizationId
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Offline Payment insert returned no row");
    return {
      kind: "recorded",
      payment: parsePayment(row, await loadActorName(tx, input.actorUserId)),
      summary: createPaymentSummary(order.snapshot.orderTotal, nextPaidMinor)
    };
  });
}

export async function reverseOfflinePayment(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    amountMinor: number;
    currency: string;
    note: string | null;
    orderNumber: string;
    organizationId: string;
    receiptId: string;
  }
): Promise<PaymentMutationResult> {
  return db.transaction(async (tx) => {
    const order = await loadOrderForPayment(tx, input);
    if (!order) return { kind: "not_found" };
    if (order.snapshot.orderTotal.currency !== input.currency) return { kind: "currency_mismatch" };
    const receiptRows = await tx
      .select()
      .from(offlinePayment)
      .where(
        and(
          eq(offlinePayment.id, input.receiptId),
          eq(offlinePayment.orderId, order.id),
          eq(offlinePayment.organizationId, input.organizationId)
        )
      )
      .limit(1);
    const receipt = receiptRows[0];
    if (!receipt || receipt.reversalOfId !== null) return { kind: "not_found" };

    const reversalRows = await tx
      .select({ amountMinor: offlinePayment.amountMinor })
      .from(offlinePayment)
      .where(
        and(
          eq(offlinePayment.reversalOfId, receipt.id),
          eq(offlinePayment.orderId, order.id),
          eq(offlinePayment.organizationId, input.organizationId)
        )
      );
    const reversedMinor = -reversalRows.reduce((sum, row) => sum + row.amountMinor, 0);
    const paidMinor = await loadPaidMinor(tx, {
      orderId: order.id,
      organizationId: input.organizationId
    });
    if (
      input.amountMinor > receipt.amountMinor - reversedMinor ||
      paidMinor - input.amountMinor < 0
    ) {
      return { kind: "overage" };
    }

    const rows = await tx
      .insert(offlinePayment)
      .values({
        actorUserId: input.actorUserId,
        amountMinor: -input.amountMinor,
        currency: input.currency,
        method: receipt.method,
        note: input.note,
        orderId: order.id,
        organizationId: input.organizationId,
        reversalOfId: receipt.id
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Offline Payment reversal insert returned no row");
    return {
      kind: "recorded",
      payment: parsePayment(row, await loadActorName(tx, input.actorUserId)),
      summary: createPaymentSummary(order.snapshot.orderTotal, paidMinor - input.amountMinor)
    };
  });
}
