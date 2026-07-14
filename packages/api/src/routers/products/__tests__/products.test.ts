import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { OrderSnapshotSchema } from "@tsu-stack/contract/order";
import { evaluateConfiguration } from "@tsu-stack/core/configuration";
import { db } from "@tsu-stack/db";
import {
  component,
  configurationDraft,
  customerOrder,
  member,
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
  organizationId: crypto.randomUUID(),
  organizationSlug: `products-${crypto.randomUUID()}`,
  otherComponentId: crypto.randomUUID(),
  otherOrganizationId: crypto.randomUUID(),
  otherOrganizationSlug: `products-${crypto.randomUUID()}`,
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
          name: "Product Fixture User",
          role: "user",
          updatedAt: new Date()
        }
      },
      db,
      headers: new Headers(),
      logger: createLogger({ operation: "products_router_test" })
    }
  });
}

const content = {
  description: "A configurable album",
  imageUrls: ["/album.jpg"],
  name: "Signature album",
  slug: "signature-album"
};

function configuration(componentId = fixture.componentId) {
  return [
    {
      key: "cover",
      label: "Cover",
      required: true,
      type: "single" as const,
      values: [
        {
          componentIds: [componentId],
          id: "linen",
          imageUrl: null,
          label: "Linen",
          requirements: []
        }
      ]
    },
    {
      included: 10,
      key: "sheets",
      label: "Sheets",
      maximum: 30,
      minimum: 10,
      required: true,
      step: 2,
      type: "number" as const
    }
  ];
}

