import { and, eq, sql } from "drizzle-orm";

import {
  type ComponentAvailabilityOverride,
  type ComponentName,
  type ComponentUnit,
  type InventoryDelta,
  type InventoryMovementReason,
  type InventoryNonnegativeDecimal
} from "@tsu-stack/contract/inventory";
import { type Database } from "@tsu-stack/db";
import { auditEvent, component, inventoryMovement } from "@tsu-stack/db/schema";

type ComponentRow = typeof component.$inferSelect;

export async function createComponent(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    lowStockThreshold: InventoryNonnegativeDecimal;
    name: ComponentName;
    organizationId: string;
    unit: ComponentUnit;
  }
): Promise<ComponentRow> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(component)
      .values({
        lowStockThreshold: input.lowStockThreshold,
        name: input.name,
        organizationId: input.organizationId,
        unit: input.unit
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Component insert returned no row");
    await tx.insert(auditEvent).values({
      action: "inventory.component_created",
      actorUserId: input.actorUserId,
      entityId: row.id,
      entityType: "component",
      metadata: { lowStockThreshold: row.lowStockThreshold, name: row.name, unit: row.unit },
      organizationId: input.organizationId
    });
    return row;
  });
}

export async function editComponent(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    componentId: string;
    lowStockThreshold: InventoryNonnegativeDecimal;
    name: ComponentName;
    organizationId: string;
    unit: ComponentUnit;
  }
): Promise<ComponentRow | undefined> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(component)
      .set({
        lowStockThreshold: input.lowStockThreshold,
        name: input.name,
        unit: input.unit
      })
      .where(
        and(eq(component.id, input.componentId), eq(component.organizationId, input.organizationId))
      )
      .returning();
    const row = rows[0];
    if (!row) return undefined;
    await tx.insert(auditEvent).values({
      action: "inventory.component_edited",
      actorUserId: input.actorUserId,
      entityId: row.id,
      entityType: "component",
      metadata: { lowStockThreshold: row.lowStockThreshold, name: row.name, unit: row.unit },
      organizationId: input.organizationId
    });
    return row;
  });
}

export async function setComponentAvailability(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    availabilityOverride: ComponentAvailabilityOverride;
    componentId: string;
    organizationId: string;
  }
): Promise<ComponentRow | undefined> {
  return db.transaction(async (tx) => {
    const currentRows = await tx
      .select()
      .from(component)
      .where(
        and(eq(component.id, input.componentId), eq(component.organizationId, input.organizationId))
      )
      .limit(1)
      .for("update");
    const current = currentRows[0];
    if (!current) return undefined;
    if (current.availabilityOverride === input.availabilityOverride) return current;

    const rows = await tx
      .update(component)
      .set({ availabilityOverride: input.availabilityOverride })
      .where(and(eq(component.id, current.id), eq(component.organizationId, input.organizationId)))
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Component availability update returned no row");
    await tx.insert(auditEvent).values({
      action: "inventory.availability_set",
      actorUserId: input.actorUserId,
      entityId: row.id,
      entityType: "component",
      metadata: { from: current.availabilityOverride, to: row.availabilityOverride },
      organizationId: input.organizationId
    });
    return row;
  });
}

export async function recordInventoryMovement(
  db: Pick<Database, "transaction">,
  input: {
    actorUserId: string;
    componentId: string;
    delta: InventoryDelta;
    organizationId: string;
    reason: InventoryMovementReason;
  }
) {
  return db.transaction(async (tx) => {
    const componentRows = await tx
      .update(component)
      .set({ quantity: sql`${component.quantity} + ${input.delta}::numeric` })
      .where(
        and(eq(component.id, input.componentId), eq(component.organizationId, input.organizationId))
      )
      .returning();
    const componentRow = componentRows[0];
    if (!componentRow) return { kind: "not_found" } as const;

    const movementRows = await tx
      .insert(inventoryMovement)
      .values({
        actorUserId: input.actorUserId,
        componentId: componentRow.id,
        delta: input.delta,
        organizationId: input.organizationId,
        reason: input.reason
      })
      .returning();
    const movement = movementRows[0];
    if (!movement) throw new Error("Inventory Movement insert returned no row");
    return { component: componentRow, kind: "recorded", movement } as const;
  });
}
