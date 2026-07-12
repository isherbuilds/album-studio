import { createAccessControl } from "better-auth/plugins/access";

import { type OrganizationRole } from "@tsu-stack/contract/organization";

/**
 * Checks Better Auth's admin-plugin platform role (`user.role`, a
 * comma-separated string, e.g. "admin"), NOT the organization RBAC
 * {@link OrganizationRole}. Used to gate platform-admin routes.
 */
export function hasAdminRole(role: string | null | undefined): boolean {
  return (
    role
      ?.split(",")
      .map((entry) => entry.trim())
      .includes("admin") ?? false
  );
}

export const organizationAccessControl = createAccessControl({
  invitation: ["create", "cancel", "read"],
  member: ["create", "update", "delete", "read"],
  organization: ["update"]
});

export const organizationRoles = {
  customer: organizationAccessControl.newRole({}),
  manager: organizationAccessControl.newRole({}),
  owner: organizationAccessControl.newRole({
    invitation: ["create", "cancel", "read"],
    member: ["create", "update", "delete", "read"],
    organization: ["update"]
  })
};

const organizationActionPermissions = {
  "invitation.cancel": { invitation: ["cancel"] },
  "invitation.create": { invitation: ["create"] },
  "invitation.read": { invitation: ["read"] },
  "member.create": { member: ["create"] },
  "member.delete": { member: ["delete"] },
  "member.read": { member: ["read"] },
  "member.update": { member: ["update"] },
  "organization.update": { organization: ["update"] }
} as const;

export type OrganizationAction = keyof typeof organizationActionPermissions;

export function can(action: OrganizationAction, context: { role: OrganizationRole }) {
  return organizationRoles[context.role].authorize(organizationActionPermissions[action]).success;
}
