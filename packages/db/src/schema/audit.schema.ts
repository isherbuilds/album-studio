import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "#@/schema/auth.schema";

/**
 * Append-only record of privileged mutations (role changes, pricing changes,
 * order-status changes, cancellation decisions, and similar). Not a Better Auth
 * table: it lives here, outside `auth.schema.ts`, so the generated auth schema
 * stays regeneratable.
 */
export const auditEvent = pgTable(
  "audit_event",
  {
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    entityId: text("entity_id").notNull(),
    entityType: text("entity_type").notNull(),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" })
  },
  (table) => [
    index("audit_event_organization_created_at_idx").on(table.organizationId, table.createdAt)
  ]
);
