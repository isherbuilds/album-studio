import { z } from "zod";

export const OrganizationRoleSchema = z.enum(["owner", "manager", "customer"]);

export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;

export const ORGANIZATION_INVITATION_TTL_SECONDS = 60 * 60 * 48;

export const InvitationStatusSchema = z.enum(["pending", "accepted", "rejected", "canceled"]);

export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const OrgSlugInputSchema = z.object({ organizationSlug: z.string().min(1) });

export type OrgSlugInput = z.infer<typeof OrgSlugInputSchema>;
