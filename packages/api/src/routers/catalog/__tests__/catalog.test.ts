import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { loadPublicProductDefinition } from "@tsu-stack/core/catalog";
import { evaluateConfiguration } from "@tsu-stack/core/configuration";
import { db } from "@tsu-stack/db";
import {
  component,
  member,
  optionGroup,
  optionValue,
  optionValueComponent,
  optionValueRequirement,
  organization,
  product,
  user
} from "@tsu-stack/db/schema";
import { createLogger } from "@tsu-stack/logger/server";

import { catalogRouter } from "#@/routers/catalog/index";

const fixture = {
  organizationId: crypto.randomUUID(),
  organizationSlug: `organization-${crypto.randomUUID()}`,
  otherOrganizationId: crypto.randomUUID(),
  otherOrganizationSlug: `organization-${crypto.randomUUID()}`,
  memberId: crypto.randomUUID(),
  otherMemberId: crypto.randomUUID(),
  nonMemberId: crypto.randomUUID(),
  // Non-customer members of THIS org — catalog browsing must reject them.
  ownerId: crypto.randomUUID(),
  managerId: crypto.randomUUID(),
  publishedProductId: crypto.randomUUID(),
  publishedProductSlug: `product-${crypto.randomUUID()}`,
  draftProductId: crypto.randomUUID(),
  draftProductSlug: `product-${crypto.randomUUID()}`,
  otherProductId: crypto.randomUUID(),
  otherProductSlug: `product-${crypto.randomUUID()}`,
  // Option groups (by position).
  coverGroupId: crypto.randomUUID(),
  giftWrapGroupId: crypto.randomUUID(),
  pagesGroupId: crypto.randomUUID(),
  // Option values.
  hardcoverValueId: crypto.randomUUID(),
  softcoverValueId: crypto.randomUUID(),
  giftWrapYesValueId: crypto.randomUUID(),
  giftWrapNoValueId: crypto.randomUUID(),
  // Components with mixed stock.
  inStockComponentId: crypto.randomUUID(),
  outOfStockComponentId: crypto.randomUUID()
};

function createContext(userId: string, email: string) {
  const authSession = {
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
      email,
      emailVerified: true,
      id: userId,
      image: null,
      name: "Fixture User",
      role: "user",
      updatedAt: new Date()
    }
  };
  return {
    authSession,
    db,
    headers: new Headers(),
    logger: createLogger({ operation: "catalog_router_test" })
  };
}

