import { z } from "zod";

const PLACEHOLDER_SECRET_PATTERN = /(?:change[_-]?me|replace)/i;

export const betterAuthSecretSchema = z
  .string()
  .min(32)
  .refine((secret) => !PLACEHOLDER_SECRET_PATTERN.test(secret), {
    message: "BETTER_AUTH_SECRET must be generated, not a placeholder"
  });
