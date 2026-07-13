import { createFileRoute } from "@tanstack/react-router";

import { ProductConfiguratorPage } from "@/components/catalog/product-configurator-page";
import { getCatalogBySlugQueryOptions } from "@/hooks/use-catalog";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/catalog/$productSlug/"
)({
  beforeLoad: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getCatalogBySlugQueryOptions(params.organizationSlug, params.productSlug)
    ),
  component: RouteComponent
});

function RouteComponent() {
  const { organizationSlug, productSlug } = Route.useParams();
  return <ProductConfiguratorPage organizationSlug={organizationSlug} productSlug={productSlug} />;
}
