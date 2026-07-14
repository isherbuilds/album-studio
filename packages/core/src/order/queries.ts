import { and, desc, eq, sql } from "drizzle-orm";

import {
  OrderDetailSchema,
  OrderListItemSchema,
  type OrderDetail,
  type OrderListItem
} from "@tsu-stack/contract/order";
import { type DatabaseOrTransaction } from "@tsu-stack/db";
import { customerOrder } from "@tsu-stack/db/schema";

export function parseOrderDetail(row: typeof customerOrder.$inferSelect): OrderDetail {
  return OrderDetailSchema.parse({
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
  input: { customerId?: string; organizationId: string }
): Promise<OrderListItem[]> {
  const rows = await db
    .select({
      createdAt: customerOrder.createdAt,
      number: customerOrder.number,
      orderTotal: sql<OrderListItem["orderTotal"]>`${customerOrder.snapshot} -> 'orderTotal'`,
      productName: sql<string>`${customerOrder.snapshot} -> 'product' ->> 'name'`,
      projectName: customerOrder.projectName,
      quantity: sql<number>`(${customerOrder.snapshot} ->> 'quantity')::integer`,
      status: customerOrder.status
    })
    .from(customerOrder)
    .where(
      and(eq(customerOrder.organizationId, input.organizationId), customerScope(input.customerId))
    )
    .orderBy(desc(customerOrder.createdAt), desc(customerOrder.id));

  return rows.map((row) =>
    OrderListItemSchema.parse({
      createdAt: row.createdAt.toISOString(),
      number: row.number,
      orderTotal: row.orderTotal,
      productName: row.productName,
      projectName: row.projectName,
      quantity: row.quantity,
      status: row.status
    })
  );
}
