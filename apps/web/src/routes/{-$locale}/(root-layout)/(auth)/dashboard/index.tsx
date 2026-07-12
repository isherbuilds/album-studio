import { createFileRoute } from "@tanstack/react-router";

import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";

import { OrganizationSelectorPage } from "@/components/organization/organization-selector-page";
import { listMyOrganizationsQueryOptions } from "@/hooks/use-organization";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/dashboard/")({
  beforeLoad: async ({ context }) => {
    const globalRoles = context.user.role?.split(",").map((role) => role.trim()) ?? [];
    if (globalRoles.includes("admin")) {
      throw redirect({ to: "/admin" });
    }

    const organizations = await context.queryClient.ensureQueryData(
      listMyOrganizationsQueryOptions()
    );
    if (organizations.length === 1 && organizations[0]) {
      throw redirect({
        params: { organizationSlug: organizations[0].slug },
        to: "/org/$organizationSlug"
      });
    }
  },
  component: OrganizationSelectorPage
});
