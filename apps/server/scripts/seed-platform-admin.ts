import process from "node:process";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@tsu-stack/auth/index";
import { db } from "@tsu-stack/db";
import { user } from "@tsu-stack/db/schema";

const input = z
  .object({
    SEED_ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
    SEED_ADMIN_NAME: z.string().trim().min(2).max(120),
    SEED_ADMIN_PASSWORD: z.string().min(8).max(128)
  })
  .parse(process.env);

const existing = await db
  .select({ id: user.id, role: user.role })
  .from(user)
  .where(eq(user.email, input.SEED_ADMIN_EMAIL))
  .limit(1);

if (existing.length > 0) {
  process.stdout.write(
    "Platform Admin seed skipped: the email already exists and was not changed.\n"
  );
  process.exit(0);
}

try {
  await auth.api.createUser({
    body: {
      email: input.SEED_ADMIN_EMAIL,
      name: input.SEED_ADMIN_NAME,
      password: input.SEED_ADMIN_PASSWORD,
      role: "admin"
    }
  });
} catch (error) {
  const raced = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.SEED_ADMIN_EMAIL))
    .limit(1);
  if (raced.length === 0) throw error;

  process.stdout.write(
    "Platform Admin seed skipped: the email already exists and was not changed.\n"
  );
  process.exit(0);
}

process.stdout.write("Platform Admin created.\n");
process.exit(0);
