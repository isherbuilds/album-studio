import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vite-plus/test";

import { getPublicErrorResponse } from "#@/error-response";

describe("getPublicErrorResponse", () => {
  it("hides unexpected server error details", () => {
    expect(getPublicErrorResponse(new Error("database password leaked"))).toEqual({
      body: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      },
      status: 500
    });
  });

  it("preserves intentional client-facing errors", () => {
    expect(getPublicErrorResponse(new HTTPException(400, { message: "Invalid request" }))).toEqual({
      body: { message: "Invalid request" },
      status: 400
    });
  });
});
