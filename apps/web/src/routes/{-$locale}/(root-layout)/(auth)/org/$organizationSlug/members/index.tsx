import { createFileRoute } from "@tanstack/react-router";

import { OrganizationMembersPage } from "@/components/organization/organization-members-page";
import { listInvitationsQueryOptions, listMembersQueryOptions } from "@/hooks/use-organization";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/members/"
)({
  beforeLoad: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(listMembersQueryOptions(params.organizationSlug)),
      context.queryClient.ensureQueryData(listInvitationsQueryOptions(params.organizationSlug))
    ]);
  },
  component: RouteComponent
});

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  return <OrganizationMembersPage organizationSlug={organizationSlug} />;
}
