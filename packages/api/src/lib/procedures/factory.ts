import { os } from "@orpc/server";
import { type z } from "zod";

import { can, type OrganizationAction } from "@tsu-stack/auth/access-control";
import { auth } from "@tsu-stack/auth/index";
import { type OrganizationRole, type OrgSlugInput } from "@tsu-stack/contract/organization";
import { getOrganizationMembershipForAccess } from "@tsu-stack/core/organization";

import { type OrpcContext } from "#@/lib/context/types";

const o = os.$context<OrpcContext>();

export const publicProcedure = o;

const authenticationErrors = {
  UNAUTHORIZED: { message: "Authentication required", status: 401 }
} as const;

const authenticatedProcedure = publicProcedure.errors(authenticationErrors);

const requireAuth = authenticatedProcedure.middleware(({ context, errors, next }) => {
  const authSession = context.authSession;
  if (!authSession?.user) {
    throw errors.UNAUTHORIZED();
  }

  return next({ context: { authSession } });
});

export const protectedProcedure = authenticatedProcedure.use(requireAuth).route({
  spec: (spec) => {
    return { ...spec, security: [{ authCookie: [] }] };
  }
});

const platformAdminAccessProcedure = publicProcedure.errors({
  ...authenticationErrors,
  FORBIDDEN: { message: "Platform administrator access is required", status: 403 }
} as const);

const requirePlatformAdmin = platformAdminAccessProcedure.middleware(
  async ({ context, errors, next }) => {
    const authSession = await auth.api.getSession({
      headers: context.headers,
      query: { disableCookieCache: true }
    });
    if (!authSession?.user) {
      throw errors.UNAUTHORIZED();
    }

    const roles = authSession.user.role?.split(",").map((role) => role.trim()) ?? [];
    if (!roles.includes("admin")) {
      throw errors.FORBIDDEN();
    }

    return next({ context: { authSession } });
  }
);

export const platformAdminProcedure = platformAdminAccessProcedure.use(requirePlatformAdmin).route({
  spec: (spec) => {
    return { ...spec, security: [{ authCookie: [] }] };
  }
});

const organizationAccessErrors = {
  FORBIDDEN: { message: "You do not have access to this organization", status: 403 },
  NOT_FOUND: { message: "Organization not found", status: 404 }
} as const;

const organizationAccessProcedure = protectedProcedure.errors(organizationAccessErrors);
const organizationAccessMiddleware = o.errors({
  ...authenticationErrors,
  ...organizationAccessErrors
});

function requireOrganization(options?: {
  action?: OrganizationAction;
  requiredRole?: OrganizationRole;
}) {
  return organizationAccessMiddleware.middleware(
    async ({ context, errors, next }, input: OrgSlugInput) => {
      const userId = context.authSession?.user?.id;
      if (!userId) {
        throw errors.UNAUTHORIZED();
      }

      const access = await getOrganizationMembershipForAccess(context.db, {
        organizationSlug: input.organizationSlug,
        userId
      });

      // A missing membership and a missing organization collapse to one safe
      // signal so a resource's existence never leaks across tenant boundaries.
      if (!access) {
        throw errors.NOT_FOUND();
      }

      const role = access.role;
      if (options?.action && !can(options.action, { role })) {
        throw errors.FORBIDDEN();
      }
      // Role-equality guard for surfaces scoped to a single membership role (e.g. the
      // customer catalog). Deliberately NOT a permission check: an Owner holds every
      // permission and a Customer holds none, so `can()` would admit Owners and reject
      // Customers — the exact inverse of "customers only".
      if (options?.requiredRole && role !== options.requiredRole) {
        throw errors.FORBIDDEN();
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
    }
  );
}

/**
 * Authenticated + a member of the slug'd organization. Exposes
 * `context.organization` and `context.role`; every DB call scopes by
 * `context.organization.id`, never by a client-supplied id.
 */
export function organizationProcedure<TInput extends OrgSlugInput>(inputSchema: z.ZodType<TInput>) {
  return organizationAccessProcedure.input(inputSchema).use(requireOrganization());
}

/** Organization member authorized for `action`; otherwise FORBIDDEN. */
export function organizationActionProcedure<TInput extends OrgSlugInput>(
  inputSchema: z.ZodType<TInput>,
  action: OrganizationAction
) {
  return organizationAccessProcedure.input(inputSchema).use(requireOrganization({ action }));
}

/**
 * Authenticated + a **Customer** member of the slug'd organization. Catalog
 * browsing is limited to Customers; Owners and Managers operate products,
 * pricing, and inventory through their own action-scoped procedures. Uses
 * role equality, not a permission — see {@link requireOrganization}.
 */
export function customerProcedure<TInput extends OrgSlugInput>(inputSchema: z.ZodType<TInput>) {
  return organizationAccessProcedure
    .input(inputSchema)
    .use(requireOrganization({ requiredRole: "customer" }));
}
