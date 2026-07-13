import { createFileRoute } from "@tanstack/react-router";

import { hasAdminRole } from "@tsu-stack/auth/access-control";
import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";

import { OrganizationSelectorPage } from "@/components/organization/organization-selector-page";
import { listMyOrganizationsQueryOptions } from "@/hooks/use-organization";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/dashboard/")({
  beforeLoad: async ({ context }) => {
    if (hasAdminRole(context.user.role)) {
      throw redirect({ to: "/admin" });
    }

    const organizations = await context.queryClient.ensureQueryData(
      listMyOrganizationsQueryOptions()
    );
    const [only] = organizations;
    if (organizations.length === 1 && only) {
      throw redirect({
        params: { organizationSlug: only.slug },
        to: "/org/$organizationSlug"
      });
    }
  },
  component: OrganizationSelectorPage
});
