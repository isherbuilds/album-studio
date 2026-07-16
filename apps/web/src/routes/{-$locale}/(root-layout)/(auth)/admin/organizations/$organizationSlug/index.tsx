import { createFileRoute } from "@tanstack/react-router";

import { PlatformOrganizationPage } from "@/components/platform-admin/platform-organization-page";
import { getOrganizationQueryOptions } from "@/hooks/use-platform-admin";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/admin/organizations/$organizationSlug/"
)({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(getOrganizationQueryOptions(params.organizationSlug)),
  component: RouteComponent
});

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  return <PlatformOrganizationPage slug={organizationSlug} />;
}
