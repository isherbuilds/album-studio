import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { can } from "@tsu-stack/auth/access-control";
import { auth } from "@tsu-stack/auth/index";
import { OrganizationRoleSchema } from "@tsu-stack/contract/organization";
import { db } from "@tsu-stack/db";
import { auditEvent, member, organization, user } from "@tsu-stack/db/schema";
import { createLogger } from "@tsu-stack/logger/server";

import { organizationsRouter } from "#@/routers/organizations/index";

const fixture = {
  customerId: crypto.randomUUID(),
  inviteeEmail: `${crypto.randomUUID()}@example.com`,
  inviteeId: "",
  managerEmail: `${crypto.randomUUID()}@example.com`,
  managerId: "",
  nonMemberId: crypto.randomUUID(),
  otherOrganizationId: crypto.randomUUID(),
  otherOrganizationSlug: `organization-${crypto.randomUUID()}`,
  organizationId: crypto.randomUUID(),
  ownerEmail: `${crypto.randomUUID()}@example.com`,
  ownerId: "",
  ownerMemberId: crypto.randomUUID(),
  otherOrganizationMemberId: crypto.randomUUID(),
  slug: `organization-${crypto.randomUUID()}`
};
const testPassword = "organization-test-password";
const programmaticInviteeEmail = `${crypto.randomUUID()}@example.com`;
let inviteeHeaders = new Headers();
let managerHeaders = new Headers();
let ownerHeaders = new Headers();

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
    headers: userId === fixture.ownerId ? ownerHeaders : new Headers(),
    logger: createLogger({ operation: "organizations_router_test" })
  };
}

async function signIn(email: string) {
  const signedIn = await auth.api.signInEmail({
    body: { email, password: testPassword },
    returnHeaders: true
  });
  return new Headers({
    cookie: signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ")
  });
}

beforeAll(async () => {
  const [owner, invitee, manager] = await Promise.all([
    auth.api.createUser({
      body: {
        email: fixture.ownerEmail,
        name: "Owner",
        password: testPassword,
        role: "user"
      }
    }),
    auth.api.createUser({
      body: {
        email: fixture.inviteeEmail,
        name: "Invitee",
        password: testPassword,
        role: "user"
      }
    }),
    auth.api.createUser({
      body: {
        email: fixture.managerEmail,
        name: "Manager",
        password: testPassword,
        role: "user"
      }
    })
  ]);
  fixture.ownerId = owner.user.id;
  fixture.inviteeId = invitee.user.id;
  fixture.managerId = manager.user.id;

  await db.insert(user).values([
    {
      email: `${fixture.customerId}@example.com`,
      emailVerified: true,
      id: fixture.customerId,
      name: "Customer",
      role: "user"
    },
    {
      email: `${fixture.nonMemberId}@example.com`,
      emailVerified: true,
      id: fixture.nonMemberId,
      name: "Non-member",
      role: "user"
    }
  ]);
  await db.insert(organization).values([
    {
      createdAt: new Date(),
      id: fixture.organizationId,
      name: "Organization Fixture",
      slug: fixture.slug
    },
    {
      createdAt: new Date(),
      id: fixture.otherOrganizationId,
      name: "Other Organization Fixture",
      slug: fixture.otherOrganizationSlug
    }
  ]);
  await db.insert(member).values([
    {
      createdAt: new Date(),
      id: fixture.ownerMemberId,
      organizationId: fixture.organizationId,
      role: "owner",
      userId: fixture.ownerId
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
      role: "customer",
      userId: fixture.customerId
    },
    {
      createdAt: new Date(),
      id: fixture.otherOrganizationMemberId,
      organizationId: fixture.otherOrganizationId,
      role: "customer",
      userId: fixture.inviteeId
    }
  ]);
  ownerHeaders = await signIn(fixture.ownerEmail);
  inviteeHeaders = await signIn(fixture.inviteeEmail);
  managerHeaders = await signIn(fixture.managerEmail);
});

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, fixture.organizationId));
  await db.delete(organization).where(eq(organization.id, fixture.otherOrganizationId));
  await db.delete(user).where(eq(user.email, programmaticInviteeEmail));
  for (const id of [
    fixture.ownerId,
    fixture.managerId,
    fixture.customerId,
    fixture.inviteeId,
    fixture.nonMemberId
  ]) {
    await db.delete(user).where(eq(user.id, id));
  }
});

