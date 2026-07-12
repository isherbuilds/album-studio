import { type AuthSession } from "@tsu-stack/auth/index";
import { type Database } from "@tsu-stack/db";
import { type RequestLogger } from "@tsu-stack/logger/server";

/**
 * Request-scoped values every procedure receives. Deliberately narrow:
 * - `authSession`: Better Auth identity + session (null until authenticated).
 * - `db`: Drizzle client for reads and transactions (injectable in tests).
 * - `headers`: raw request headers for auth re-reads and transport concerns.
 * - `logger`: request-scoped logger; handlers stay silent, global error
 *   interceptors record unexpected failures once.
 *
 * Organization-scoped procedures additionally expose `organization` and `role`
 * via `organizationProcedure`; they are added by middleware, not the base context.
 */
export type OrpcContext = {
  authSession: AuthSession | null;
  db: Database;
  headers: Headers;
  logger: RequestLogger;
};
