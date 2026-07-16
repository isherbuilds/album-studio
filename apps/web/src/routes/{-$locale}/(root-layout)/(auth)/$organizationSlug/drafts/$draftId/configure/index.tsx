import { createFileRoute } from "@tanstack/react-router";

import { DraftConfiguratorPage } from "@/components/drafts/draft-configurator-page";
import { getDraftByIdQueryOptions } from "@/hooks/use-drafts";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/$organizationSlug/drafts/$draftId/configure/"
)({
  loader: ({ context, params }) =>
    context.queryClient.fetchQuery({
      ...getDraftByIdQueryOptions(params.organizationSlug, params.draftId),
      staleTime: 0
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { draftId, organizationSlug } = Route.useParams();
  return <DraftConfiguratorPage draftId={draftId} organizationSlug={organizationSlug} />;
}
