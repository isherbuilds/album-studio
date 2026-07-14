import { createRouterClient } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { db } from "@tsu-stack/db";
import {
  auditEvent,
  component,
  inventoryMovement,
  member,
  organization,
  user
} from "@tsu-stack/db/schema";
import { createLogger } from "@tsu-stack/logger/server";

import { appRouter } from "#@/routers/index";

const fixture = {
  customerId: crypto.randomUUID(),
  managerId: crypto.randomUUID(),
  otherOrganizationId: crypto.randomUUID(),
  otherOrganizationSlug: `inventory-${crypto.randomUUID()}`,
  organizationId: crypto.randomUUID(),
  organizationSlug: `inventory-${crypto.randomUUID()}`,
  ownerId: crypto.randomUUID()
};

function clientFor(userId: string) {
  return createRouterClient(appRouter, {
    context: {
      authSession: {
        session: {
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          id: crypto.randomUUID(),
          token: crypto.randomUUID(),
          updatedAt: new Date(),
          userId
        },
        user: {
          banned: false,
          banExpires: null,
          banReason: null,
          createdAt: new Date(),
          email: `${userId}@example.com`,
          emailVerified: true,
          id: userId,
          image: null,
          name: "Inventory Fixture User",
          role: "user",
          updatedAt: new Date()
        }
      },
      db,
      headers: new Headers(),
      logger: createLogger({ operation: "inventory_router_test" })
    }
  });
}

beforeAll(async () => {
  await db.insert(user).values(
    [fixture.customerId, fixture.managerId, fixture.ownerId].map((id) => {
      return {
        email: `${id}@example.com`,
        emailVerified: true,
        id,
        name: "Inventory Fixture User",
        role: "user"
      };
    })
  );
  await db.insert(organization).values([
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.organizationId,
      name: "Inventory Organization",
      slug: fixture.organizationSlug
    },
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.otherOrganizationId,
      name: "Other Inventory Organization",
      slug: fixture.otherOrganizationSlug
    }
  ]);
  await db.insert(member).values([
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "customer",
      userId: fixture.customerId
    },
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "manager",
      userId: fixture.managerId
    },
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "owner",
      userId: fixture.ownerId
    },
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.otherOrganizationId,
      role: "owner",
      userId: fixture.ownerId
    }
  ]);
});

afterAll(async () => {
  await db
    .delete(inventoryMovement)
    .where(eq(inventoryMovement.organizationId, fixture.organizationId));
  await db
    .delete(organization)
    .where(inArray(organization.id, [fixture.organizationId, fixture.otherOrganizationId]));
  await db
    .delete(user)
    .where(inArray(user.id, [fixture.customerId, fixture.managerId, fixture.ownerId]));
});

beforeEach(async () => {
  await db
    .delete(inventoryMovement)
    .where(eq(inventoryMovement.organizationId, fixture.organizationId));
  await db.delete(component).where(eq(component.organizationId, fixture.organizationId));
});

