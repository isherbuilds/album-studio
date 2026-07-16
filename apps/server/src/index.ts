import { hostname } from "node:os";
import { join } from "node:path/posix";

import { serve } from "@hono/node-server";
import { SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { experimental_RethrowHandlerPlugin as RethrowHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

import { createContext } from "@tsu-stack/api/lib/context/hono/create-context";
import { appRouter } from "@tsu-stack/api/routers/index";
import { auth } from "@tsu-stack/auth/index";
import { migrateDatabase } from "@tsu-stack/db";
import { ENV_SERVER } from "@tsu-stack/env/server/env";
import { log } from "@tsu-stack/logger/server";
import {
  honoLogIngestionMiddleware,
  honoLoggerMiddleware,
  type HonoLogVariables
} from "@tsu-stack/logger/server/hono/middleware";

import { createClientLogIngestionGuard } from "#@/client-log-ingestion";
import { createCookieMutationOriginGuard } from "#@/cookie-mutation-origin";
import { getPublicErrorResponse } from "#@/error-response";
import { clientLogBodyLimit, requestBodyLimit } from "#@/request-body-limit";
import { createServerCors } from "#@/server-cors";
import "#@/shared/lib/logger";

const serverHostname = hostname();

export const app = new Hono<HonoLogVariables>().basePath(
  new URL(ENV_SERVER.VITE_SERVER_URL).pathname
);

app.use("/*", createServerCors(new URL(ENV_SERVER.VITE_WEB_URL).origin));
app.use(
  "/*",
  secureHeaders({
    crossOriginResourcePolicy: "cross-origin",
    permissionsPolicy: {
      camera: [],
      geolocation: [],
      microphone: []
    },
    referrerPolicy: "strict-origin-when-cross-origin",
    strictTransportSecurity: ENV_SERVER.NODE_ENV === "production",
    xFrameOptions: "DENY"
  })
);
app.use(
  "/*",
  createCookieMutationOriginGuard([
    new URL(ENV_SERVER.VITE_WEB_URL).origin,
    new URL(ENV_SERVER.VITE_SERVER_URL).origin
  ])
);

app.use(
  "/*",
  honoLoggerMiddleware({
    exclude: ["**/health/**", "**/_logs/ingest"],
    enrich: (ctx) => {
      ctx.event.hostname = serverHostname;
    }
  })
);

app.use("/rpc/*", requestBodyLimit);

app.post(
  "/_logs/ingest",
  createClientLogIngestionGuard({
    allowedOrigin: new URL(ENV_SERVER.VITE_WEB_URL).origin,
    trustProxy: ENV_SERVER.TRUST_PROXY
  }),
  clientLogBodyLimit,
  honoLogIngestionMiddleware()
);

app.onError((error, c) => {
  const requestLog = c.get("log");
  if (requestLog) {
    requestLog.error(error);
  } else {
    log.error({ event: "hono_global_error", error });
  }

  const response = getPublicErrorResponse(error);

  return c.json(response.body, response.status);
});

/**
 * Disable /auth/reference calls as they are handled by the OpenAPI generator
 * @see https://better-auth.com/docs/plugins/open-api#configuration
 */
app.on(["POST", "GET"], "/auth/reference", (c) =>
  c.redirect(`${ENV_SERVER.VITE_SERVER_URL}/docs#auth-api-reference`, 301)
);

app.get("/auth/open-api/generate-schema", async (c) => {
  // IMPORTANT: Need to explicitly do this instead of relying on the OpenAPI plugin's built-in schema generation
  // Otherwise, it will 404 with the /auth/* endpoint
  const schema = await auth.api.generateOpenAPISchema();
  return c.json(schema);
});

app.post("/auth/organization/update-member-role", (c) => c.notFound());

app.on(["POST", "GET"], "/auth/*", async (c) => auth.handler(c.req.raw));

const openApiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [
    onError((error, { context }) => {
      context.logger.set({ handler: "openapi" });
      context.logger.error(error instanceof Error ? error : String(error));
    })
  ],
  plugins: [
    new SmartCoercionPlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()]
    }),
    new OpenAPIReferencePlugin({
      docsConfig: () => {
        const apiBasePath = new URL(ENV_SERVER.VITE_SERVER_URL).pathname;
        return {
          content: undefined,
          metaData: {
            description: "Documentation for the @tsu-stack/server API.",
            title: "@tsu-stack/server API Documentation"
          },
          sources: [
            {
              title: "API Reference",
              url: join(apiBasePath, "docs", "spec.json")
            },
            {
              title: "Auth API Reference",
              url: join(apiBasePath, "auth", "open-api", "generate-schema")
            }
          ],
          theme: "deepSpace"
        };
      },
      docsPath: "/docs",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        components: {
          securitySchemes: {
            authCookie: {
              description: `**(optional)** Session cookie from signing-in, required for protected endpoints [View Auth Reference](${ENV_SERVER.VITE_SERVER_URL}/docs#auth-api-reference)`,
              in: "cookie",
              name: "better_auth.session_token",
              type: "apiKey"
            }
          }
        },
        info: {
          description: `This is the API for @tsu-stack/server.\n## Usage\nFor authentication, you can sign in via the \`/sign-in\` endpoint in [the Auth Reference](${ENV_SERVER.VITE_SERVER_URL}/docs#auth-api-reference). Include the session cookie in subsequent requests to access protected endpoints.\n## Resources\n - [Official Website](${ENV_SERVER.VITE_WEB_URL})\n - [Auth API Reference](${ENV_SERVER.VITE_SERVER_URL}/docs#auth-api-reference)`,
          title: "@tsu-stack/server API",
          version: ENV_SERVER.SOURCE_COMMIT
        },
        servers: [
          {
            description: "Primary API Server",
            url: ENV_SERVER.VITE_SERVER_URL
          }
        ]
      },
      specPath: "/docs/spec.json"
    }),
    new RethrowHandlerPlugin({
      filter: (error) => !(error instanceof ORPCError)
    })
  ]
});

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error, { context }) => {
      context.logger.set({ handler: "rpc" });
      context.logger.error(error instanceof Error ? error : String(error));
    })
  ],
  plugins: []
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c, logger: c.get("log") });

  // oRPC at /rpc/*
  const rpcResult = await rpcHandler.handle(c.req.raw, {
    context,
    prefix: join(new URL(ENV_SERVER.VITE_SERVER_URL).pathname, "rpc") as `/${string}`
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  // OpenAPI docs at /docs/*
  if (ENV_SERVER.ENABLE_OPEN_API_DOCS) {
    const docsResult = await openApiHandler.handle(c.req.raw, {
      context,
      prefix: join(new URL(ENV_SERVER.VITE_SERVER_URL).pathname, "docs") as `/${string}`
    });

    if (docsResult.matched) {
      return c.newResponse(docsResult.response.body, docsResult.response);
    }
  }

  // OpenAPI REST API at /*
  const openApiResult = await openApiHandler.handle(c.req.raw, {
    context,
    prefix: new URL(ENV_SERVER.VITE_SERVER_URL).pathname as `/${string}`
  });

  if (openApiResult.matched) {
    return c.newResponse(openApiResult.response.body, openApiResult.response);
  }

  await next();
});

void (async () => {
  await migrateDatabase();

  serve(
    {
      fetch: app.fetch,
      port: 5000
    },
    (info) => {
      log.info({
        event: "server_started",
        port: info.port,
        url: `http://localhost:${info.port}${new URL(ENV_SERVER.VITE_SERVER_URL).pathname}`
      });
    }
  );
})();
