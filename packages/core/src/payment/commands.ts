import { and, eq, sql } from "drizzle-orm";

import {
  type OfflinePaymentMethod,
  type PaymentDetail,
  type PaymentSummary
} from "@tsu-stack/contract/payment";
import { type Database, type DatabaseOrTransaction } from "@tsu-stack/db";
import { customerOrder, offlinePayment } from "@tsu-stack/db/schema";

import { createPaymentSummary, parsePayment } from "#@/payment/queries";

type PaymentMutationResult =
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
    .select({
      amountMinor: sql<number>`coalesce(sum(${offlinePayment.amountMinor}), 0)`.mapWith(Number)
    })
    .from(offlinePayment)
    .where(
      and(
        eq(offlinePayment.orderId, input.orderId),
        eq(offlinePayment.organizationId, input.organizationId)
      )
    );
  const row = rows[0];
  if (!row) throw new Error("Offline Payment total query returned no row");
  return row.amountMinor;
}

async function loadPaymentByMutationId(
  tx: DatabaseOrTransaction,
  input: { mutationId: string; organizationId: string }
) {
  const rows = await tx
    .select()
    .from(offlinePayment)
    .where(
      and(
        eq(offlinePayment.mutationId, input.mutationId),
        eq(offlinePayment.organizationId, input.organizationId)
      )
    )
    .limit(1);
  return rows[0];
}

export async function recordOfflinePayment(
  db: Pick<Database, "transaction">,
  input: {
    actorName: string;
    actorUserId: string;
    amountMinor: number;
    method: OfflinePaymentMethod;
    mutationId: string;
    note: string | null;
    orderNumber: string;
    organizationId: string;
  }
): Promise<PaymentMutationResult> {
  return db.transaction(async (tx) => {
    const order = await loadOrderForPayment(tx, input);
    if (!order) return { kind: "not_found" };
    const existing = await loadPaymentByMutationId(tx, input);
    if (existing) {
      if (
        existing.actorUserId !== input.actorUserId ||
        existing.amountMinor !== input.amountMinor ||
        existing.entryType !== "receipt" ||
        existing.method !== input.method ||
        existing.note !== input.note ||
        existing.orderId !== order.id
      ) {
        throw new Error("Offline Payment mutation ID reused with different receipt input");
      }
      const paidMinor = await loadPaidMinor(tx, {
        orderId: order.id,
        organizationId: input.organizationId
      });
      return {
        kind: "recorded",
        payment: parsePayment(existing, input.actorName, order.snapshot.orderTotal.currency),
        summary: createPaymentSummary(order.snapshot.orderTotal, paidMinor)
      };
    }
    if (order.status === "cancelled") return { kind: "not_found" };
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
        entryType: "receipt",
        method: input.method,
        mutationId: input.mutationId,
        note: input.note,
        orderId: order.id,
        organizationId: input.organizationId
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Offline Payment insert returned no row");
    return {
      kind: "recorded",
      payment: parsePayment(row, input.actorName, order.snapshot.orderTotal.currency),
      summary: createPaymentSummary(order.snapshot.orderTotal, nextPaidMinor)
    };
  });
}

export async function reverseOfflinePayment(
  db: Pick<Database, "transaction">,
  input: {
    actorName: string;
    actorUserId: string;
    amountMinor: number;
    note: string | null;
    mutationId: string;
    orderNumber: string;
    organizationId: string;
    receiptId: string;
  }
): Promise<PaymentMutationResult> {
  return db.transaction(async (tx) => {
    const order = await loadOrderForPayment(tx, input);
    if (!order) return { kind: "not_found" };
    const existing = await loadPaymentByMutationId(tx, input);
    if (existing) {
      if (
        existing.actorUserId !== input.actorUserId ||
        existing.amountMinor !== -input.amountMinor ||
        existing.entryType !== "reversal" ||
        existing.note !== input.note ||
        existing.orderId !== order.id ||
        existing.reversalOfId !== input.receiptId
      ) {
        throw new Error("Offline Payment mutation ID reused with different reversal input");
      }
      const paidMinor = await loadPaidMinor(tx, {
        orderId: order.id,
        organizationId: input.organizationId
      });
      return {
        kind: "recorded",
        payment: parsePayment(existing, input.actorName, order.snapshot.orderTotal.currency),
        summary: createPaymentSummary(order.snapshot.orderTotal, paidMinor)
      };
    }
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
      .select({
        reversedMinor: sql<number>`coalesce(-sum(${offlinePayment.amountMinor}), 0)`.mapWith(Number)
      })
      .from(offlinePayment)
      .where(
        and(
          eq(offlinePayment.reversalOfId, receipt.id),
          eq(offlinePayment.orderId, order.id),
          eq(offlinePayment.organizationId, input.organizationId)
        )
      );
    const reversalTotal = reversalRows[0];
    if (!reversalTotal) throw new Error("Offline Payment reversal total query returned no row");
    const reversedMinor = reversalTotal.reversedMinor;
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
        entryType: "reversal",
        method: receipt.method,
        mutationId: input.mutationId,
        note: input.note,
        orderId: order.id,
        organizationId: input.organizationId,
        reversalOfId: receipt.id,
        reversalTargetType: "receipt"
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Offline Payment reversal insert returned no row");
    return {
      kind: "recorded",
      payment: parsePayment(row, input.actorName, order.snapshot.orderTotal.currency),
      summary: createPaymentSummary(order.snapshot.orderTotal, paidMinor - input.amountMinor)
    };
  });
}
