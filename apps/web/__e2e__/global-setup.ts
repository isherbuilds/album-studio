import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { config } from "@dotenvx/dotenvx";

export const E2E_PLATFORM_ADMIN_EMAIL = "platform-admin@album-studio.test";
export const E2E_PLATFORM_ADMIN_PASSWORD = "platform-admin-password-123";

export default function globalSetup(): void {
  const workspaceRoot = resolve(import.meta.dirname, "../../..");
  const envFile = resolve(workspaceRoot, "packages/env/.env");
  const { parsed } = config({ path: envFile, quiet: true });
  const env = { ...parsed, ...process.env };
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) throw new Error("DATABASE_URL is required for browser tests");

  const hostname = new URL(databaseUrl).hostname;
  const localHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];
  if (!localHosts.includes(hostname)) {
    throw new Error("Browser tests refuse to seed a non-local database");
  }

  execFileSync("pnpm", ["--dir", "apps/server", "run", "reset:e2e-data"], {
    cwd: workspaceRoot,
    env,
    stdio: "inherit"
  });
  execFileSync("pnpm", ["--dir", "apps/server", "run", "seed:demo-data"], {
    cwd: workspaceRoot,
    env,
    stdio: "inherit"
  });
  execFileSync("pnpm", ["--dir", "apps/server", "run", "seed:platform-admin"], {
    cwd: workspaceRoot,
    env: {
      ...env,
      SEED_ADMIN_EMAIL: E2E_PLATFORM_ADMIN_EMAIL,
      SEED_ADMIN_NAME: "Album Studio Platform Admin",
      SEED_ADMIN_PASSWORD: E2E_PLATFORM_ADMIN_PASSWORD
    },
    stdio: "inherit"
  });
}
