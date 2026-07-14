import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

import { type OrderSnapshot } from "@tsu-stack/contract/order";

import { organization, user } from "#@/schema/auth.schema";
import { configurationDraft } from "#@/schema/draft.schema";
import { product } from "#@/schema/product.schema";

export const orderStatus = pgEnum("order_status", [
  "placed",
  "confirmed",
  "in_production",
  "completed",
  "cancelled"
]);

export const customerOrder = pgTable(
  "customer_order",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    draftId: text("draft_id")
      .notNull()
      .references(() => configurationDraft.id, { onDelete: "restrict" }),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    number: text("number")
      .notNull()
      .default(sql`'AS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    productId: text("product_id").notNull(),
    projectName: text("project_name"),
    snapshot: jsonb("snapshot").$type<OrderSnapshot>().notNull(),
    status: orderStatus("status").notNull().default("placed"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("customer_order_number_uidx").on(table.number),
    uniqueIndex("customer_order_draft_uidx").on(table.draftId),
    index("customer_order_organization_created_idx").on(table.organizationId, table.createdAt),
    index("customer_order_customer_created_idx").on(
      table.organizationId,
      table.customerId,
      table.createdAt
    ),
    foreignKey({
      name: "customer_order_product_organization_fkey",
      columns: [table.productId, table.organizationId],
      foreignColumns: [product.id, product.organizationId]
    }).onDelete("restrict")
  ]
);
