import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1"]);

export default async function setup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for API tests");
  }

  const parsedDatabaseUrl = new URL(databaseUrl);
  if (!localDatabaseHosts.has(parsedDatabaseUrl.hostname)) {
    throw new Error("API tests refuse to use a non-local database");
  }

  const schema = `api_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  const adminClient = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
  await adminClient.unsafe(`create schema "${schema}"`);

  parsedDatabaseUrl.searchParams.set("options", `-c search_path=${schema},public`);
  const testDatabaseUrl = parsedDatabaseUrl.toString();
  process.env.DATABASE_URL = testDatabaseUrl;

  const migrationClient = postgres(testDatabaseUrl, { max: 1, onnotice: () => undefined });
  await migrate(drizzle({ client: migrationClient }), {
    migrationsFolder: resolve(import.meta.dirname, "../../../db/migrations"),
    migrationsSchema: schema
  });
  await migrationClient.end();

  return async () => {
    await adminClient.unsafe(`drop schema "${schema}" cascade`);
    await adminClient.end();
  };
}
