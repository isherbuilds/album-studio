import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

import { organization, user } from "#@/schema/auth.schema";
import { customerOrder } from "#@/schema/order.schema";

export const offlinePaymentMethod = pgEnum("offline_payment_method", [
  "cash",
  "bank_transfer",
  "upi",
  "cheque",
  "other"
]);

export const offlinePayment = pgTable(
  "offline_payment",
  {
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    method: offlinePaymentMethod("method").notNull(),
    note: text("note"),
    orderId: text("order_id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    reversalOfId: text("reversal_of_id")
  },
  (table) => [
    index("offline_payment_order_created_idx").on(
      table.organizationId,
      table.orderId,
      table.createdAt
    ),
    index("offline_payment_reversal_idx").on(table.reversalOfId),
    uniqueIndex("offline_payment_id_scope_uidx").on(table.id, table.organizationId, table.orderId),
    foreignKey({
      name: "offline_payment_order_organization_fkey",
      columns: [table.orderId, table.organizationId],
      foreignColumns: [customerOrder.id, customerOrder.organizationId]
    }).onDelete("restrict"),
    foreignKey({
      name: "offline_payment_reversal_scope_fkey",
      columns: [table.reversalOfId, table.organizationId, table.orderId],
      foreignColumns: [table.id, table.organizationId, table.orderId]
    }).onDelete("restrict"),
    check("offline_payment_amount_nonzero_check", sql`${table.amountMinor} <> 0`),
    check(
      "offline_payment_reversal_sign_check",
      sql`(${table.reversalOfId} is null and ${table.amountMinor} > 0) or (${table.reversalOfId} is not null and ${table.amountMinor} < 0)`
    )
  ]
);
