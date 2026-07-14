import { PackageCheck } from "lucide-react";

import { type OrganizationRole } from "@tsu-stack/contract/organization";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import { Card, CardContent } from "@tsu-stack/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle
} from "@tsu-stack/ui/components/empty";

import { formatMinorAmount } from "@/components/catalog/format";
import { useOrderListQuery } from "@/hooks/use-orders";

export function OrdersPage({
  organizationRole,
  organizationSlug
}: {
  organizationRole: OrganizationRole;
  organizationSlug: string;
}) {
  const { locale } = useLocale();
  const orders = useOrderListQuery(organizationSlug).data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{m.orders__title()}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{m.orders__description()}</p>
      </header>
      {orders.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <PackageCheck />
          </EmptyMedia>
          <EmptyTitle>{m.orders__empty_title()}</EmptyTitle>
          <EmptyDescription>{m.orders__empty_description()}</EmptyDescription>
          {organizationRole === "customer" ? (
            <EmptyContent>
              <Button asChild>
                <Link params={{ organizationSlug }} to="/org/$organizationSlug/catalog">
                  {m.drafts__browse_catalog()}
                </Link>
              </Button>
            </EmptyContent>
          ) : null}
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
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Button asChild className="h-auto w-fit px-0" variant="link">
                      <Link
                        params={{ orderNumber: order.number, organizationSlug }}
                        to="/org/$organizationSlug/orders/$orderNumber"
                      >
                        {order.projectName ?? order.productName}
                      </Link>
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {order.number} · {order.productName} ·{" "}
                      {m.drafts__quantity({ quantity: order.quantity })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <Badge variant="outline">{m.orders__status_placed()}</Badge>
                    <span className="font-medium tabular-nums">
                      {formatMinorAmount(
                        order.orderTotal.amountMinor,
                        order.orderTotal.currency,
                        locale
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
