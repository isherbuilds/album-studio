import { ArrowUpRight, PackageCheck, Search } from "lucide-react";
import { useState } from "react";

import { type OrderListItem, type OrderStatus, OrderStatusSchema } from "@tsu-stack/contract/order";
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
import { Input } from "@tsu-stack/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@tsu-stack/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";

import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceStatStrip,
  WorkspaceToolbar
} from "@/components/admin/workspace";
import { formatMinorAmount } from "@/components/catalog/format";
import { orderStatusConfig, orderStatusLabel } from "@/components/orders/order-format";
import { useOrderListQuery } from "@/hooks/use-orders";

type OrderSort = "amount-asc" | "amount-desc" | "date-asc" | "date-desc";

function orderStatusFilterLabel(value: "all" | OrderStatus) {
  return value === "all" ? m.orders__all_statuses() : orderStatusLabel(value);
}

function orderSortLabel(value: OrderSort) {
  switch (value) {
    case "date-desc":
      return m.orders__sort_newest();
    case "date-asc":
      return m.orders__sort_oldest();
    case "amount-desc":
      return m.orders__sort_highest();
    case "amount-asc":
      return m.orders__sort_lowest();
  }
}

export function OrdersPage({
  organizationRole,
  organizationSlug
}: {
  organizationRole: OrganizationRole;
  organizationSlug: string;
}) {
  const { locale } = useLocale();
  const ordersQuery = useOrderListQuery(organizationSlug);
  const orders = ordersQuery.data ?? [];
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<OrderSort>("date-desc");
  const [statusFilter, setStatusFilter] = useState("all");

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOrders = orders.filter((order) => {
    const matchesQuery =
      normalizedQuery === "" ||
      order.number.toLocaleLowerCase().includes(normalizedQuery) ||
      order.productName.toLocaleLowerCase().includes(normalizedQuery) ||
      order.projectName?.toLocaleLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const visibleOrders = Array.prototype.sort.call(
    filteredOrders,
    (left: OrderListItem, right: OrderListItem) => {
      if (sort === "date-asc") return left.createdAt.localeCompare(right.createdAt);
      if (sort === "date-desc") return right.createdAt.localeCompare(left.createdAt);
      if (sort === "amount-asc") {
        return left.orderTotal.amountMinor - right.orderTotal.amountMinor;
      }
      return right.orderTotal.amountMinor - left.orderTotal.amountMinor;
    }
  ) as OrderListItem[];

  const counts = {
    completed: orders.filter((order) => order.status === "completed").length,
    inProduction: orders.filter((order) => order.status === "in_production").length,
    placed: orders.filter((order) => order.status === "placed").length
  };

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        description={m.orders__description()}
        eyebrow={m.app_shell__production_workspace()}
        title={m.orders__title()}
      />

      <WorkspaceStatStrip
        label={m.orders__title()}
        stats={[
          { label: m.orders__title(), value: orders.length },
          {
            label: m.orders__status_placed(),
            markerClassName: orderStatusConfig.placed.dotClass,
            value: counts.placed
          },
          {
            label: m.orders__status_in_production(),
            markerClassName: orderStatusConfig.in_production.dotClass,
            value: counts.inProduction
          },
          {
            label: m.orders__status_completed(),
            markerClassName: orderStatusConfig.completed.dotClass,
            value: counts.completed
          }
        ]}
      />

      {orders.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
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
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select
                onValueChange={(value) => setStatusFilter(value ?? "all")}
                value={statusFilter}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue>{orderStatusFilterLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">{m.orders__all_statuses()}</SelectItem>
                    {OrderStatusSchema.options.map((status) => (
                      <SelectItem key={status} value={status}>
                        {orderStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => setSort(value as OrderSort)} value={sort}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue>{orderSortLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="date-desc">{m.orders__sort_newest()}</SelectItem>
                    <SelectItem value="date-asc">{m.orders__sort_oldest()}</SelectItem>
                    <SelectItem value="amount-desc">{m.orders__sort_highest()}</SelectItem>
                    <SelectItem value="amount-asc">{m.orders__sort_lowest()}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </WorkspaceToolbar>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table className="min-w-230">
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.orders__order()}</TableHead>
                    <TableHead>{m.orders__product()}</TableHead>
                    <TableHead className="w-40">{m.orders__order_date()}</TableHead>
                    <TableHead className="w-40">{m.common__status()}</TableHead>
                    <TableHead className="w-24 text-right">{m.products__quantity()}</TableHead>
                    <TableHead className="w-40 text-right">{m.products__order_total()}</TableHead>
                    <TableHead className="w-16">
                      <span className="sr-only">{m.common__open()}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleOrders.length === 0 ? (
                    <TableRow>
                      <TableCell className="h-32 text-center text-muted-foreground" colSpan={7}>
                        {m.orders__no_filter_results()}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleOrders.map((order) => (
                      <TableRow key={order.number}>
                        <TableCell>
                          <Link
                            className="group block w-fit rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            params={{ orderNumber: order.number, organizationSlug }}
                            to="/org/$organizationSlug/orders/$orderNumber"
                          >
                            <strong className="block max-w-64 truncate font-medium group-hover:underline">
                              {order.projectName ?? order.productName}
                            </strong>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {order.number}
                            </span>
                          </Link>
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
                        <TableCell className="text-right tabular-nums">{order.quantity}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMinorAmount(
                            order.orderTotal.amountMinor,
                            order.orderTotal.currency,
                            locale
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            aria-label={`${order.number}: ${m.orders__job_ticket()}`}
                            asChild
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Link
                              params={{ orderNumber: order.number, organizationSlug }}
                              to="/org/$organizationSlug/orders/$orderNumber"
                            >
                              <ArrowUpRight />
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
