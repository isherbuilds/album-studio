import { z } from "zod";

import { MoneySchema } from "@tsu-stack/contract/configuration";
import {
  OrganizationDashboardInputSchema,
  PlatformDashboardInputSchema
} from "@tsu-stack/contract/dashboard";
import {
  loadCustomerDashboard,
  loadManagerDashboard,
  loadOwnerDashboard,
  loadPlatformDashboard
} from "@tsu-stack/core/dashboard";

import { exactRoleOrganizationProcedure, platformAdminProcedure } from "#@/lib/procedures/factory";

const CountSchema = z.number().int().nonnegative();
const StockSummarySchema = z.object({ low: CountSchema, out: CountSchema });
const CustomerDashboardSchema = z.object({
  activeDrafts: CountSchema,
  recentOrders: CountSchema
});
const ManagerDashboardSchema = z.object({
  orders: z.object({
    confirmed: CountSchema,
    inProduction: CountSchema,
    placed: CountSchema
  }),
  stock: StockSummarySchema
});
const OwnerDashboardSchema = z.object({
  customers: CountSchema,
  orders: z.object({
    cancelled: CountSchema,
    completed: CountSchema,
    confirmed: CountSchema,
    inProduction: CountSchema,
    placed: CountSchema
  }),
  stock: StockSummarySchema,
  unpaidTotal: MoneySchema
});
const PlatformDashboardSchema = z.object({
  organizations: CountSchema,
  roles: z.object({
    customers: CountSchema,
    managers: CountSchema,
    owners: CountSchema
  }),
  users: CountSchema
});

export const dashboardsRouter = {
  customer: exactRoleOrganizationProcedure(OrganizationDashboardInputSchema, "customer")
    .route({ description: "Get a Customer's organization dashboard", method: "GET" })
    .output(CustomerDashboardSchema)
    .handler(async ({ context }) =>
      loadCustomerDashboard(context.db, {
        organizationId: context.organization.id,
        userId: context.authSession.user.id
      })
    ),
  manager: exactRoleOrganizationProcedure(OrganizationDashboardInputSchema, "manager")
    .route({ description: "Get a Manager's organization dashboard", method: "GET" })
    .output(ManagerDashboardSchema)
    .handler(async ({ context }) =>
      loadManagerDashboard(context.db, {
        organizationId: context.organization.id
      })
    ),
  owner: exactRoleOrganizationProcedure(OrganizationDashboardInputSchema, "owner")
    .route({ description: "Get an Owner's organization dashboard", method: "GET" })
    .output(OwnerDashboardSchema)
    .handler(async ({ context }) =>
      loadOwnerDashboard(context.db, {
        organizationId: context.organization.id
      })
    ),
  platform: platformAdminProcedure
    .route({ description: "Get installation-wide organization and user counts", method: "GET" })
    .input(PlatformDashboardInputSchema)
    .output(PlatformDashboardSchema)
    .handler(async ({ context }) => loadPlatformDashboard(context.db))
};
