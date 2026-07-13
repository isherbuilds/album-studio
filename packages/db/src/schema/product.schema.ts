import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

import { organization } from "#@/schema/auth.schema";

export const productStatus = pgEnum("product_status", ["draft", "published", "archived"]);

export const optionGroupType = pgEnum("option_group_type", ["single", "boolean", "number"]);

/**
 * An Organization's configurable sellable Product. `basePriceMinor` and every
 * derived monetary field are integer minor units (`bigint`) in the Organization's
 * currency. `revision` tracks lifecycle/editor concurrency only; it never
 * participates in configuration evaluation or checkout price acceptance.
 */
export const product = pgTable(
  "product",
  {
    basePriceMinor: bigint("base_price_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    imageUrls: jsonb("image_urls")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull().default(1),
    slug: text("slug").notNull(),
    status: productStatus("status").notNull().default("draft"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("product_organization_slug_uidx").on(table.organizationId, table.slug),
    index("product_organization_status_idx").on(table.organizationId, table.status)
  ]
);

/**
 * An ordered Option Group owned by a Product. `key` is the immutable machine
 * identifier used in Draft selections and evaluation; labels and `position` may
 * change without changing identity. Numeric columns are populated only when
 * `type` is `number` (sheet count uses this shape).
 */
export const optionGroup = pgTable(
  "option_group",
  {
    additionalUnitPriceMinor: bigint("additional_unit_price_minor", { mode: "number" }),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    included: integer("included"),
    key: text("key").notNull(),
    label: text("label").notNull(),
    maximum: integer("maximum"),
    minimum: integer("minimum"),
    position: integer("position").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    required: boolean("required").notNull(),
    step: integer("step"),
    type: optionGroupType("type").notNull()
  },
  (table) => [
    uniqueIndex("option_group_product_key_uidx").on(table.productId, table.key),
    index("option_group_product_position_idx").on(table.productId, table.position),
    // Enforce the domain invariant at the DB: a `number` group owns all of its
    // numeric fields (spec §Domain) with a positive step. Non-number groups leave
    // them null. This stops a stray null from reaching ProductDefinitionSchema and
    // 500-ing catalog.bySlug for the whole product.
    check(
      "option_group_number_fields_check",
      sql`${table.type} <> 'number' OR (${table.minimum} IS NOT NULL AND ${table.maximum} IS NOT NULL AND ${table.step} IS NOT NULL AND ${table.included} IS NOT NULL AND ${table.additionalUnitPriceMinor} IS NOT NULL AND ${table.step} > 0)`
    )
  ]
);

/**
 * A selectable Option Value in a `single` or `boolean` group. Its row `id` is the
 * immutable machine identifier carried in Draft selections. `priceAdjustmentMinor`
 * is a per-unit fixed adjustment in integer minor units, including zero.
 */
export const optionValue = pgTable(
  "option_value",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Optional per-value preview image (relative asset path or absolute URL). Drives
    // the configurator's swap-on-select hero; null falls back to a generated placeholder.
    imageUrl: text("image_url"),
    label: text("label").notNull(),
    optionGroupId: text("option_group_id")
      .notNull()
      .references(() => optionGroup.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    priceAdjustmentMinor: bigint("price_adjustment_minor", { mode: "number" }).notNull()
  },
  (table) => [index("option_value_group_position_idx").on(table.optionGroupId, table.position)]
);

/** Direct compatibility edge. Prerequisite groups derive from Option Value ownership. */
export const optionValueRequirement = pgTable(
  "option_value_requirement",
  {
    optionValueId: text("option_value_id")
      .notNull()
      .references(() => optionValue.id, { onDelete: "cascade" }),
    prerequisiteOptionValueId: text("prerequisite_option_value_id")
      .notNull()
      .references(() => optionValue.id, { onDelete: "cascade" })
  },
  (table) => [
    primaryKey({
      name: "option_value_requirement_pkey",
      columns: [table.optionValueId, table.prerequisiteOptionValueId]
    }),
    index("option_value_requirement_prerequisite_idx").on(table.prerequisiteOptionValueId)
  ]
);
