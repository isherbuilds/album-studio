import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth, isAPIError } from "@tsu-stack/auth/index";
import {
  InvitationStatusSchema,
  OrganizationRoleSchema,
  OrgSlugInputSchema
} from "@tsu-stack/contract/organization";
import { auditEvent, invitation, member, organization, user } from "@tsu-stack/db/schema";

import {
  organizationActionProcedure,
  organizationProcedure,
  protectedProcedure,
  publicProcedure
} from "#@/lib/procedures/factory";
import { claimInvitation } from "#@/routers/organizations/claim-invitation";
import { getInvitationUrl } from "#@/routers/organizations/invitation-url";

const organizationMembershipSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string(),
  name: z.string(),
  role: OrganizationRoleSchema,
  slug: z.string()
});

const memberSchema = z.object({
  createdAt: z.string().datetime(),
  email: z.email(),
  id: z.string(),
  name: z.string(),
  role: OrganizationRoleSchema,
  userId: z.string()
});

const invitationSchema = z.object({
  email: z.email(),
  expiresAt: z.string().datetime(),
  id: z.string(),
  invitationUrl: z.url(),
  role: OrganizationRoleSchema,
  status: InvitationStatusSchema
});

const acceptedInvitationSchema = z.object({
  email: z.email(),
  organizationId: z.string(),
  organizationSlug: z.string(),
  role: OrganizationRoleSchema
});

