import { describe, expect, it } from "vite-plus/test";

import { getRequestLogContext } from "#@/server/tanstack-start/middleware";

describe("getRequestLogContext", () => {
  it("never includes query parameters in request logs", () => {
    const context = getRequestLogContext(
      new Request("https://app.example.com/invitations/accept?id=bearer-secret&safe=value")
    );

    expect(context.path).toBe("/invitations/accept");
    expect("query" in context).toBe(false);
  });
});
