import { createFileRoute } from "@tanstack/react-router";

import { can } from "@tsu-stack/auth/access-control";

import { ProductEditorPage } from "@/components/products/product-editor-page";
import { getProductQueryOptions } from "@/hooks/use-products";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/$organizationSlug/admin/products/$productSlug/"
)({
  loader: ({ context, params }) =>
    context.queryClient.fetchQuery(
      getProductQueryOptions(params.organizationSlug, params.productSlug)
    ),
  component: ProductDetailRoute
});

function ProductDetailRoute() {
  const { organizationSlug, productSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  return (
    <ProductEditorPage
      canDelete={can("product.delete", { role: membership.role })}
      canEditPricing={can("product.price", { role: membership.role })}
      organizationSlug={organizationSlug}
      productSlug={productSlug}
    />
  );
}
