import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { ProductStatusSchema } from "@tsu-stack/contract/product";

import { ProductsPage } from "@/components/products/products-page";
import { getProductsQueryOptions } from "@/hooks/use-products";

const productsSearchSchema = z.object({
  page: z.number().int().positive().catch(1),
  status: ProductStatusSchema.optional().catch(undefined)
});

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/$organizationSlug/admin/products/"
)({
  validateSearch: zodValidator(productsSearchSchema),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, params }) =>
    context.queryClient.ensureQueryData(
      getProductsQueryOptions(params.organizationSlug, {
        page: deps.page,
        status: deps.status
      })
    ),
  component: ProductsRoute
});

function ProductsRoute() {
  const { organizationSlug } = Route.useParams();
  const { page, status } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <ProductsPage
      onPageChange={(nextPage) => {
        void navigate({ search: { page: nextPage, status } });
      }}
      onStatusChange={(nextStatus) => {
        void navigate({
          reloadDocument: true,
          search: { page: 1, status: nextStatus }
        });
      }}
      organizationSlug={organizationSlug}
      page={page}
      status={status}
    />
  );
}
