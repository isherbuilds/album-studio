import { createMiddleware } from "hono/factory";

const UNSAFE_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export function createCookieMutationOriginGuard(allowedOrigins: readonly string[]) {
  return createMiddleware(async (context, next) => {
    const origin = context.req.header("origin");
    const fetchSite = context.req.header("sec-fetch-site");
    if (
      UNSAFE_METHODS.has(context.req.method) &&
      context.req.header("cookie") &&
      ((origin && !allowedOrigins.includes(origin)) || (!origin && fetchSite !== undefined))
    ) {
      return context.json({ message: "Forbidden" }, 403);
    }

    await next();
  });
}
