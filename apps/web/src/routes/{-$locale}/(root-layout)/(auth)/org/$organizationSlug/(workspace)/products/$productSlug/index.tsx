import { createFileRoute } from "@tanstack/react-router";

import { ProductEditorPage } from "@/components/products/product-editor-page";
import { getInventoryListQueryOptions } from "@/hooks/use-inventory";
import { getProductQueryOptions } from "@/hooks/use-products";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/(workspace)/products/$productSlug/"
)({
  beforeLoad: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getProductQueryOptions(params.organizationSlug, params.productSlug)
      ),
      context.queryClient.ensureQueryData(getInventoryListQueryOptions(params.organizationSlug))
    ]),
  component: ProductDetailRoute
});

function ProductDetailRoute() {
  const { organizationSlug, productSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  return (
    <ProductEditorPage
      canEditPricing={membership.role === "owner"}
      organizationSlug={organizationSlug}
      productSlug={productSlug}
    />
  );
}
