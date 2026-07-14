import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp
} from "drizzle-orm/pg-core";

import { type ConfigurationDraftSnapshot } from "@tsu-stack/contract/draft";

import { user } from "#@/schema/auth.schema";
import { product } from "#@/schema/product.schema";

export const configurationDraftStatus = pgEnum("configuration_draft_status", [
  "active",
  "converted"
]);

export const configurationDraft = pgTable(
  "configuration_draft",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull(),
    productId: text("product_id").notNull(),
    revision: integer("revision").notNull().default(1),
    snapshot: jsonb("snapshot").$type<ConfigurationDraftSnapshot>().notNull(),
    status: configurationDraftStatus("status").notNull().default("active"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("configuration_draft_customer_active_updated_idx").on(
      table.organizationId,
      table.customerId,
      table.status,
      table.updatedAt
    ),
    foreignKey({
      name: "configuration_draft_product_organization_fkey",
      columns: [table.productId, table.organizationId],
      foreignColumns: [product.id, product.organizationId]
    }).onDelete("cascade"),
    check("configuration_draft_revision_check", sql`${table.revision} > 0`)
  ]
);
