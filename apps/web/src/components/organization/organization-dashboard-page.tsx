import { ArrowUpRight } from "lucide-react";

import { type OrganizationRole } from "@tsu-stack/contract/organization";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@tsu-stack/ui/components/empty";
import { Spinner } from "@tsu-stack/ui/components/spinner";

import {
  useCustomerDashboardQuery,
  useManagerDashboardQuery,
  useOwnerDashboardQuery
} from "@/hooks/use-dashboard";
import { getNumberFormatter } from "@/lib/intl";
import { formatMinorAmount } from "@/lib/money";

const dashboardLinkClass =
  "block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="h-full" size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      </CardContent>
      <CardFooter className="mt-auto text-xs font-medium text-muted-foreground">
        {m.organization_dashboard__view()}
        <ArrowUpRight aria-hidden />
      </CardFooter>
    </Card>
  );
}

function DashboardState({ failed }: { failed?: boolean }) {
  return (
    <Empty className="min-h-64 border border-dashed">
      <EmptyHeader>
        {failed ? null : (
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
        )}
        <EmptyTitle>
          {failed ? m.organization_dashboard__load_failed() : m.organization_dashboard__loading()}
        </EmptyTitle>
        <EmptyDescription>
          {failed
            ? m.organization_dashboard__load_failed_description()
            : m.organization_dashboard__loading_description()}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function DashboardGrid({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label={m.organization_dashboard__summary()}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {children}
    </section>
  );
}

function OwnerDashboard({ organizationSlug }: { organizationSlug: string }) {
  const { locale } = useLocale();
  const numberFormatter = getNumberFormatter(locale);
  const dashboard = useOwnerDashboardQuery(organizationSlug);

  if (dashboard.isError) return <DashboardState failed />;
  if (!dashboard.data) return <DashboardState />;

  const orderCards = [
    ["placed", m.organization_dashboard__placed_orders(), dashboard.data.orders.placed],
    ["confirmed", m.organization_dashboard__confirmed_orders(), dashboard.data.orders.confirmed],
    [
      "in_production",
      m.organization_dashboard__in_production_orders(),
      dashboard.data.orders.inProduction
    ],
    ["completed", m.organization_dashboard__completed_orders(), dashboard.data.orders.completed],
    ["cancelled", m.organization_dashboard__cancelled_orders(), dashboard.data.orders.cancelled]
  ] as const;
  const customerLabel = m.organization_dashboard__customers();
  const customerValue = numberFormatter.format(dashboard.data.customers);
  const unpaidLabel = m.organization_dashboard__unpaid_total();
  const unpaidValue = formatMinorAmount(
    dashboard.data.unpaidTotal.amountMinor,
    dashboard.data.unpaidTotal.currency,
    locale
  );
  const lowStockLabel = m.inventory__low();
  const lowStockValue = numberFormatter.format(dashboard.data.stock.low);
  const outOfStockLabel = m.inventory__out();
  const outOfStockValue = numberFormatter.format(dashboard.data.stock.out);

  return (
    <DashboardGrid>
      <Link
        aria-label={m.organization_dashboard__card_label({
          label: customerLabel,
          value: customerValue
        })}
        className={dashboardLinkClass}
        params={{ organizationSlug }}
        to="/$organizationSlug/admin/members"
      >
        <SummaryCard label={customerLabel} value={customerValue} />
      </Link>
      {orderCards.map(([status, label, count]) => {
        const value = numberFormatter.format(count);
        return (
          <Link
            aria-label={m.organization_dashboard__card_label({ label, value })}
            className={dashboardLinkClass}
            key={status}
            params={{ organizationSlug }}
            search={{ page: 1, sort: "date-desc", status }}
            to="/$organizationSlug/orders"
          >
            <SummaryCard label={label} value={value} />
          </Link>
        );
      })}
      <Link
        aria-label={m.organization_dashboard__card_label({
          label: unpaidLabel,
          value: unpaidValue
        })}
        className={dashboardLinkClass}
        params={{ organizationSlug }}
        to="/$organizationSlug/admin/payments"
      >
        <SummaryCard label={unpaidLabel} value={unpaidValue} />
      </Link>
      <Link
        aria-label={m.organization_dashboard__card_label({
          label: lowStockLabel,
          value: lowStockValue
        })}
        className={dashboardLinkClass}
        params={{ organizationSlug }}
        to="/$organizationSlug/admin/inventory"
      >
        <SummaryCard label={lowStockLabel} value={lowStockValue} />
      </Link>
      <Link
        aria-label={m.organization_dashboard__card_label({
          label: outOfStockLabel,
          value: outOfStockValue
        })}
        className={dashboardLinkClass}
        params={{ organizationSlug }}
        to="/$organizationSlug/admin/inventory"
      >
        <SummaryCard label={outOfStockLabel} value={outOfStockValue} />
      </Link>
    </DashboardGrid>
  );
}

function ManagerDashboard({ organizationSlug }: { organizationSlug: string }) {
  const { locale } = useLocale();
  const numberFormatter = getNumberFormatter(locale);
  const dashboard = useManagerDashboardQuery(organizationSlug);

  if (dashboard.isError) return <DashboardState failed />;
  if (!dashboard.data) return <DashboardState />;

  const orderCards = [
    ["placed", m.organization_dashboard__placed_orders(), dashboard.data.orders.placed],
    ["confirmed", m.organization_dashboard__confirmed_orders(), dashboard.data.orders.confirmed],
    [
      "in_production",
      m.organization_dashboard__in_production_orders(),
      dashboard.data.orders.inProduction
    ]
  ] as const;
  const stockCards = [
    [m.inventory__low(), dashboard.data.stock.low],
    [m.inventory__out(), dashboard.data.stock.out]
  ] as const;

  return (
    <DashboardGrid>
      {orderCards.map(([status, label, count]) => {
        const value = numberFormatter.format(count);
        return (
          <Link
            aria-label={m.organization_dashboard__card_label({ label, value })}
            className={dashboardLinkClass}
            key={status}
            params={{ organizationSlug }}
            search={{ page: 1, sort: "date-desc", status }}
            to="/$organizationSlug/orders"
          >
            <SummaryCard label={label} value={value} />
          </Link>
        );
      })}
      {stockCards.map(([label, count]) => {
        const value = numberFormatter.format(count);
        return (
          <Link
            aria-label={m.organization_dashboard__card_label({ label, value })}
            className={dashboardLinkClass}
            key={label}
            params={{ organizationSlug }}
            to="/$organizationSlug/admin/inventory"
          >
            <SummaryCard label={label} value={value} />
          </Link>
        );
      })}
    </DashboardGrid>
  );
}

function CustomerDashboard({ organizationSlug }: { organizationSlug: string }) {
  const { locale } = useLocale();
  const numberFormatter = getNumberFormatter(locale);
  const dashboard = useCustomerDashboardQuery(organizationSlug);

  if (dashboard.isError) return <DashboardState failed />;
  if (!dashboard.data) return <DashboardState />;

  const activeDraftsLabel = m.organization_dashboard__active_drafts();
  const activeDraftsValue = numberFormatter.format(dashboard.data.activeDrafts);
  const recentOrdersLabel = m.organization_dashboard__recent_orders();
  const recentOrdersValue = numberFormatter.format(dashboard.data.recentOrders);

  return (
    <DashboardGrid>
      <Link
        aria-label={m.organization_dashboard__card_label({
          label: activeDraftsLabel,
          value: activeDraftsValue
        })}
        className={dashboardLinkClass}
        params={{ organizationSlug }}
        to="/$organizationSlug/drafts"
      >
        <SummaryCard label={activeDraftsLabel} value={activeDraftsValue} />
      </Link>
      <Link
        aria-label={m.organization_dashboard__card_label({
          label: recentOrdersLabel,
          value: recentOrdersValue
        })}
        className={dashboardLinkClass}
        params={{ organizationSlug }}
        to="/$organizationSlug/orders"
      >
        <SummaryCard label={recentOrdersLabel} value={recentOrdersValue} />
      </Link>
    </DashboardGrid>
  );
}

export function OrganizationDashboardPage({
  organizationRole,
  organizationSlug
}: {
  organizationRole: OrganizationRole;
  organizationSlug: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {m.organization_dashboard__title()}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {m.organization_dashboard__description()}
        </p>
      </header>
      {organizationRole === "owner" ? (
        <OwnerDashboard organizationSlug={organizationSlug} />
      ) : organizationRole === "manager" ? (
        <ManagerDashboard organizationSlug={organizationSlug} />
      ) : (
        <CustomerDashboard organizationSlug={organizationSlug} />
      )}
    </div>
  );
}
