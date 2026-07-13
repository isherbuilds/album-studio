import { describe, expect, it } from "vite-plus/test";
import { type z } from "zod";

import {
  MAX_OPTION_GROUP_KEY_LENGTH,
  MAX_OPTION_VALUE_ID_LENGTH,
  MAX_PRODUCT_OPTION_GROUPS,
  ProductDefinitionSchema
} from "@tsu-stack/contract/configuration";

function product(): z.input<typeof ProductDefinitionSchema> {
  return {
    id: "album",
    basePriceMinor: 100,
    groups: [
      {
        type: "single" as const,
        key: "cover",
        label: "Cover",
        required: true,
        values: [
          {
            id: "linen",
            label: "Linen",
            priceAdjustmentMinor: 0,
            requirements: [],
            componentIds: ["linen"]
          }
        ]
      },
      {
        type: "single" as const,
        key: "finish",
        label: "Finish",
        required: false,
        values: [
          {
            id: "foil",
            label: "Foil",
            priceAdjustmentMinor: 10,
            requirements: [{ groupKey: "cover", optionValueIds: ["linen"] }],
            componentIds: []
          }
        ]
      },
      {
        type: "number" as const,
        key: "pages",
        label: "Pages",
        required: true,
        minimum: 10,
        maximum: 20,
        included: 12,
        step: 2,
        additionalUnitPriceMinor: 5
      }
    ]
  };
}

function discrete(value: ReturnType<typeof product>, index: number) {
  const group = value.groups[index];
  if (group.type === "number") throw new Error("Expected discrete group fixture");
  return group;
}

function numeric(value: ReturnType<typeof product>) {
  const group = value.groups[2];
  if (group.type !== "number") throw new Error("Expected numeric group fixture");
  return group;
}

describe("ProductDefinitionSchema invariants", () => {
  it.each([
    [
      "duplicate group keys",
      (value: ReturnType<typeof product>) => (value.groups[1].key = "cover")
    ],
    [
      "duplicate value IDs",
      (value: ReturnType<typeof product>) =>
        discrete(value, 0).values.push({ ...discrete(value, 0).values[0] })
    ],
    [
      "duplicate component IDs",
      (value: ReturnType<typeof product>) => discrete(value, 0).values[0].componentIds.push("linen")
    ],
    [
      "duplicate requirement group IDs",
      (value: ReturnType<typeof product>) =>
        discrete(value, 1).values[0].requirements.push({
          groupKey: "cover",
          optionValueIds: ["linen"]
        })
    ],
    [
      "duplicate requirement value IDs",
      (value: ReturnType<typeof product>) =>
        discrete(value, 1).values[0].requirements[0].optionValueIds.push("linen")
    ],
    [
      "minimum above maximum",
      (value: ReturnType<typeof product>) => {
        numeric(value).minimum = 22;
      }
    ],
    [
      "included outside range",
      (value: ReturnType<typeof product>) => {
        numeric(value).included = 22;
      }
    ],
    [
      "maximum off step",
      (value: ReturnType<typeof product>) => {
        numeric(value).maximum = 21;
      }
    ],
    [
      "included off step",
      (value: ReturnType<typeof product>) => {
        numeric(value).included = 13;
      }
    ],
    [
      "zero step",
      (value: ReturnType<typeof product>) => {
        numeric(value).step = 0;
      }
    ],
    [
      "forward requirement reference",
      (value: ReturnType<typeof product>) =>
        discrete(value, 0).values[0].requirements.push({
          groupKey: "finish",
          optionValueIds: ["foil"]
        })
    ],
    [
      "unknown requirement group",
      (value: ReturnType<typeof product>) =>
        discrete(value, 1).values[0].requirements.push({
          groupKey: "missing",
          optionValueIds: ["value"]
        })
    ],
    [
      "unknown requirement value",
      (value: ReturnType<typeof product>) => {
        discrete(value, 1).values[0].requirements[0].optionValueIds = ["missing"];
      }
    ]
  ])("rejects %s", (_name, mutate) => {
    const value = product();
    mutate(value);
    expect(ProductDefinitionSchema.safeParse(value).success).toBe(false);
  });

  it.each([1, 3])("rejects boolean groups with %i values", (count) => {
    const value = product();
    value.groups.push({
      type: "boolean",
      key: "gift",
      label: "Gift",
      required: true,
      values: Array.from({ length: count }, (_, index) => {
        return {
          id: `value-${index}`,
          label: `Value ${index}`,
          priceAdjustmentMinor: 0,
          requirements: [],
          componentIds: []
        };
      })
    });
    expect(ProductDefinitionSchema.safeParse(value).success).toBe(false);
  });

  it("accepts a valid product definition", () => {
    expect(ProductDefinitionSchema.safeParse(product()).success).toBe(true);
  });

  it("rejects a negative numeric minimum", () => {
    const value = product();
    numeric(value).minimum = -2;
    expect(ProductDefinitionSchema.safeParse(value).success).toBe(false);
  });

  it("accepts Option Group and Value boundaries", () => {
    const groupCountValue = product();
    groupCountValue.groups = Array.from({ length: MAX_PRODUCT_OPTION_GROUPS }, (_, index) => {
      return {
        type: "number" as const,
        key: `group-${index}`,
        label: `Group ${index}`,
        required: true,
        minimum: 0,
        maximum: 1,
        included: 0,
        step: 1,
        additionalUnitPriceMinor: 0
      };
    });
    expect(ProductDefinitionSchema.safeParse(groupCountValue).success).toBe(true);

    const groupKeyValue = product();
    groupKeyValue.groups = [groupKeyValue.groups[2]];
    groupKeyValue.groups[0].key = "g".repeat(MAX_OPTION_GROUP_KEY_LENGTH);
    expect(ProductDefinitionSchema.safeParse(groupKeyValue).success).toBe(true);

    const optionValue = product();
    optionValue.groups = [optionValue.groups[0]];
    discrete(optionValue, 0).values[0].id = "v".repeat(MAX_OPTION_VALUE_ID_LENGTH);
    expect(ProductDefinitionSchema.safeParse(optionValue).success).toBe(true);
  });

  it("rejects too many Option Groups", () => {
    const value = product();
    value.groups = Array.from({ length: MAX_PRODUCT_OPTION_GROUPS + 1 }, (_, index) => {
      return {
        type: "number" as const,
        key: `group-${index}`,
        label: `Group ${index}`,
        required: true,
        minimum: 0,
        maximum: 1,
        included: 0,
        step: 1,
        additionalUnitPriceMinor: 0
      };
    });
    expect(ProductDefinitionSchema.safeParse(value).success).toBe(false);
  });

  it("rejects oversized Option Group keys", () => {
    const value = product();
    value.groups = [value.groups[2]];
    value.groups[0].key = "g".repeat(MAX_OPTION_GROUP_KEY_LENGTH + 1);
    expect(ProductDefinitionSchema.safeParse(value).success).toBe(false);
  });

  it("rejects oversized Option Value IDs", () => {
    const value = product();
    value.groups = [value.groups[0]];
    discrete(value, 0).values[0].id = "v".repeat(MAX_OPTION_VALUE_ID_LENGTH + 1);
    expect(ProductDefinitionSchema.safeParse(value).success).toBe(false);
  });
});
