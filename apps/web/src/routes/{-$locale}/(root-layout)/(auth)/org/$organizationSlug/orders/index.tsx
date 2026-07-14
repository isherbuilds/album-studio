import { createFileRoute } from "@tanstack/react-router";

import { OrdersPage } from "@/components/orders/orders-page";
import { getOrderListQueryOptions } from "@/hooks/use-orders";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/orders/"
)({
  beforeLoad: ({ context, params }) =>
    context.queryClient.ensureQueryData(getOrderListQueryOptions(params.organizationSlug)),
  component: OrdersRoute
});

function OrdersRoute() {
  const { organizationSlug } = Route.useParams();
  const { membership } = Route.useRouteContext();
  return <OrdersPage organizationRole={membership.role} organizationSlug={organizationSlug} />;
}
