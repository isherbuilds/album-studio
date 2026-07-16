import { getConnInfo } from "@hono/node-server/conninfo";
import { type Context } from "hono";
import { createMiddleware } from "hono/factory";

type ClientLogIngestionGuardOptions = {
  allowedOrigin: string;
  getClientKey?: (context: Context) => string;
  maxRequests?: number;
  now?: () => number;
  trustProxy?: boolean;
  windowMs?: number;
};

type RateWindow = {
  count: number;
  resetAt: number;
};

const MAX_TRACKED_CLIENTS = 10_000;

export function resolveClientAddress({
  forwardedFor,
  remoteAddress,
  trustProxy
}: {
  forwardedFor?: string;
  remoteAddress?: string;
  trustProxy: boolean;
}) {
  if (trustProxy && forwardedFor) {
    const forwardedAddress = forwardedFor.split(",").at(-1)?.trim();
    return forwardedAddress === "" ? (remoteAddress ?? "unknown") : (forwardedAddress ?? "unknown");
  }
  return remoteAddress ?? "unknown";
}

export function createClientLogIngestionGuard(options: ClientLogIngestionGuardOptions) {
  const maxRequests = options.maxRequests ?? 60;
  const getClientKey =
    options.getClientKey ??
    ((context: Context) =>
      resolveClientAddress({
        forwardedFor: context.req.header("x-forwarded-for"),
        remoteAddress: getConnInfo(context).remote.address,
        trustProxy: options.trustProxy ?? false
      }));
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? 60_000;
  const windows = new Map<string, RateWindow>();

  return createMiddleware(async (context, next) => {
    if (context.req.header("origin") !== options.allowedOrigin) {
      return context.json({ message: "Forbidden" }, 403);
    }

    const timestamp = now();
    let clientAddress = getClientKey(context);
    if (!windows.has(clientAddress) && windows.size >= MAX_TRACKED_CLIENTS) {
      for (const [address, rateWindow] of windows) {
        if (timestamp >= rateWindow.resetAt) windows.delete(address);
      }
      if (windows.size >= MAX_TRACKED_CLIENTS) clientAddress = "overflow";
    }
    const current = windows.get(clientAddress);
    const window =
      !current || timestamp >= current.resetAt
        ? { count: 0, resetAt: timestamp + windowMs }
        : current;

    if (window.count >= maxRequests) {
      context.header(
        "Retry-After",
        String(Math.max(1, Math.ceil((window.resetAt - timestamp) / 1000)))
      );
      return context.json({ message: "Too many log requests" }, 429);
    }

    window.count += 1;
    windows.set(clientAddress, window);
    await next();
  });
}
