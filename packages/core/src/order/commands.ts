import { and, eq } from "drizzle-orm";

import { type ConfigurationEvaluation } from "@tsu-stack/contract/configuration";
import {
  OrderPriceComparisonSchema,
  type CancellationRequestStatus,
  type OrderDetail,
  OrderSnapshotSchema,
  type OrderStatus,
  type OrderPriceComparison,
  type OrderSnapshot
} from "@tsu-stack/contract/order";
import { type Database, type DatabaseOrTransaction } from "@tsu-stack/db";
import { auditEvent, configurationDraft, customerOrder } from "@tsu-stack/db/schema";

import { loadPublicProductDefinition } from "#@/catalog/queries";
import { evaluateConfiguration } from "#@/configuration/evaluate-configuration";
import { runRepeatableReadTransaction } from "#@/database/run-repeatable-read-transaction";
import { parseConfigurationDraftDetail } from "#@/draft/queries";
import { parseOrderDetail } from "#@/order/queries";

const validTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  cancelled: [],
  completed: [],
  confirmed: ["in_production", "cancelled"],
  in_production: ["completed", "cancelled"],
  placed: ["confirmed", "cancelled"]
};

async function loadOrderForUpdate(
  tx: DatabaseOrTransaction,
  input: { customerId?: string; orderNumber: string; organizationId: string }
) {
  const rows = await tx
    .select()
    .from(customerOrder)
    .where(
      and(
        eq(customerOrder.number, input.orderNumber),
        eq(customerOrder.organizationId, input.organizationId),
        input.customerId ? eq(customerOrder.customerId, input.customerId) : undefined
      )
    )
    .limit(1)
    .for("update");
  return rows[0];
}

async function recordOrderAudit(
  tx: DatabaseOrTransaction,
  input: {
    action: string;
    actorUserId: string;
    entityId: string;
    metadata: Record<string, string | null>;
    organizationId: string;
  }
) {
  await tx.insert(auditEvent).values({
    action: input.action,
    actorUserId: input.actorUserId,
    entityId: input.entityId,
    entityType: "order",
    metadata: input.metadata,
    organizationId: input.organizationId
  });
}

type ValidEvaluation = Extract<ConfigurationEvaluation, { status: "valid" }>;

function canonicalPrice(price: OrderPriceComparison) {
  return JSON.stringify(OrderPriceComparisonSchema.parse(price));
}

function createOrderSnapshot(
  product: NonNullable<Awaited<ReturnType<typeof loadPublicProductDefinition>>>,
  draft: typeof configurationDraft.$inferSelect,
  evaluation: ValidEvaluation
): OrderSnapshot {
  const selections: OrderSnapshot["selections"] = [];
  for (const group of product.definition.groups) {
    const selected = evaluation.normalizedSelections[group.key];
    if (selected === undefined) continue;

    if (group.type === "number") {
      if (typeof selected !== "number") {
        throw new Error(`Invalid numeric Order snapshot for Option Group ${group.key}`);
      }
      selections.push({
        groupKey: group.key,
        groupLabel: group.label,
        kind: "number",
        selected
      });
      continue;
    }

    const value = group.values.find((option) => option.id === selected);
    if (!value) {
      throw new Error(`Invalid option Order snapshot for Option Group ${group.key}`);
    }
    selections.push({
      componentIds: value.componentIds,
      groupKey: group.key,
      groupLabel: group.label,
      kind: "option",
      optionValueId: value.id,
      optionValueLabel: value.label
    });
  }

  return OrderSnapshotSchema.parse({
    orderTotal: evaluation.orderTotal,
    perUnitBreakdown: evaluation.perUnitBreakdown,
    perUnitTotal: evaluation.perUnitTotal,
    product: { id: product.definition.id, name: product.name, slug: product.slug },
    projectName: draft.snapshot.projectName,
    quantity: draft.snapshot.quantity,
    selections
  });
}

