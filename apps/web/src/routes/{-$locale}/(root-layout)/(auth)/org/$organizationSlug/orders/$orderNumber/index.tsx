import { createFileRoute } from "@tanstack/react-router";

import { OrderDetailPage } from "@/components/orders/order-detail-page";
import { getOrderByNumberQueryOptions } from "@/hooks/use-orders";
import { getPaymentLedgerQueryOptions } from "@/hooks/use-payments";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/orders/$orderNumber/"
)({
  beforeLoad: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getOrderByNumberQueryOptions(params.organizationSlug, params.orderNumber)
      ),
      context.queryClient.ensureQueryData(
        getPaymentLedgerQueryOptions(params.organizationSlug, params.orderNumber)
      )
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
