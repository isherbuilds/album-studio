import { CurrencyCodeSchema } from "@tsu-stack/contract/configuration";

export const organizationAdditionalFields = {
  currency: {
    type: "string",
    input: true,
    required: true,
    validator: { input: CurrencyCodeSchema, output: CurrencyCodeSchema }
  }
} as const;
