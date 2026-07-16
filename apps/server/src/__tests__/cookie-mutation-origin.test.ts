import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";

import { createCookieMutationOriginGuard } from "#@/cookie-mutation-origin";

const allowedOrigin = "https://web.example.com";
const apiOrigin = "https://api.example.com";

function createApp() {
  const app = new Hono();
  app.use("/*", createCookieMutationOriginGuard([allowedOrigin, apiOrigin]));
  app.all("/resource", (context) => context.body(null, 204));
  return app;
}

describe("createCookieMutationOriginGuard", () => {
  it("allows cookie mutations from exact web origin", async () => {
    const response = await createApp().request("/resource", {
      headers: { cookie: "session=value", origin: allowedOrigin },
      method: "POST"
    });

    expect(response.status).toBe(204);
  });

  it("rejects browser cookie mutations without a trusted origin", async () => {
    const missingOrigin = await createApp().request("/resource", {
      headers: { cookie: "session=value", "sec-fetch-site": "cross-site" },
      method: "DELETE"
    });
    const mismatchedOrigin = await createApp().request("/resource", {
      headers: { cookie: "session=value", origin: "https://attacker.example.com" },
      method: "DELETE"
    });

    expect(missingOrigin.status).toBe(403);
    expect(mismatchedOrigin.status).toBe(403);
  });

  it("allows API-origin docs and non-browser cookie clients", async () => {
    const app = createApp();
    const docs = await app.request("/resource", {
      headers: { cookie: "session=value", origin: apiOrigin },
      method: "POST"
    });
    const serverClient = await app.request("/resource", {
      headers: { cookie: "session=value" },
      method: "POST"
    });

    expect(docs.status).toBe(204);
    expect(serverClient.status).toBe(204);
  });

  it("allows safe cookie requests and cookie-less API mutations", async () => {
    const app = createApp();
    const safe = await app.request("/resource", {
      headers: { cookie: "session=value" },
      method: "GET"
    });
    const apiMutation = await app.request("/resource", { method: "POST" });

    expect(safe.status).toBe(204);
    expect(apiMutation.status).toBe(204);
  });
});
