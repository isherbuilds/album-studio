import { Outlet, createFileRoute } from "@tanstack/react-router";

import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";

import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/(workspace)"
)({
  beforeLoad: ({ context, params }) => {
    if (context.membership.role === "customer") {
      throw redirect({
        params: { organizationSlug: params.organizationSlug },
        to: "/org/$organizationSlug/catalog"
      });
    }
  },
  component: OrganizationWorkspaceLayout
});

function OrganizationWorkspaceLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
