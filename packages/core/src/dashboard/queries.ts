import { and, eq, gte, sql } from "drizzle-orm";

import { type DatabaseOrTransaction } from "@tsu-stack/db";
import {
  component,
  configurationDraft,
  customerOrder,
  member,
  offlinePayment,
  organization,
  user
} from "@tsu-stack/db/schema";

type OrganizationDashboardScope = {
  organizationId: string;
};

type CustomerDashboardScope = OrganizationDashboardScope & {
  userId: string;
};

function loadStockSummary(db: DatabaseOrTransaction, organizationId: string) {
  return db
    .select({
      low: sql<number>`count(*) filter (
        where ${component.availabilityOverride} = 'low'
          or (
            ${component.availabilityOverride} = 'automatic'
            and ${component.quantity} > 0
            and ${component.quantity} <= ${component.lowStockThreshold}
          )
      )::int`.mapWith(Number),
      out: sql<number>`count(*) filter (
        where ${component.availabilityOverride} = 'out'
          or (
            ${component.availabilityOverride} = 'automatic'
            and ${component.quantity} <= 0
          )
      )::int`.mapWith(Number)
    })
    .from(component)
    .where(eq(component.organizationId, organizationId));
}

function loadOwnerOrderSummary(db: DatabaseOrTransaction, organizationId: string) {
  const paymentLedger = db
    .select({
      amountMinor: sql<number>`coalesce(sum(${offlinePayment.amountMinor}), 0)::bigint`
        .mapWith(Number)
        .as("amount_minor"),
      orderId: offlinePayment.orderId,
      organizationId: offlinePayment.organizationId
    })
    .from(offlinePayment)
    .where(eq(offlinePayment.organizationId, organizationId))
    .groupBy(offlinePayment.organizationId, offlinePayment.orderId)
    .as("dashboard_payment_ledger");

  const orderAmountMinor = sql<number>`(
    ${customerOrder.snapshot} -> 'orderTotal' ->> 'amountMinor'
  )::bigint`;

  return db
    .select({
      cancelled:
        sql<number>`count(*) filter (where ${customerOrder.status} = 'cancelled')::int`.mapWith(
          Number
        ),
      completed:
        sql<number>`count(*) filter (where ${customerOrder.status} = 'completed')::int`.mapWith(
          Number
        ),
      confirmed:
        sql<number>`count(*) filter (where ${customerOrder.status} = 'confirmed')::int`.mapWith(
          Number
        ),
      inProduction:
        sql<number>`count(*) filter (where ${customerOrder.status} = 'in_production')::int`.mapWith(
          Number
        ),
      placed: sql<number>`count(*) filter (where ${customerOrder.status} = 'placed')::int`.mapWith(
        Number
      ),
      unpaidAmountMinor: sql<number>`coalesce(
        sum(greatest(${orderAmountMinor} - coalesce(${paymentLedger.amountMinor}, 0), 0::bigint))
          filter (where ${customerOrder.status} <> 'cancelled'),
        0
      )::bigint`.mapWith(Number)
    })
    .from(customerOrder)
    .leftJoin(
      paymentLedger,
      and(
        eq(paymentLedger.organizationId, customerOrder.organizationId),
        eq(paymentLedger.orderId, customerOrder.id)
      )
    )
    .where(eq(customerOrder.organizationId, organizationId));
}

function loadManagerOrderSummary(db: DatabaseOrTransaction, organizationId: string) {
  return db
    .select({
      confirmed:
        sql<number>`count(*) filter (where ${customerOrder.status} = 'confirmed')::int`.mapWith(
          Number
        ),
      inProduction:
        sql<number>`count(*) filter (where ${customerOrder.status} = 'in_production')::int`.mapWith(
          Number
        ),
      placed: sql<number>`count(*) filter (where ${customerOrder.status} = 'placed')::int`.mapWith(
        Number
      )
    })
    .from(customerOrder)
    .where(eq(customerOrder.organizationId, organizationId));
}

export async function loadOwnerDashboard(
  db: DatabaseOrTransaction,
  scope: OrganizationDashboardScope
) {
  const [customerRows, orderRows, stockRows, currencyRows] = await Promise.all([
    db
      .select({
        customers: sql<number>`count(*)::int`.mapWith(Number)
      })
      .from(member)
      .where(and(eq(member.organizationId, scope.organizationId), eq(member.role, "customer"))),
    loadOwnerOrderSummary(db, scope.organizationId),
    loadStockSummary(db, scope.organizationId),
    db
      .select({ currency: organization.currency })
      .from(organization)
      .where(eq(organization.id, scope.organizationId))
      .limit(1)
  ]);
  const counts = orderRows[0];
  const stock = stockRows[0];
  const currency = currencyRows[0]?.currency;
  if (!counts || !stock || !currency) {
    throw new Error("Owner dashboard aggregate query returned no row");
  }

  return {
    customers: customerRows[0]?.customers ?? 0,
    orders: {
      cancelled: counts.cancelled,
      completed: counts.completed,
      confirmed: counts.confirmed,
      inProduction: counts.inProduction,
      placed: counts.placed
    },
    stock,
    unpaidTotal: { amountMinor: counts.unpaidAmountMinor, currency }
  };
}

export async function loadManagerDashboard(
  db: DatabaseOrTransaction,
  scope: OrganizationDashboardScope
) {
  const [orderRows, stockRows] = await Promise.all([
    loadManagerOrderSummary(db, scope.organizationId),
    loadStockSummary(db, scope.organizationId)
  ]);
  const counts = orderRows[0];
  const stock = stockRows[0];
  if (!counts || !stock) {
    throw new Error("Manager dashboard aggregate query returned no row");
  }

  return {
    orders: {
      confirmed: counts.confirmed,
      inProduction: counts.inProduction,
      placed: counts.placed
    },
    stock
  };
}

export async function loadCustomerDashboard(
  db: DatabaseOrTransaction,
  scope: CustomerDashboardScope
) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [draftRows, orderRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
      .from(configurationDraft)
      .where(
        and(
          eq(configurationDraft.organizationId, scope.organizationId),
          eq(configurationDraft.customerId, scope.userId),
          eq(configurationDraft.status, "active")
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
      .from(customerOrder)
      .where(
        and(
          eq(customerOrder.organizationId, scope.organizationId),
          eq(customerOrder.customerId, scope.userId),
          gte(customerOrder.createdAt, cutoff)
        )
      )
  ]);

  return {
    activeDrafts: draftRows[0]?.count ?? 0,
    recentOrders: orderRows[0]?.count ?? 0
  };
}

export async function loadPlatformDashboard(db: DatabaseOrTransaction) {
  const [stats] = await db
    .select({
      customers: sql<number>`count(*) filter (where ${member.role} = 'customer')::int`.mapWith(
        Number
      ),
      managers: sql<number>`count(*) filter (where ${member.role} = 'manager')::int`.mapWith(
        Number
      ),
      organizations: sql<number>`(select count(*)::int from ${organization})`.mapWith(Number),
      owners: sql<number>`count(*) filter (where ${member.role} = 'owner')::int`.mapWith(Number),
      users: sql<number>`(select count(*)::int from ${user})`.mapWith(Number)
    })
    .from(member);

  if (!stats) throw new Error("Dashboard aggregate query returned no row");
  return {
    organizations: stats.organizations,
    roles: {
      customers: stats.customers,
      managers: stats.managers,
      owners: stats.owners
    },
    users: stats.users
  };
}
