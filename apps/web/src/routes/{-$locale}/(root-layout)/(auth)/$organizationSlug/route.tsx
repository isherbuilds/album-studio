import { Outlet, createFileRoute } from "@tanstack/react-router";

import { getOrganizationMembershipQueryOptions } from "@/hooks/use-organization";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/$organizationSlug")({
  beforeLoad: async ({ context, params }) => {
    const membership = await context.queryClient.fetchQuery({
      ...getOrganizationMembershipQueryOptions(params.organizationSlug),
      staleTime: 0
    });
    return { membership };
  },
  component: Outlet
});
