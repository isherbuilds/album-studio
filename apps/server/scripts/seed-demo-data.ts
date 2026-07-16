import process from "node:process";

import { and, eq, inArray } from "drizzle-orm";

import { auth } from "@tsu-stack/auth/index";
import { DEFAULT_ORGANIZATION_CURRENCY } from "@tsu-stack/contract/configuration";
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

const ORGANIZATION_SLUG = "demo-studio";
const WEDDING_PRODUCT_SLUG = "wedding-album";
const OWNER_EMAIL = "owner@demo-studio.test";
const MANAGER_EMAIL = "manager@demo-studio.test";
const CUSTOMER_EMAIL = "customer@demo-studio.test";
const DEMO_PASSWORD = "demo-password-123";

type ComponentFixture = {
  key: string;
  lowStockThreshold: string;
  name: string;
  quantity: string;
  unit: string;
};

type OptionValueFixture = {
  componentKeys?: readonly string[];
  imageUrl?: string;
  key: string;
  label: string;
  priceAdjustmentMinor: number;
  prerequisiteKeys?: readonly string[];
};

type DiscreteOptionGroupFixture = {
  key: string;
  label: string;
  required: boolean;
  type: "boolean" | "single";
  values: readonly OptionValueFixture[];
};

type NumberOptionGroupFixture = {
  additionalUnitPriceMinor: number;
  included: number;
  key: string;
  label: string;
  maximum: number;
  minimum: number;
  required: boolean;
  step: number;
  type: "number";
};

type ProductFixture = {
  basePriceMinor: number;
  components: readonly ComponentFixture[];
  description: string;
  imageUrls: readonly string[];
  name: string;
  optionGroups: readonly (DiscreteOptionGroupFixture | NumberOptionGroupFixture)[];
  slug: string;
};

