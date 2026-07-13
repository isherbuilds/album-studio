import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV_WEB_ISOMORPHIC } from "@tsu-stack/env/web/env.isomorphic";

import { organizationAccessControl, organizationRoles } from "#@/access-control";

export const API_AUTH_URL = `${ENV_WEB_ISOMORPHIC.VITE_SERVER_URL}/auth`;

/**
 * IMPORTANT: Only use this for client-side operations (e.g. in React components or browser-only hooks).
 * It uses nanostores internally, which are not suitable for server-side usage due to lack of request isolation, leading to shared auth state.
 */
export const authClient = createAuthClient({
  baseURL: API_AUTH_URL,
  plugins: [
    adminClient(),
    organizationClient({
      ac: organizationAccessControl,
      roles: organizationRoles,
      schema: {
        organization: {
          additionalFields: {
            currency: { type: "string", input: true, required: true }
          }
        }
      }
    })
  ]
});

export type AuthSession = typeof authClient.$Infer.Session;
