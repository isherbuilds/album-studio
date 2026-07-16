import { m } from "@tsu-stack/i18n/messages";

import { WorkspacePage, WorkspacePageHeader } from "@/components/admin/workspace";
import { OrdersTablePanel, type OrdersTablePanelProps } from "@/components/orders/orders-page";

export function PaymentsPage({
  onPageChange,
  onSortChange,
  onStatusChange,
  organizationSlug,
  page,
  sort,
  status
}: OrdersTablePanelProps) {
  return (
    <WorkspacePage>
      <WorkspacePageHeader description={m.payments__description()} title={m.payments__title()} />
      <OrdersTablePanel
        emptyDescription={m.payments__empty_orders_description()}
        emptyTitle={m.payments__empty_orders()}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onStatusChange={onStatusChange}
        organizationSlug={organizationSlug}
        page={page}
        sort={sort}
        status={status}
      />
    </WorkspacePage>
  );
}
