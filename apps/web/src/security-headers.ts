import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

const SECURITY_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
} as const;

export const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(
  ({ next }) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      setResponseHeader(name, value);
    }
    return next();
  }
);
