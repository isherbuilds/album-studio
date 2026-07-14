import { createFileRoute } from "@tanstack/react-router";

import { DraftsPage } from "@/components/drafts/drafts-page";
import { getDraftListQueryOptions } from "@/hooks/use-drafts";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/drafts/"
)({
  beforeLoad: ({ context, params }) =>
    context.queryClient.ensureQueryData(getDraftListQueryOptions(params.organizationSlug)),
  component: RouteComponent
});

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  return <DraftsPage organizationSlug={organizationSlug} />;
}
