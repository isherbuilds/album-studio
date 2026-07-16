import { Outlet, createFileRoute } from "@tanstack/react-router";

import { StorefrontShell } from "@/components/layout/storefront-shell";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/$organizationSlug/catalog")({
  component: CatalogLayout
});

function CatalogLayout() {
  const { membership } = Route.useRouteContext();
  const { organizationSlug } = Route.useParams();

  return (
    <StorefrontShell organizationName={membership.name} organizationSlug={organizationSlug}>
      <Outlet />
    </StorefrontShell>
  );
}