describe("organization boundaries", () => {
  it("uses one shared authorization seam for owner-only organization actions", () => {
    expect(OrganizationRoleSchema.options).toEqual(["owner", "manager", "customer"]);
    expect(can("member.update", { role: "owner" })).toBe(true);
    expect(can("member.update", { role: "manager" })).toBe(false);
    expect(can("invitation.create", { role: "customer" })).toBe(false);
  });

  it("returns membership only to a member of the slugged organization", async () => {
    const memberClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.managerId, `${fixture.managerId}@example.com`)
    });
    const nonMemberClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.nonMemberId, `${fixture.nonMemberId}@example.com`)
    });

    await expect(memberClient.bySlug({ organizationSlug: fixture.slug })).resolves.toMatchObject({
      role: "manager",
      slug: fixture.slug
    });
    await expect(nonMemberClient.bySlug({ organizationSlug: fixture.slug })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
  });

  it("allows only owners to read members", async () => {
    const managerClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.managerId, `${fixture.managerId}@example.com`)
    });
    const ownerClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.ownerId, fixture.ownerEmail)
    });

    await expect(
      managerClient.members.list({ organizationSlug: fixture.slug })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      ownerClient.members.list({ organizationSlug: fixture.slug })
    ).resolves.toHaveLength(3);
  });

  it("creates and accepts invitations through Better Auth", async () => {
    const invitation = await auth.api.createInvitation({
      body: {
        email: fixture.inviteeEmail,
        organizationId: fixture.organizationId,
        role: "customer"
      },
      headers: ownerHeaders
    });

    await expect(
      auth.api.acceptInvitation({
        body: { invitationId: invitation.id },
        headers: ownerHeaders
      })
    ).rejects.toMatchObject({
      body: { code: "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION" }
    });

    const accepted = await auth.api.acceptInvitation({
      body: { invitationId: invitation.id },
      headers: inviteeHeaders
    });

    expect(accepted.member).toMatchObject({
      organizationId: fixture.organizationId,
      role: "customer",
      userId: fixture.inviteeId
    });
    await expect(
      auth.api.acceptInvitation({
        body: { invitationId: invitation.id },
        headers: inviteeHeaders
      })
    ).rejects.toMatchObject({ body: { code: "INVITATION_NOT_FOUND" } });
  });

  it("rejects native invitation creation by non-owners", async () => {
    await expect(
      auth.api.createInvitation({
        body: {
          email: `${crypto.randomUUID()}@example.com`,
          organizationId: fixture.organizationId,
          role: "customer"
        },
        headers: managerHeaders
      })
    ).rejects.toMatchObject({
      body: { code: "YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION" }
    });
  });

  it("programmatically creates a missing invited user before claiming membership", async () => {
    const invitation = await auth.api.createInvitation({
      body: {
        email: programmaticInviteeEmail,
        organizationId: fixture.organizationId,
        role: "manager"
      },
      headers: ownerHeaders
    });
    const publicClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.nonMemberId, `${fixture.nonMemberId}@example.com`)
    });

    await expect(
      publicClient.invitations.acceptNewUser({
        invitationId: invitation.id,
        name: "Programmatic Invitee",
        password: testPassword
      })
    ).resolves.toMatchObject({
      email: programmaticInviteeEmail,
      organizationId: fixture.organizationId,
      role: "manager"
    });
  });

  it("lists only the signed-in user's organization memberships", async () => {
    const memberClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.customerId, `${fixture.customerId}@example.com`)
    });
    const nonMemberClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.nonMemberId, `${fixture.nonMemberId}@example.com`)
    });

    await expect(memberClient.list()).resolves.toEqual([
      expect.objectContaining({ role: "customer", slug: fixture.slug })
    ]);
    await expect(nonMemberClient.list()).resolves.toEqual([]);
  });

  it("uses Better Auth last-owner protection", async () => {
    await expect(
      auth.api.removeMember({
        body: {
          memberIdOrEmail: fixture.ownerMemberId,
          organizationId: fixture.organizationId
        },
        headers: ownerHeaders
      })
    ).rejects.toMatchObject({
      body: { code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER" }
    });
  });

  it("surfaces LAST_OWNER when demoting the organization's only owner", async () => {
    const ownerClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.ownerId, fixture.ownerEmail)
    });

    await expect(
      ownerClient.members.updateRole({
        memberId: fixture.ownerMemberId,
        organizationSlug: fixture.slug,
        role: "manager"
      })
    ).rejects.toMatchObject({ code: "LAST_OWNER" });
  });

  it("hides members from another organization behind NOT_FOUND", async () => {
    const ownerClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.ownerId, fixture.ownerEmail)
    });

    await expect(
      ownerClient.members.updateRole({
        memberId: fixture.otherOrganizationMemberId,
        organizationSlug: fixture.slug,
        role: "manager"
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updates a role through Better Auth and records the Album Studio audit event", async () => {
    const ownerClient = createRouterClient(organizationsRouter, {
      context: createContext(fixture.ownerId, fixture.ownerEmail)
    });
    const members = await ownerClient.members.list({ organizationSlug: fixture.slug });
    const manager = members.find((item) => item.userId === fixture.managerId);
    expect(manager).toBeDefined();

    await ownerClient.members.updateRole({
      memberId: manager?.id ?? "",
      organizationSlug: fixture.slug,
      role: "customer"
    });

    await expect(
      db
        .select({ action: auditEvent.action, metadata: auditEvent.metadata })
        .from(auditEvent)
        .where(eq(auditEvent.entityId, manager?.id ?? ""))
    ).resolves.toContainEqual({
      action: "organization.member.role_updated",
      metadata: { from: "manager", to: "customer" }
    });
  });
});