const CATALOG_FIXTURES: readonly ProductFixture[] = [
  {
    basePriceMinor: 15_000,
    components: [
      {
        key: "linen-fabric",
        lowStockThreshold: "10",
        name: "Linen Fabric",
        quantity: "100",
        unit: "sheet"
      },
      {
        key: "leather-hide",
        lowStockThreshold: "10",
        name: "Leather Hide",
        quantity: "5",
        unit: "sheet"
      },
      {
        key: "silk-roll",
        lowStockThreshold: "10",
        name: "Silk Roll",
        quantity: "100",
        unit: "roll"
      },
      {
        key: "velvet-fabric",
        lowStockThreshold: "10",
        name: "Velvet Fabric",
        quantity: "0",
        unit: "sheet"
      },
      {
        key: "foil-roll",
        lowStockThreshold: "10",
        name: "Foil Roll",
        quantity: "0",
        unit: "roll"
      },
      {
        key: "gift-box-stock",
        lowStockThreshold: "10",
        name: "Gift Box Stock",
        quantity: "8",
        unit: "unit"
      }
    ],
    description:
      "A premium linen-and-leather wedding album, configurable by cover, finish, page count, and gift box.",
    imageUrls: ["/placeholders/album-hero.svg"],
    name: "Wedding Album",
    optionGroups: [
      {
        key: "cover",
        label: "Cover",
        required: true,
        type: "single",
        values: [
          {
            componentKeys: ["linen-fabric"],
            imageUrl: "/placeholders/cover-linen.svg",
            key: "cover-linen",
            label: "Linen",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["leather-hide"],
            imageUrl: "/placeholders/cover-leather.svg",
            key: "cover-leather",
            label: "Leather",
            priceAdjustmentMinor: 4_000
          },
          {
            componentKeys: ["silk-roll"],
            imageUrl: "/placeholders/cover-silk.svg",
            key: "cover-silk",
            label: "Silk",
            priceAdjustmentMinor: 2_500
          },
          {
            componentKeys: ["velvet-fabric"],
            imageUrl: "/placeholders/cover-velvet.svg",
            key: "cover-velvet",
            label: "Velvet",
            priceAdjustmentMinor: 3_000
          }
        ]
      },
      {
        key: "finish",
        label: "Finish",
        required: false,
        type: "single",
        values: [
          {
            imageUrl: "/placeholders/finish-matte.svg",
            key: "finish-matte",
            label: "Matte",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["foil-roll"],
            imageUrl: "/placeholders/finish-foil.svg",
            key: "finish-foil",
            label: "Foil",
            prerequisiteKeys: ["cover-linen", "cover-leather"],
            priceAdjustmentMinor: 1_500
          }
        ]
      },
      {
        additionalUnitPriceMinor: 300,
        included: 24,
        key: "pages",
        label: "Pages",
        maximum: 60,
        minimum: 20,
        required: true,
        step: 4,
        type: "number"
      },
      {
        key: "gift_box",
        label: "Gift Box",
        required: false,
        type: "boolean",
        values: [
          {
            key: "gift-box-no",
            label: "No Gift Box",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["gift-box-stock"],
            imageUrl: "/placeholders/giftbox.svg",
            key: "gift-box-premium",
            label: "Premium Gift Box",
            priceAdjustmentMinor: 2_000
          }
        ]
      }
    ],
    slug: WEDDING_PRODUCT_SLUG
  },
  {
    basePriceMinor: 9_500,
    components: [
      {
        key: "cover-board",
        lowStockThreshold: "12",
        name: "Family Yearbook Cover Board",
        quantity: "75",
        unit: "sheet"
      },
      {
        key: "recycled-paper",
        lowStockThreshold: "500",
        name: "Family Yearbook Recycled Paper",
        quantity: "4200",
        unit: "sheet"
      },
      {
        key: "keepsake-sleeve",
        lowStockThreshold: "8",
        name: "Family Yearbook Keepsake Sleeve",
        quantity: "24",
        unit: "unit"
      }
    ],
    description:
      "A cheerful annual family yearbook with durable covers, flexible page counts, and an optional keepsake sleeve.",
    imageUrls: ["/placeholders/cover-linen.svg", "/placeholders/album-hero.svg"],
    name: "Family Yearbook",
    optionGroups: [
      {
        key: "cover_style",
        label: "Cover Style",
        required: true,
        type: "single",
        values: [
          {
            componentKeys: ["cover-board"],
            imageUrl: "/placeholders/cover-linen.svg",
            key: "cover-style-cloth",
            label: "Clothbound",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["cover-board"],
            imageUrl: "/placeholders/cover-velvet.svg",
            key: "cover-style-illustrated",
            label: "Illustrated Hardcover",
            priceAdjustmentMinor: 1_200
          }
        ]
      },
      {
        key: "paper",
        label: "Paper",
        required: true,
        type: "single",
        values: [
          {
            componentKeys: ["recycled-paper"],
            imageUrl: "/placeholders/finish-matte.svg",
            key: "paper-recycled",
            label: "Recycled Matte",
            priceAdjustmentMinor: 0
          },
          {
            imageUrl: "/placeholders/finish-foil.svg",
            key: "paper-satin",
            label: "Satin",
            priceAdjustmentMinor: 900
          }
        ]
      },
      {
        additionalUnitPriceMinor: 175,
        included: 32,
        key: "pages",
        label: "Pages",
        maximum: 96,
        minimum: 24,
        required: true,
        step: 8,
        type: "number"
      },
      {
        key: "keepsake_sleeve",
        label: "Keepsake Sleeve",
        required: false,
        type: "boolean",
        values: [
          {
            key: "keepsake-sleeve-no",
            label: "No Sleeve",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["keepsake-sleeve"],
            imageUrl: "/placeholders/giftbox.svg",
            key: "keepsake-sleeve-yes",
            label: "Add Keepsake Sleeve",
            prerequisiteKeys: ["cover-style-cloth"],
            priceAdjustmentMinor: 1_400
          }
        ]
      }
    ],
    slug: "family-yearbook"
  },
  {
    basePriceMinor: 8_000,
    components: [
      {
        key: "panoramic-board",
        lowStockThreshold: "10",
        name: "Travel Photo Book Panoramic Board",
        quantity: "48",
        unit: "sheet"
      },
      {
        key: "gloss-paper",
        lowStockThreshold: "400",
        name: "Travel Photo Book Gloss Paper",
        quantity: "1800",
        unit: "sheet"
      },
      {
        key: "map-pocket",
        lowStockThreshold: "15",
        name: "Travel Photo Book Map Pocket",
        quantity: "60",
        unit: "unit"
      }
    ],
    description:
      "A portable travel photo book with landscape formats, vivid paper choices, and an optional pocket for maps and tickets.",
    imageUrls: ["/placeholders/cover-silk.svg", "/placeholders/album-hero.svg"],
    name: "Travel Photo Book",
    optionGroups: [
      {
        key: "format",
        label: "Format",
        required: true,
        type: "single",
        values: [
          {
            imageUrl: "/placeholders/cover-silk.svg",
            key: "format-square",
            label: "Square",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["panoramic-board"],
            imageUrl: "/placeholders/cover-leather.svg",
            key: "format-landscape",
            label: "Panoramic Landscape",
            priceAdjustmentMinor: 1_800
          }
        ]
      },
      {
        key: "paper",
        label: "Paper",
        required: true,
        type: "single",
        values: [
          {
            imageUrl: "/placeholders/finish-matte.svg",
            key: "paper-matte",
            label: "Matte",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["gloss-paper"],
            imageUrl: "/placeholders/finish-foil.svg",
            key: "paper-gloss",
            label: "High Gloss",
            prerequisiteKeys: ["format-landscape"],
            priceAdjustmentMinor: 1_100
          }
        ]
      },
      {
        additionalUnitPriceMinor: 125,
        included: 28,
        key: "pages",
        label: "Pages",
        maximum: 72,
        minimum: 20,
        required: true,
        step: 4,
        type: "number"
      },
      {
        key: "map_pocket",
        label: "Map Pocket",
        required: false,
        type: "boolean",
        values: [
          {
            key: "map-pocket-no",
            label: "No Pocket",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["map-pocket"],
            imageUrl: "/placeholders/giftbox.svg",
            key: "map-pocket-yes",
            label: "Add Map Pocket",
            priceAdjustmentMinor: 650
          }
        ]
      }
    ],
    slug: "travel-photo-book"
  },
  {
    basePriceMinor: 12_500,
    components: [
      {
        key: "layflat-hinge",
        lowStockThreshold: "20",
        name: "Portfolio Book Layflat Hinge",
        quantity: "90",
        unit: "unit"
      },
      {
        key: "cotton-paper",
        lowStockThreshold: "300",
        name: "Portfolio Book Cotton Paper",
        quantity: "2400",
        unit: "sheet"
      },
      {
        key: "presentation-case",
        lowStockThreshold: "5",
        name: "Portfolio Book Presentation Case",
        quantity: "16",
        unit: "unit"
      }
    ],
    description:
      "A gallery-ready professional portfolio with archival paper, precision binding, and presentation-ready packaging.",
    imageUrls: ["/placeholders/cover-leather.svg", "/placeholders/giftbox.svg"],
    name: "Professional Portfolio",
    optionGroups: [
      {
        key: "binding",
        label: "Binding",
        required: true,
        type: "single",
        values: [
          {
            imageUrl: "/placeholders/cover-linen.svg",
            key: "binding-case",
            label: "Case Bound",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["layflat-hinge"],
            imageUrl: "/placeholders/cover-leather.svg",
            key: "binding-layflat",
            label: "Layflat",
            priceAdjustmentMinor: 2_600
          }
        ]
      },
      {
        key: "paper",
        label: "Paper",
        required: true,
        type: "single",
        values: [
          {
            imageUrl: "/placeholders/finish-matte.svg",
            key: "paper-smooth",
            label: "Smooth White",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["cotton-paper"],
            imageUrl: "/placeholders/finish-foil.svg",
            key: "paper-cotton",
            label: "Archival Cotton",
            priceAdjustmentMinor: 2_200
          }
        ]
      },
      {
        additionalUnitPriceMinor: 450,
        included: 20,
        key: "spreads",
        label: "Spreads",
        maximum: 50,
        minimum: 10,
        required: true,
        step: 5,
        type: "number"
      },
      {
        key: "presentation_case",
        label: "Presentation Case",
        required: false,
        type: "boolean",
        values: [
          {
            key: "presentation-case-no",
            label: "No Case",
            priceAdjustmentMinor: 0
          },
          {
            componentKeys: ["presentation-case"],
            imageUrl: "/placeholders/giftbox.svg",
            key: "presentation-case-yes",
            label: "Add Presentation Case",
            prerequisiteKeys: ["binding-layflat", "paper-cotton"],
            priceAdjustmentMinor: 3_200
          }
        ]
      }
    ],
    slug: "professional-portfolio"
  }
];
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed demo data");
const databaseHost = new URL(databaseUrl).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(databaseHost)) {
  throw new Error(`Refusing to seed a non-local database (host: ${databaseHost})`);
}

