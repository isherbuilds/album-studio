import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { CurrencyCodeSchema } from "@tsu-stack/contract/configuration";
import { type ConfigurationDraftEditor } from "@tsu-stack/contract/draft";
import { type OrderPriceComparison } from "@tsu-stack/contract/order";
import { placeOrder as placeOrderCore } from "@tsu-stack/core/order";
import { db } from "@tsu-stack/db";
import {
  auditEvent,
  component,
  customerOrder,
  member,
  offlinePayment,
  optionGroup,
  optionValue,
  optionValueComponent,
  organization,
  product,
  user
} from "@tsu-stack/db/schema";
import { createLogger } from "@tsu-stack/logger/server";

import { appRouter } from "#@/routers/index";

const fixture = {
  componentId: crypto.randomUUID(),
  customerId: crypto.randomUUID(),
  managerId: crypto.randomUUID(),
  otherCustomerId: crypto.randomUUID(),
  ownerId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  organizationSlug: `orders-${crypto.randomUUID()}`,
  otherOrganizationId: crypto.randomUUID(),
  otherOrganizationSlug: `orders-${crypto.randomUUID()}`,
  productId: crypto.randomUUID(),
  productSlug: `album-${crypto.randomUUID()}`,
  groupId: crypto.randomUUID(),
  valueId: crypto.randomUUID()
};
const currency = CurrencyCodeSchema.parse("USD");

function expectSafeAuditMetadata(metadata: unknown, expected: Record<string, unknown>) {
  expect(metadata).toEqual(expected);
  expect(JSON.stringify(metadata)).not.toMatch(/password|token|secret|session|cookie/i);
}

function createContext(userId: string) {
  return {
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
        name: "Order Fixture User",
        role: "user",
        updatedAt: new Date()
      }
    },
    db,
    headers: new Headers(),
    logger: createLogger({ operation: "orders_router_test" })
  };
}

function clientFor(userId: string) {
  return createRouterClient(appRouter, { context: createContext(userId) });
}

async function createValidDraft(customerId = fixture.customerId) {
  const client = clientFor(customerId);
  const created = await client.drafts.create({
    organizationSlug: fixture.organizationSlug,
    productSlug: fixture.productSlug,
    projectName: "Maya & Arjun"
  });
  return client.drafts.save({
    draftId: created.draft.id,
    expectedRevision: created.draft.revision,
    organizationSlug: fixture.organizationSlug,
    projectName: created.draft.projectName,
    quantity: 2,
    selections: { cover: fixture.valueId },
    step: { kind: "review" }
  });
}

function acceptedPrice(editor: ConfigurationDraftEditor): OrderPriceComparison {
  if (editor.draft.evaluationSummary.status !== "valid") throw new Error("Expected valid Draft");
  return {
    orderTotal: editor.draft.evaluationSummary.orderTotal,
    perUnitBreakdown: editor.draft.evaluationSummary.perUnitBreakdown,
    perUnitTotal: editor.draft.evaluationSummary.perUnitTotal
  };
}

function priceForBase(basePriceMinor: number): OrderPriceComparison {
  const perUnitTotalMinor = basePriceMinor + 500;
  return {
    orderTotal: { amountMinor: perUnitTotalMinor * 2, currency },
    perUnitBreakdown: [
      { amountMinor: basePriceMinor, kind: "base" },
      {
        amountMinor: 500,
        groupKey: "cover",
        kind: "option",
        optionValueId: fixture.valueId
      }
    ],
    perUnitTotal: { amountMinor: perUnitTotalMinor, currency }
  };
}

