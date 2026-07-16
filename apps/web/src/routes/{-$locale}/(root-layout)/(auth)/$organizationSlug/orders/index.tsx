import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { OrderSortSchema, OrderStatusSchema } from "@tsu-stack/contract/order";

import { OrdersPage } from "@/components/orders/orders-page";
import { getOrderListQueryOptions } from "@/hooks/use-orders";

const ordersSearchSchema = z.object({
  page: z.number().int().positive().catch(1),
  sort: OrderSortSchema.catch("date-desc"),
  status: OrderStatusSchema.optional().catch(undefined)
});

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/$organizationSlug/orders/")({
  validateSearch: zodValidator(ordersSearchSchema),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, params }) =>
    context.queryClient.fetchQuery({
      ...getOrderListQueryOptions(params.organizationSlug, {
        page: deps.page,
        sort: deps.sort,
        status: deps.status
      }),
      staleTime: 0
    }),
  component: OrdersRoute
});

function OrdersRoute() {
  const { organizationSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  const { page, sort, status } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <OrdersPage
      onPageChange={(nextPage) => {
        void navigate({ search: { page: nextPage, sort, status } });
      }}
      onSortChange={(nextSort) => {
        void navigate({
          reloadDocument: true,
          search: { page: 1, sort: nextSort, status }
        });
      }}
      onStatusChange={(nextStatus) => {
        void navigate({
          reloadDocument: true,
          search: { page: 1, sort, status: nextStatus }
        });
      }}
      organizationRole={membership.role}
      organizationSlug={organizationSlug}
      page={page}
      sort={sort}
      status={status}
    />
  );
}