async function findUserIdByEmail(email: string): Promise<string | undefined> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  return rows[0]?.id;
}

async function ensureUserId(email: string, name: string): Promise<string> {
  const existing = await findUserIdByEmail(email);
  if (existing !== undefined) return existing;

  const created = await auth.api.createUser({
    body: { email, name, password: DEMO_PASSWORD, role: "user" }
  });
  return created.user.id;
}

const existingOrganizations = await db
  .select({ id: organization.id })
  .from(organization)
  .where(eq(organization.slug, ORGANIZATION_SLUG))
  .limit(1);
const existingOrganization = existingOrganizations[0];

const ownerId = await ensureUserId(OWNER_EMAIL, "Demo Studio Owner");
const customerId = await ensureUserId(CUSTOMER_EMAIL, "Demo Studio Customer");
const managerId = await ensureUserId(MANAGER_EMAIL, "Demo Studio Manager");

let organizationId = existingOrganization?.id;
if (organizationId === undefined) {
  const createdOrganization = await auth.api.createOrganization({
    body: {
      currency: DEFAULT_ORGANIZATION_CURRENCY,
      keepCurrentActiveOrganization: true,
      name: "Demo Studio",
      slug: ORGANIZATION_SLUG,
      userId: ownerId
    }
  });
  organizationId = createdOrganization.id;
} else {
  await db
    .update(organization)
    .set({ currency: DEFAULT_ORGANIZATION_CURRENCY })
    .where(eq(organization.id, organizationId));
}