async function loadPlacedOrder(
  tx: DatabaseOrTransaction,
  input: { customerId: string; draftId: string; organizationId: string }
) {
  const rows = await tx
    .select()
    .from(customerOrder)
    .where(
      and(
        eq(customerOrder.draftId, input.draftId),
        eq(customerOrder.organizationId, input.organizationId),
        eq(customerOrder.customerId, input.customerId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Converted Configuration Draft has no Order");
  return { kind: "placed" as const, order: parseOrderDetail(rows[0]) };
}

export async function placeOrder(
  db: Pick<Database, "transaction">,
  input: {
    acceptedPrice: OrderPriceComparison;
    customerId: string;
    draftId: string;
    organizationId: string;
  }
) {
  return runRepeatableReadTransaction(db, async (tx) => {
    const references = await tx
      .select({ productId: configurationDraft.productId, status: configurationDraft.status })
      .from(configurationDraft)
      .where(
        and(
          eq(configurationDraft.id, input.draftId),
          eq(configurationDraft.organizationId, input.organizationId),
          eq(configurationDraft.customerId, input.customerId)
        )
      )
      .limit(1);
    const reference = references[0];
    if (!reference) return { kind: "not_found" as const };
    if (reference.status === "converted") return loadPlacedOrder(tx, input);

    const product = await loadPublicProductDefinition(tx, {
      lockDefinition: true,
      organizationId: input.organizationId,
      productId: reference.productId
    });
    if (!product) return { kind: "not_found" as const };

    const draftRows = await tx
      .select()
      .from(configurationDraft)
      .where(
        and(
          eq(configurationDraft.id, input.draftId),
          eq(configurationDraft.organizationId, input.organizationId),
          eq(configurationDraft.customerId, input.customerId)
        )
      )
      .limit(1)
      .for("update");
    const draft = draftRows[0];
    if (!draft) return { kind: "not_found" as const };
    if (draft.status === "converted") return loadPlacedOrder(tx, input);

    const evaluation = evaluateConfiguration({
      availability: product.availability,
      currency: product.currency,
      product: product.definition,
      quantity: draft.snapshot.quantity,
      selections: draft.snapshot.selections
    });
    if (evaluation.status === "invalid") {
      return {
        issues: evaluation.issues,
        kind: "configuration_invalid" as const,
        product
      };
    }
    const currentPrice: OrderPriceComparison = {
      orderTotal: evaluation.orderTotal,
      perUnitBreakdown: evaluation.perUnitBreakdown,
      perUnitTotal: evaluation.perUnitTotal
    };
    if (canonicalPrice(currentPrice) !== canonicalPrice(input.acceptedPrice)) {
      return {
        current: currentPrice,
        kind: "price_changed" as const,
        previous: input.acceptedPrice,
        product
      };
    }

    const rows = await tx
      .insert(customerOrder)
      .values({
        customerId: input.customerId,
        draftId: draft.id,
        organizationId: input.organizationId,
        productId: product.definition.id,
        projectName: draft.snapshot.projectName,
        snapshot: createOrderSnapshot(product, draft, evaluation)
      })
      .returning();
    const order = rows[0];
    if (!order) throw new Error("Order insert returned no row");

    const converted = await tx
      .update(configurationDraft)
      .set({ status: "converted" })
      .where(and(eq(configurationDraft.id, draft.id), eq(configurationDraft.status, "active")))
      .returning({ id: configurationDraft.id });
    if (!converted[0]) throw new Error("Configuration Draft conversion returned no row");

    return { kind: "placed" as const, order: parseOrderDetail(order) };
  });
}

type OrderMutationResult =
  | { kind: "invalid_transition" }
  | { kind: "not_found" }
  | { kind: "updated"; order: OrderDetail };

export async function transitionOrder(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    orderNumber: string;
    organizationId: string;
    status: OrderStatus;
  }
): Promise<OrderMutationResult> {
  return runRepeatableReadTransaction(db, async (tx) => {
    const order = await loadOrderForUpdate(tx, input);
    if (!order) return { kind: "not_found" };
    if (
      !validTransitions[order.status].includes(input.status) ||
      order.cancellationStatus === "pending"
    ) {
      return { kind: "invalid_transition" };
    }

    const rows = await tx
      .update(customerOrder)
      .set({ status: input.status })
      .where(and(eq(customerOrder.id, order.id), eq(customerOrder.status, order.status)))
      .returning();
    const updated = rows[0];
    if (!updated) throw new Error("Order transition returned no row");
    await recordOrderAudit(tx, {
      action: "order.status_updated",
      actorUserId: input.actorUserId,
      entityId: order.id,
      metadata: { from: order.status, to: input.status },
      organizationId: input.organizationId
    });
    return { kind: "updated", order: parseOrderDetail(updated) };
  });
}

export async function correctOrderProjectName(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    orderNumber: string;
    organizationId: string;
    projectName: string | null;
  }
): Promise<OrderDetail | undefined> {
  return runRepeatableReadTransaction(db, async (tx) => {
    const order = await loadOrderForUpdate(tx, input);
    if (!order) return undefined;
    if (order.projectName === input.projectName) return parseOrderDetail(order);

    const rows = await tx
      .update(customerOrder)
      .set({ projectName: input.projectName })
      .where(eq(customerOrder.id, order.id))
      .returning();
    const updated = rows[0];
    if (!updated) throw new Error("Order Project Name correction returned no row");
    await recordOrderAudit(tx, {
      action: "order.project_name_corrected",
      actorUserId: input.actorUserId,
      entityId: order.id,
      metadata: { from: order.projectName, to: input.projectName },
      organizationId: input.organizationId
    });
    return parseOrderDetail(updated);
  });
}

export async function requestOrderCancellation(
  db: Pick<Database, "transaction">,
  input: { customerId: string; orderNumber: string; organizationId: string }
): Promise<OrderMutationResult> {
  return runRepeatableReadTransaction(db, async (tx) => {
    const order = await loadOrderForUpdate(tx, input);
    if (!order) return { kind: "not_found" };
    if (
      order.status !== "placed" ||
      (order.cancellationStatus !== "none" && order.cancellationStatus !== "rejected")
    ) {
      return { kind: "invalid_transition" };
    }
    const rows = await tx
      .update(customerOrder)
      .set({ cancellationStatus: "pending" })
      .where(eq(customerOrder.id, order.id))
      .returning();
    const updated = rows[0];
    if (!updated) throw new Error("Order cancellation request returned no row");
    return { kind: "updated", order: parseOrderDetail(updated) };
  });
}

export async function decideOrderCancellation(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    decision: Extract<CancellationRequestStatus, "approved" | "rejected">;
    orderNumber: string;
    organizationId: string;
  }
): Promise<OrderMutationResult> {
  return runRepeatableReadTransaction(db, async (tx) => {
    const order = await loadOrderForUpdate(tx, input);
    if (!order) return { kind: "not_found" };
    if (order.status !== "placed" || order.cancellationStatus !== "pending") {
      return { kind: "invalid_transition" };
    }
    const rows = await tx
      .update(customerOrder)
      .set({
        cancellationStatus: input.decision,
        status: input.decision === "approved" ? "cancelled" : "placed"
      })
      .where(eq(customerOrder.id, order.id))
      .returning();
    const updated = rows[0];
    if (!updated) throw new Error("Order cancellation decision returned no row");
    await recordOrderAudit(tx, {
      action: "order.cancellation_decided",
      actorUserId: input.actorUserId,
      entityId: order.id,
      metadata: { decision: input.decision },
      organizationId: input.organizationId
    });
    return { kind: "updated", order: parseOrderDetail(updated) };
  });
}

export async function duplicateOrderToDraft(
  db: Pick<Database, "transaction">,
  input: { customerId: string; orderNumber: string; organizationId: string }
) {
  return runRepeatableReadTransaction(db, async (tx) => {
    const order = await loadOrderForUpdate(tx, input);
    if (!order) return undefined;
    const selections = Object.fromEntries(
      order.snapshot.selections.map((selection) => [
        selection.groupKey,
        selection.kind === "option" ? selection.optionValueId : selection.selected
      ])
    );
    const rows = await tx
      .insert(configurationDraft)
      .values({
        customerId: input.customerId,
        organizationId: input.organizationId,
        productId: order.productId,
        snapshot: {
          evaluationSummary: {
            orderTotal: order.snapshot.orderTotal,
            perUnitBreakdown: order.snapshot.perUnitBreakdown,
            perUnitTotal: order.snapshot.perUnitTotal,
            status: "valid"
          },
          projectName: order.projectName,
          quantity: order.snapshot.quantity,
          selections,
          step: { kind: "review" }
        }
      })
      .returning();
    const draft = rows[0];
    if (!draft) throw new Error("Order duplication returned no Configuration Draft");
    return { draft: parseConfigurationDraftDetail(draft, order.snapshot.product.slug) };
  });
}
