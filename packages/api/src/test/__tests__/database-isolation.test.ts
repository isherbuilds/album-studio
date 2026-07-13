import { sql } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import { db } from "@tsu-stack/db";

describe("API test database", () => {
  it("runs inside an ephemeral schema", async () => {
    const [row] = await db.execute<{ schema: string }>(sql`select current_schema() as schema`);

    expect(row?.schema).toMatch(/^api_test_[a-z0-9_]+$/);
  });
});