export const organizationsRouter = {
  bySlug: organizationProcedure(OrgSlugInputSchema)
    .route({ description: "Get an organization membership by slug", method: "GET" })
    .output(organizationMembershipSchema)
    .handler(({ context }) => {
      return {
        id: context.organization.id,
        name: context.organization.name,
        slug: context.organization.slug,
        createdAt: context.organization.createdAt.toISOString(),
        role: context.role
      };
    }),
  invitations: {
    // TODO(mvp-hardening): This custom enrollment path is outside Better Auth's limiter.
    // Add per-IP and invitation-scoped throttling before opening enrollment beyond
    // invitation links controlled by the trusted enterprise operator.
    acceptNewUser: publicProcedure
      .route({ description: "Create an invited user and accept the invitation", method: "POST" })
      .input(
        z.object({
          invitationId: z.string().min(1),
          name: z.string().trim().min(2).max(120),
          password: z.string().min(8).max(128)
        })
      )
      .errors({
        ACCOUNT_EXISTS: { message: "Sign in to accept this invitation", status: 409 },
        INVITATION_INVALID: { message: "Invitation is invalid or expired", status: 400 }
      })
      .output(acceptedInvitationSchema)
      .handler(async ({ context, errors, input }) => {
        const initialRows = await context.db
          .select({ invitation, organizationSlug: organization.slug })
          .from(invitation)
          .innerJoin(organization, eq(organization.id, invitation.organizationId))
          .where(eq(invitation.id, input.invitationId))
          .limit(1);
        const initialRecord = initialRows[0];
        if (
          !initialRecord ||
          initialRecord.invitation.status !== "pending" ||
          initialRecord.invitation.expiresAt <= new Date()
        ) {
          throw errors.INVITATION_INVALID();
        }
        const normalizedEmail = initialRecord.invitation.email.toLowerCase();
        const existing = await context.db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, normalizedEmail))
          .limit(1);
        if (existing.length > 0) {
          throw errors.ACCOUNT_EXISTS();
        }

        const created = await auth.api.createUser({
          body: {
            email: normalizedEmail,
            name: input.name,
            password: input.password,
            role: "user"
          }
        });

        try {
          return await claimInvitation(
            context.db,
            { invitationId: input.invitationId, userId: created.user.id },
            errors
          );
        } catch (error) {
          await context.db.delete(user).where(eq(user.id, created.user.id));
          throw error;
        }
      }),
    list: organizationActionProcedure(OrgSlugInputSchema, "invitation.read")
      .route({ description: "List organization invitations", method: "GET" })
      .output(z.array(invitationSchema))
      .handler(async ({ context }) => {
        const rows = await context.db
          .select()
          .from(invitation)
          .where(eq(invitation.organizationId, context.organization.id));
        return rows.map((row) => {
          return {
            email: row.email,
            expiresAt: row.expiresAt.toISOString(),
            id: row.id,
            invitationUrl: getInvitationUrl(row.id),
            role: OrganizationRoleSchema.parse(row.role),
            status: InvitationStatusSchema.parse(row.status)
          };
        });
      })
  },
  list: protectedProcedure
    .route({ description: "List the current user's organization memberships", method: "GET" })
    .input(z.void())
    .output(z.array(organizationMembershipSchema))
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({
          createdAt: organization.createdAt,
          id: organization.id,
          name: organization.name,
          role: member.role,
          slug: organization.slug
        })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(eq(member.userId, context.authSession.user.id));
      return rows.map((row) => {
        return {
          ...row,
          createdAt: row.createdAt.toISOString(),
          role: OrganizationRoleSchema.parse(row.role)
        };
      });
    }),
  members: {
    list: organizationActionProcedure(OrgSlugInputSchema, "member.read")
      .route({ description: "List organization members", method: "GET" })
      .output(z.array(memberSchema))
      .handler(async ({ context }) => {
        const rows = await context.db
          .select({
            createdAt: member.createdAt,
            email: user.email,
            id: member.id,
            name: user.name,
            role: member.role,
            userId: user.id
          })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(eq(member.organizationId, context.organization.id));
        return rows.map((row) => {
          return {
            ...row,
            createdAt: row.createdAt.toISOString(),
            role: OrganizationRoleSchema.parse(row.role)
          };
        });
      }),
    updateRole: organizationActionProcedure(
      OrgSlugInputSchema.extend({ memberId: z.string().min(1), role: OrganizationRoleSchema }),
      "member.update"
    )
      .route({ description: "Update an organization member role", method: "POST" })
      .errors({ LAST_OWNER: { message: "An organization must retain an owner", status: 409 } })
      .output(z.object({ success: z.literal(true) }))
      .handler(async ({ context, errors, input }) => {
        const targets = await context.db
          .select({ role: member.role })
          .from(member)
          .where(
            and(eq(member.id, input.memberId), eq(member.organizationId, context.organization.id))
          )
          .limit(1);
        const previousRole = targets[0]?.role;
        if (!previousRole) {
          throw new ORPCError("NOT_FOUND", { message: "Member not found" });
        }

        // TODO(mvp-hardening): Better Auth commits this mutation before the audit insert,
        // and its directly mounted update-member-role endpoint can bypass this wrapper.
        // The trusted-operator MVP accepts that gap; make this the sole durable mutation
        // path (or audit through a reliable Better Auth hook/outbox) before audit fidelity
        // becomes a compliance or multi-operator requirement.
        try {
          await auth.api.updateMemberRole({
            body: {
              memberId: input.memberId,
              organizationId: context.organization.id,
              role: input.role
            },
            headers: context.headers
          });
        } catch (error) {
          if (
            isAPIError(error) &&
            (error.body?.code === "MEMBER_NOT_FOUND" ||
              error.body?.code === "YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER")
          ) {
            throw new ORPCError("NOT_FOUND", { message: "Member not found" });
          }
          if (
            isAPIError(error) &&
            error.body?.code === "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER"
          ) {
            throw errors.LAST_OWNER();
          }
          throw error;
        }

        if (previousRole && previousRole !== input.role) {
          await context.db.insert(auditEvent).values({
            action: "organization.member.role_updated",
            actorUserId: context.authSession.user.id,
            createdAt: new Date(),
            entityId: input.memberId,
            entityType: "organization_member",
            id: crypto.randomUUID(),
            metadata: { from: previousRole, to: input.role },
            organizationId: context.organization.id
          });
        }
        return { success: true };
      })
  }
};
