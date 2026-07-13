import { type RouterClient } from "@orpc/server";

import { catalogRouter } from "#@/routers/catalog/index";
import { healthRouter } from "#@/routers/health/index";
import { organizationsRouter } from "#@/routers/organizations/index";
import { platformRouter } from "#@/routers/platform/index";
import { privateRouter } from "#@/routers/private/index";

export const appRouter = {
  catalog: catalogRouter,
  health: healthRouter,
  organizations: organizationsRouter,
  private: privateRouter,
  platform: platformRouter
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