beforeAll(async () => {
  await db.insert(user).values([
    {
      email: `${fixture.memberId}@example.com`,
      emailVerified: true,
      id: fixture.memberId,
      name: "Catalog Member",
      role: "user"
    },
    {
      email: `${fixture.otherMemberId}@example.com`,
      emailVerified: true,
      id: fixture.otherMemberId,
      name: "Other Org Member",
      role: "user"
    },
    {
      email: `${fixture.nonMemberId}@example.com`,
      emailVerified: true,
      id: fixture.nonMemberId,
      name: "Non-member",
      role: "user"
    },
    {
      email: `${fixture.ownerId}@example.com`,
      emailVerified: true,
      id: fixture.ownerId,
      name: "Catalog Owner",
      role: "user"
    },
    {
      email: `${fixture.managerId}@example.com`,
      emailVerified: true,
      id: fixture.managerId,
      name: "Catalog Manager",
      role: "user"
    }
  ]);
  await db.insert(organization).values([
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.organizationId,
      name: "Catalog Organization",
      slug: fixture.organizationSlug
    },
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.otherOrganizationId,
      name: "Other Catalog Organization",
      slug: fixture.otherOrganizationSlug
    }
  ]);
  await db.insert(member).values([
    {
      createdAt: new Date(),
      id: fixture.memberId,
      organizationId: fixture.organizationId,
      role: "customer",
      userId: fixture.memberId
    },
    {
      createdAt: new Date(),
      id: fixture.otherMemberId,
      organizationId: fixture.otherOrganizationId,
      role: "customer",
      userId: fixture.otherMemberId
    },
    {
      createdAt: new Date(),
      id: fixture.ownerId,
      organizationId: fixture.organizationId,
      role: "owner",
      userId: fixture.ownerId
    },
    {
      createdAt: new Date(),
      id: fixture.managerId,
      organizationId: fixture.organizationId,
      role: "manager",
      userId: fixture.managerId
    }
  ]);

  // Components: one plentiful, one out of stock.
  await db.insert(component).values([
    {
      id: fixture.inStockComponentId,
      name: "Hardcover Board",
      organizationId: fixture.organizationId,
      quantity: "100",
      lowStockThreshold: "5",
      unit: "each"
    },
    {
      id: fixture.outOfStockComponentId,
      name: "Softcover Sheet",
      organizationId: fixture.organizationId,
      quantity: "0",
      lowStockThreshold: "5",
      unit: "each"
    }
  ]);

  // Products: published (full tree), draft, and one in the other org.
  await db.insert(product).values([
    {
      basePriceMinor: 5000,
      id: fixture.publishedProductId,
      imageUrls: ["https://example.com/album-front.png", "https://example.com/album-back.png"],
      name: "Photo Album",
      organizationId: fixture.organizationId,
      slug: fixture.publishedProductSlug,
      status: "published"
    },
    {
      basePriceMinor: 3000,
      id: fixture.draftProductId,
      name: "Draft Album",
      organizationId: fixture.organizationId,
      slug: fixture.draftProductSlug,
      status: "draft"
    },
    {
      basePriceMinor: 4000,
      id: fixture.otherProductId,
      name: "Other Org Album",
      organizationId: fixture.otherOrganizationId,
      slug: fixture.otherProductSlug,
      status: "published"
    }
  ]);

  await db.insert(optionGroup).values([
    {
      id: fixture.coverGroupId,
      key: "cover",
      label: "Cover",
      position: 0,
      productId: fixture.publishedProductId,
      required: true,
      type: "single"
    },
    {
      id: fixture.giftWrapGroupId,
      key: "gift-wrap",
      label: "Gift Wrap",
      position: 1,
      productId: fixture.publishedProductId,
      required: true,
      type: "boolean"
    },
    {
      additionalUnitPriceMinor: 100,
      id: fixture.pagesGroupId,
      included: 20,
      key: "pages",
      label: "Pages",
      maximum: 60,
      minimum: 20,
      position: 2,
      productId: fixture.publishedProductId,
      required: false,
      step: 10,
      type: "number"
    }
  ]);

  await db.insert(optionValue).values([
    {
      id: fixture.hardcoverValueId,
      label: "Hardcover",
      optionGroupId: fixture.coverGroupId,
      organizationId: fixture.organizationId,
      position: 0,
      priceAdjustmentMinor: 1500,
      productId: fixture.publishedProductId
    },
    {
      id: fixture.softcoverValueId,
      label: "Softcover",
      optionGroupId: fixture.coverGroupId,
      organizationId: fixture.organizationId,
      position: 1,
      priceAdjustmentMinor: 0,
      productId: fixture.publishedProductId
    },
    {
      id: fixture.giftWrapYesValueId,
      label: "Yes",
      optionGroupId: fixture.giftWrapGroupId,
      organizationId: fixture.organizationId,
      position: 0,
      priceAdjustmentMinor: 500,
      productId: fixture.publishedProductId
    },
    {
      id: fixture.giftWrapNoValueId,
      label: "No",
      optionGroupId: fixture.giftWrapGroupId,
      organizationId: fixture.organizationId,
      position: 1,
      priceAdjustmentMinor: 0,
      productId: fixture.publishedProductId
    }
  ]);

  // Requirement: gift-wrap "Yes" accepts either cover value from the earlier group.
  await db.insert(optionValueRequirement).values([
    {
      optionValueId: fixture.giftWrapYesValueId,
      prerequisiteOptionValueId: fixture.hardcoverValueId,
      productId: fixture.publishedProductId
    },
    {
      optionValueId: fixture.giftWrapYesValueId,
      prerequisiteOptionValueId: fixture.softcoverValueId,
      productId: fixture.publishedProductId
    }
  ]);

  // Component links with mixed stock: Hardcover -> in-stock, Softcover -> out-of-stock.
  await db.insert(optionValueComponent).values([
    {
      componentId: fixture.inStockComponentId,
      optionValueId: fixture.hardcoverValueId,
      organizationId: fixture.organizationId
    },
    {
      componentId: fixture.outOfStockComponentId,
      optionValueId: fixture.softcoverValueId,
      organizationId: fixture.organizationId
    }
  ]);
});

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, fixture.organizationId));
  await db.delete(organization).where(eq(organization.id, fixture.otherOrganizationId));
  for (const id of [
    fixture.memberId,
    fixture.otherMemberId,
    fixture.nonMemberId,
    fixture.ownerId,
    fixture.managerId
  ]) {
    await db.delete(user).where(eq(user.id, id));
  }
});

