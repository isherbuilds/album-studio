import { ORPCError, os } from "@orpc/server";
import { type z } from "zod";

import { can, type OrganizationAction } from "@tsu-stack/auth/access-control";
import { auth } from "@tsu-stack/auth/index";
import { type OrgSlugInput } from "@tsu-stack/contract/organization";
import { getOrganizationMembershipForAccess } from "@tsu-stack/core/organization";

import { type OrpcContext } from "#@/lib/context/types";

const o = os.$context<OrpcContext>();

export const publicProcedure = o;

const requireAuth = o.middleware(({ context, next }) => {
  const authSession = context.authSession;
  if (!authSession?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  return next({ context: { authSession } });
});

export const protectedProcedure = publicProcedure.use(requireAuth).route({
  spec: (spec) => {
    return { ...spec, security: [{ authCookie: [] }] };
  }
});

const requirePlatformAdmin = o.middleware(async ({ context, next }) => {
  const authSession = await auth.api.getSession({
    headers: context.headers,
    query: { disableCookieCache: true }
  });
  if (!authSession?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const roles = authSession.user.role?.split(",").map((role) => role.trim()) ?? [];
  if (!roles.includes("admin")) {
    throw new ORPCError("FORBIDDEN", { message: "Platform administrator access is required" });
  }

  return next({ context: { authSession } });
});

export const platformAdminProcedure = publicProcedure.use(requirePlatformAdmin).route({
  spec: (spec) => {
    return { ...spec, security: [{ authCookie: [] }] };
  }
});

function requireOrganization(action?: OrganizationAction) {
  return o.middleware(async ({ context, next }, input: OrgSlugInput) => {
    const userId = context.authSession?.user?.id;
    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const access = await getOrganizationMembershipForAccess(context.db, {
      organizationSlug: input.organizationSlug,
      userId
    });

    // A missing membership and a missing organization collapse to one safe
    // signal so a resource's existence never leaks across tenant boundaries.
    if (!access) {
      throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
    }

    const role = access.role;
    if (action && !can(action, { role })) {
      throw new ORPCError("FORBIDDEN", { message: "You do not have access to this organization" });
    }

    return next({
      context: {
        organization: {
          createdAt: access.organizationCreatedAt,
          id: access.organizationId,
          name: access.organizationName,
          slug: access.organizationSlug
        },
        role
      }
    });
  });
}

/**
 * Authenticated + a member of the slug'd organization. Exposes
 * `context.organization` and `context.role`; every DB call scopes by
 * `context.organization.id`, never by a client-supplied id.
 */
export function organizationProcedure<TInput extends OrgSlugInput>(inputSchema: z.ZodType<TInput>) {
  return protectedProcedure.input(inputSchema).use(requireOrganization());
}

/** Organization member authorized for `action`; otherwise FORBIDDEN. */
export function organizationActionProcedure<TInput extends OrgSlugInput>(
  inputSchema: z.ZodType<TInput>,
  action: OrganizationAction
) {
  return protectedProcedure.input(inputSchema).use(requireOrganization(action));
}
