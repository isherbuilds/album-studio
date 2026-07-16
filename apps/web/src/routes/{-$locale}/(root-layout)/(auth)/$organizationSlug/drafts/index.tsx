import { createFileRoute } from "@tanstack/react-router";

import { DraftsPage } from "@/components/drafts/drafts-page";
import { getDraftListQueryOptions } from "@/hooks/use-drafts";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/$organizationSlug/drafts/")({
  loader: ({ context, params }) =>
    context.queryClient.fetchQuery({
      ...getDraftListQueryOptions(params.organizationSlug),
      staleTime: 0
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  return <DraftsPage organizationSlug={organizationSlug} />;
}
