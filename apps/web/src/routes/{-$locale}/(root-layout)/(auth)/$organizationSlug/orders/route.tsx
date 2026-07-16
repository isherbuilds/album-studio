import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { StorefrontShell } from "@/components/layout/storefront-shell";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/$organizationSlug/orders")({
  component: OrdersLayout
});

function OrdersLayout() {
  const { organizationSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  return membership.role === "customer" ? (
    <StorefrontShell organizationName={membership.name} organizationSlug={organizationSlug}>
      <Outlet />
    </StorefrontShell>
  ) : (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
