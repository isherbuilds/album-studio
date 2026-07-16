import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";

import { createClientLogIngestionGuard, resolveClientAddress } from "#@/client-log-ingestion";

function createApp(now: () => number) {
  const app = new Hono();
  app.post(
    "/logs",
    createClientLogIngestionGuard({
      allowedOrigin: "https://web.example.com",
      getClientKey: () => "203.0.113.7",
      maxRequests: 2,
      now,
      windowMs: 60_000
    }),
    (context) => context.body(null, 204)
  );
  return app;
}

describe("createClientLogIngestionGuard", () => {
  it("uses trusted proxy identity without accepting a left-side spoof", () => {
    expect(
      resolveClientAddress({
        forwardedFor: "198.51.100.9, 203.0.113.7",
        remoteAddress: "172.18.0.2",
        trustProxy: true
      })
    ).toBe("203.0.113.7");
    expect(
      resolveClientAddress({
        forwardedFor: "198.51.100.9",
        remoteAddress: "203.0.113.7",
        trustProxy: false
      })
    ).toBe("203.0.113.7");
  });

  it("rejects requests without exact web origin", async () => {
    const response = await createApp(() => 0).request("/logs", {
      headers: { origin: "https://attacker.example.com" },
      method: "POST"
    });

    expect(response.status).toBe(403);
  });

  it("rate limits connection identity regardless of forwarded headers", async () => {
    const app = createApp(() => 0);
    let requestCount = 0;
    const request = () => {
      requestCount += 1;
      return app.request("/logs", {
        headers: {
          origin: "https://web.example.com",
          "x-forwarded-for": `203.0.113.${requestCount}`
        },
        method: "POST"
      });
    };

    expect((await request()).status).toBe(204);
    expect((await request()).status).toBe(204);
    const limited = await request();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
