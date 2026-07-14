import { ReceiptText, Search } from "lucide-react";
import { useState } from "react";

import { type OrderListItem } from "@tsu-stack/contract/order";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import { Card, CardContent } from "@tsu-stack/ui/components/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@tsu-stack/ui/components/empty";
import { Input } from "@tsu-stack/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";

import { WorkspacePage, WorkspacePageHeader, WorkspaceToolbar } from "@/components/admin/workspace";
import { formatMinorAmount } from "@/components/catalog/format";
import { orderStatusConfig, orderStatusLabel } from "@/components/orders/order-format";
import { useOrderListQuery } from "@/hooks/use-orders";

export function PaymentsPage({ organizationSlug }: { organizationSlug: string }) {
  const { locale } = useLocale();
  const ordersQuery = useOrderListQuery(organizationSlug);
  const orders = ordersQuery.data ?? [];
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOrders = orders.filter(
    (order) =>
      normalizedQuery === "" ||
      order.number.toLocaleLowerCase().includes(normalizedQuery) ||
      order.productName.toLocaleLowerCase().includes(normalizedQuery) ||
      order.projectName?.toLocaleLowerCase().includes(normalizedQuery)
  );
  const visibleOrders = Array.prototype.sort.call(
    filteredOrders,
    (left: OrderListItem, right: OrderListItem) => right.createdAt.localeCompare(left.createdAt)
  ) as OrderListItem[];

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        description={m.payments__description()}
        eyebrow={m.app_shell__production_workspace()}
        title={m.payments__title()}
      />
      {orders.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyMedia variant="icon">
            <ReceiptText />
          </EmptyMedia>
          <EmptyTitle>{m.payments__empty_orders()}</EmptyTitle>
          <EmptyDescription>{m.payments__empty_orders_description()}</EmptyDescription>
        </Empty>
      ) : (
        <Card className="overflow-hidden py-0">
          <WorkspaceToolbar>
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label={m.orders__search_placeholder()}
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={m.orders__search_placeholder()}
                type="search"
                value={query}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {visibleOrders.length} / {orders.length}
            </span>
          </WorkspaceToolbar>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table className="min-w-210">
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.orders__order()}</TableHead>
                    <TableHead>{m.orders__product()}</TableHead>
                    <TableHead className="w-40">{m.orders__order_date()}</TableHead>
                    <TableHead className="w-40">{m.common__status()}</TableHead>
                    <TableHead className="w-40 text-right">{m.products__order_total()}</TableHead>
                    <TableHead className="w-44">
                      <span className="sr-only">{m.payments__manage_order()}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleOrders.length === 0 ? (
                    <TableRow>
                      <TableCell className="h-32 text-center text-muted-foreground" colSpan={6}>
                        {m.orders__no_filter_results()}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleOrders.map((order) => (
                      <TableRow key={order.number}>
                        <TableCell>
                          <strong className="block max-w-64 truncate font-medium">
                            {order.projectName ?? order.productName}
                          </strong>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {order.number}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.productName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString(locale, {
                            dateStyle: "medium"
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <span
                              aria-hidden
                              className={`size-1.5 rounded-full ${orderStatusConfig[order.status].dotClass}`}
                            />
                            {orderStatusLabel(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMinorAmount(
                            order.orderTotal.amountMinor,
                            order.orderTotal.currency,
                            locale
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              params={{ orderNumber: order.number, organizationSlug }}
                              to="/org/$organizationSlug/orders/$orderNumber"
                            >
                              {m.payments__manage_order()}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </WorkspacePage>
  );
}
