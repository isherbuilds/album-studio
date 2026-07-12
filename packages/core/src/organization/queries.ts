import { and, eq } from "drizzle-orm";

import { type OrganizationRole, OrganizationRoleSchema } from "@tsu-stack/contract/organization";
import { type DatabaseOrTransaction } from "@tsu-stack/db";
import { member, organization } from "@tsu-stack/db/schema";

export type OrganizationAccess = {
  membershipId: string;
  organizationCreatedAt: Date;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
};

export type GetOrganizationMembershipForAccessInput = {
  organizationSlug: string;
  userId: string;
};

/**
 * Resolves the caller's membership in one organization by slug. Returns
 * `undefined` when the organization does not exist or the user is not a member,
 * allowing callers to collapse both cases into one tenant-safe signal.
 */
export async function getOrganizationMembershipForAccess(
  db: DatabaseOrTransaction,
  input: GetOrganizationMembershipForAccessInput
): Promise<OrganizationAccess | undefined> {
  const rows = await db
    .select({
      membershipId: member.id,
      organizationCreatedAt: organization.createdAt,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      role: member.role
    })
    .from(organization)
    .innerJoin(
      member,
      and(eq(member.organizationId, organization.id), eq(member.userId, input.userId))
    )
    .where(eq(organization.slug, input.organizationSlug))
    .limit(1);

  const access = rows[0];
  return access ? { ...access, role: OrganizationRoleSchema.parse(access.role) } : undefined;
}
