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
  inventory: ["manage"],
  member: ["create", "update", "delete", "read"],
  order: ["manage"],
  payment: ["manage"],
  organization: ["update"]
});

export const organizationRoles = {
  customer: organizationAccessControl.newRole({}),
  manager: organizationAccessControl.newRole({
    inventory: ["manage"],
    order: ["manage"],
    payment: ["manage"]
  }),
  owner: organizationAccessControl.newRole({
    invitation: ["create", "cancel", "read"],
    inventory: ["manage"],
    member: ["create", "update", "delete", "read"],
    order: ["manage"],
    payment: ["manage"],
    organization: ["update"]
  })
};

const organizationActionPermissions = {
  "invitation.cancel": { invitation: ["cancel"] },
  "invitation.create": { invitation: ["create"] },
  "invitation.read": { invitation: ["read"] },
  "inventory.manage": { inventory: ["manage"] },
  "member.create": { member: ["create"] },
  "member.delete": { member: ["delete"] },
  "member.read": { member: ["read"] },
  "member.update": { member: ["update"] },
  "order.manage": { order: ["manage"] },
  "organization.update": { organization: ["update"] },
  "payment.manage": { payment: ["manage"] }
} as const;

export type OrganizationAction = keyof typeof organizationActionPermissions;

export function can(action: OrganizationAction, context: { role: OrganizationRole }) {
  return organizationRoles[context.role].authorize(organizationActionPermissions[action]).success;
}
