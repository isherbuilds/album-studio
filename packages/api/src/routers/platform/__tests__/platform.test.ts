import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { auth } from "@tsu-stack/auth/index";
import { db } from "@tsu-stack/db";
import { account, member, organization, user } from "@tsu-stack/db/schema";
import { createLogger } from "@tsu-stack/logger/server";

import { platformRouter } from "#@/routers/platform/index";

let adminId = "";
const ownerId = crypto.randomUUID();
const ownerEmail = `${ownerId}@example.com`;
const adminEmail = `${crypto.randomUUID()}@example.com`;
const nonAdminEmail = `${crypto.randomUUID()}@example.com`;
const provisionedOwnerEmail = `${crypto.randomUUID()}@example.com`;
const testPassword = "platform-test-password";
let adminHeaders = new Headers();
let nonAdminHeaders = new Headers();

function createContext(headers: Headers, role: string | null = null) {
  const authSession = {
    session: {
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      id: "session-id",
      token: "session-token",
      updatedAt: new Date(),
      userId: adminId
    },
    user: {
      banned: false,
      banExpires: null,
      banReason: null,
      createdAt: new Date(),
      email: adminEmail,
      emailVerified: true,
      id: adminId,
      image: null,
      name: "Admin",
      role,
      updatedAt: new Date()
    }
  };
  return {
    authSession,
    db,
    headers,
    logger: createLogger({ operation: "platform_router_test" })
  };
}

beforeAll(async () => {
  const [adminUser] = await Promise.all([
    auth.api.createUser({
      body: {
        email: adminEmail,
        name: "Admin",
        password: testPassword,
        role: "admin"
      }
    }),
    auth.api.createUser({
      body: {
        email: nonAdminEmail,
        name: "Non-admin",
        password: testPassword,
        role: "user"
      }
    })
  ]);
  adminId = adminUser.user.id;
  await db.insert(user).values({
    email: ownerEmail,
    emailVerified: true,
    id: ownerId,
    name: "Initial Owner",
    role: "user"
  });

  const [adminSignIn, nonAdminSignIn] = await Promise.all([
    auth.api.signInEmail({
      body: { email: adminEmail, password: testPassword },
      returnHeaders: true
    }),
    auth.api.signInEmail({
      body: { email: nonAdminEmail, password: testPassword },
      returnHeaders: true
    })
  ]);
  const toRequestHeaders = (headers: Headers) =>
    new Headers({
      cookie: headers
        .getSetCookie()
        .map((value) => value.split(";", 1)[0])
        .join("; ")
    });
  adminHeaders = toRequestHeaders(adminSignIn.headers);
  nonAdminHeaders = toRequestHeaders(nonAdminSignIn.headers);
});

afterAll(async () => {
  await db.delete(user).where(eq(user.email, provisionedOwnerEmail));
  await db.delete(user).where(eq(user.email, nonAdminEmail));
  await db.delete(user).where(eq(user.id, adminId));
  await db.delete(user).where(eq(user.id, ownerId));
});

describe("platform router authorization", () => {
  it("rejects a signed-in non-admin even when the request context contains a stale admin role", async () => {
    const client = createRouterClient(platformRouter, {
      context: createContext(nonAdminHeaders, "admin")
    });

    await expect(client.dashboard()).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
  });

  it("rejects an unauthenticated request", async () => {
    const client = createRouterClient(platformRouter, {
      context: createContext(new Headers())
    });

    await expect(client.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("allows a platform admin", async () => {
    const client = createRouterClient(platformRouter, {
      context: createContext(adminHeaders, "admin")
    });

    await expect(client.dashboard()).resolves.toMatchObject({
      organizations: expect.any(Number),
      users: expect.any(Number)
    });
  });

  it("programmatically creates a missing user and appoints them as initial owner", async () => {
    const client = createRouterClient(platformRouter, {
      context: createContext(adminHeaders, "admin")
    });
    const slug = `platform-${crypto.randomUUID()}`;

    try {
      const created = await client.organizations.create({
        currency: "EUR",
        name: "Platform Organization",
        ownerEmail: provisionedOwnerEmail,
        ownerName: "Provisioned Owner",
        ownerPassword: "a-secure-temporary-password",
        slug
      });

      expect(created).toMatchObject({
        owner: {
          email: provisionedOwnerEmail,
          name: "Provisioned Owner"
        },
        ownerCreated: true,
        slug
      });
      const [persisted] = await db
        .select({ currency: organization.currency })
        .from(organization)
        .where(eq(organization.slug, slug));
      expect(persisted?.currency).toBe("EUR");
      await expect(
        client.organizations.create({
          currency: "USD",
          name: "Duplicate Platform Organization",
          ownerEmail: provisionedOwnerEmail,
          ownerName: "Provisioned Owner",
          ownerPassword: "a-secure-temporary-password",
          slug
        })
      ).rejects.toMatchObject({ code: "ORGANIZATION_SLUG_TAKEN" });
      await expect(
        db
          .select({ role: member.role })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .where(eq(organization.slug, slug))
      ).resolves.toEqual([{ role: "owner" }]);
      await expect(
        db
          .select({ email: user.email, name: user.name, providerId: account.providerId })
          .from(user)
          .innerJoin(account, eq(account.userId, user.id))
          .where(eq(user.email, provisionedOwnerEmail))
      ).resolves.toEqual([
        {
          email: provisionedOwnerEmail,
          name: "Provisioned Owner",
          providerId: "credential"
        }
      ]);
    } finally {
      await db.delete(organization).where(eq(organization.slug, slug));
    }
  });

  it("reuses an existing user as the initial owner", async () => {
    const client = createRouterClient(platformRouter, {
      context: createContext(adminHeaders, "admin")
    });
    const slug = `platform-existing-owner-${crypto.randomUUID()}`;

    try {
      const created = await client.organizations.create({
        currency: "USD",
        name: "Existing Owner Organization",
        ownerEmail,
        ownerName: "Ignored Owner Name",
        ownerPassword: "ignored-owner-password",
        slug
      });

      expect(created).toMatchObject({
        owner: {
          email: ownerEmail,
          id: ownerId,
          name: "Initial Owner"
        },
        ownerCreated: false,
        slug
      });
      await expect(
        db
          .select({ role: member.role })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .where(eq(organization.slug, slug))
      ).resolves.toEqual([{ role: "owner" }]);
    } finally {
      await db.delete(organization).where(eq(organization.slug, slug));
    }
  });
});
