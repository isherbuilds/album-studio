import { describe, expect, it } from "vite-plus/test";

import { ProductDefinitionSchema } from "@tsu-stack/contract/configuration";

import { normalizeConfigurationDraftStep } from "#@/draft/index";

const product = ProductDefinitionSchema.parse({
  basePriceMinor: 1_000,
  groups: [
    {
      key: "cover",
      label: "Cover",
      required: false,
      type: "single",
      values: [
        {
          componentIds: [],
          id: "linen",
          label: "Linen",
          priceAdjustmentMinor: 0,
          requirements: []
        }
      ]
    }
  ],
  id: "album"
});

describe("normalizeConfigurationDraftStep", () => {
  it("preserves current group, review, and summary steps", () => {
    expect(normalizeConfigurationDraftStep({ kind: "group", groupKey: "cover" }, product)).toEqual({
      kind: "group",
      groupKey: "cover"
    });
    expect(normalizeConfigurationDraftStep({ kind: "review" }, product)).toEqual({
      kind: "review"
    });
    expect(normalizeConfigurationDraftStep({ kind: "summary" }, product)).toEqual({
      kind: "summary"
    });
  });

  it("moves a removed group to the first current group", () => {
    expect(
      normalizeConfigurationDraftStep({ kind: "group", groupKey: "removed" }, product)
    ).toEqual({ kind: "group", groupKey: "cover" });
  });

  it("moves a removed group to review when Product has no groups", () => {
    const emptyProduct = ProductDefinitionSchema.parse({
      basePriceMinor: 1_000,
      groups: [],
      id: "simple-print"
    });
    expect(
      normalizeConfigurationDraftStep({ kind: "group", groupKey: "removed" }, emptyProduct)
    ).toEqual({ kind: "review" });
  });
});
