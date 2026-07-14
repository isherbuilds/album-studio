import { type RouterClient } from "@orpc/server";

import { catalogRouter } from "#@/routers/catalog/index";
import { draftsRouter } from "#@/routers/drafts/index";
import { healthRouter } from "#@/routers/health/index";
import { ordersRouter } from "#@/routers/orders/index";
import { organizationsRouter } from "#@/routers/organizations/index";
import { paymentsRouter } from "#@/routers/payments/index";
import { platformRouter } from "#@/routers/platform/index";
import { privateRouter } from "#@/routers/private/index";

export const appRouter = {
  catalog: catalogRouter,
  drafts: draftsRouter,
  health: healthRouter,
  organizations: organizationsRouter,
  orders: ordersRouter,
  payments: paymentsRouter,
  private: privateRouter,
  platform: platformRouter
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
