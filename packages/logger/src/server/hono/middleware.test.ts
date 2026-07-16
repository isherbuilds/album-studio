import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";

import { honoLogIngestionMiddleware } from "#@/server/hono/middleware";

function createApp() {
  const app = new Hono();
  app.post("/logs", honoLogIngestionMiddleware());
  return app;
}

describe("honoLogIngestionMiddleware", () => {
  it("rejects malformed batches", async () => {
    const nonBatch = await createApp().request("/logs", {
      body: JSON.stringify({ event: { event: "page_view" } }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const invalidEntry = await createApp().request("/logs", {
      body: JSON.stringify([{ request: {} }]),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    expect(nonBatch.status).toBe(400);
    expect(invalidEntry.status).toBe(400);
  });

  it("rejects empty and unbounded batches", async () => {
    const empty = await createApp().request("/logs", {
      body: "[]",
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const oversized = await createApp().request("/logs", {
      body: JSON.stringify(
        Array.from({ length: 26 }, () => {
          return { event: { event: "page_view", level: "info" } };
        })
      ),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    expect(empty.status).toBe(400);
    expect(oversized.status).toBe(400);
  });
});
