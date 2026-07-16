import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { OrderSortSchema, OrderStatusSchema } from "@tsu-stack/contract/order";

import { PaymentsPage } from "@/components/payments/payments-page";
import { getOrderListQueryOptions } from "@/hooks/use-orders";

const paymentsSearchSchema = z.object({
  page: z.number().int().positive().catch(1),
  sort: OrderSortSchema.catch("date-desc"),
  status: OrderStatusSchema.optional().catch(undefined)
});

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/$organizationSlug/admin/payments/"
)({
  validateSearch: zodValidator(paymentsSearchSchema),
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
  component: PaymentsRoute
});

function PaymentsRoute() {
  const { organizationSlug } = Route.useParams();
  const { page, sort, status } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <PaymentsPage
      onPageChange={(nextPage) => {
        void navigate({ search: { page: nextPage, sort, status } });
      }}
      onSortChange={(nextSort) => {
        void navigate({ search: { page: 1, sort: nextSort, status } });
      }}
      onStatusChange={(nextStatus) => {
        void navigate({ search: { page: 1, sort, status: nextStatus } });
      }}
      organizationSlug={organizationSlug}
      page={page}
      sort={sort}
      status={status}
    />
  );
}
