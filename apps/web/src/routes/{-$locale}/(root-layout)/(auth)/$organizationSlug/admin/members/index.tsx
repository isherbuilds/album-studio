import { createFileRoute } from "@tanstack/react-router";

import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";

import { OrganizationMembersPage } from "@/components/organization/organization-members-page";
import { listInvitationsQueryOptions, listMembersQueryOptions } from "@/hooks/use-organization";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/$organizationSlug/admin/members/"
)({
  beforeLoad: ({ context, params }) => {
    if (context.membership.role !== "owner") {
      throw redirect({
        params: { organizationSlug: params.organizationSlug },
        to: "/$organizationSlug/dashboard"
      });
    }
  },
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.fetchQuery(listMembersQueryOptions(params.organizationSlug)),
      context.queryClient.fetchQuery(listInvitationsQueryOptions(params.organizationSlug))
    ]);
  },
  component: RouteComponent
});

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  return (
    <OrganizationMembersPage organizationId={membership.id} organizationSlug={organizationSlug} />
  );
}
