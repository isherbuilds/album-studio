import { createFileRoute } from "@tanstack/react-router";

import { OrderDetailPage } from "@/components/orders/order-detail-page";
import { getOrderByNumberQueryOptions } from "@/hooks/use-orders";
import { getPaymentLedgerQueryOptions } from "@/hooks/use-payments";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/$organizationSlug/orders/$orderNumber/"
)({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.fetchQuery({
        ...getOrderByNumberQueryOptions(params.organizationSlug, params.orderNumber),
        staleTime: 0
      }),
      context.queryClient.fetchQuery({
        ...getPaymentLedgerQueryOptions(params.organizationSlug, params.orderNumber),
        staleTime: 0
      })
    ]),
  component: OrderRoute
});

function OrderRoute() {
  const { orderNumber, organizationSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  return (
    <OrderDetailPage
      orderNumber={orderNumber}
      organizationRole={membership.role}
      organizationSlug={organizationSlug}
    />
  );
}
