import { createFileRoute } from "@tanstack/react-router";

import { DraftConfiguratorPage } from "@/components/drafts/draft-configurator-page";
import { getDraftByIdQueryOptions } from "@/hooks/use-drafts";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/drafts/$draftId/configure/"
)({
  beforeLoad: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getDraftByIdQueryOptions(params.organizationSlug, params.draftId)
    ),
  component: RouteComponent
});

function RouteComponent() {
  const { draftId, organizationSlug } = Route.useParams();
  return <DraftConfiguratorPage draftId={draftId} organizationSlug={organizationSlug} />;
}
