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

const mediumDateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatOrderDate(value: string, locale: string): string {
  let formatter = mediumDateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
    mediumDateFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(value));
}

export function formatOrderDateTime(value: string, locale: string): string {
  let formatter = dateTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC"
    });
    dateTimeFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(value));
}
