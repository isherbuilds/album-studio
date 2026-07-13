import {
  foreignKey,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique
} from "drizzle-orm/pg-core";

import { organization } from "#@/schema/auth.schema";
import { optionValue } from "#@/schema/product.schema";

export const componentAvailabilityOverride = pgEnum("component_availability_override", [
  "automatic",
  "available",
  "low",
  "out"
]);

/**
 * An Organization-scoped material Component. `quantity` and `lowStockThreshold`
 * are decimals. Effective availability derives from `availabilityOverride` first;
 * under `automatic`, quantity at or below zero is `out`, at or below the threshold
 * is `low`, otherwise `available`. Slice 4 seeds and reads Components; Slice 8 adds
 * Movements and override mutations.
 */
export const component = pgTable(
  "component",
  {
    availabilityOverride: componentAvailabilityOverride("availability_override")
      .notNull()
      .default("automatic"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    lowStockThreshold: numeric("low_stock_threshold", { precision: 14, scale: 4 })
      .notNull()
      .default("0"),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("0"),
    unit: text("unit").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("component_organization_idx").on(table.organizationId),
    unique("component_id_organization_key").on(table.id, table.organizationId)
  ]
);

/**
 * Many-to-many link between an Option Value and the Components it consumes. The
 * least-available linked Component controls whether the value can be ordered.
 */
export const optionValueComponent = pgTable(
  "option_value_component",
  {
    componentId: text("component_id").notNull(),
    optionValueId: text("option_value_id").notNull(),
    organizationId: text("organization_id").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.optionValueId, table.componentId] }),
    index("option_value_component_component_idx").on(table.componentId),
    foreignKey({
      name: "option_value_component_component_fkey",
      columns: [table.componentId, table.organizationId],
      foreignColumns: [component.id, component.organizationId]
    }).onDelete("cascade"),
    foreignKey({
      name: "option_value_component_option_value_fkey",
      columns: [table.optionValueId, table.organizationId],
      foreignColumns: [optionValue.id, optionValue.organizationId]
    }).onDelete("cascade")
  ]
);
