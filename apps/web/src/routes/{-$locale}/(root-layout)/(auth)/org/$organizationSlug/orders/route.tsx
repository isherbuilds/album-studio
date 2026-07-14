import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { StorefrontShell } from "@/components/layout/storefront-shell";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/orders"
)({ component: OrdersLayout });

function OrdersLayout() {
  const { organizationSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  if (membership.role !== "customer") {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }
  return (
    <StorefrontShell organizationName={membership.name} organizationSlug={organizationSlug}>
      <Outlet />
    </StorefrontShell>
  );
}
