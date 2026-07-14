import { createFileRoute } from "@tanstack/react-router";

import { ProductsPage } from "@/components/products/products-page";
import { getProductsQueryOptions } from "@/hooks/use-products";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/(workspace)/products/"
)({
  beforeLoad: ({ context, params }) =>
    context.queryClient.ensureQueryData(getProductsQueryOptions(params.organizationSlug)),
  component: ProductsRoute
});

function ProductsRoute() {
  const { organizationSlug } = Route.useParams();
  return <ProductsPage organizationSlug={organizationSlug} />;
}
