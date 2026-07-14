import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { ComponentAvailabilityStatusSchema } from "@tsu-stack/contract/configuration";
import {
  ComponentAvailabilityOverrideSchema,
  InventoryComponentByIdInputSchema,
  InventoryCreateComponentInputSchema,
  InventoryDecimalSchema,
  InventoryEditComponentInputSchema,
  InventoryListInputSchema,
  InventoryNonnegativeDecimalSchema,
  InventoryRecordMovementInputSchema,
  InventorySetAvailabilityInputSchema
} from "@tsu-stack/contract/inventory";
import {
  computeEffectiveAvailability,
  createComponent,
  editComponent,
  recordInventoryMovement,
  setComponentAvailability
} from "@tsu-stack/core/inventory";
import { component, inventoryMovement, user } from "@tsu-stack/db/schema";

import { organizationActionProcedure } from "#@/lib/procedures/factory";

const componentOutputSchema = z.object({
  availabilityOverride: ComponentAvailabilityOverrideSchema,
  createdAt: z.string().datetime(),
  effectiveAvailability: ComponentAvailabilityStatusSchema,
  id: z.string().min(1),
  lowStockThreshold: InventoryNonnegativeDecimalSchema,
  name: z.string().min(1),
  quantity: InventoryDecimalSchema,
  unit: z.string().min(1),
  updatedAt: z.string().datetime()
});

const movementOutputSchema = z.object({
  actorName: z.string().min(1),
  createdAt: z.string().datetime(),
  delta: InventoryDecimalSchema,
  id: z.string().min(1),
  reason: z.string().min(1)
});

const movementMutationOutputSchema = z.object({
  component: componentOutputSchema,
  movement: movementOutputSchema
});

function serializeComponent(row: typeof component.$inferSelect) {
  return {
    availabilityOverride: row.availabilityOverride,
    createdAt: row.createdAt.toISOString(),
    effectiveAvailability: computeEffectiveAvailability(row),
    id: row.id,
    lowStockThreshold: row.lowStockThreshold,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeMovement(row: typeof inventoryMovement.$inferSelect, actorName: string) {
  return {
    actorName,
    createdAt: row.createdAt.toISOString(),
    delta: row.delta,
    id: row.id,
    reason: row.reason
  };
}

export const inventoryRouter = {
  list: organizationActionProcedure(InventoryListInputSchema, "inventory.manage")
    .route({ description: "List an organization's inventory Components", method: "GET" })
    .output(z.array(componentOutputSchema))
    .handler(async ({ context }) => {
      const rows = await context.db
        .select()
        .from(component)
        .where(eq(component.organizationId, context.organization.id))
        .orderBy(asc(component.name), asc(component.id));
      return rows.map(serializeComponent);
    }),
  listMovements: organizationActionProcedure(InventoryComponentByIdInputSchema, "inventory.manage")
    .route({ description: "List a Component's Movement history", method: "GET" })
    .output(z.array(movementOutputSchema))
    .handler(async ({ context, input }) => {
      const movements = await context.db
        .select({ actorName: user.name, movement: inventoryMovement })
        .from(inventoryMovement)
        .innerJoin(user, eq(user.id, inventoryMovement.actorUserId))
        .where(
          and(
            eq(inventoryMovement.componentId, input.componentId),
            eq(inventoryMovement.organizationId, context.organization.id)
          )
        )
        .orderBy(desc(inventoryMovement.createdAt), desc(inventoryMovement.id))
        .limit(200);
      return movements.map((row) => serializeMovement(row.movement, row.actorName));
    }),
  createComponent: organizationActionProcedure(
    InventoryCreateComponentInputSchema,
    "inventory.manage"
  )
    .route({ description: "Create an inventory Component", method: "POST" })
    .output(componentOutputSchema)
    .handler(async ({ context, input }) => {
      const row = await createComponent(context.db, {
        actorUserId: context.authSession.user.id,
        lowStockThreshold: input.lowStockThreshold,
        name: input.name,
        organizationId: context.organization.id,
        unit: input.unit
      });
      return serializeComponent(row);
    }),
  editComponent: organizationActionProcedure(InventoryEditComponentInputSchema, "inventory.manage")
    .route({ description: "Edit an inventory Component", method: "PATCH" })
    .output(componentOutputSchema)
    .handler(async ({ context, errors, input }) => {
      const row = await editComponent(context.db, {
        actorUserId: context.authSession.user.id,
        componentId: input.componentId,
        lowStockThreshold: input.lowStockThreshold,
        name: input.name,
        organizationId: context.organization.id,
        unit: input.unit
      });
      if (!row) throw errors.NOT_FOUND({ message: "Component not found" });
      return serializeComponent(row);
    }),
  recordMovement: organizationActionProcedure(
    InventoryRecordMovementInputSchema,
    "inventory.manage"
  )
    .route({ description: "Append a stock Movement", method: "POST" })
    .errors({
      QUANTITY_OUT_OF_RANGE: { message: "Movement exceeds quantity range", status: 422 }
    })
    .output(movementMutationOutputSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await recordInventoryMovement(context.db, {
        actorUserId: context.authSession.user.id,
        componentId: input.componentId,
        delta: input.delta,
        organizationId: context.organization.id,
        reason: input.reason
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Component not found" });
      if (result.kind === "quantity_out_of_range") throw errors.QUANTITY_OUT_OF_RANGE();
      return {
        component: serializeComponent(result.component),
        movement: serializeMovement(result.movement, context.authSession.user.name)
      };
    }),
  setAvailability: organizationActionProcedure(
    InventorySetAvailabilityInputSchema,
    "inventory.manage"
  )
    .route({ description: "Set a Component availability override", method: "PATCH" })
    .output(componentOutputSchema)
    .handler(async ({ context, errors, input }) => {
      const row = await setComponentAvailability(context.db, {
        actorUserId: context.authSession.user.id,
        availabilityOverride: input.availabilityOverride,
        componentId: input.componentId,
        organizationId: context.organization.id
      });
      if (!row) throw errors.NOT_FOUND({ message: "Component not found" });
      return serializeComponent(row);
    })
};