beforeAll(async () => {
  await db.insert(user).values(
    [fixture.customerId, fixture.managerId, fixture.ownerId].map((id) => {
      return {
        email: `${id}@example.com`,
        emailVerified: true,
        id,
        name: "Product Fixture User",
        role: "user"
      };
    })
  );
  await db.insert(organization).values([
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.organizationId,
      name: "Product Organization",
      slug: fixture.organizationSlug
    },
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.otherOrganizationId,
      name: "Other Product Organization",
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
  await db.insert(component).values([
    {
      availabilityOverride: "available",
      id: fixture.componentId,
      lowStockThreshold: "0",
      name: "Linen",
      organizationId: fixture.organizationId,
      quantity: "10",
      unit: "metre"
    },
    {
      availabilityOverride: "available",
      id: fixture.otherComponentId,
      lowStockThreshold: "0",
      name: "Other linen",
      organizationId: fixture.otherOrganizationId,
      quantity: "10",
      unit: "metre"
    }
  ]);
});

afterAll(async () => {
  await db.delete(customerOrder).where(eq(customerOrder.organizationId, fixture.organizationId));
  await db
    .delete(configurationDraft)
    .where(eq(configurationDraft.organizationId, fixture.organizationId));
  await db.delete(product).where(eq(product.organizationId, fixture.organizationId));
  await db
    .delete(organization)
    .where(inArray(organization.id, [fixture.organizationId, fixture.otherOrganizationId]));
  await db
    .delete(user)
    .where(inArray(user.id, [fixture.customerId, fixture.managerId, fixture.ownerId]));
});

beforeEach(async () => {
  await db.delete(customerOrder).where(eq(customerOrder.organizationId, fixture.organizationId));
  await db
    .delete(configurationDraft)
    .where(eq(configurationDraft.organizationId, fixture.organizationId));
  await db.delete(product).where(eq(product.organizationId, fixture.organizationId));
});

describe("products router", () => {
  it("supports a Manager-authored shell and configuration but reserves all pricing for Owners", async () => {
    const manager = clientFor(fixture.managerId);
    const owner = clientFor(fixture.ownerId);
    const customer = clientFor(fixture.customerId);

    const created = await manager.products.create({
      ...content,
      organizationSlug: fixture.organizationSlug
    });
    expect(created).toMatchObject({
      basePriceMinor: null,
      groups: [],
      status: "draft",
      validationIssues: expect.arrayContaining([
        expect.objectContaining({ path: ["basePriceMinor"] })
      ])
    });

    await expect(
      manager.products.publish({
        expectedRevision: created.revision,
        organizationSlug: fixture.organizationSlug,
        productSlug: created.slug
      })
    ).rejects.toMatchObject({ code: "PRODUCT_INVALID" });

    const configured = await manager.products.editConfiguration({
      expectedRevision: created.revision,
      groups: configuration(),
      organizationSlug: fixture.organizationSlug,
      productSlug: created.slug
    });
    expect(configured.groups).toMatchObject([
      {
        type: "single",
        values: [{ componentIds: [fixture.componentId], priceAdjustmentMinor: null }]
      },
      { additionalUnitPriceMinor: null, type: "number" }
    ]);

    await expect(
      manager.products.editPricing({
        basePriceMinor: 10_000,
        expectedRevision: configured.revision,
        numericGroupPrices: [{ additionalUnitPriceMinor: 250, groupKey: "sheets" }],
        optionValuePrices: [{ optionValueId: "linen", priceAdjustmentMinor: 500 }],
        organizationSlug: fixture.organizationSlug,
        productSlug: configured.slug
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const priced = await owner.products.editPricing({
      basePriceMinor: 10_000,
      expectedRevision: configured.revision,
      numericGroupPrices: [{ additionalUnitPriceMinor: 250, groupKey: "sheets" }],
      optionValuePrices: [{ optionValueId: "linen", priceAdjustmentMinor: 500 }],
      organizationSlug: fixture.organizationSlug,
      productSlug: configured.slug
    });
    expect(priced.validationIssues).toEqual([]);

    const selections = { cover: "linen", sheets: 12 };
    const preview = await owner.products.preview({
      organizationSlug: fixture.organizationSlug,
      productSlug: priced.slug,
      quantity: 2,
      selections
    });
    expect(preview).toMatchObject({
      evaluation: {
        orderTotal: { amountMinor: 22_000, currency: "USD" },
        perUnitTotal: { amountMinor: 11_000, currency: "USD" },
        status: "valid"
      },
      kind: "evaluation"
    });

    const published = await manager.products.publish({
      expectedRevision: priced.revision,
      organizationSlug: fixture.organizationSlug,
      productSlug: priced.slug
    });
    expect(published.status).toBe("published");

    const publicProduct = await customer.catalog.bySlug({
      organizationSlug: fixture.organizationSlug,
      productSlug: published.slug
    });
    expect(preview).toEqual({
      evaluation: evaluateConfiguration({
        availability: publicProduct.availability,
        currency: publicProduct.currency,
        product: publicProduct.definition,
        quantity: 2,
        selections
      }),
      kind: "evaluation"
    });

    await expect(
      customer.products.list({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserves existing prices during Manager configuration edits and rejects foreign Components", async () => {
    const manager = clientFor(fixture.managerId);
    const owner = clientFor(fixture.ownerId);
    const created = await owner.products.create({
      ...content,
      organizationSlug: fixture.organizationSlug
    });
    const configured = await owner.products.editConfiguration({
      expectedRevision: created.revision,
      groups: configuration(),
      organizationSlug: fixture.organizationSlug,
      productSlug: created.slug
    });
    const priced = await owner.products.editPricing({
      basePriceMinor: 10_000,
      expectedRevision: configured.revision,
      numericGroupPrices: [{ additionalUnitPriceMinor: 250, groupKey: "sheets" }],
      optionValuePrices: [{ optionValueId: "linen", priceAdjustmentMinor: 500 }],
      organizationSlug: fixture.organizationSlug,
      productSlug: configured.slug
    });

    const edited = await manager.products.editConfiguration({
      expectedRevision: priced.revision,
      groups: [
        {
          ...configuration()[0],
          label: "Cover material",
          values: [{ ...configuration()[0]?.values?.[0], label: "Italian linen" }]
        },
        configuration()[1]
      ],
      organizationSlug: fixture.organizationSlug,
      productSlug: priced.slug
    });
    expect(edited).toMatchObject({
      basePriceMinor: 10_000,
      groups: [
        { values: [{ label: "Italian linen", priceAdjustmentMinor: 500 }] },
        { additionalUnitPriceMinor: 250 }
      ]
    });

    await expect(
      manager.products.editConfiguration({
        expectedRevision: edited.revision,
        groups: configuration(fixture.otherComponentId),
        organizationSlug: fixture.organizationSlug,
        productSlug: edited.slug
      })
    ).rejects.toMatchObject({ code: "PRODUCT_INVALID" });
  });

  it("enforces revision and Organization boundaries", async () => {
    const owner = clientFor(fixture.ownerId);
    const created = await owner.products.create({
      ...content,
      organizationSlug: fixture.organizationSlug
    });
    const edited = await owner.products.editContent({
      ...content,
      description: "Updated description",
      expectedRevision: created.revision,
      organizationSlug: fixture.organizationSlug,
      productSlug: created.slug
    });

    await expect(
      owner.products.archive({
        expectedRevision: created.revision,
        organizationSlug: fixture.organizationSlug,
        productSlug: created.slug
      })
    ).rejects.toMatchObject({ code: "PRODUCT_CONFLICT", data: { revision: edited.revision } });

    await expect(
      owner.products.bySlug({
        organizationSlug: fixture.otherOrganizationSlug,
        productSlug: created.slug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deletes an unreferenced Product and archives Products referenced by a Draft or Order", async () => {
    const owner = clientFor(fixture.ownerId);
    const unreferenced = await owner.products.create({
      ...content,
      organizationSlug: fixture.organizationSlug,
      slug: "unreferenced-album"
    });
    await expect(
      owner.products.remove({
        expectedRevision: unreferenced.revision,
        organizationSlug: fixture.organizationSlug,
        productSlug: unreferenced.slug
      })
    ).resolves.toMatchObject({ id: unreferenced.id, result: "deleted" });

    const draftReferenced = await owner.products.create({
      ...content,
      organizationSlug: fixture.organizationSlug,
      slug: "draft-referenced-album"
    });
    await db.insert(configurationDraft).values({
      customerId: fixture.customerId,
      organizationId: fixture.organizationId,
      productId: draftReferenced.id,
      snapshot: {
        evaluationSummary: {
          issues: [
            { code: "quantity_invalid", location: { kind: "quantity" }, params: { quantity: 0 } }
          ],
          status: "invalid"
        },
        projectName: null,
        quantity: 0,
        selections: {},
        step: { kind: "review" }
      }
    });
    await expect(
      owner.products.remove({
        expectedRevision: draftReferenced.revision,
        organizationSlug: fixture.organizationSlug,
        productSlug: draftReferenced.slug
      })
    ).resolves.toMatchObject({ id: draftReferenced.id, result: "archived" });

    const referenced = await owner.products.create({
      ...content,
      organizationSlug: fixture.organizationSlug,
      slug: "referenced-album"
    });
    const draftId = crypto.randomUUID();
    await db.insert(configurationDraft).values({
      customerId: fixture.customerId,
      id: draftId,
      organizationId: fixture.organizationId,
      productId: referenced.id,
      snapshot: {
        evaluationSummary: {
          issues: [
            { code: "quantity_invalid", location: { kind: "quantity" }, params: { quantity: 0 } }
          ],
          status: "invalid"
        },
        projectName: null,
        quantity: 0,
        selections: {},
        step: { kind: "review" }
      },
      status: "converted"
    });
    await db.insert(customerOrder).values({
      customerId: fixture.customerId,
      draftId,
      organizationId: fixture.organizationId,
      productId: referenced.id,
      projectName: null,
      snapshot: OrderSnapshotSchema.parse({
        orderTotal: { amountMinor: 0, currency: "USD" },
        perUnitBreakdown: [{ amountMinor: 0, kind: "base" }],
        perUnitTotal: { amountMinor: 0, currency: "USD" },
        product: { id: referenced.id, name: referenced.name, slug: referenced.slug },
        projectName: null,
        quantity: 1,
        selections: []
      })
    });

    await expect(
      owner.products.remove({
        expectedRevision: referenced.revision,
        organizationSlug: fixture.organizationSlug,
        productSlug: referenced.slug
      })
    ).resolves.toMatchObject({ id: referenced.id, result: "archived" });
    await expect(
      owner.products.bySlug({
        organizationSlug: fixture.organizationSlug,
        productSlug: referenced.slug
      })
    ).resolves.toMatchObject({ status: "archived" });
  });
});
