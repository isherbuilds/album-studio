import { createFileRoute } from "@tanstack/react-router";

import { PaymentsPage } from "@/components/payments/payments-page";
import { getOrderListQueryOptions } from "@/hooks/use-orders";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/org/$organizationSlug/(workspace)/payments/"
)({
  beforeLoad: ({ context, params }) =>
    context.queryClient.ensureQueryData(getOrderListQueryOptions(params.organizationSlug)),
  component: PaymentsRoute
});

function PaymentsRoute() {
  const { organizationSlug } = Route.useParams();
  return <PaymentsPage organizationSlug={organizationSlug} />;
}
