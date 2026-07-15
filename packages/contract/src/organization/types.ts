import { z } from "zod";

import { CurrencyCodeSchema } from "@tsu-stack/contract/configuration";

export const OrganizationRoleSchema = z.enum(["owner", "manager", "customer"]);

export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;

export const ORGANIZATION_INVITATION_TTL_SECONDS = 60 * 60 * 48;

export const InvitationStatusSchema = z.enum(["pending", "accepted", "rejected", "canceled"]);

export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const OrgSlugInputSchema = z.object({ organizationSlug: z.string().min(1) });

export const OrganizationCreateInvitationInputSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  role: OrganizationRoleSchema
});
export const OrganizationAcceptNewUserInvitationInputSchema = z.object({
  invitationId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128)
});
export const PlatformCreateOrganizationInputSchema = z.object({
  currency: CurrencyCodeSchema,
  name: z.string().trim().min(2).max(120),
  ownerEmail: z.email().transform((email) => email.toLowerCase()),
  ownerName: z.string().trim().min(2).max(120),
  ownerPassword: z.string().min(8).max(128),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
});

export type OrgSlugInput = z.infer<typeof OrgSlugInputSchema>;
export type OrganizationCreateInvitationInput = z.infer<
  typeof OrganizationCreateInvitationInputSchema
>;
export type OrganizationAcceptNewUserInvitationInput = z.infer<
  typeof OrganizationAcceptNewUserInvitationInputSchema
>;
export type PlatformCreateOrganizationInput = z.infer<typeof PlatformCreateOrganizationInputSchema>;
