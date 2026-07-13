import { Outlet, createFileRoute } from "@tanstack/react-router";

import { StorefrontShell } from "@/components/layout/storefront-shell";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/drafts"
)({
  component: DraftsLayout
});

function DraftsLayout() {
  const { membership } = Route.useRouteContext();
  const { organizationSlug } = Route.useParams();

  return (
    <StorefrontShell organizationName={membership.name} organizationSlug={organizationSlug}>
      <Outlet />
    </StorefrontShell>
  );
}
