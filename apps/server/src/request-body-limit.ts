import { bodyLimit } from "hono/body-limit";

export const MAX_REQUEST_BODY_BYTES = 256 * 1024;
export const MAX_CLIENT_LOG_BODY_BYTES = 64 * 1024;

function createRequestBodyLimit(maxSize: number, message: string) {
  return bodyLimit({
    maxSize,
    onError: (context) =>
      context.json(
        {
          code: "PAYLOAD_TOO_LARGE",
          message
        },
        413
      )
  });
}

export const requestBodyLimit = createRequestBodyLimit(
  MAX_REQUEST_BODY_BYTES,
  "Request body exceeds 256 KiB limit"
);

export const clientLogBodyLimit = createRequestBodyLimit(
  MAX_CLIENT_LOG_BODY_BYTES,
  "Log payload exceeds 64 KiB limit"
);
