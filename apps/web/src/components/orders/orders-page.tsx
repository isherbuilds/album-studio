import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PackageCheck, Plus, Search } from "lucide-react";
import { useState } from "react";

import {
  OrderSortSchema,
  OrderStatusSchema,
  type OrderSort,
  type OrderStatus
} from "@tsu-stack/contract/order";
import { type OrganizationRole } from "@tsu-stack/contract/organization";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button, buttonVariants } from "@tsu-stack/ui/components/button";
import { Card } from "@tsu-stack/ui/components/card";
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
import { Spinner } from "@tsu-stack/ui/components/spinner";
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
import { DataPagination } from "@/components/common/data-pagination";
import { SearchResultsStatus } from "@/components/common/search-results-status";
import { orderStatusConfig, orderStatusLabel } from "@/components/orders/order-format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getOrderListQueryOptions } from "@/hooks/use-orders";
import { getDateTimeFormatter, getNumberFormatter } from "@/lib/intl";
import { formatMinorAmount } from "@/lib/money";

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

export type OrdersTablePanelProps = {
  emptyDescription?: string;
  emptyTitle?: string;
  onPageChange: (page: number) => void;
  onSortChange: (sort: OrderSort) => void;
  onStatusChange: (status: OrderStatus | undefined) => void;
  organizationSlug: string;
  page: number;
  sort: OrderSort;
  status: OrderStatus | undefined;
  showStats?: boolean;
};

export function OrdersTablePanel({
  emptyDescription = m.orders__empty_description(),
  emptyTitle = m.orders__empty_title(),
  onPageChange,
  onSortChange,
  onStatusChange,
  organizationSlug,
  page,
  sort,
  status,
  showStats = false
}: OrdersTablePanelProps) {
  const { locale } = useLocale();
  const dateFormatter = getDateTimeFormatter(locale, { dateStyle: "medium", timeZone: "UTC" });
  const numberFormatter = getNumberFormatter(locale);
  const [query, setQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query.trim());
  const orderDetailTo = "/$organizationSlug/orders/$orderNumber";
  const activePage = debouncedQuery ? searchPage : page;
  const ordersQuery = useQuery({
    ...getOrderListQueryOptions(organizationSlug, {
      page: activePage,
      query: debouncedQuery,
      sort,
      status
    }),
    placeholderData: keepPreviousData
  });
  const result = ordersQuery.data;
  const totalOrders = result
    ? result.counts.cancelled +
      result.counts.completed +
      result.counts.confirmed +
      result.counts.inProduction +
      result.counts.placed
    : 0;

  if (ordersQuery.isError) {
    return (
      <Empty className="rounded-lg border border-dashed py-16" role="alert">
        <EmptyMedia variant="icon">
          <PackageCheck />
        </EmptyMedia>
        <EmptyTitle>{m.orders__update_failed()}</EmptyTitle>
        <EmptyContent>
          <Button onClick={() => void ordersQuery.refetch()} variant="outline">
            {m.error_500__try_again()}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (ordersQuery.isPending || result === undefined) {
    return (
      <Card className="py-0">
        <output className="grid min-h-56 place-items-center">
          <Spinner aria-label={m.orders__title()} />
        </output>
      </Card>
    );
  }

  if (totalOrders === 0) {
    return (
      <Empty className="rounded-lg border border-dashed py-16">
        <EmptyMedia variant="icon">
          <PackageCheck />
        </EmptyMedia>
        <EmptyTitle>{emptyTitle}</EmptyTitle>
        <EmptyDescription>{emptyDescription}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <>
      {showStats ? (
        <WorkspaceStatStrip
          label={m.orders__title()}
          stats={[
            { id: "total", label: m.orders__title(), value: totalOrders },
            {
              id: "placed",
              label: m.orders__status_placed(),
              markerClassName: orderStatusConfig.placed.dotClass,
              value: result.counts.placed
            },
            {
              id: "in-production",
              label: m.orders__status_in_production(),
              markerClassName: orderStatusConfig.in_production.dotClass,
              value: result.counts.inProduction
            },
            {
              id: "completed",
              label: m.orders__status_completed(),
              markerClassName: orderStatusConfig.completed.dotClass,
              value: result.counts.completed
            }
          ]}
        />
      ) : null}
      <div className="overflow-hidden rounded-lg border bg-card">
        <WorkspaceToolbar>
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={m.orders__search_placeholder()}
              className="pl-9"
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchPage(1);
              }}
              placeholder={m.orders__search_placeholder()}
              type="search"
              value={query}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select
              onValueChange={(value) =>
                onStatusChange(
                  value === "all" || value === null ? undefined : OrderStatusSchema.parse(value)
                )
              }
              value={status ?? "all"}
            >
              <SelectTrigger
                aria-label={`${m.orders__status_filter()}: ${orderStatusFilterLabel(status ?? "all")}`}
                className="w-full sm:w-44"
              >
                <SelectValue>{orderStatusFilterLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">{m.orders__all_statuses()}</SelectItem>
                  {OrderStatusSchema.options.map((orderStatus) => (
                    <SelectItem key={orderStatus} value={orderStatus}>
                      {orderStatusLabel(orderStatus)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => {
                if (value !== null) onSortChange(OrderSortSchema.parse(value));
              }}
              value={sort}
            >
              <SelectTrigger
                aria-label={`${m.orders__sort_label()}: ${orderSortLabel(sort)}`}
                className="w-full sm:w-44"
              >
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
        <SearchResultsStatus
          isFetching={ordersQuery.isFetching}
          loadingLabel={m.orders__title()}
          total={result?.total}
        />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.length === 0 ? (
                <TableRow>
                  <TableCell className="h-32 text-center text-muted-foreground" colSpan={6}>
                    {m.orders__no_filter_results()}
                  </TableCell>
                </TableRow>
              ) : (
                result.items.map((order) => (
                  <TableRow key={order.number}>
                    <TableCell>
                      <Link
                        className="group block w-fit rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        params={{ orderNumber: order.number, organizationSlug }}
                        to={orderDetailTo}
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
                      <span className="block max-w-64 truncate">{order.productName}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dateFormatter.format(new Date(order.createdAt))}
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
                    <TableCell className="text-right tabular-nums">
                      {numberFormatter.format(order.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMinorAmount(
                        order.orderTotal.amountMinor,
                        order.orderTotal.currency,
                        locale
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <DataPagination
          isFetching={ordersQuery.isFetching}
          onPageChange={(nextPage) => {
            if (debouncedQuery) setSearchPage(nextPage);
            else onPageChange(nextPage);
          }}
          page={result.page}
          pageCount={result.pageCount}
        />
      </div>
    </>
  );
}

type OrdersPageProps = OrdersTablePanelProps & {
  organizationRole: OrganizationRole;
};

export function OrdersPage({
  onPageChange,
  onSortChange,
  onStatusChange,
  organizationRole,
  organizationSlug,
  page,
  sort,
  status
}: OrdersPageProps) {
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        actions={
          organizationRole === "customer" ? (
            <Link
              className={buttonVariants()}
              params={{ organizationSlug }}
              to="/$organizationSlug/catalog"
            >
              <Plus data-icon="inline-start" />
              {m.orders__create()}
            </Link>
          ) : undefined
        }
        description={m.orders__description()}
        title={m.orders__title()}
      />

      <OrdersTablePanel
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onStatusChange={onStatusChange}
        organizationSlug={organizationSlug}
        page={page}
        showStats
        sort={sort}
        status={status}
      />
    </WorkspacePage>
  );
}
