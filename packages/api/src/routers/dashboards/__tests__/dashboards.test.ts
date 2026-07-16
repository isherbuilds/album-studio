import { createRouterClient } from "@orpc/server";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { auth } from "@tsu-stack/auth/index";
import { ConfigurationDraftSnapshotSchema } from "@tsu-stack/contract/draft";
import { OrderSnapshotSchema } from "@tsu-stack/contract/order";
import { db } from "@tsu-stack/db";
import {
  component,
  configurationDraft,
  customerOrder,
  member,
  offlinePayment,
  organization,
  product,
  user
} from "@tsu-stack/db/schema";
import { createLogger } from "@tsu-stack/logger/server";

import { appRouter } from "#@/routers/index";

const fixture = {
  customerId: crypto.randomUUID(),
  secondCustomerId: crypto.randomUUID(),
  managerId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  organizationSlug: `dashboard-${crypto.randomUUID()}`,
  otherCustomerId: crypto.randomUUID(),
  otherOrganizationId: crypto.randomUUID(),
  otherOrganizationSlug: `dashboard-other-${crypto.randomUUID()}`,
  otherOwnerId: crypto.randomUUID(),
  outsiderId: crypto.randomUUID(),
  ownerId: crypto.randomUUID(),
  productId: crypto.randomUUID(),
  otherProductId: crypto.randomUUID()
};
const userId = crypto.randomUUID();
const adminEmail = `${crypto.randomUUID()}@example.com`;
const nonAdminEmail = `${crypto.randomUUID()}@example.com`;
const password = "dashboard-test-password";
let adminHeaders = new Headers();
let nonAdminHeaders = new Headers();

function contextFor(
  headers = new Headers(),
  platformRole: string | null = "user",
  authenticatedUserId: string = userId
) {
  return {
    authSession: {
      session: {
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        updatedAt: new Date(),
        userId: authenticatedUserId
      },
      user: {
        banned: false,
        banExpires: null,
        banReason: null,
        createdAt: new Date(),
        email: `${authenticatedUserId}@example.com`,
        emailVerified: true,
        id: authenticatedUserId,
        image: null,
        name: "Dashboard Fixture User",
        role: platformRole,
        updatedAt: new Date()
      }
    },
    db,
    headers,
    logger: createLogger({ operation: "dashboards_router_test" })
  };
}

function clientFor(authenticatedUserId: string) {
  return createRouterClient(appRouter, {
    context: contextFor(new Headers(), "user", authenticatedUserId)
  });
}

const draftSnapshot = ConfigurationDraftSnapshotSchema.parse({
  evaluationSummary: {
    orderTotal: { amountMinor: 10_000, currency: "EUR" },
    perUnitBreakdown: [{ amountMinor: 10_000, kind: "base" }],
    perUnitTotal: { amountMinor: 10_000, currency: "EUR" },
    status: "valid"
  },
  projectName: null,
  quantity: 1,
  selections: {},
  step: { kind: "review" }
});

function orderSnapshot(amountMinor: number, orderProductId = fixture.productId) {
  return OrderSnapshotSchema.parse({
    orderTotal: { amountMinor, currency: "EUR" },
    perUnitBreakdown: [{ amountMinor, kind: "base" }],
    perUnitTotal: { amountMinor, currency: "EUR" },
    product: { id: orderProductId, name: "Dashboard Album", slug: "dashboard-album" },
    projectName: null,
    quantity: 1,
    selections: []
  });
}