describe("catalog router", () => {
  it("restricts catalog browsing to customers — owners and managers are FORBIDDEN", async () => {
    const ownerClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.ownerId, `${fixture.ownerId}@example.com`)
    });
    const managerClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.managerId, `${fixture.managerId}@example.com`)
    });
    const customerClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.memberId, `${fixture.memberId}@example.com`)
    });

    // Both non-customer roles are members of this org, so this is a role check
    // (FORBIDDEN), not a membership check (NOT_FOUND) — the org's existence is
    // already known to them.
    for (const client of [ownerClient, managerClient]) {
      await expect(
        client.list({ organizationSlug: fixture.organizationSlug })
      ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });
      await expect(
        client.bySlug({
          organizationSlug: fixture.organizationSlug,
          productSlug: fixture.publishedProductSlug
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });
    }

    // The customer on the same org is still allowed.
    await expect(
      customerClient.list({ organizationSlug: fixture.organizationSlug })
    ).resolves.toHaveLength(1);
  });

  it("lists only this organization's published products as lightweight summaries", async () => {
    const memberClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.memberId, `${fixture.memberId}@example.com`)
    });

    const summaries = await memberClient.list({ organizationSlug: fixture.organizationSlug });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toEqual({
      slug: fixture.publishedProductSlug,
      name: "Photo Album",
      thumbnailUrl: "https://example.com/album-front.png",
      basePriceMinor: 5000,
      currency: "USD"
    });
    // Neither the draft product nor the other org's product leak in.
    expect(summaries.map((summary) => summary.slug)).not.toContain(fixture.draftProductSlug);
    expect(summaries.map((summary) => summary.slug)).not.toContain(fixture.otherProductSlug);
  });

  it("returns the complete curated product definition for a published slug", async () => {
    const memberClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.memberId, `${fixture.memberId}@example.com`)
    });

    const payload = await memberClient.bySlug({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.publishedProductSlug
    });

    expect(payload.slug).toBe(fixture.publishedProductSlug);
    expect(payload.name).toBe("Photo Album");
    expect(payload.currency).toBe("USD");
    expect(payload.imageUrls).toEqual([
      "https://example.com/album-front.png",
      "https://example.com/album-back.png"
    ]);
    expect(payload.definition.id).toBe(fixture.publishedProductId);
    expect(payload.definition.basePriceMinor).toBe(5000);

    // Group structure + types, in position order.
    expect(payload.definition.groups.map((group) => group.type)).toEqual([
      "single",
      "boolean",
      "number"
    ]);

    const [coverGroup, giftWrapGroup, pagesGroup] = payload.definition.groups;
    expect(coverGroup).toMatchObject({ type: "single", key: "cover", label: "Cover" });
    expect(giftWrapGroup).toMatchObject({ type: "boolean", key: "gift-wrap", label: "Gift Wrap" });
    expect(pagesGroup).toMatchObject({
      type: "number",
      key: "pages",
      minimum: 20,
      maximum: 60,
      step: 10,
      included: 20,
      additionalUnitPriceMinor: 100
    });

    // Value labels + prices are curated onto the definition.
    if (coverGroup.type !== "single") throw new Error("expected single cover group");
    expect(coverGroup.values).toEqual([
      expect.objectContaining({
        id: fixture.hardcoverValueId,
        label: "Hardcover",
        priceAdjustmentMinor: 1500,
        componentIds: [fixture.inStockComponentId]
      }),
      expect.objectContaining({
        id: fixture.softcoverValueId,
        label: "Softcover",
        priceAdjustmentMinor: 0,
        componentIds: [fixture.outOfStockComponentId]
      })
    ]);

    // Direct requirement edges group into one OR-clause derived from cover ownership.
    if (giftWrapGroup.type !== "boolean") throw new Error("expected boolean gift-wrap group");
    const giftWrapYes = giftWrapGroup.values.find(
      (value) => value.id === fixture.giftWrapYesValueId
    );
    expect(giftWrapYes?.requirements).toEqual([
      {
        groupKey: "cover",
        optionValueIds: [fixture.hardcoverValueId, fixture.softcoverValueId]
      }
    ]);

    // Availability carries a status for every referenced component, including the out one.
    expect(payload.availability).toEqual({
      [fixture.inStockComponentId]: "available",
      [fixture.outOfStockComponentId]: "out"
    });

    // No raw inventory/authoring fields leak to the customer surface.
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("quantity");
    expect(serialized).not.toContain("lowStockThreshold");
    expect(serialized).not.toContain("availabilityOverride");
    expect(serialized).not.toContain("threshold");
    expect(serialized).not.toContain("override");
    expect(serialized).not.toContain("revision");
    expect(serialized).not.toContain("status");
  });

  it("hides products behind NOT_FOUND across membership, publication, and tenant boundaries", async () => {
    const nonMemberClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.nonMemberId, `${fixture.nonMemberId}@example.com`)
    });
    const otherOrgMemberClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.otherMemberId, `${fixture.otherMemberId}@example.com`)
    });
    const memberClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.memberId, `${fixture.memberId}@example.com`)
    });

    // A non-member requesting this org's slug never learns the org (or product) exists.
    await expect(
      nonMemberClient.bySlug({
        organizationSlug: fixture.organizationSlug,
        productSlug: fixture.publishedProductSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });

    // A member of the OTHER org requesting this org's slug is likewise hidden.
    await expect(
      otherOrgMemberClient.bySlug({
        organizationSlug: fixture.organizationSlug,
        productSlug: fixture.publishedProductSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });

    // An unpublished (draft) product is not resolvable through the catalog.
    await expect(
      memberClient.bySlug({
        organizationSlug: fixture.organizationSlug,
        productSlug: fixture.draftProductSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });

    // The other org's product slug requested via THIS org's slug does not cross tenants.
    await expect(
      memberClient.bySlug({
        organizationSlug: fixture.organizationSlug,
        productSlug: fixture.otherProductSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
  });

  it("hides the catalog list from non-members and other tenants behind NOT_FOUND", async () => {
    const nonMemberClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.nonMemberId, `${fixture.nonMemberId}@example.com`)
    });
    const otherOrgMemberClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.otherMemberId, `${fixture.otherMemberId}@example.com`)
    });

    // A non-member listing this org's catalog never learns the org exists.
    await expect(
      nonMemberClient.list({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });

    // A member of the OTHER org cannot read this org's catalog through its slug.
    await expect(
      otherOrgMemberClient.list({ organizationSlug: fixture.organizationSlug })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
  });

  it("rejects cross-scope catalog associations at the database boundary", async () => {
    const otherComponentId = crypto.randomUUID();
    const otherGroupId = crypto.randomUUID();

    await db.insert(component).values({
      id: otherComponentId,
      name: "Other tenant component",
      organizationId: fixture.otherOrganizationId,
      unit: "piece"
    });
    await db.insert(optionGroup).values({
      id: otherGroupId,
      key: "other-cover",
      label: "Other cover",
      position: 0,
      productId: fixture.otherProductId,
      required: true,
      type: "single"
    });

    await expect(
      db.insert(optionValueComponent).values({
        componentId: otherComponentId,
        optionValueId: fixture.hardcoverValueId,
        organizationId: fixture.organizationId
      })
    ).rejects.toMatchObject({
      cause: { constraint_name: "option_value_component_component_fkey" }
    });

    await expect(
      db.insert(optionValue).values({
        id: crypto.randomUUID(),
        label: "Mismatched value",
        optionGroupId: otherGroupId,
        organizationId: fixture.organizationId,
        position: 0,
        priceAdjustmentMinor: 0,
        productId: fixture.publishedProductId
      })
    ).rejects.toMatchObject({
      cause: { constraint_name: "option_value_option_group_product_fkey" }
    });
  });

  it("rejects monetary values outside JavaScript's safe integer range", async () => {
    await expect(
      db.insert(product).values({
        basePriceMinor: Number.MAX_SAFE_INTEGER + 1,
        imageUrls: [],
        name: "Unsafe money",
        organizationId: fixture.organizationId,
        slug: `unsafe-money-${crypto.randomUUID()}`,
        status: "draft"
      })
    ).rejects.toMatchObject({ cause: { constraint_name: "product_base_price_minor_check" } });

    // The derived monetary columns carry the same safe-integer bound.
    await expect(
      db.insert(optionValue).values({
        id: crypto.randomUUID(),
        label: "Unsafe adjustment",
        optionGroupId: fixture.coverGroupId,
        organizationId: fixture.organizationId,
        position: 99,
        priceAdjustmentMinor: Number.MAX_SAFE_INTEGER + 1,
        productId: fixture.publishedProductId
      })
    ).rejects.toMatchObject({
      cause: { constraint_name: "option_value_price_adjustment_minor_check" }
    });

    // A fully valid number group (passes the number-fields check) but an unsafe unit price.
    await expect(
      db.insert(optionGroup).values({
        additionalUnitPriceMinor: Number.MAX_SAFE_INTEGER + 1,
        id: crypto.randomUUID(),
        included: 0,
        key: `unsafe-unit-${crypto.randomUUID()}`,
        label: "Unsafe unit price",
        maximum: 10,
        minimum: 0,
        position: 99,
        productId: fixture.publishedProductId,
        required: false,
        step: 5,
        type: "number"
      })
    ).rejects.toMatchObject({
      cause: { constraint_name: "option_group_additional_unit_price_minor_check" }
    });
  });

  it("rejects a self-referential option value requirement at the database boundary", async () => {
    await expect(
      db.insert(optionValueRequirement).values({
        optionValueId: fixture.hardcoverValueId,
        prerequisiteOptionValueId: fixture.hardcoverValueId,
        productId: fixture.publishedProductId
      })
    ).rejects.toMatchObject({
      cause: { constraint_name: "option_value_requirement_no_self_reference_check" }
    });
  });

  it("returns an evaluator-ready payload", async () => {
    const memberClient = createRouterClient(catalogRouter, {
      context: createContext(fixture.memberId, `${fixture.memberId}@example.com`)
    });

    const { definition, availability, currency } = await memberClient.bySlug({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.publishedProductSlug
    });

    // A valid selection (Hardcover + gift-wrap Yes + 40 pages) evaluates cleanly.
    const valid = evaluateConfiguration({
      product: definition,
      availability,
      currency,
      quantity: 2,
      selections: {
        cover: fixture.hardcoverValueId,
        "gift-wrap": fixture.giftWrapYesValueId,
        pages: 40
      }
    });

    expect(valid.status).toBe("valid");
    if (valid.status !== "valid") throw new Error("expected valid evaluation");
    // base 5000 + Hardcover 1500 + gift-wrap Yes 500 + (40 - 20 included) * 100 = 9000 per unit.
    expect(valid.perUnitTotal).toEqual({ amountMinor: 9000, currency: "USD" });
    expect(Number.isInteger(valid.orderTotal.amountMinor)).toBe(true);
    expect(valid.orderTotal).toEqual({ amountMinor: 18000, currency: "USD" });

    // The out-of-stock component surfaces on its option value as a disabled explanation...
    const disabled = valid.disabledExplanations.find(
      (explanation) => explanation.optionValueId === fixture.softcoverValueId
    );
    expect(disabled?.reasons).toContainEqual({
      code: "component_unavailable",
      params: { componentId: fixture.outOfStockComponentId }
    });

    // ...and selecting it invalidates the configuration with a component_unavailable issue.
    const invalid = evaluateConfiguration({
      product: definition,
      availability,
      currency,
      quantity: 1,
      selections: {
        cover: fixture.softcoverValueId,
        "gift-wrap": fixture.giftWrapNoValueId
      }
    });

    expect(invalid.status).toBe("invalid");
    if (invalid.status !== "invalid") throw new Error("expected invalid evaluation");
    expect(invalid.issues).toContainEqual(
      expect.objectContaining({
        code: "component_unavailable",
        params: expect.objectContaining({
          componentId: fixture.outOfStockComponentId,
          optionValueId: fixture.softcoverValueId
        })
      })
    );
  });

  it("keeps product-definition query count fixed as groups and values grow", async () => {
    let baselineQueryCount = 0;
    const baselineDb = drizzle({
      client: db.$client,
      relations: db._.relations,
      logger: {
        logQuery() {
          baselineQueryCount += 1;
        }
      }
    });
    await loadPublicProductDefinition(baselineDb, {
      organizationId: fixture.organizationId,
      productSlug: fixture.publishedProductSlug
    });

    const extraGroupIds = Array.from({ length: 20 }, () => crypto.randomUUID());
    await db.insert(optionGroup).values(
      extraGroupIds.map((id, index) => {
        return {
          id,
          key: `extra-group-${index}`,
          label: `Extra group ${index}`,
          position: index + 10,
          productId: fixture.publishedProductId,
          required: false,
          type: "single" as const
        };
      })
    );

    await db.insert(optionValue).values(
      extraGroupIds.flatMap((optionGroupId, groupIndex) =>
        [0, 1].map((position) => {
          return {
            id: crypto.randomUUID(),
            label: `Extra value ${groupIndex}-${position}`,
            optionGroupId,
            organizationId: fixture.organizationId,
            position,
            priceAdjustmentMinor: groupIndex + position,
            productId: fixture.publishedProductId
          };
        })
      )
    );

    try {
      let expandedQueryCount = 0;
      const expandedDb = drizzle({
        client: db.$client,
        relations: db._.relations,
        logger: {
          logQuery() {
            expandedQueryCount += 1;
          }
        }
      });
      const expandedDefinition = await loadPublicProductDefinition(expandedDb, {
        organizationId: fixture.organizationId,
        productSlug: fixture.publishedProductSlug
      });

      expect(expandedDefinition?.definition.groups).toHaveLength(3 + extraGroupIds.length);
      expect(baselineQueryCount).toBe(6);
      expect(expandedQueryCount).toBe(baselineQueryCount);
    } finally {
      await db.delete(optionGroup).where(inArray(optionGroup.id, extraGroupIds));
    }
  });
});
