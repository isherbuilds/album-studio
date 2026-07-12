import { Outlet, createFileRoute } from "@tanstack/react-router";

import { getOrganizationMembershipQueryOptions } from "@/hooks/use-organization";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/org/$organizationSlug")({
  beforeLoad: async ({ context, params }) => {
    const membership = await context.queryClient.ensureQueryData(
      getOrganizationMembershipQueryOptions(params.organizationSlug)
    );
    return { membership };
  },
  component: Outlet
});
