import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { config } from "@dotenvx/dotenvx";

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

  execFileSync("pnpm", ["--dir", "apps/server", "run", "seed:demo-data"], {
    cwd: workspaceRoot,
    env,
    stdio: "inherit"
  });
}