beforeAll(async () => {
  await Promise.all([
    auth.api.createUser({
      body: { email: adminEmail, name: "Dashboard Admin", password, role: "admin" }
    }),
    auth.api.createUser({
      body: { email: nonAdminEmail, name: "Dashboard User", password, role: "user" }
    })
  ]);
  const [adminSignIn, nonAdminSignIn] = await Promise.all([
    auth.api.signInEmail({ body: { email: adminEmail, password }, returnHeaders: true }),
    auth.api.signInEmail({ body: { email: nonAdminEmail, password }, returnHeaders: true })
  ]);
  const requestHeaders = (headers: Headers) =>
    new Headers({
      cookie: headers
        .getSetCookie()
        .map((value) => value.split(";", 1)[0])
        .join("; ")
    });
  adminHeaders = requestHeaders(adminSignIn.headers);
  nonAdminHeaders = requestHeaders(nonAdminSignIn.headers);

  const now = new Date();
  await db.insert(user).values([
    {
      email: `${fixture.ownerId}@example.com`,
      emailVerified: true,
      id: fixture.ownerId,
      name: "Owner"
    },
    {
      email: `${fixture.managerId}@example.com`,
      emailVerified: true,
      id: fixture.managerId,
      name: "Manager"
    },
    {
      email: `${fixture.customerId}@example.com`,
      emailVerified: true,
      id: fixture.customerId,
      name: "Customer"
    },
    {
      email: `${fixture.secondCustomerId}@example.com`,
      emailVerified: true,
      id: fixture.secondCustomerId,
      name: "Second Customer"
    },
    {
      email: `${fixture.outsiderId}@example.com`,
      emailVerified: true,
      id: fixture.outsiderId,
      name: "Outsider"
    },
    {
      email: `${fixture.otherOwnerId}@example.com`,
      emailVerified: true,
      id: fixture.otherOwnerId,
      name: "Other Owner"
    },
    {
      email: `${fixture.otherCustomerId}@example.com`,
      emailVerified: true,
      id: fixture.otherCustomerId,
      name: "Other Customer"
    }
  ]);
  await db.insert(organization).values([
    {
      createdAt: now,
      currency: "EUR",
      id: fixture.organizationId,
      name: "Dashboard Organization",
      slug: fixture.organizationSlug
    },
    {
      createdAt: now,
      currency: "USD",
      id: fixture.otherOrganizationId,
      name: "Other Dashboard Organization",
      slug: fixture.otherOrganizationSlug
    }
  ]);
  await db.insert(member).values([
    {
      createdAt: now,
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "owner",
      userId: fixture.ownerId
    },
    {
      createdAt: now,
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "manager",
      userId: fixture.managerId
    },
    {
      createdAt: now,
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "customer",
      userId: fixture.customerId
    },
    {
      createdAt: now,
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "customer",
      userId: fixture.secondCustomerId
    },
    {
      createdAt: now,
      id: crypto.randomUUID(),
      organizationId: fixture.otherOrganizationId,
      role: "owner",
      userId: fixture.otherOwnerId
    },
    {
      createdAt: now,
      id: crypto.randomUUID(),
      organizationId: fixture.otherOrganizationId,
      role: "customer",
      userId: fixture.otherCustomerId
    }
  ]);
  await db.insert(product).values([
    {
      basePriceMinor: 10_000,
      id: fixture.productId,
      name: "Dashboard Album",
      organizationId: fixture.organizationId,
      slug: "dashboard-album",
      status: "published"
    },
    {
      basePriceMinor: 50_000,
      id: fixture.otherProductId,
      name: "Other Dashboard Album",
      organizationId: fixture.otherOrganizationId,
      slug: "other-dashboard-album",
      status: "published"
    }
  ]);
  await db.insert(component).values([
    {
      id: crypto.randomUUID(),
      lowStockThreshold: "5",
      name: "Automatic out",
      organizationId: fixture.organizationId,
      quantity: "0",
      unit: "piece"
    },
    {
      id: crypto.randomUUID(),
      lowStockThreshold: "5",
      name: "Automatic low",
      organizationId: fixture.organizationId,
      quantity: "3",
      unit: "piece"
    },
    {
      id: crypto.randomUUID(),
      lowStockThreshold: "5",
      name: "Automatic available",
      organizationId: fixture.organizationId,
      quantity: "10",
      unit: "piece"
    },
    {
      availabilityOverride: "out",
      id: crypto.randomUUID(),
      lowStockThreshold: "5",
      name: "Override out",
      organizationId: fixture.organizationId,
      quantity: "100",
      unit: "piece"
    },
    {
      availabilityOverride: "low",
      id: crypto.randomUUID(),
      lowStockThreshold: "5",
      name: "Override low",
      organizationId: fixture.organizationId,
      quantity: "100",
      unit: "piece"
    },
    {
      availabilityOverride: "available",
      id: crypto.randomUUID(),
      lowStockThreshold: "5",
      name: "Override available",
      organizationId: fixture.organizationId,
      quantity: "0",
      unit: "piece"
    },
    {
      availabilityOverride: "out",
      id: crypto.randomUUID(),
      name: "Other tenant out",
      organizationId: fixture.otherOrganizationId,
      unit: "piece"
    }
  ]);

  const orders = [
    {
      amountMinor: 10_000,
      customerId: fixture.customerId,
      createdAt: new Date(now.getTime() - 2 * 86_400_000),
      status: "placed" as const
    },
    {
      amountMinor: 5_000,
      customerId: fixture.secondCustomerId,
      createdAt: new Date(now.getTime() - 3 * 86_400_000),
      status: "placed" as const
    },
    {
      amountMinor: 20_000,
      customerId: fixture.customerId,
      createdAt: new Date(now.getTime() - 31 * 86_400_000),
      status: "confirmed" as const
    },
    {
      amountMinor: 30_000,
      customerId: fixture.customerId,
      createdAt: new Date(now.getTime() - 4 * 86_400_000),
      status: "in_production" as const
    },
    {
      amountMinor: 40_000,
      customerId: fixture.secondCustomerId,
      createdAt: new Date(now.getTime() - 5 * 86_400_000),
      status: "completed" as const
    },
    {
      amountMinor: 99_999,
      customerId: fixture.customerId,
      createdAt: new Date(now.getTime() - 6 * 86_400_000),
      status: "cancelled" as const
    }
  ].map((order) => {
    return {
      ...order,
      draftId: crypto.randomUUID(),
      id: crypto.randomUUID()
    };
  });
  await db.insert(configurationDraft).values([
    ...orders.map((order) => {
      return {
        customerId: order.customerId,
        id: order.draftId,
        organizationId: fixture.organizationId,
        productId: fixture.productId,
        snapshot: draftSnapshot,
        status: "converted" as const
      };
    }),
    {
      customerId: fixture.customerId,
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      productId: fixture.productId,
      snapshot: draftSnapshot,
      status: "active"
    },
    {
      customerId: fixture.customerId,
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      productId: fixture.productId,
      snapshot: draftSnapshot,
      status: "active"
    },
    {
      customerId: fixture.secondCustomerId,
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      productId: fixture.productId,
      snapshot: draftSnapshot,
      status: "active"
    }
  ]);
  await db.insert(customerOrder).values(
    orders.map((order) => {
      return {
        createdAt: order.createdAt,
        customerId: order.customerId,
        draftId: order.draftId,
        id: order.id,
        organizationId: fixture.organizationId,
        productId: fixture.productId,
        snapshot: orderSnapshot(order.amountMinor),
        status: order.status
      };
    })
  );
  const firstReceiptId = crypto.randomUUID();
  const confirmedReceiptId = crypto.randomUUID();
  await db.insert(offlinePayment).values([
    {
      actorUserId: fixture.ownerId,
      amountMinor: 3_000,
      entryType: "receipt",
      id: firstReceiptId,
      method: "cash",
      mutationId: crypto.randomUUID(),
      orderId: orders[0]!.id,
      organizationId: fixture.organizationId
    },
    {
      actorUserId: fixture.ownerId,
      amountMinor: 10_000,
      entryType: "receipt",
      method: "cash",
      mutationId: crypto.randomUUID(),
      orderId: orders[1]!.id,
      organizationId: fixture.organizationId
    },
    {
      actorUserId: fixture.ownerId,
      amountMinor: 7_000,
      entryType: "receipt",
      id: confirmedReceiptId,
      method: "bank_transfer",
      mutationId: crypto.randomUUID(),
      orderId: orders[2]!.id,
      organizationId: fixture.organizationId
    },
    {
      actorUserId: fixture.ownerId,
      amountMinor: -2_000,
      entryType: "reversal",
      method: "bank_transfer",
      mutationId: crypto.randomUUID(),
      orderId: orders[2]!.id,
      organizationId: fixture.organizationId,
      reversalOfId: confirmedReceiptId,
      reversalTargetType: "receipt"
    }
  ]);

  const otherDraftId = crypto.randomUUID();
  await db.insert(configurationDraft).values({
    customerId: fixture.otherCustomerId,
    id: otherDraftId,
    organizationId: fixture.otherOrganizationId,
    productId: fixture.otherProductId,
    snapshot: draftSnapshot,
    status: "converted"
  });
  await db.insert(customerOrder).values({
    createdAt: new Date(now.getTime() - 86_400_000),
    customerId: fixture.otherCustomerId,
    draftId: otherDraftId,
    organizationId: fixture.otherOrganizationId,
    productId: fixture.otherProductId,
    snapshot: orderSnapshot(50_000, fixture.otherProductId),
    status: "placed"
  });
});

