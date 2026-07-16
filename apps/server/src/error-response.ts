import { type ContentfulStatusCode } from "hono/utils/http-status";

import { parseError } from "@tsu-stack/logger/server";

export function getPublicErrorResponse(error: unknown) {
  const parsed = parseError(error);

  if (parsed.status >= 500) {
    return {
      body: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      },
      status: 500 as const
    };
  }

  return {
    body: {
      message: parsed.message,
      ...(parsed.code ? { code: parsed.code } : {}),
      ...(parsed.why ? { why: parsed.why } : {}),
      ...(parsed.fix ? { fix: parsed.fix } : {}),
      ...(parsed.link ? { link: parsed.link } : {})
    },
    status: parsed.status as ContentfulStatusCode
  };
}
