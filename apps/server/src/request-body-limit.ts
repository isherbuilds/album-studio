import { bodyLimit } from "hono/body-limit";

export const MAX_REQUEST_BODY_BYTES = 256 * 1024;

export const requestBodyLimit = bodyLimit({
  maxSize: MAX_REQUEST_BODY_BYTES,
  onError: (context) =>
    context.json(
      {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds 256 KiB limit"
      },
      413
    )
});
