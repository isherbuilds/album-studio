import { cors } from "hono/cors";

export function createServerCors(origin: string) {
  return cors({
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
    origin: [origin]
  });
}
