import { and, eq } from "drizzle-orm";

import { type ConfigurationEvaluation } from "@tsu-stack/contract/configuration";
import {
  OrderSnapshotSchema,
  type OrderPriceComparison,
  type OrderSnapshot
} from "@tsu-stack/contract/order";
import { type Database, type DatabaseOrTransaction } from "@tsu-stack/db";
import { configurationDraft, customerOrder } from "@tsu-stack/db/schema";

import { loadPublicProductDefinition } from "#@/catalog/queries";
import { evaluateConfiguration } from "#@/configuration/evaluate-configuration";
import { runRepeatableReadTransaction } from "#@/database/run-repeatable-read-transaction";
import { parseOrderDetail } from "#@/order/queries";

type ValidEvaluation = Extract<ConfigurationEvaluation, { status: "valid" }>;

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
      lockProduct: true,
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
    if (JSON.stringify(currentPrice) !== JSON.stringify(input.acceptedPrice)) {
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
