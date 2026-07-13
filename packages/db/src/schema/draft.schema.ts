import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp
} from "drizzle-orm/pg-core";

import { type ConfigurationSelections } from "@tsu-stack/contract/configuration";
import {
  type ConfigurationDraftEvaluationSummary,
  type ConfigurationDraftStep
} from "@tsu-stack/contract/draft";

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
    evaluationSummary: jsonb("evaluation_summary")
      .$type<ConfigurationDraftEvaluationSummary>()
      .notNull(),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull(),
    productId: text("product_id").notNull(),
    projectName: text("project_name"),
    quantity: doublePrecision("quantity").notNull(),
    revision: integer("revision").notNull().default(1),
    selections: jsonb("selections").$type<ConfigurationSelections>().notNull(),
    status: configurationDraftStatus("status").notNull().default("active"),
    step: jsonb("step").$type<ConfigurationDraftStep>().notNull(),
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
    check(
      "configuration_draft_project_name_check",
      sql`${table.projectName} IS NULL OR (char_length(${table.projectName}) >= 1 AND char_length(${table.projectName}) <= 120)`
    ),
    check(
      "configuration_draft_quantity_safe_number_check",
      sql`${table.quantity} >= ${Number.MIN_SAFE_INTEGER} AND ${table.quantity} <= ${Number.MAX_SAFE_INTEGER}`
    ),
    check("configuration_draft_revision_check", sql`${table.revision} > 0`)
  ]
);
