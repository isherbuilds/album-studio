import { type OrderStatus } from "@tsu-stack/contract/order";
import { m } from "@tsu-stack/i18n/messages";

export function orderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "placed":
      return m.orders__status_placed();
    case "confirmed":
      return m.orders__status_confirmed();
    case "in_production":
      return m.orders__status_in_production();
    case "completed":
      return m.orders__status_completed();
    case "cancelled":
      return m.orders__status_cancelled();
  }
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | undefined {
  if (status === "placed") return "confirmed";
  if (status === "confirmed") return "in_production";
  if (status === "in_production") return "completed";
  return undefined;
}
