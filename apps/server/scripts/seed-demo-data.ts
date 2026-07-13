import process from "node:process";

import { and, eq, inArray } from "drizzle-orm";

import { auth } from "@tsu-stack/auth/index";
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
const PRODUCT_SLUG = "wedding-album";
const OWNER_EMAIL = "owner@demo-studio.test";
const CUSTOMER_EMAIL = "customer@demo-studio.test";
const DEMO_PASSWORD = "demo-password-123";
const SEEDED_COMPONENT_NAMES = [
  "Linen Fabric",
  "Leather Hide",
  "Silk Roll",
  "Velvet Fabric",
  "Foil Roll",
  "Gift Box Stock"
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

let organizationId = existingOrganization?.id;
if (organizationId === undefined) {
  const createdOrganization = await auth.api.createOrganization({
    body: {
      currency: "USD",
      keepCurrentActiveOrganization: true,
      name: "Demo Studio",
      slug: ORGANIZATION_SLUG,
      userId: ownerId
    }
  });
  organizationId = createdOrganization.id;
} else {
  await db.update(organization).set({ currency: "USD" }).where(eq(organization.id, organizationId));
}

const existingCustomerMembers = await db
  .select({ id: member.id })
  .from(member)
  .where(and(eq(member.organizationId, organizationId), eq(member.userId, customerId)))
  .limit(1);
if (existingCustomerMembers.length === 0) {
  // Membership lifecycle belongs to Better Auth, not a raw insert — go through the
  // supported server API so the org plugin owns creation (custom "customer" role included).
  await auth.api.addMember({
    body: {
      organizationId,
      role: "customer",
      userId: customerId
    }
  });
}

await db.transaction(async (tx) => {
  await tx
    .delete(product)
    .where(and(eq(product.organizationId, organizationId), eq(product.slug, PRODUCT_SLUG)));
  await tx
    .delete(component)
    .where(
      and(
        eq(component.organizationId, organizationId),
        inArray(component.name, SEEDED_COMPONENT_NAMES)
      )
    );

  const ids = {
    boxStock: crypto.randomUUID(),
    coverGroup: crypto.randomUUID(),
    coverLeather: crypto.randomUUID(),
    coverLinen: crypto.randomUUID(),
    coverSilk: crypto.randomUUID(),
    coverVelvet: crypto.randomUUID(),
    finishFoil: crypto.randomUUID(),
    finishGroup: crypto.randomUUID(),
    finishMatte: crypto.randomUUID(),
    foilRoll: crypto.randomUUID(),
    giftBoxGroup: crypto.randomUUID(),
    giftBoxNo: crypto.randomUUID(),
    giftBoxPremium: crypto.randomUUID(),
    leatherHide: crypto.randomUUID(),
    linenFabric: crypto.randomUUID(),
    pagesGroup: crypto.randomUUID(),
    product: crypto.randomUUID(),
    silkRoll: crypto.randomUUID(),
    velvetFabric: crypto.randomUUID()
  };

  await tx.insert(component).values([
    {
      id: ids.linenFabric,
      lowStockThreshold: "10",
      name: "Linen Fabric",
      organizationId,
      quantity: "100",
      unit: "sheet"
    },
    {
      id: ids.leatherHide,
      lowStockThreshold: "10",
      name: "Leather Hide",
      organizationId,
      quantity: "5",
      unit: "sheet"
    },
    {
      id: ids.silkRoll,
      lowStockThreshold: "10",
      name: "Silk Roll",
      organizationId,
      quantity: "100",
      unit: "roll"
    },
    {
      id: ids.velvetFabric,
      lowStockThreshold: "10",
      name: "Velvet Fabric",
      organizationId,
      quantity: "0",
      unit: "sheet"
    },
    {
      id: ids.foilRoll,
      lowStockThreshold: "10",
      name: "Foil Roll",
      organizationId,
      quantity: "0",
      unit: "roll"
    },
    {
      id: ids.boxStock,
      lowStockThreshold: "10",
      name: "Gift Box Stock",
      organizationId,
      quantity: "8",
      unit: "unit"
    }
  ]);

  await tx.insert(product).values({
    basePriceMinor: 15000,
    description:
      "A premium linen-and-leather wedding album, configurable by cover, finish, page count, and gift box.",
    id: ids.product,
    imageUrls: ["/placeholders/album-hero.svg"],
    name: "Wedding Album",
    organizationId,
    slug: PRODUCT_SLUG,
    status: "published"
  });

  await tx.insert(optionGroup).values([
    {
      id: ids.coverGroup,
      key: "cover",
      label: "Cover",
      position: 0,
      productId: ids.product,
      required: true,
      type: "single"
    },
    {
      id: ids.finishGroup,
      key: "finish",
      label: "Finish",
      position: 1,
      productId: ids.product,
      required: false,
      type: "single"
    },
    {
      additionalUnitPriceMinor: 300,
      id: ids.pagesGroup,
      included: 24,
      key: "pages",
      label: "Pages",
      maximum: 60,
      minimum: 20,
      position: 2,
      productId: ids.product,
      required: true,
      step: 4,
      type: "number"
    },
    {
      id: ids.giftBoxGroup,
      key: "gift_box",
      label: "Gift Box",
      position: 3,
      productId: ids.product,
      required: false,
      type: "boolean"
    }
  ]);

  await tx.insert(optionValue).values([
    {
      id: ids.coverLinen,
      imageUrl: "/placeholders/cover-linen.svg",
      label: "Linen",
      optionGroupId: ids.coverGroup,
      organizationId,
      position: 0,
      priceAdjustmentMinor: 0,
      productId: ids.product
    },
    {
      id: ids.coverLeather,
      imageUrl: "/placeholders/cover-leather.svg",
      label: "Leather",
      optionGroupId: ids.coverGroup,
      organizationId,
      position: 1,
      priceAdjustmentMinor: 4000,
      productId: ids.product
    },
    {
      id: ids.coverSilk,
      imageUrl: "/placeholders/cover-silk.svg",
      label: "Silk",
      optionGroupId: ids.coverGroup,
      organizationId,
      position: 2,
      priceAdjustmentMinor: 2500,
      productId: ids.product
    },
    {
      id: ids.coverVelvet,
      imageUrl: "/placeholders/cover-velvet.svg",
      label: "Velvet",
      optionGroupId: ids.coverGroup,
      organizationId,
      position: 3,
      priceAdjustmentMinor: 3000,
      productId: ids.product
    },
    {
      id: ids.finishMatte,
      imageUrl: "/placeholders/finish-matte.svg",
      label: "Matte",
      optionGroupId: ids.finishGroup,
      organizationId,
      position: 0,
      priceAdjustmentMinor: 0,
      productId: ids.product
    },
    {
      id: ids.finishFoil,
      imageUrl: "/placeholders/finish-foil.svg",
      label: "Foil",
      optionGroupId: ids.finishGroup,
      organizationId,
      position: 1,
      priceAdjustmentMinor: 1500,
      productId: ids.product
    },
    {
      id: ids.giftBoxNo,
      label: "No Gift Box",
      optionGroupId: ids.giftBoxGroup,
      organizationId,
      position: 0,
      priceAdjustmentMinor: 0,
      productId: ids.product
    },
    {
      id: ids.giftBoxPremium,
      imageUrl: "/placeholders/giftbox.svg",
      label: "Premium Gift Box",
      optionGroupId: ids.giftBoxGroup,
      organizationId,
      position: 1,
      priceAdjustmentMinor: 2000,
      productId: ids.product
    }
  ]);

  await tx.insert(optionValueRequirement).values([
    {
      optionValueId: ids.finishFoil,
      prerequisiteOptionValueId: ids.coverLinen,
      productId: ids.product
    },
    {
      optionValueId: ids.finishFoil,
      prerequisiteOptionValueId: ids.coverLeather,
      productId: ids.product
    }
  ]);

  await tx.insert(optionValueComponent).values([
    { componentId: ids.linenFabric, optionValueId: ids.coverLinen, organizationId },
    { componentId: ids.leatherHide, optionValueId: ids.coverLeather, organizationId },
    { componentId: ids.silkRoll, optionValueId: ids.coverSilk, organizationId },
    { componentId: ids.velvetFabric, optionValueId: ids.coverVelvet, organizationId },
    { componentId: ids.foilRoll, optionValueId: ids.finishFoil, organizationId },
    { componentId: ids.boxStock, optionValueId: ids.giftBoxPremium, organizationId }
  ]);
});

process.stdout.write("Demo data refreshed.\n");
process.stdout.write(`  Organization: ${ORGANIZATION_SLUG}\n`);
process.stdout.write(`  Customer login: ${CUSTOMER_EMAIL} / ${DEMO_PASSWORD}\n`);
process.stdout.write(
  `  Product: ${PRODUCT_SLUG} at /org/${ORGANIZATION_SLUG}/catalog/${PRODUCT_SLUG}\n`
);
process.exit(0);