beforeAll(async () => {
  await db.insert(user).values(
    [fixture.customerId, fixture.managerId, fixture.otherCustomerId, fixture.ownerId].map((id) => {
      return {
        email: `${id}@example.com`,
        emailVerified: true,
        id,
        name: "Order Fixture User",
        role: "user"
      };
    })
  );
  await db.insert(organization).values([
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.organizationId,
      name: "Order Organization",
      slug: fixture.organizationSlug
    },
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.otherOrganizationId,
      name: "Other Order Organization",
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
      role: "customer",
      userId: fixture.otherCustomerId
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
      role: "customer",
      userId: fixture.customerId
    },
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.otherOrganizationId,
      role: "manager",
      userId: fixture.managerId
    },
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.otherOrganizationId,
      role: "owner",
      userId: fixture.ownerId
    }
  ]);
  await db.insert(product).values({
    basePriceMinor: 10_000,
    id: fixture.productId,
    name: "Wedding Album",
    organizationId: fixture.organizationId,
    slug: fixture.productSlug,
    status: "published"
  });
  await db.insert(optionGroup).values({
    id: fixture.groupId,
    key: "cover",
    label: "Cover",
    position: 0,
    productId: fixture.productId,
    required: true,
    type: "single"
  });
  await db.insert(optionValue).values({
    id: fixture.valueId,
    label: "Linen",
    optionGroupId: fixture.groupId,
    organizationId: fixture.organizationId,
    position: 0,
    priceAdjustmentMinor: 500,
    productId: fixture.productId
  });
  await db.insert(component).values({
    id: fixture.componentId,
    name: "Linen roll",
    organizationId: fixture.organizationId,
    quantity: "10",
    unit: "metre"
  });
  await db.insert(optionValueComponent).values({
    componentId: fixture.componentId,
    optionValueId: fixture.valueId,
    organizationId: fixture.organizationId
  });
});

afterAll(async () => {
  await db.delete(offlinePayment).where(eq(offlinePayment.organizationId, fixture.organizationId));
  await db.delete(auditEvent).where(eq(auditEvent.organizationId, fixture.organizationId));
  await db.delete(customerOrder).where(eq(customerOrder.organizationId, fixture.organizationId));
  await db.delete(organization).where(eq(organization.id, fixture.organizationId));
  await db.delete(organization).where(eq(organization.id, fixture.otherOrganizationId));
  await db.delete(user).where(eq(user.id, fixture.customerId));
  await db.delete(user).where(eq(user.id, fixture.otherCustomerId));
  await db.delete(user).where(eq(user.id, fixture.managerId));
  await db.delete(user).where(eq(user.id, fixture.ownerId));
});

