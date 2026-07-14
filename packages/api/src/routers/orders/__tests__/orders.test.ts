import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { CurrencyCodeSchema } from "@tsu-stack/contract/configuration";
import { type ConfigurationDraftEditor } from "@tsu-stack/contract/draft";
import { type OrderPriceComparison } from "@tsu-stack/contract/order";
import { db } from "@tsu-stack/db";
import {
  component,
  customerOrder,
  member,
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
  otherCustomerId: crypto.randomUUID(),
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
    [fixture.customerId, fixture.otherCustomerId].map((id) => {
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
  await db.delete(customerOrder).where(eq(customerOrder.organizationId, fixture.organizationId));
  await db.delete(organization).where(eq(organization.id, fixture.organizationId));
  await db.delete(organization).where(eq(organization.id, fixture.otherOrganizationId));
  await db.delete(user).where(eq(user.id, fixture.customerId));
  await db.delete(user).where(eq(user.id, fixture.otherCustomerId));
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
    expect(placed.number).toMatch(/^AS-[A-F0-9]{12}$/);

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
    await db
      .update(product)
      .set({ basePriceMinor: 10_000, name: "Wedding Album" })
      .where(eq(product.id, fixture.productId));
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
});