afterAll(async () => {
  const organizationIds = [fixture.organizationId, fixture.otherOrganizationId];
  await db.delete(offlinePayment).where(inArray(offlinePayment.organizationId, organizationIds));
  await db.delete(customerOrder).where(inArray(customerOrder.organizationId, organizationIds));
  await db
    .delete(configurationDraft)
    .where(inArray(configurationDraft.organizationId, organizationIds));
  await db.delete(component).where(inArray(component.organizationId, organizationIds));
  await db.delete(product).where(inArray(product.organizationId, organizationIds));
  await db.delete(organization).where(inArray(organization.id, organizationIds));
  await db
    .delete(user)
    .where(
      inArray(user.id, [
        fixture.ownerId,
        fixture.managerId,
        fixture.customerId,
        fixture.secondCustomerId,
        fixture.outsiderId,
        fixture.otherOwnerId,
        fixture.otherCustomerId
      ])
    );
  await db.delete(user).where(inArray(user.email, [adminEmail, nonAdminEmail]));
});

describe("dashboards router", () => {
  it("enforces platform administrator boundaries from the authoritative session", async () => {
    const nonAdmin = createRouterClient(appRouter, {
      context: contextFor(nonAdminHeaders, "admin")
    });
    const unauthenticated = createRouterClient(appRouter, {
      context: contextFor(new Headers(), "admin")
    });
    const admin = createRouterClient(appRouter, {
      context: contextFor(adminHeaders, null)
    });

    await expect(nonAdmin.dashboards.platform()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(unauthenticated.dashboards.platform()).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
    const result = await admin.dashboards.platform();
    expect(result).toEqual({
      organizations: expect.any(Number),
      roles: {
        customers: expect.any(Number),
        managers: expect.any(Number),
        owners: expect.any(Number)
      },
      users: expect.any(Number)
    });
    expect(JSON.stringify(result)).not.toMatch(/password|token|secret|session|cookie/i);
  });

  it("returns exact tenant-scoped aggregates for each exact organization role", async () => {
    const owner = clientFor(fixture.ownerId);
    const manager = clientFor(fixture.managerId);
    const customer = clientFor(fixture.customerId);
    const otherOwner = clientFor(fixture.otherOwnerId);

    const ownerResult = await owner.dashboards.owner({
      organizationSlug: fixture.organizationSlug
    });
    const managerResult = await manager.dashboards.manager({
      organizationSlug: fixture.organizationSlug
    });
    const customerResult = await customer.dashboards.customer({
      organizationSlug: fixture.organizationSlug
    });
    const otherOwnerResult = await otherOwner.dashboards.owner({
      organizationSlug: fixture.otherOrganizationSlug
    });

    expect(ownerResult).toEqual({
      customers: 2,
      orders: {
        cancelled: 1,
        completed: 1,
        confirmed: 1,
        inProduction: 1,
        placed: 2
      },
      stock: { low: 2, out: 2 },
      unpaidTotal: { amountMinor: 92_000, currency: "EUR" }
    });
    expect(managerResult).toEqual({
      orders: { confirmed: 1, inProduction: 1, placed: 2 },
      stock: { low: 2, out: 2 }
    });
    expect(customerResult).toEqual({ activeDrafts: 2, recentOrders: 3 });
    expect(otherOwnerResult).toEqual({
      customers: 1,
      orders: {
        cancelled: 0,
        completed: 0,
        confirmed: 0,
        inProduction: 0,
        placed: 1
      },
      stock: { low: 0, out: 1 },
      unpaidTotal: { amountMinor: 50_000, currency: "USD" }
    });
    expect(
      JSON.stringify({ customerResult, managerResult, otherOwnerResult, ownerResult })
    ).not.toMatch(/password|token|secret|session|cookie/i);
  });

  it("requires exact roles and preserves tenant ambiguity", async () => {
    const owner = clientFor(fixture.ownerId);
    const manager = clientFor(fixture.managerId);
    const customer = clientFor(fixture.customerId);
    const outsider = clientFor(fixture.outsiderId);

    await expect(
      manager.dashboards.owner({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      customer.dashboards.manager({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.dashboards.customer({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      customer.dashboards.owner({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.dashboards.manager({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      manager.dashboards.customer({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      outsider.dashboards.owner({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      owner.dashboards.owner({ organizationSlug: fixture.otherOrganizationSlug })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
