import { createFileRoute } from "@tanstack/react-router";

import { InventoryPage } from "@/components/inventory/inventory-page";
import { getInventoryListQueryOptions } from "@/hooks/use-inventory";

export const Route = createFileRoute(
  "/{-$locale}/(root-layout)/(auth)/$organizationSlug/admin/inventory/"
)({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(getInventoryListQueryOptions(params.organizationSlug)),
  component: InventoryRoute
});

function InventoryRoute() {
  const { organizationSlug } = Route.useParams();
  return <InventoryPage organizationSlug={organizationSlug} />;
}
