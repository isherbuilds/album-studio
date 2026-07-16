import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";

import { MAX_REQUEST_BODY_BYTES, requestBodyLimit } from "#@/request-body-limit";
import { createServerCors } from "#@/server-cors";

function createApp() {
  const app = new Hono();
  app.use("/*", createServerCors("https://web.example.com"));
  app.use("/*", requestBodyLimit);
  app.post("/rpc/drafts/save", (context) => context.json({ accepted: true }));
  app.post("/auth/sign-in", (context) => context.json({ accepted: true }));
  return app;
}

describe("requestBodyLimit", () => {
  it("accepts request bodies at configured ceiling", async () => {
    const response = await createApp().request("/rpc/drafts/save", {
      body: "x".repeat(MAX_REQUEST_BODY_BYTES),
      method: "POST"
    });

    expect(response.status).toBe(200);
  });

  it("allows DELETE preflight for RPC removals", async () => {
    const response = await createApp().request("/rpc/drafts/remove", {
      headers: {
        origin: "https://web.example.com",
        "access-control-request-method": "DELETE"
      },
      method: "OPTIONS"
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")?.split(",")).toContain("DELETE");
  });

  it("rejects oversized bodies from declared Content-Length before handler work", async () => {
    const response = await createApp().request("/rpc/drafts/save", {
      body: "{}",
      headers: { "content-length": String(MAX_REQUEST_BODY_BYTES + 1) },
      method: "POST"
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body exceeds 256 KiB limit"
    });
  });

  it("rejects oversized streamed bodies without Content-Length", async () => {
    const request = new Request("http://localhost/rpc/drafts/save", {
      body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
      method: "POST"
    });
    expect(request.headers.has("content-length")).toBe(false);

    const response = await createApp().request(request);

    expect(response.status).toBe(413);
  });

  it("rejects oversized bodies on non-RPC routes", async () => {
    const response = await createApp().request("/auth/sign-in", {
      body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
      method: "POST"
    });

    expect(response.status).toBe(413);
  });
});
