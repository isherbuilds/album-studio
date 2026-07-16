import { createFileRoute } from "@tanstack/react-router";

import { OrganizationSelectorPage } from "@/components/organization/organization-selector-page";
import { listMyOrganizationsQueryOptions } from "@/hooks/use-organization";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/select-organization/")({
  loader: ({ context }) =>
    context.queryClient.fetchQuery({
      ...listMyOrganizationsQueryOptions(),
      staleTime: 0
    }),
  component: OrganizationSelectorPage
});
