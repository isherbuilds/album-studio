import { createFileRoute } from "@tanstack/react-router";

import { OrderDetailPage } from "@/components/orders/order-detail-page";
import { getOrderByNumberQueryOptions } from "@/hooks/use-orders";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/orders/$orderNumber/"
)({
  beforeLoad: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getOrderByNumberQueryOptions(params.organizationSlug, params.orderNumber)
    ),
  component: OrderRoute
});

function OrderRoute() {
  const { orderNumber, organizationSlug } = Route.useParams();
  return <OrderDetailPage orderNumber={orderNumber} organizationSlug={organizationSlug} />;
}
