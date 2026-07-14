import { ReceiptText } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Button } from "@tsu-stack/ui/components/button";
import { Card, CardContent } from "@tsu-stack/ui/components/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@tsu-stack/ui/components/empty";

import { formatMinorAmount } from "@/components/catalog/format";
import { orderStatusLabel } from "@/components/orders/order-format";
import { useOrderListQuery } from "@/hooks/use-orders";

export function PaymentsPage({ organizationSlug }: { organizationSlug: string }) {
  const { locale } = useLocale();
  const orders = useOrderListQuery(organizationSlug).data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{m.payments__title()}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{m.payments__description()}</p>
      </header>
      {orders.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <ReceiptText />
          </EmptyMedia>
          <EmptyTitle>{m.payments__empty_orders()}</EmptyTitle>
          <EmptyDescription>{m.payments__empty_orders_description()}</EmptyDescription>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <ol className="divide-y">
              {orders.map((order) => (
                <li
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"
                  key={order.number}
                >
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">
                      {order.projectName ?? order.productName}
                    </strong>
                    <span className="text-sm text-muted-foreground">
                      {order.number} · {orderStatusLabel(order.status)}
                    </span>
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatMinorAmount(
                      order.orderTotal.amountMinor,
                      order.orderTotal.currency,
                      locale
                    )}
                  </span>
                  <Button asChild variant="outline">
                    <Link
                      params={{ orderNumber: order.number, organizationSlug }}
                      to="/org/$organizationSlug/orders/$orderNumber"
                    >
                      {m.payments__manage_order()}
                    </Link>
                  </Button>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