const existingCustomerMembers = await db
  .select({ id: member.id })
  .from(member)
  .where(and(eq(member.organizationId, organizationId), eq(member.userId, customerId)))
  .limit(1);
if (existingCustomerMembers.length === 0) {
  await auth.api.addMember({
    body: {
      organizationId,
      role: "customer",
      userId: customerId
    }
  });
}

const existingManagerMembers = await db
  .select({ id: member.id, role: member.role })
  .from(member)
  .where(and(eq(member.organizationId, organizationId), eq(member.userId, managerId)))
  .limit(1);
const existingManagerMember = existingManagerMembers[0];
if (!existingManagerMember) {
  await auth.api.addMember({
    body: {
      organizationId,
      role: "manager",
      userId: managerId
    }
  });
} else if (existingManagerMember.role !== "manager") {
  await db.update(member).set({ role: "manager" }).where(eq(member.id, existingManagerMember.id));
}

function fixtureId(productSlug: string, kind: string, key: string): string {
  return `demo-seed:${ORGANIZATION_SLUG}:${productSlug}:${kind}:${key}`;
}

await db.transaction(async (tx) => {
  const fixtureSlugs = CATALOG_FIXTURES.map((fixture) => fixture.slug);
  const existingProducts = await tx
    .select({
      basePriceMinor: product.basePriceMinor,
      description: product.description,
      id: product.id,
      imageUrls: product.imageUrls,
      name: product.name,
      slug: product.slug,
      status: product.status
    })
    .from(product)
    .where(and(eq(product.organizationId, organizationId), inArray(product.slug, fixtureSlugs)));
  const existingProductBySlug = new Map(
    existingProducts.map((existingProduct) => [existingProduct.slug, existingProduct])
  );
  const productIdBySlug = new Map<string, string>();

  for (const fixture of CATALOG_FIXTURES) {
    const existingProduct = existingProductBySlug.get(fixture.slug);
    const imageUrls = [...fixture.imageUrls];
    if (existingProduct) {
      const productNeedsUpdate =
        existingProduct.basePriceMinor !== fixture.basePriceMinor ||
        existingProduct.description !== fixture.description ||
        existingProduct.name !== fixture.name ||
        existingProduct.status !== "published" ||
        JSON.stringify(existingProduct.imageUrls) !== JSON.stringify(imageUrls);
      if (productNeedsUpdate) {
        await tx
          .update(product)
          .set({
            basePriceMinor: fixture.basePriceMinor,
            description: fixture.description,
            imageUrls,
            name: fixture.name,
            status: "published"
          })
          .where(eq(product.id, existingProduct.id));
      }
      productIdBySlug.set(fixture.slug, existingProduct.id);
      continue;
    }

    const productId = fixtureId(fixture.slug, "product", fixture.slug);
    await tx.insert(product).values({
      basePriceMinor: fixture.basePriceMinor,
      description: fixture.description,
      id: productId,
      imageUrls,
      name: fixture.name,
      organizationId,
      slug: fixture.slug,
      status: "published"
    });
    productIdBySlug.set(fixture.slug, productId);
  }

  const componentIdByFixtureKey = new Map<string, string>();
  for (const fixture of CATALOG_FIXTURES) {
    for (const componentFixture of fixture.components) {
      const fixtureKey = `${fixture.slug}:${componentFixture.key}`;
      componentIdByFixtureKey.set(
        fixtureKey,
        fixtureId(fixture.slug, "component", componentFixture.key)
      );
    }
  }
  const getFixtureComponentId = (productSlug: string, componentKey: string): string => {
    const componentId = componentIdByFixtureKey.get(`${productSlug}:${componentKey}`);
    if (!componentId) {
      throw new Error(`Missing component ID for ${productSlug}:${componentKey}`);
    }
    return componentId;
  };

  await tx.delete(optionGroup).where(inArray(optionGroup.productId, [...productIdBySlug.values()]));

  const allComponentFixtures = CATALOG_FIXTURES.flatMap((fixture) =>
    fixture.components.map((componentFixture) => ({
      ...componentFixture,
      id: getFixtureComponentId(fixture.slug, componentFixture.key)
    }))
  );
  const existingComponents = await tx
    .select({
      id: component.id,
      lowStockThreshold: component.lowStockThreshold,
      name: component.name,
      quantity: component.quantity,
      unit: component.unit
    })
    .from(component)
    .where(
      and(
        eq(component.organizationId, organizationId),
        inArray(
          component.id,
          allComponentFixtures.map((componentFixture) => componentFixture.id)
        )
      )
    );
  const existingComponentById = new Map(
    existingComponents.map((existingComponent) => [existingComponent.id, existingComponent])
  );

  for (const componentFixture of allComponentFixtures) {
    const existingComponent = existingComponentById.get(componentFixture.id);
    if (!existingComponent) {
      await tx.insert(component).values({
        id: componentFixture.id,
        lowStockThreshold: componentFixture.lowStockThreshold,
        name: componentFixture.name,
        organizationId,
        quantity: componentFixture.quantity,
        unit: componentFixture.unit
      });
      continue;
    }

    if (
      existingComponent.lowStockThreshold !== componentFixture.lowStockThreshold ||
      existingComponent.name !== componentFixture.name ||
      existingComponent.quantity !== componentFixture.quantity ||
      existingComponent.unit !== componentFixture.unit
    ) {
      await tx
        .update(component)
        .set({
          lowStockThreshold: componentFixture.lowStockThreshold,
          name: componentFixture.name,
          quantity: componentFixture.quantity,
          unit: componentFixture.unit
        })
        .where(
          and(eq(component.id, componentFixture.id), eq(component.organizationId, organizationId))
        );
    }
  }

  for (const fixture of CATALOG_FIXTURES) {
    const productId = productIdBySlug.get(fixture.slug);
    if (!productId) throw new Error(`Missing seeded product ID for ${fixture.slug}`);

    const componentIdByKey = new Map(
      fixture.components.map((componentFixture) => [
        componentFixture.key,
        getFixtureComponentId(fixture.slug, componentFixture.key)
      ])
    );
    const requirements: (typeof optionValueRequirement.$inferInsert)[] = [];
    const componentAssociations: (typeof optionValueComponent.$inferInsert)[] = [];

    for (const [groupPosition, groupFixture] of fixture.optionGroups.entries()) {
      const optionGroupId = fixtureId(fixture.slug, "group", groupFixture.key);
      if (groupFixture.type === "number") {
        await tx.insert(optionGroup).values({
          additionalUnitPriceMinor: groupFixture.additionalUnitPriceMinor,
          id: optionGroupId,
          included: groupFixture.included,
          key: groupFixture.key,
          label: groupFixture.label,
          maximum: groupFixture.maximum,
          minimum: groupFixture.minimum,
          position: groupPosition,
          productId,
          required: groupFixture.required,
          step: groupFixture.step,
          type: groupFixture.type
        });
        continue;
      }

      await tx.insert(optionGroup).values({
        id: optionGroupId,
        key: groupFixture.key,
        label: groupFixture.label,
        position: groupPosition,
        productId,
        required: groupFixture.required,
        type: groupFixture.type
      });

      for (const [valuePosition, valueFixture] of groupFixture.values.entries()) {
        const optionValueId = fixtureId(fixture.slug, "value", valueFixture.key);
        await tx.insert(optionValue).values({
          id: optionValueId,
          imageUrl: valueFixture.imageUrl,
          label: valueFixture.label,
          optionGroupId,
          organizationId,
          position: valuePosition,
          priceAdjustmentMinor: valueFixture.priceAdjustmentMinor,
          productId
        });

        for (const prerequisiteKey of valueFixture.prerequisiteKeys ?? []) {
          requirements.push({
            optionValueId,
            prerequisiteOptionValueId: fixtureId(fixture.slug, "value", prerequisiteKey),
            productId
          });
        }
        for (const componentKey of valueFixture.componentKeys ?? []) {
          const componentId = componentIdByKey.get(componentKey);
          if (!componentId) {
            throw new Error(`Unknown component key ${componentKey} in fixture ${fixture.slug}`);
          }
          componentAssociations.push({ componentId, optionValueId, organizationId });
        }
      }
    }

    if (requirements.length > 0) {
      await tx.insert(optionValueRequirement).values(requirements);
    }
    if (componentAssociations.length > 0) {
      await tx.insert(optionValueComponent).values(componentAssociations);
    }
  }
});

process.stdout.write("Demo data ready.\n");
process.stdout.write(`  Organization: ${ORGANIZATION_SLUG}\n`);
process.stdout.write(`  Owner login: ${OWNER_EMAIL} / ${DEMO_PASSWORD}\n`);
process.stdout.write(`  Manager login: ${MANAGER_EMAIL} / ${DEMO_PASSWORD}\n`);
process.stdout.write(`  Customer login: ${CUSTOMER_EMAIL} / ${DEMO_PASSWORD}\n`);
for (const fixture of CATALOG_FIXTURES) {
  process.stdout.write(
    `  Product: ${fixture.slug} at /${ORGANIZATION_SLUG}/catalog/${fixture.slug}\n`
  );
}
process.exit(0);
