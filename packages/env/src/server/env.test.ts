import { describe, expect, it } from "vite-plus/test";

import { betterAuthSecretSchema } from "#@/server/auth-secret";

describe("betterAuthSecretSchema", () => {
  it("rejects documented placeholder secrets", () => {
    expect(
      betterAuthSecretSchema.safeParse(
        "replace_me_run_pnpm_auth_secret_to_generate_a_real_value_here"
      ).success
    ).toBe(false);
    expect(betterAuthSecretSchema.safeParse("replace-with-at-least-32-characters").success).toBe(
      false
    );
  });

  it("accepts generated secrets", () => {
    expect(
      betterAuthSecretSchema.safeParse("S3cure-random-auth-secret-2026-07-16-x9Q!").success
    ).toBe(true);
  });
});