describe("orders router", () => {
  it("places one immutable Order and returns it idempotently", async () => {
    const client = clientFor(fixture.customerId);
    const editor = await createValidDraft();
    const accepted = acceptedPrice(editor);

    const [placed, concurrent] = await Promise.all([
      client.orders.place({
        acceptedPrice: accepted,
        draftId: editor.draft.id,
        organizationSlug: fixture.organizationSlug
      }),
      client.orders.place({
        acceptedPrice: accepted,
        draftId: editor.draft.id,
        organizationSlug: fixture.organizationSlug
      })
    ]);
    const repeated = await client.orders.place({
      acceptedPrice: {
        ...accepted,
        orderTotal: { amountMinor: 1, currency: "USD" }
      },
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });

    expect(concurrent).toEqual(placed);
    expect(repeated).toEqual(placed);
    expect(placed).toMatchObject({
      projectName: "Maya & Arjun",
      snapshot: {
        orderTotal: { amountMinor: 21_000, currency: "USD" },
        product: { id: fixture.productId, name: "Wedding Album" },
        quantity: 2,
        selections: [
          {
            componentIds: [fixture.componentId],
            groupKey: "cover",
            optionValueId: fixture.valueId,
            optionValueLabel: "Linen"
          }
        ]
      },
      status: "placed"
    });
    expect(placed.number).toMatch(/^AS-S\d{11}$/);
    await expect(
      db
        .select({ quantity: component.quantity })
        .from(component)
        .where(eq(component.id, fixture.componentId))
    ).resolves.toEqual([{ quantity: "10.0000" }]);

    await db
      .update(product)
      .set({ basePriceMinor: 99_000, name: "Renamed" })
      .where(eq(product.id, fixture.productId));
    const detail = await client.orders.byNumber({
      orderNumber: placed.number,
      organizationSlug: fixture.organizationSlug
    });
    expect(detail.snapshot.product.name).toBe("Wedding Album");
    expect(detail.snapshot.orderTotal).toEqual({ amountMinor: 21_000, currency: "USD" });
    const rows = await db
      .select()
      .from(customerOrder)
      .where(eq(customerOrder.draftId, editor.draft.id));
    expect(rows).toHaveLength(1);
    await expect(
      db.insert(customerOrder).values({
        customerId: fixture.otherCustomerId,
        draftId: editor.draft.id,
        organizationId: fixture.organizationId,
        productId: fixture.productId,
        projectName: placed.projectName,
        snapshot: placed.snapshot
      })
    ).rejects.toThrow("Failed query");
    await db
      .update(product)
      .set({ basePriceMinor: 10_000, name: "Wedding Album" })
      .where(eq(product.id, fixture.productId));

    await expect(
      client.orders.list({ organizationSlug: fixture.organizationSlug })
    ).resolves.toMatchObject({
      counts: { placed: 1 },
      items: [
        expect.objectContaining({
          number: placed.number,
          orderTotal: { amountMinor: 21_000, currency: "USD" },
          productName: "Wedding Album",
          quantity: 2,
          status: "placed"
        })
      ],
      page: 1,
      pageCount: 1,
      pageSize: 20,
      total: 1
    });
  });

  it("accepts equivalent prices independent of property insertion order", async () => {
    const editor = await createValidDraft();
    const accepted = acceptedPrice(editor);
    const result = await placeOrderCore(db, {
      acceptedPrice: {
        perUnitTotal: accepted.perUnitTotal,
        perUnitBreakdown: accepted.perUnitBreakdown,
        orderTotal: accepted.orderTotal
      },
      customerId: fixture.customerId,
      draftId: editor.draft.id,
      organizationId: fixture.organizationId
    });

    expect(result).toMatchObject({ kind: "placed" });
  });

  it("requires explicit acceptance after authoritative price change", async () => {
    const client = clientFor(fixture.customerId);
    const editor = await createValidDraft();
    if (editor.draft.evaluationSummary.status !== "valid") throw new Error("Expected valid Draft");
    const accepted = acceptedPrice(editor);
    const staleSelectionPrice: OrderPriceComparison = {
      ...accepted,
      perUnitBreakdown: accepted.perUnitBreakdown.map((line) =>
        line.kind === "option" ? { ...line, optionValueId: "retired-cover" } : line
      )
    };
    await expect(
      client.orders.place({
        acceptedPrice: staleSelectionPrice,
        draftId: editor.draft.id,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({
      code: "PRICE_CHANGED",
      data: {
        current: {
          perUnitBreakdown: expect.arrayContaining([
            expect.objectContaining({ optionValueId: fixture.valueId })
          ])
        },
        previous: {
          perUnitBreakdown: expect.arrayContaining([
            expect.objectContaining({ optionValueId: "retired-cover" })
          ])
        }
      },
      defined: true
    });
    await db
      .update(product)
      .set({ basePriceMinor: 12_000 })
      .where(eq(product.id, fixture.productId));

    await expect(
      client.orders.place({
        acceptedPrice: accepted,
        draftId: editor.draft.id,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({
      code: "PRICE_CHANGED",
      data: {
        current: { orderTotal: { amountMinor: 25_000, currency: "USD" } },
        previous: { orderTotal: { amountMinor: 21_000, currency: "USD" } }
      },
      defined: true
    });

    await db
      .update(product)
      .set({ basePriceMinor: 13_000 })
      .where(eq(product.id, fixture.productId));

    await expect(
      client.orders.place({
        acceptedPrice: priceForBase(12_000),
        draftId: editor.draft.id,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({
      code: "PRICE_CHANGED",
      data: {
        current: { orderTotal: { amountMinor: 27_000, currency: "USD" } },
        previous: { orderTotal: { amountMinor: 25_000, currency: "USD" } }
      },
      defined: true
    });

    await expect(
      client.orders.place({
        acceptedPrice: priceForBase(13_000),
        draftId: editor.draft.id,
        organizationSlug: fixture.organizationSlug
      })
    ).resolves.toMatchObject({ snapshot: { orderTotal: { amountMinor: 27_000 } } });
    await db
      .update(product)
      .set({ basePriceMinor: 10_000 })
      .where(eq(product.id, fixture.productId));
  });

  it("returns affected group when current Component becomes unavailable", async () => {
    const client = clientFor(fixture.customerId);
    const editor = await createValidDraft();
    if (editor.draft.evaluationSummary.status !== "valid") throw new Error("Expected valid Draft");
    await db.update(component).set({ quantity: "0" }).where(eq(component.id, fixture.componentId));

    await expect(
      client.orders.place({
        acceptedPrice: acceptedPrice(editor),
        draftId: editor.draft.id,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({
      code: "CONFIGURATION_INVALID",
      data: {
        issues: [expect.objectContaining({ location: { kind: "group", groupKey: "cover" } })],
        product: {
          availability: { [fixture.componentId]: "out" }
        }
      },
      defined: true
    });
    await db.update(component).set({ quantity: "10" }).where(eq(component.id, fixture.componentId));
  });

  it("hides another Customer's Draft and Order across tenant-safe reads", async () => {
    const owner = clientFor(fixture.customerId);
    const other = clientFor(fixture.otherCustomerId);
    const editor = await createValidDraft();
    const placed = await owner.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });

    await expect(
      other.orders.place({
        acceptedPrice: acceptedPrice(editor),
        draftId: editor.draft.id,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    await expect(
      other.orders.byNumber({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    await expect(
      owner.orders.byNumber({
        orderNumber: placed.number,
        organizationSlug: fixture.otherOrganizationSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
  });

  it("supports staff follow-up while keeping submitted Orders immutable to Customers", async () => {
    const customer = clientFor(fixture.customerId);
    const manager = clientFor(fixture.managerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });

    await expect(
      customer.orders.correctProjectName({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug,
        projectName: "Customer edit"
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });
    await expect(
      customer.orders.transition({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug,
        status: "confirmed"
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });
    await expect(
      customer.payments.record({
        amountMinor: 1_000,
        method: "cash",
        mutationId: crypto.randomUUID(),
        note: null,
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });
    await expect(
      manager.orders.duplicateToDraft({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });
    await expect(
      manager.orders.requestCancellation({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });

    const corrected = await manager.orders.correctProjectName({
      orderNumber: placed.number,
      organizationSlug: fixture.organizationSlug,
      projectName: "password token secret session cookie"
    });
    expect(corrected.projectName).toBe("password token secret session cookie");

    await expect(
      manager.orders.transition({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug,
        status: "completed"
      })
    ).rejects.toMatchObject({ code: "INVALID_ORDER_TRANSITION", defined: true });

    await expect(
      manager.orders.transition({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug,
        status: "confirmed"
      })
    ).resolves.toMatchObject({ status: "confirmed" });
    await expect(
      manager.orders.transition({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug,
        status: "in_production"
      })
    ).resolves.toMatchObject({ status: "in_production" });
    await expect(
      manager.orders.transition({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug,
        status: "completed"
      })
    ).resolves.toMatchObject({ status: "completed" });

    const audits = await db
      .select({ action: auditEvent.action, metadata: auditEvent.metadata })
      .from(auditEvent)
      .where(eq(auditEvent.organizationId, fixture.organizationId));
    const projectNameAudit = audits.find(
      (audit) => audit.action === "order.project_name_corrected"
    );
    expectSafeAuditMetadata(projectNameAudit?.metadata, {});

    const statusAudits = audits
      .filter((audit) => audit.action === "order.status_updated")
      .map((audit) => audit.metadata);
    expect(statusAudits).toHaveLength(3);
    expect(statusAudits).toEqual(
      expect.arrayContaining([
        { from: "placed", to: "confirmed" },
        { from: "confirmed", to: "in_production" },
        { from: "in_production", to: "completed" }
      ])
    );
  });

  it("lets Customers request cancellation and staff decide only while placed", async () => {
    const customer = clientFor(fixture.customerId);
    const manager = clientFor(fixture.managerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });

    await expect(
      customer.orders.requestCancellation({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).resolves.toMatchObject({ cancellationStatus: "pending", status: "placed" });
    const requestAudits = await db
      .select({
        action: auditEvent.action,
        actorUserId: auditEvent.actorUserId,
        metadata: auditEvent.metadata
      })
      .from(auditEvent)
      .where(eq(auditEvent.organizationId, fixture.organizationId));
    const requestAudit = requestAudits.find(
      (audit) => audit.action === "order.cancellation_requested"
    );
    expect(requestAudit?.actorUserId).toBe(fixture.customerId);
    expectSafeAuditMetadata(requestAudit?.metadata, {});
    await expect(
      customer.orders.requestCancellation({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({ code: "INVALID_ORDER_TRANSITION", defined: true });
    await expect(
      manager.orders.transition({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug,
        status: "confirmed"
      })
    ).rejects.toMatchObject({ code: "INVALID_ORDER_TRANSITION", defined: true });
    await expect(
      manager.orders.decideCancellation({
        decision: "approved",
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).resolves.toMatchObject({ cancellationStatus: "approved", status: "cancelled" });
    const decisionAudits = await db
      .select({ action: auditEvent.action, metadata: auditEvent.metadata })
      .from(auditEvent)
      .where(eq(auditEvent.organizationId, fixture.organizationId));
    const decisionAudit = decisionAudits.find(
      (audit) => audit.action === "order.cancellation_decided"
    );
    expectSafeAuditMetadata(decisionAudit?.metadata, { decision: "approved" });
  });

  it("duplicates immutable Order configuration into a new active Draft", async () => {
    const customer = clientFor(fixture.customerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });
    await db
      .update(product)
      .set({ basePriceMinor: 12_000 })
      .where(eq(product.id, fixture.productId));

    let duplicate;
    try {
      duplicate = await customer.orders.duplicateToDraft({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      });
    } finally {
      await db
        .update(product)
        .set({ basePriceMinor: 10_000 })
        .where(eq(product.id, fixture.productId));
    }

    expect(duplicate.draft).toMatchObject({
      projectName: "Maya & Arjun",
      quantity: 2,
      selections: { cover: fixture.valueId },
      status: "active"
    });
    expect(duplicate.draft.evaluationSummary).toMatchObject({
      orderTotal: { amountMinor: 25_000, currency: "USD" },
      status: "valid"
    });
    expect(duplicate.draft.id).not.toBe(editor.draft.id);
  });

  it("rejects duplication when current Product is unavailable", async () => {
    const customer = clientFor(fixture.customerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });

    await db.update(product).set({ status: "archived" }).where(eq(product.id, fixture.productId));
    try {
      await expect(
        customer.orders.duplicateToDraft({
          orderNumber: placed.number,
          organizationSlug: fixture.organizationSlug
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    } finally {
      await db
        .update(product)
        .set({ status: "published" })
        .where(eq(product.id, fixture.productId));
    }
  });

  it("duplicates an Order with a now-unavailable selection into an editable invalid Draft", async () => {
    const customer = clientFor(fixture.customerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });

    await db.update(component).set({ quantity: "0" }).where(eq(component.id, fixture.componentId));
    let duplicate;
    try {
      duplicate = await customer.orders.duplicateToDraft({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      });
    } finally {
      await db
        .update(component)
        .set({ quantity: "10" })
        .where(eq(component.id, fixture.componentId));
    }

    expect(duplicate.draft).toMatchObject({ projectName: "Maya & Arjun", status: "active" });
    expect(duplicate.draft.evaluationSummary.status).toBe("invalid");
    expect(duplicate.draft.id).not.toBe(editor.draft.id);
  });

  it("scopes every follow-up mutation to current Organization", async () => {
    const customer = clientFor(fixture.customerId);
    const manager = clientFor(fixture.managerId);
    const owner = clientFor(fixture.ownerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });
    const scope = { orderNumber: placed.number, organizationSlug: fixture.otherOrganizationSlug };

    await Promise.all([
      expect(
        owner.orders.correctProjectName({ ...scope, projectName: "Cross-Organization edit" })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true }),
      expect(owner.orders.transition({ ...scope, status: "confirmed" })).rejects.toMatchObject({
        code: "NOT_FOUND",
        defined: true
      }),
      expect(
        owner.orders.decideCancellation({ ...scope, decision: "approved" })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true }),
      expect(customer.orders.requestCancellation(scope)).rejects.toMatchObject({
        code: "NOT_FOUND",
        defined: true
      }),
      expect(customer.orders.duplicateToDraft(scope)).rejects.toMatchObject({
        code: "NOT_FOUND",
        defined: true
      }),
      expect(
        manager.payments.record({
          ...scope,
          amountMinor: 1_000,
          method: "cash",
          mutationId: crypto.randomUUID(),
          note: null
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true }),
      expect(
        manager.payments.reverse({
          ...scope,
          amountMinor: 1_000,
          mutationId: crypto.randomUUID(),
          note: null,
          receiptId: crypto.randomUUID()
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true }),
      expect(manager.payments.listByOrder(scope)).rejects.toMatchObject({
        code: "NOT_FOUND",
        defined: true
      })
    ]);
  });

  it("records partial offline receipts and bounded append-only reversals", async () => {
    const customer = clientFor(fixture.customerId);
    const manager = clientFor(fixture.managerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });

    const receiptInput = {
      amountMinor: 8_000,
      method: "upi" as const,
      mutationId: crypto.randomUUID(),
      note: "Deposit",
      orderNumber: placed.number,
      organizationSlug: fixture.organizationSlug
    };
    const receipt = await manager.payments.record(receiptInput);
    await expect(manager.payments.record(receiptInput)).resolves.toEqual(receipt);
    expect(receipt.summary).toMatchObject({
      balance: { amountMinor: 13_000, currency: "USD" },
      paid: { amountMinor: 8_000, currency: "USD" },
      state: "partially_paid"
    });

    await expect(
      manager.payments.record({
        amountMinor: 14_000,
        method: "cash",
        mutationId: crypto.randomUUID(),
        note: null,
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).rejects.toMatchObject({ code: "PAYMENT_OVERAGE", defined: true });

    const reversed = await manager.payments.reverse({
      amountMinor: 3_000,
      mutationId: crypto.randomUUID(),
      note: "Deposit correction",
      orderNumber: placed.number,
      organizationSlug: fixture.organizationSlug,
      receiptId: receipt.payment.id
    });
    expect(reversed).toMatchObject({
      payment: { amount: { amountMinor: -3_000, currency: "USD" } },
      summary: {
        balance: { amountMinor: 16_000, currency: "USD" },
        paid: { amountMinor: 5_000, currency: "USD" },
        state: "partially_paid"
      }
    });

    const ledger = await customer.payments.listByOrder({
      orderNumber: placed.number,
      organizationSlug: fixture.organizationSlug
    });
    expect(ledger.payments).toHaveLength(2);
  });

  it("rejects new receipts on cancelled Orders but still allows reversals", async () => {
    const customer = clientFor(fixture.customerId);
    const manager = clientFor(fixture.managerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });
    const scope = { orderNumber: placed.number, organizationSlug: fixture.organizationSlug };

    const receipt = await manager.payments.record({
      ...scope,
      amountMinor: 8_000,
      method: "upi",
      mutationId: crypto.randomUUID(),
      note: "Deposit before cancellation"
    });

    await customer.orders.requestCancellation(scope);
    await expect(
      manager.orders.decideCancellation({ ...scope, decision: "approved" })
    ).resolves.toMatchObject({ status: "cancelled" });

    await expect(
      manager.payments.record({
        ...scope,
        amountMinor: 1_000,
        method: "cash",
        mutationId: crypto.randomUUID(),
        note: null
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });

    await expect(
      manager.payments.reverse({
        ...scope,
        amountMinor: 8_000,
        mutationId: crypto.randomUUID(),
        note: "Refund after cancellation",
        receiptId: receipt.payment.id
      })
    ).resolves.toMatchObject({
      payment: { amount: { amountMinor: -8_000, currency: "USD" } },
      summary: { paid: { amountMinor: 0, currency: "USD" }, state: "unpaid" }
    });
  });

  it("rejects a reversal linked to a receipt from another Order", async () => {
    const customer = clientFor(fixture.customerId);
    const manager = clientFor(fixture.managerId);
    const firstEditor = await createValidDraft();
    const firstOrder = await customer.orders.place({
      acceptedPrice: acceptedPrice(firstEditor),
      draftId: firstEditor.draft.id,
      organizationSlug: fixture.organizationSlug
    });
    const secondEditor = await createValidDraft();
    const secondOrder = await customer.orders.place({
      acceptedPrice: acceptedPrice(secondEditor),
      draftId: secondEditor.draft.id,
      organizationSlug: fixture.organizationSlug
    });
    const receipt = await manager.payments.record({
      amountMinor: 8_000,
      method: "cash",
      mutationId: crypto.randomUUID(),
      note: null,
      orderNumber: firstOrder.number,
      organizationSlug: fixture.organizationSlug
    });
    const secondOrderRows = await db
      .select({ id: customerOrder.id })
      .from(customerOrder)
      .where(eq(customerOrder.number, secondOrder.number))
      .limit(1);
    const secondOrderId = secondOrderRows[0]?.id;
    if (!secondOrderId) throw new Error("Second Order missing");

    await expect(
      db.insert(offlinePayment).values({
        actorUserId: fixture.managerId,
        amountMinor: -1_000,
        entryType: "reversal",
        method: "cash",
        mutationId: crypto.randomUUID(),
        note: null,
        orderId: secondOrderId,
        organizationId: fixture.organizationId,
        reversalOfId: receipt.payment.id,
        reversalTargetType: "receipt"
      })
    ).rejects.toThrow("Failed query");

    const firstOrderRows = await db
      .select({ id: customerOrder.id })
      .from(customerOrder)
      .where(eq(customerOrder.number, firstOrder.number))
      .limit(1);
    const firstOrderId = firstOrderRows[0]?.id;
    if (!firstOrderId) throw new Error("First Order missing");
    const selfId = crypto.randomUUID();
    await expect(
      db.insert(offlinePayment).values({
        actorUserId: fixture.managerId,
        amountMinor: -1_000,
        entryType: "reversal",
        id: selfId,
        method: "cash",
        mutationId: crypto.randomUUID(),
        note: null,
        orderId: firstOrderId,
        organizationId: fixture.organizationId,
        reversalOfId: selfId,
        reversalTargetType: "receipt"
      })
    ).rejects.toThrow("Failed query");

    const reversal = await manager.payments.reverse({
      amountMinor: 1_000,
      mutationId: crypto.randomUUID(),
      note: null,
      orderNumber: firstOrder.number,
      organizationSlug: fixture.organizationSlug,
      receiptId: receipt.payment.id
    });
    await expect(
      db.insert(offlinePayment).values({
        actorUserId: fixture.managerId,
        amountMinor: -1_000,
        entryType: "reversal",
        method: "cash",
        mutationId: crypto.randomUUID(),
        note: null,
        orderId: firstOrderId,
        organizationId: fixture.organizationId,
        reversalOfId: reversal.payment.id,
        reversalTargetType: "receipt"
      })
    ).rejects.toThrow("Failed query");

    await expect(
      db.insert(offlinePayment).values({
        actorUserId: fixture.managerId,
        amountMinor: Number.MAX_SAFE_INTEGER + 1,
        entryType: "receipt",
        method: "cash",
        mutationId: crypto.randomUUID(),
        note: null,
        orderId: firstOrderId,
        organizationId: fixture.organizationId
      })
    ).rejects.toThrow("Failed query");
  });

  it("serializes concurrent receipts and reversals against Order balance", async () => {
    const customer = clientFor(fixture.customerId);
    const manager = clientFor(fixture.managerId);
    const editor = await createValidDraft();
    const placed = await customer.orders.place({
      acceptedPrice: acceptedPrice(editor),
      draftId: editor.draft.id,
      organizationSlug: fixture.organizationSlug
    });
    const receiptInput = {
      amountMinor: 15_000,
      method: "cash" as const,
      mutationId: crypto.randomUUID(),
      note: null,
      orderNumber: placed.number,
      organizationSlug: fixture.organizationSlug
    };

    const receipts = await Promise.allSettled([
      manager.payments.record(receiptInput),
      manager.payments.record({ ...receiptInput, mutationId: crypto.randomUUID() })
    ]);
    const recorded = receipts.filter((result) => result.status === "fulfilled");
    const rejected = receipts.filter((result) => result.status === "rejected");
    expect(recorded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: { code: "PAYMENT_OVERAGE", defined: true },
      status: "rejected"
    });
    const receipt = recorded[0]?.value;
    if (!receipt) throw new Error("Expected one concurrent receipt");

    const reversalInput = {
      amountMinor: 10_000,
      mutationId: crypto.randomUUID(),
      note: null,
      orderNumber: placed.number,
      organizationSlug: fixture.organizationSlug,
      receiptId: receipt.payment.id
    };
    const reversals = await Promise.allSettled([
      manager.payments.reverse(reversalInput),
      manager.payments.reverse({ ...reversalInput, mutationId: crypto.randomUUID() })
    ]);
    expect(reversals.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(reversals.filter((result) => result.status === "rejected")).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ code: "PAYMENT_OVERAGE" }) })
    ]);

    await expect(
      manager.payments.listByOrder({
        orderNumber: placed.number,
        organizationSlug: fixture.organizationSlug
      })
    ).resolves.toMatchObject({
      summary: { paid: { amountMinor: 5_000, currency: "USD" } }
    });
  });
});
