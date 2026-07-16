import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  OrderDetailSchema,
  type OrderListInput,
  OrderListItemSchema,
  type OrderDetail,
  type OrderListItem,
  type OrderListResult
} from "@tsu-stack/contract/order";
import { type DatabaseOrTransaction } from "@tsu-stack/db";
import { customerOrder } from "@tsu-stack/db/schema";

export function parseOrderDetail(row: typeof customerOrder.$inferSelect): OrderDetail {
  return OrderDetailSchema.parse({
    cancellationStatus: row.cancellationStatus,
    createdAt: row.createdAt.toISOString(),
    number: row.number,
    projectName: row.projectName,
    snapshot: row.snapshot,
    status: row.status
  });
}

function customerScope(customerId: string | undefined) {
  return customerId ? eq(customerOrder.customerId, customerId) : undefined;
}

export async function loadOrderByNumber(
  db: DatabaseOrTransaction,
  input: { customerId?: string; orderNumber: string; organizationId: string }
): Promise<OrderDetail | undefined> {
  const rows = await db
    .select()
    .from(customerOrder)
    .where(
      and(
        eq(customerOrder.organizationId, input.organizationId),
        eq(customerOrder.number, input.orderNumber),
        customerScope(input.customerId)
      )
    )
    .limit(1);
  return rows[0] ? parseOrderDetail(rows[0]) : undefined;
}

export async function listOrders(
  db: DatabaseOrTransaction,
  input: Omit<OrderListInput, "organizationSlug"> & {
    customerId?: string;
    organizationId: string;
  }
): Promise<OrderListResult> {
  const organizationFilter = and(
    eq(customerOrder.organizationId, input.organizationId),
    customerScope(input.customerId)
  );
  const escapedQuery = input.query
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  const queryPattern = `%${escapedQuery}%`;
  const productName = sql<string>`${customerOrder.snapshot} -> 'product' ->> 'name'`;
  const amountMinor = sql<number>`(${customerOrder.snapshot} -> 'orderTotal' ->> 'amountMinor')::numeric`;
  const listFilter = and(
    organizationFilter,
    input.status ? eq(customerOrder.status, input.status) : undefined,
    input.query
      ? or(
          ilike(customerOrder.number, queryPattern),
          ilike(customerOrder.projectName, queryPattern),
          ilike(productName, queryPattern)
        )
      : undefined
  );
  const primaryOrder =
    input.sort === "date-asc"
      ? asc(customerOrder.createdAt)
      : input.sort === "amount-asc"
        ? asc(amountMinor)
        : input.sort === "amount-desc"
          ? desc(amountMinor)
          : desc(customerOrder.createdAt);

  const [rows, totalRows, countRows] = await Promise.all([
    db
      .select({
        createdAt: customerOrder.createdAt,
        number: customerOrder.number,
        orderTotal: sql<OrderListItem["orderTotal"]>`${customerOrder.snapshot} -> 'orderTotal'`,
        productName,
        projectName: customerOrder.projectName,
        quantity: sql<number>`(${customerOrder.snapshot} ->> 'quantity')::integer`,
        status: customerOrder.status
      })
      .from(customerOrder)
      .where(listFilter)
      .orderBy(primaryOrder, desc(customerOrder.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(customerOrder)
      .where(listFilter),
    db
      .select({ status: customerOrder.status, value: sql<number>`count(*)::int` })
      .from(customerOrder)
      .where(organizationFilter)
      .groupBy(customerOrder.status)
  ]);

  const counts = { cancelled: 0, completed: 0, confirmed: 0, inProduction: 0, placed: 0 };
  for (const row of countRows) {
    counts[row.status === "in_production" ? "inProduction" : row.status] = row.value;
  }
  const total = totalRows[0]?.value ?? 0;

  return {
    counts,
    items: rows.map((row) =>
      OrderListItemSchema.parse({
        createdAt: row.createdAt.toISOString(),
        number: row.number,
        orderTotal: row.orderTotal,
        productName: row.productName,
        projectName: row.projectName,
        quantity: row.quantity,
        status: row.status
      })
    ),
    page: input.page,
    pageCount: Math.ceil(total / input.pageSize),
    pageSize: input.pageSize,
    total
  };
}
