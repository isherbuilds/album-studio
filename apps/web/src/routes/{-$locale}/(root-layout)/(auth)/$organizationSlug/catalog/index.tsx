import { createFileRoute } from "@tanstack/react-router";

import { CatalogPage } from "@/components/catalog/catalog-page";
import { getCatalogListQueryOptions } from "@/hooks/use-catalog";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/$organizationSlug/catalog/")(
  {
    loader: ({ context, params }) =>
      context.queryClient.ensureQueryData(getCatalogListQueryOptions(params.organizationSlug)),
    component: RouteComponent
  }
);

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  return <CatalogPage organizationSlug={organizationSlug} />;
}
