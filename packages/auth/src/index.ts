import { join } from "node:path/posix";

import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import "@tanstack/react-start/server-only";
import { betterAuth } from "better-auth";
import { isAPIError } from "better-auth/api";
import { openAPI } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";

import { ORGANIZATION_INVITATION_TTL_SECONDS } from "@tsu-stack/contract/organization";
import { db } from "@tsu-stack/db";
import * as schema from "@tsu-stack/db/schema";
import { ENV_SERVER } from "@tsu-stack/env/server/env";

import { organizationAccessControl, organizationRoles } from "#@/access-control";

export const auth = betterAuth({
  baseURL: new URL(ENV_SERVER.VITE_SERVER_URL).origin,
  basePath: join(new URL(ENV_SERVER.VITE_SERVER_URL).pathname, "auth"),
  trustedOrigins: [new URL(ENV_SERVER.VITE_WEB_URL).origin],
  secret: ENV_SERVER.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema
  }),

  // https://www.better-auth.com/docs/concepts/session-management#session-caching
  session: {
    cookieCache: {
      enabled: true,
      // TODO(mvp-hardening): A revoked session can retain access for this cache window.
      // The trusted-enterprise-admin MVP accepts that trade-off; require fresh sessions
      // for privileged organization mutations before broadening the operator model.
      maxAge: 5 * 60 // 5 minutes
    }
  },

  // https://www.better-auth.com/docs/authentication/email-password
  emailAndPassword: {
    disableSignUp: true,
    enabled: true
  },

  experimental: {
    // https://www.better-auth.com/docs/adapters/drizzle#joins-experimental
    joins: true
  },

  plugins: [
    admin(),
    organization({
      ac: organizationAccessControl,
      allowUserToCreateOrganization: false,
      disableOrganizationDeletion: true,
      invitationExpiresIn: ORGANIZATION_INVITATION_TTL_SECONDS,
      roles: organizationRoles
    }),
    openAPI({
      theme: "deepSpace"
    })
  ],

  telemetry: {
    enabled: false
  }
});

export type AuthSession = typeof auth.$Infer.Session;

export { isAPIError };
