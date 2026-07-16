import { Outlet, createFileRoute } from "@tanstack/react-router";

import { hasAdminRole } from "@tsu-stack/auth/access-control";
import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";

import { AppShell } from "@/components/layout/app-shell";
import { listMyOrganizationsQueryOptions } from "@/hooks/use-organization";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/admin")({
  beforeLoad: async ({ context }) => {
    if (hasAdminRole(context.user.role)) return;

    const memberships = await context.queryClient.fetchQuery({
      ...listMyOrganizationsQueryOptions(),
      staleTime: 0
    });
    const [membership] = memberships;
    if (memberships.length !== 1 || !membership) {
      throw redirect({ to: "/select-organization" });
    }
    throw redirect({
      params: { organizationSlug: membership.slug },
      to: "/$organizationSlug"
    });
  },
  component: AdminLayout
});

function AdminLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
