import { createFileRoute } from "@tanstack/react-router";

import { OrganizationHomePage } from "@/components/organization/organization-home-page";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/")({
  component: RouteComponent
});

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  return <OrganizationHomePage organizationSlug={organizationSlug} />;
}
