import { type OrderStatus } from "@tsu-stack/contract/order";
import { m } from "@tsu-stack/i18n/messages";

export const orderStatusConfig: Record<OrderStatus, { dotClass: string; label: () => string }> = {
  cancelled: { dotClass: "bg-destructive", label: m.orders__status_cancelled },
  completed: { dotClass: "bg-success", label: m.orders__status_completed },
  confirmed: { dotClass: "bg-info", label: m.orders__status_confirmed },
  in_production: { dotClass: "bg-warning", label: m.orders__status_in_production },
  placed: { dotClass: "bg-muted-foreground", label: m.orders__status_placed }
};

export function orderStatusLabel(status: OrderStatus) {
  return orderStatusConfig[status].label();
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | undefined {
  if (status === "placed") return "confirmed";
  if (status === "confirmed") return "in_production";
  if (status === "in_production") return "completed";
  return undefined;
}
