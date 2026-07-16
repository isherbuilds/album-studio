import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { StorefrontShell } from "@/components/layout/storefront-shell";
import { OrganizationDashboardPage } from "@/components/organization/organization-dashboard-page";
import {
  getCustomerDashboardQueryOptions,
  getManagerDashboardQueryOptions,
  getOwnerDashboardQueryOptions
} from "@/hooks/use-dashboard";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/$organizationSlug/dashboard/"
)({
  loader: ({ context, params }) => {
    if (context.membership.role === "owner") {
      return context.queryClient.fetchQuery({
        ...getOwnerDashboardQueryOptions(params.organizationSlug),
        staleTime: 0
      });
    }
    if (context.membership.role === "manager") {
      return context.queryClient.fetchQuery({
        ...getManagerDashboardQueryOptions(params.organizationSlug),
        staleTime: 0
      });
    }
    return context.queryClient.fetchQuery({
      ...getCustomerDashboardQueryOptions(params.organizationSlug),
      staleTime: 0
    });
  },
  component: OrganizationDashboardRoute
});

function OrganizationDashboardRoute() {
  const { organizationSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  const page = (
    <OrganizationDashboardPage
      organizationRole={membership.role}
      organizationSlug={organizationSlug}
    />
  );
  return membership.role === "customer" ? (
    <StorefrontShell organizationName={membership.name} organizationSlug={organizationSlug}>
      {page}
    </StorefrontShell>
  ) : (
    <AppShell>{page}</AppShell>
  );
}
