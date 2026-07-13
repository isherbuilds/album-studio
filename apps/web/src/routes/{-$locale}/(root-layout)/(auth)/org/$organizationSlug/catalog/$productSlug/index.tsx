import { createFileRoute } from "@tanstack/react-router";

import { ProductStartPage } from "@/components/catalog/product-start-page";
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
  return <ProductStartPage organizationSlug={organizationSlug} productSlug={productSlug} />;
}
