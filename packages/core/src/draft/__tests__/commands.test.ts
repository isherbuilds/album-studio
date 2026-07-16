import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createConfigurationDraft } from "@tsu-stack/core/draft";
import { db } from "@tsu-stack/db";
import {
  component,
  optionGroup,
  optionValue,
  optionValueComponent,
  optionValueRequirement,
  organization,
  product,
  user
} from "@tsu-stack/db/schema";

const fixture = {
  customerId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  organizationSlug: `draft-defaults-${crypto.randomUUID()}`,
  productId: crypto.randomUUID(),
  productSlug: `draft-defaults-${crypto.randomUUID()}`,
  coverGroupId: crypto.randomUUID(),
  disabledCoverId: crypto.randomUUID(),
  strandingCoverId: crypto.randomUUID(),
  availableCoverId: crypto.randomUUID(),
  styleGroupId: crypto.randomUUID(),
  incompatibleStyleId: crypto.randomUUID(),
  compatibleStyleId: crypto.randomUUID(),
  optionalGroupId: crypto.randomUUID(),
  optionalValueId: crypto.randomUUID(),
  pagesGroupId: crypto.randomUUID(),
  blockedGroupId: crypto.randomUUID(),
  unavailableBlockedId: crypto.randomUUID(),
  incompatibleBlockedId: crypto.randomUUID(),
  unavailableComponentId: crypto.randomUUID(),
  availableComponentId: crypto.randomUUID()
};

beforeAll(async () => {
  await db.insert(user).values({
    email: `${fixture.customerId}@example.com`,
    emailVerified: true,
    id: fixture.customerId,
    name: "Draft Defaults Fixture"
  });
  await db.insert(organization).values({
    createdAt: new Date(),
    currency: "USD",
    id: fixture.organizationId,
    name: "Draft Defaults Organization",
    slug: fixture.organizationSlug
  });
  await db.insert(product).values({
    basePriceMinor: 10_000,
    id: fixture.productId,
    name: "Draft Defaults Product",
    organizationId: fixture.organizationId,
    slug: fixture.productSlug,
    status: "published"
  });
  await db.insert(optionGroup).values([
    {
      id: fixture.coverGroupId,
      key: "cover",
      label: "Cover",
      position: 0,
      productId: fixture.productId,
      required: true,
      type: "single"
    },
    {
      id: fixture.styleGroupId,
      key: "style",
      label: "Style",
      position: 1,
      productId: fixture.productId,
      required: true,
      type: "boolean"
    },
    {
      id: fixture.optionalGroupId,
      key: "gift-box",
      label: "Gift box",
      position: 2,
      productId: fixture.productId,
      required: false,
      type: "single"
    },
    {
      additionalUnitPriceMinor: 100,
      id: fixture.pagesGroupId,
      included: 20,
      key: "pages",
      label: "Pages",
      maximum: 60,
      minimum: 20,
      position: 3,
      productId: fixture.productId,
      required: true,
      step: 10,
      type: "number"
    },
    {
      id: fixture.blockedGroupId,
      key: "blocked",
      label: "Blocked",
      position: 4,
      productId: fixture.productId,
      required: true,
      type: "single"
    }
  ]);
  await db.insert(optionValue).values([
    {
      id: fixture.disabledCoverId,
      label: "Unavailable cover",
      optionGroupId: fixture.coverGroupId,
      organizationId: fixture.organizationId,
      position: 0,
      priceAdjustmentMinor: 0,
      productId: fixture.productId
    },
    {
      id: fixture.strandingCoverId,
      label: "Available cover without compatible styles",
      optionGroupId: fixture.coverGroupId,
      organizationId: fixture.organizationId,
      position: 1,
      priceAdjustmentMinor: 0,
      productId: fixture.productId
    },
    {
      id: fixture.availableCoverId,
      label: "Available cover",
      optionGroupId: fixture.coverGroupId,
      organizationId: fixture.organizationId,
      position: 2,
      priceAdjustmentMinor: 0,
      productId: fixture.productId
    },
    {
      id: fixture.incompatibleStyleId,
      label: "Incompatible style",
      optionGroupId: fixture.styleGroupId,
      organizationId: fixture.organizationId,
      position: 0,
      priceAdjustmentMinor: 0,
      productId: fixture.productId
    },
    {
      id: fixture.compatibleStyleId,
      label: "Compatible style",
      optionGroupId: fixture.styleGroupId,
      organizationId: fixture.organizationId,
      position: 1,
      priceAdjustmentMinor: 0,
      productId: fixture.productId
    },
    {
      id: fixture.optionalValueId,
      label: "Gift box",
      optionGroupId: fixture.optionalGroupId,
      organizationId: fixture.organizationId,
      position: 0,
      priceAdjustmentMinor: 0,
      productId: fixture.productId
    },
    {
      id: fixture.unavailableBlockedId,
      label: "Unavailable blocked value",
      optionGroupId: fixture.blockedGroupId,
      organizationId: fixture.organizationId,
      position: 0,
      priceAdjustmentMinor: 0,
      productId: fixture.productId
    },
    {
      id: fixture.incompatibleBlockedId,
      label: "Incompatible blocked value",
      optionGroupId: fixture.blockedGroupId,
      organizationId: fixture.organizationId,
      position: 1,
      priceAdjustmentMinor: 0,
      productId: fixture.productId
    }
  ]);
  await db.insert(component).values([
    {
      availabilityOverride: "out",
      id: fixture.unavailableComponentId,
      name: "Unavailable material",
      organizationId: fixture.organizationId,
      unit: "sheet"
    },
    {
      availabilityOverride: "available",
      id: fixture.availableComponentId,
      name: "Available material",
      organizationId: fixture.organizationId,
      unit: "sheet"
    }
  ]);
  await db.insert(optionValueComponent).values([
    {
      componentId: fixture.unavailableComponentId,
      optionValueId: fixture.disabledCoverId,
      organizationId: fixture.organizationId
    },
    {
      componentId: fixture.availableComponentId,
      optionValueId: fixture.availableCoverId,
      organizationId: fixture.organizationId
    },
    {
      componentId: fixture.unavailableComponentId,
      optionValueId: fixture.unavailableBlockedId,
      organizationId: fixture.organizationId
    }
  ]);
  await db.insert(optionValueRequirement).values([
    {
      optionValueId: fixture.incompatibleStyleId,
      prerequisiteOptionValueId: fixture.disabledCoverId,
      productId: fixture.productId
    },
    {
      optionValueId: fixture.compatibleStyleId,
      prerequisiteOptionValueId: fixture.availableCoverId,
      productId: fixture.productId
    },
    {
      optionValueId: fixture.incompatibleBlockedId,
      prerequisiteOptionValueId: fixture.disabledCoverId,
      productId: fixture.productId
    }
  ]);
});

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, fixture.organizationId));
  await db.delete(user).where(eq(user.id, fixture.customerId));
});

describe("createConfigurationDraft", () => {
  it("saves valid defaults for required groups without selecting optional or blocked values", async () => {
    const editor = await createConfigurationDraft(db, {
      customerId: fixture.customerId,
      organizationId: fixture.organizationId,
      productSlug: fixture.productSlug,
      projectName: undefined
    });

    expect(editor?.draft.selections).toEqual({
      cover: fixture.availableCoverId,
      pages: 20,
      style: fixture.compatibleStyleId
    });
  });
});