describe("inventory router", () => {
  it("lets an Owner create a Component and list its derived availability", async () => {
    const owner = clientFor(fixture.ownerId);

    const created = await owner.inventory.createComponent({
      lowStockThreshold: "5.5",
      name: "  Italian leather  ",
      organizationSlug: fixture.organizationSlug,
      unit: "  sq ft  "
    });

    expect(created).toMatchObject({
      availabilityOverride: "automatic",
      effectiveAvailability: "out",
      lowStockThreshold: "5.5000",
      name: "Italian leather",
      quantity: "0.0000",
      unit: "sq ft"
    });
    await expect(
      owner.inventory.list({ organizationSlug: fixture.organizationSlug })
    ).resolves.toEqual([created]);
  });

  it("lets a Manager edit a Component and set its availability override", async () => {
    const manager = clientFor(fixture.managerId);
    const created = await manager.inventory.createComponent({
      lowStockThreshold: "2",
      name: "Board",
      organizationSlug: fixture.organizationSlug,
      unit: "sheet"
    });

    const edited = await manager.inventory.editComponent({
      componentId: created.id,
      lowStockThreshold: "4.25",
      name: "Grey board",
      organizationSlug: fixture.organizationSlug,
      unit: "board"
    });
    expect(edited).toMatchObject({
      effectiveAvailability: "out",
      lowStockThreshold: "4.2500",
      name: "Grey board",
      unit: "board"
    });

    await expect(
      manager.inventory.setAvailability({
        availabilityOverride: "available",
        componentId: created.id,
        organizationSlug: fixture.organizationSlug
      })
    ).resolves.toMatchObject({
      availabilityOverride: "available",
      effectiveAvailability: "available",
      id: created.id,
      quantity: "0.0000"
    });
  });

  it("records decimal Movements and returns current quantity with append-only history", async () => {
    const manager = clientFor(fixture.managerId);
    const created = await manager.inventory.createComponent({
      lowStockThreshold: "2.5",
      name: "Linen",
      organizationSlug: fixture.organizationSlug,
      unit: "metre"
    });

    const received = await manager.inventory.recordMovement({
      componentId: created.id,
      delta: "3.125",
      organizationSlug: fixture.organizationSlug,
      reason: "  Supplier delivery  "
    });
    expect(received.component).toMatchObject({
      effectiveAvailability: "available",
      id: created.id,
      quantity: "3.1250"
    });
    expect(received.movement).toMatchObject({
      actorName: "Inventory Fixture User",
      delta: "3.1250",
      reason: "Supplier delivery"
    });

    const used = await manager.inventory.recordMovement({
      componentId: created.id,
      delta: "-1",
      organizationSlug: fixture.organizationSlug,
      reason: "Production use"
    });
    expect(used.component).toMatchObject({
      effectiveAvailability: "low",
      quantity: "2.1250"
    });

    await expect(
      manager.inventory.listMovements({
        componentId: created.id,
        organizationSlug: fixture.organizationSlug
      })
    ).resolves.toMatchObject([
      { delta: "-1.0000", reason: "Production use" },
      { delta: "3.1250", reason: "Supplier delivery" }
    ]);
  });

  it("updates quantity atomically when decimal Movements race", async () => {
    const owner = clientFor(fixture.ownerId);
    const created = await owner.inventory.createComponent({
      lowStockThreshold: "0",
      name: "Adhesive",
      organizationSlug: fixture.organizationSlug,
      unit: "litre"
    });

    await Promise.all([
      owner.inventory.recordMovement({
        componentId: created.id,
        delta: "1.25",
        organizationSlug: fixture.organizationSlug,
        reason: "Delivery one"
      }),
      owner.inventory.recordMovement({
        componentId: created.id,
        delta: "2.5",
        organizationSlug: fixture.organizationSlug,
        reason: "Delivery two"
      })
    ]);

    const list = await owner.inventory.list({ organizationSlug: fixture.organizationSlug });
    expect(list.find((row) => row.id === created.id)?.quantity).toBe("3.7500");
    const movements = await owner.inventory.listMovements({
      componentId: created.id,
      organizationSlug: fixture.organizationSlug
    });
    expect(movements).toHaveLength(2);
  });

  it("allows stock to fall below zero and derives out", async () => {
    const owner = clientFor(fixture.ownerId);
    const created = await owner.inventory.createComponent({
      lowStockThreshold: "0",
      name: "Thread",
      organizationSlug: fixture.organizationSlug,
      unit: "spool"
    });

    await expect(
      owner.inventory.recordMovement({
        componentId: created.id,
        delta: "-5",
        organizationSlug: fixture.organizationSlug,
        reason: "Overdraw"
      })
    ).resolves.toMatchObject({
      component: { effectiveAvailability: "out", quantity: "-5.0000" }
    });
  });

  it("treats a redundant availability override as a no-op with no new audit event", async () => {
    const owner = clientFor(fixture.ownerId);
    const created = await owner.inventory.createComponent({
      lowStockThreshold: "0",
      name: "Cloth",
      organizationSlug: fixture.organizationSlug,
      unit: "metre"
    });

    const setOut = () =>
      owner.inventory.setAvailability({
        availabilityOverride: "out",
        componentId: created.id,
        organizationSlug: fixture.organizationSlug
      });
    await expect(setOut()).resolves.toMatchObject({ availabilityOverride: "out" });
    await expect(setOut()).resolves.toMatchObject({ availabilityOverride: "out" });

    const events = await db
      .select()
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.entityId, created.id),
          eq(auditEvent.action, "inventory.availability_set")
        )
      );
    expect(events).toHaveLength(1);
  });

  it("rejects Customer access and zero-delta Movements", async () => {
    const customer = clientFor(fixture.customerId);
    const owner = clientFor(fixture.ownerId);
    const created = await owner.inventory.createComponent({
      lowStockThreshold: "0",
      name: "Paper",
      organizationSlug: fixture.organizationSlug,
      unit: "sheet"
    });

    await expect(
      customer.inventory.list({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });
    await expect(
      owner.inventory.recordMovement({
        componentId: created.id,
        delta: "0",
        organizationSlug: fixture.organizationSlug,
        reason: "No change"
      })
    ).rejects.toBeDefined();
  });

  it("scopes every Component ID operation to current Organization", async () => {
    const owner = clientFor(fixture.ownerId);
    const created = await owner.inventory.createComponent({
      lowStockThreshold: "1",
      name: "Cross-tenant board",
      organizationSlug: fixture.organizationSlug,
      unit: "sheet"
    });
    const foreignScope = {
      componentId: created.id,
      organizationSlug: fixture.otherOrganizationSlug
    };

    await expect(
      owner.inventory.list({ organizationSlug: fixture.otherOrganizationSlug })
    ).resolves.toEqual([]);
    await Promise.all([
      expect(owner.inventory.listMovements(foreignScope)).resolves.toEqual([]),
      expect(
        owner.inventory.editComponent({
          ...foreignScope,
          lowStockThreshold: "2",
          name: "Cross-tenant edit",
          unit: "board"
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true }),
      expect(
        owner.inventory.recordMovement({
          ...foreignScope,
          delta: "1",
          reason: "Cross-tenant movement"
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true }),
      expect(
        owner.inventory.setAvailability({
          ...foreignScope,
          availabilityOverride: "out"
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true })
    ]);
  });
});
