import { eq } from "drizzle-orm";

import { OrganizationRoleSchema } from "@tsu-stack/contract/organization";
import { type Database } from "@tsu-stack/db";
import { invitation, member, organization } from "@tsu-stack/db/schema";

type ClaimInvitationInput = {
  invitationId: string;
  userId: string;
};

/**
 * Locks a pending invitation, attaches the given user as a member, and marks the
 * invitation accepted in a single transaction. The `SELECT ... FOR UPDATE` makes
 * concurrent accepts of the same invitation safe: the loser sees a non-pending
 * status and receives `INVITATION_INVALID`.
 */
export async function claimInvitation(
  database: Database,
  input: ClaimInvitationInput,
  errors: { INVITATION_INVALID: () => Error }
) {
  return database.transaction(async (tx) => {
    const rows = await tx
      .select({ invitation, organizationSlug: organization.slug })
      .from(invitation)
      .innerJoin(organization, eq(organization.id, invitation.organizationId))
      .where(eq(invitation.id, input.invitationId))
      .limit(1)
      .for("update");
    const record = rows[0];
    if (
      !record ||
      record.invitation.status !== "pending" ||
      record.invitation.expiresAt <= new Date()
    ) {
      throw errors.INVITATION_INVALID();
    }
    await tx.insert(member).values({
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: record.invitation.organizationId,
      role: record.invitation.role,
      userId: input.userId
    });
    await tx
      .update(invitation)
      .set({ status: "accepted" })
      .where(eq(invitation.id, input.invitationId));

    return {
      email: record.invitation.email,
      organizationId: record.invitation.organizationId,
      organizationSlug: record.organizationSlug,
      role: OrganizationRoleSchema.parse(record.invitation.role)
    };
  });
}
