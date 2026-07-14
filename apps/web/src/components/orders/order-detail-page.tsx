import { ChevronLeft } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@tsu-stack/ui/components/card";
import { Separator } from "@tsu-stack/ui/components/separator";

import { formatMinorAmount } from "@/components/catalog/format";
import { orderStatusLabel } from "@/components/orders/order-format";
import { useOrderByNumberQuery } from "@/hooks/use-orders";

export function OrderDetailPage({
  orderNumber,
  organizationSlug
}: {
  orderNumber: string;
  organizationSlug: string;
}) {
  const { locale } = useLocale();
  const order = useOrderByNumberQuery(organizationSlug, orderNumber).data;
  if (!order) return null;
  const format = (amountMinor: number) =>
    formatMinorAmount(amountMinor, order.snapshot.orderTotal.currency, locale);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-5 sm:p-8">
      <Link
        className="flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        params={{ organizationSlug }}
        to="/org/$organizationSlug/orders"
      >
        <ChevronLeft />
        {m.orders__back()}
      </Link>
      <header className="flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-sm text-muted-foreground">{order.number}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {order.projectName ?? order.snapshot.product.name}
          </h1>
        </div>
        <Badge variant="outline">{orderStatusLabel(order.status)}</Badge>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{order.snapshot.product.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            {order.snapshot.selections.map((selection) => (
              <div className="flex flex-col gap-1" key={selection.groupKey}>
                <dt className="text-xs text-muted-foreground">{selection.groupLabel}</dt>
                <dd className="text-sm font-medium">
                  {selection.kind === "option" ? selection.optionValueLabel : selection.selected}
                </dd>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{m.catalog__quantity()}</dt>
              <dd className="text-sm font-medium">{order.snapshot.quantity}</dd>
            </div>
          </dl>
          <Separator />
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium">{m.catalog__order_total()}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {format(order.snapshot.orderTotal.amountMinor)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
