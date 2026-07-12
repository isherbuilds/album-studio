import { describe, expect, it } from "vite-plus/test";

import {
  ConfigurationEvaluationSchema,
  CurrencyCodeSchema,
  type EvaluateConfigurationInput,
  type ProductDefinition,
  ProductDefinitionSchema
} from "@tsu-stack/contract/configuration";
import { evaluateConfiguration } from "@tsu-stack/core/configuration";

function createProduct(): ProductDefinition {
  return ProductDefinitionSchema.parse({
    id: "album",
    basePriceMinor: 10_000,
    groups: [
      {
        type: "single",
        key: "cover",
        label: "Cover",
        required: true,
        values: [
          {
            id: "linen",
            label: "Linen",
            priceAdjustmentMinor: 0,
            requirements: [],
            componentIds: ["linen-material"]
          },
          {
            id: "leather",
            label: "Leather",
            priceAdjustmentMinor: 2_500,
            requirements: [],
            componentIds: ["leather-material"]
          },
          {
            id: "acrylic",
            label: "Acrylic",
            priceAdjustmentMinor: 1_500,
            requirements: [],
            componentIds: ["acrylic-material"]
          }
        ]
      },
      {
        type: "single",
        key: "size",
        label: "Size",
        required: true,
        values: [
          {
            id: "small",
            label: "Small",
            priceAdjustmentMinor: 0,
            requirements: [],
            componentIds: []
          },
          {
            id: "large",
            label: "Large",
            priceAdjustmentMinor: 3_000,
            requirements: [],
            componentIds: []
          }
        ]
      },
      {
        type: "single",
        key: "finish",
        label: "Finish",
        required: false,
        values: [
          {
            id: "foil",
            label: "Foil",
            priceAdjustmentMinor: 500,
            requirements: [
              { groupKey: "cover", optionValueIds: ["linen", "leather"] },
              { groupKey: "size", optionValueIds: ["large"] }
            ],
            componentIds: ["foil-material", "adhesive-material"]
          }
        ]
      },
      {
        type: "number",
        key: "sheets",
        label: "Sheets",
        required: true,
        minimum: 10,
        maximum: 40,
        step: 2,
        included: 20,
        additionalUnitPriceMinor: 250
      }
    ]
  });
}

function createInput(): EvaluateConfigurationInput {
  return {
    product: createProduct(),
    selections: {
      cover: "linen",
      size: "large",
      finish: "foil",
      sheets: 24
    },
    quantity: 3,
    availability: {
      "linen-material": "available",
      "leather-material": "available",
      "acrylic-material": "available",
      "foil-material": "available",
      "adhesive-material": "available"
    },
    currency: CurrencyCodeSchema.parse("USD")
  };
}

describe("evaluateConfiguration", () => {
  describe("integer-money pricing", () => {
    it("returns per-unit breakdown and Order total for a valid configuration", () => {
      const result = evaluateConfiguration(createInput());

      expect(result.status).toBe("valid");
      if (result.status !== "valid") return;

      expect(result.normalizedSelections).toEqual({
        cover: "linen",
        size: "large",
        finish: "foil",
        sheets: 24
      });
      expect(result.perUnitBreakdown).toEqual([
        { kind: "base", amountMinor: 10_000 },
        {
          kind: "option",
          groupKey: "cover",
          optionValueId: "linen",
          amountMinor: 0
        },
        {
          kind: "option",
          groupKey: "size",
          optionValueId: "large",
          amountMinor: 3_000
        },
        {
          kind: "option",
          groupKey: "finish",
          optionValueId: "foil",
          amountMinor: 500
        },
        {
          kind: "number",
          groupKey: "sheets",
          selected: 24,
          additionalUnits: 4,
          unitPriceMinor: 250,
          amountMinor: 1_000
        }
      ]);
      expect(result.perUnitTotal).toEqual({ amountMinor: 14_500, currency: "USD" });
      expect(result.orderTotal).toEqual({ amountMinor: 43_500, currency: "USD" });
    });

    it.each([
      {
        name: "keeps zero-cost Option Value in breakdown",
        sheets: 20,
        expectedAdditionalUnits: 0,
        expectedNumericAmount: 0,
        expectedPerUnitTotal: 10_000
      },
      {
        name: "does not charge numeric units included in base price",
        sheets: 18,
        expectedAdditionalUnits: 0,
        expectedNumericAmount: 0,
        expectedPerUnitTotal: 10_000
      },
      {
        name: "charges each numeric unit above included quantity",
        sheets: 24,
        expectedAdditionalUnits: 4,
        expectedNumericAmount: 1_000,
        expectedPerUnitTotal: 11_000
      }
    ])(
      "$name",
      ({ sheets, expectedAdditionalUnits, expectedNumericAmount, expectedPerUnitTotal }) => {
        const input = createInput();
        input.selections = { cover: "linen", size: "small", sheets };
        input.quantity = 1;

        const result = evaluateConfiguration(input);

        expect(result.status).toBe("valid");
        if (result.status !== "valid") return;

        expect(result.perUnitBreakdown).toContainEqual({
          kind: "option",
          groupKey: "cover",
          optionValueId: "linen",
          amountMinor: 0
        });
        expect(result.perUnitBreakdown).toContainEqual({
          kind: "number",
          groupKey: "sheets",
          selected: sheets,
          additionalUnits: expectedAdditionalUnits,
          unitPriceMinor: 250,
          amountMinor: expectedNumericAmount
        });
        expect(result.perUnitTotal.amountMinor).toBe(expectedPerUnitTotal);
      }
    );

    it("prices a selected boolean group as a fixed adjustment", () => {
      const input = createInput();
      input.product.groups.push({
        type: "boolean",
        key: "gift-box",
        label: "Gift box",
        required: true,
        values: [
          {
            id: "yes",
            label: "Yes",
            priceAdjustmentMinor: 750,
            requirements: [],
            componentIds: []
          },
          {
            id: "no",
            label: "No",
            priceAdjustmentMinor: 0,
            requirements: [],
            componentIds: []
          }
        ]
      });
      input.selections["gift-box"] = "yes";

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("valid");
      if (result.status !== "valid") return;

      expect(result.perUnitBreakdown).toContainEqual({
        kind: "option",
        groupKey: "gift-box",
        optionValueId: "yes",
        amountMinor: 750
      });
      expect(result.perUnitTotal.amountMinor).toBe(15_250);
    });
  });

  describe("discrete selection issues", () => {
    it("reports a missing required discrete selection", () => {
      const input = createInput();
      delete input.selections.cover;

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "missing_selection",
          location: { kind: "group", groupKey: "cover" }
        })
      );
    });

    it.each([
      {
        name: "reports unknown selection group",
        configure: (input: EvaluateConfigurationInput) => {
          input.selections.unknown = "value";
        },
        issueCode: "unknown_group",
        groupKey: "unknown"
      },
      {
        name: "reports unknown Option Value",
        configure: (input: EvaluateConfigurationInput) => {
          input.selections.cover = "velvet";
        },
        issueCode: "unknown_selection",
        groupKey: "cover"
      },
      {
        name: "reports wrong discrete selection type",
        configure: (input: EvaluateConfigurationInput) => {
          input.selections.cover = 123;
        },
        issueCode: "invalid_selection_type",
        groupKey: "cover"
      }
    ] as const)("$name", ({ configure, issueCode, groupKey }) => {
      const input = createInput();
      configure(input);

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: issueCode,
          location: { kind: "group", groupKey }
        })
      );
    });
  });

  describe("numeric selections and quantity", () => {
    it.each([
      {
        name: "reports missing required numeric selection",
        sheets: undefined,
        issueCode: "missing_selection"
      },
      {
        name: "rejects number below configured range",
        sheets: 8,
        issueCode: "number_out_of_range"
      },
      {
        name: "rejects number above configured range",
        sheets: 42,
        issueCode: "number_out_of_range"
      },
      {
        name: "rejects number outside configured step",
        sheets: 11,
        issueCode: "number_step_mismatch"
      }
    ] as const)("$name", ({ sheets, issueCode }) => {
      const input = createInput();
      if (sheets === undefined) {
        delete input.selections.sheets;
      } else {
        input.selections.sheets = sheets;
      }

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: issueCode,
          location: { kind: "group", groupKey: "sheets" }
        })
      );
    });

    it.each([
      { name: "NaN", sheets: Number.NaN },
      { name: "positive infinity", sheets: Number.POSITIVE_INFINITY },
      { name: "negative infinity", sheets: Number.NEGATIVE_INFINITY }
    ])("returns schema-valid issue result for $name numeric selection", ({ sheets }) => {
      const input = createInput();
      input.selections.sheets = sheets;

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "invalid_selection_type",
          location: { kind: "group", groupKey: "sheets" }
        })
      );
      expect(() => ConfigurationEvaluationSchema.parse(result)).not.toThrow();
    });

    it.each([
      { name: "accepts minimum Order quantity", quantity: 1, valid: true },
      { name: "rejects zero Order quantity", quantity: 0, valid: false },
      { name: "rejects negative Order quantity", quantity: -1, valid: false },
      { name: "rejects fractional Order quantity", quantity: 1.5, valid: false }
    ])("$name", ({ quantity, valid }) => {
      const input = createInput();
      input.quantity = quantity;

      const result = evaluateConfiguration(input);

      expect(result.status).toBe(valid ? "valid" : "invalid");
      if (valid || result.status !== "invalid") return;

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "quantity_invalid",
          location: { kind: "quantity" }
        })
      );
    });
  });

  describe("requirements and normalization", () => {
    it.each([
      ["unknown group", "unknown", "value"],
      ["unknown Option Value", "cover", "velvet"],
      ["wrong discrete type", "cover", 123],
      ["wrong numeric type", "sheets", "24"]
    ])("removes %s from normalized selections", (_name, key, selection) => {
      const input = createInput();
      input.selections[key] = selection;
      const result = evaluateConfiguration(input);
      expect(result.normalizedSelections).not.toHaveProperty(key);
    });

    it.each([8, 11])("keeps correctable invalid numeric value %i", (selection) => {
      const input = createInput();
      input.selections.sheets = selection;
      expect(evaluateConfiguration(input).normalizedSelections.sheets).toBe(selection);
    });

    it.each([
      { name: "accepts first OR requirement", cover: "linen" },
      { name: "accepts second OR requirement", cover: "leather" }
    ])("$name", ({ cover }) => {
      const input = createInput();
      input.selections.cover = cover;

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("valid");
      expect(result.normalizedSelections.finish).toBe("foil");
    });

    it("requires matches across every prerequisite group", () => {
      const input = createInput();
      input.selections.size = "small";

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.normalizedSelections).not.toHaveProperty("finish");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "selection_invalidated",
          location: { kind: "group", groupKey: "finish" }
        })
      );
    });

    it("clears a later selection invalidated by an earlier selection", () => {
      const input = createInput();
      input.selections.cover = "acrylic";

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.normalizedSelections).toMatchObject({
        cover: "acrylic",
        size: "large",
        sheets: 24
      });
      expect(result.normalizedSelections).not.toHaveProperty("finish");
      expect(result.disabledExplanations).toContainEqual(
        expect.objectContaining({
          groupKey: "finish",
          optionValueId: "foil",
          reasons: expect.arrayContaining([expect.objectContaining({ code: "requirement_unmet" })])
        })
      );
    });
  });

  describe("Component availability", () => {
    it("throws for missing authoritative availability on an unselected value", () => {
      const input = createInput();
      delete input.availability["acrylic-material"];
      expect(() => evaluateConfiguration(input)).toThrow(Error);
    });

    it("clears selected value when linked Component is out", () => {
      const input = createInput();
      input.selections.cover = "leather";
      input.availability["leather-material"] = "out";

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.normalizedSelections).not.toHaveProperty("cover");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "component_unavailable",
          location: { kind: "group", groupKey: "cover" }
        })
      );
      expect(result.disabledExplanations).toContainEqual(
        expect.objectContaining({
          groupKey: "cover",
          optionValueId: "leather",
          reasons: expect.arrayContaining([
            expect.objectContaining({ code: "component_unavailable" })
          ])
        })
      );
    });

    it("keeps low linked Component orderable", () => {
      const input = createInput();
      input.selections.cover = "leather";
      input.availability["leather-material"] = "low";

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("valid");
      expect(result.normalizedSelections.cover).toBe("leather");
    });

    it("throws when a Component named like a prototype property lacks availability", () => {
      const input = createInput();
      const cover = input.product.groups[0];
      if (cover.type === "number") throw new Error("Expected discrete cover group");
      cover.values[0].componentIds = ["toString"];

      expect(() => evaluateConfiguration(input)).toThrow(/Missing availability/);
    });
  });

  describe("safe integer arithmetic", () => {
    it.each([
      {
        name: "rejects per-unit addition overflow",
        configure: (input: EvaluateConfigurationInput) => {
          input.product.basePriceMinor = Number.MAX_SAFE_INTEGER;
          input.selections = { cover: "leather", size: "small", sheets: 20 };
          input.quantity = 1;
        },
        location: { kind: "group", groupKey: "cover" }
      },
      {
        name: "rejects Order-total multiplication overflow",
        configure: (input: EvaluateConfigurationInput) => {
          input.product.basePriceMinor = Number.MAX_SAFE_INTEGER;
          input.selections = { cover: "linen", size: "small", sheets: 20 };
          input.quantity = 2;
        },
        location: { kind: "quantity" }
      }
    ])("$name", ({ configure, location }) => {
      const input = createInput();
      configure(input);

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "money_overflow", location })
      );
    });

    it("rejects number-price multiplication overflow before summation", () => {
      const input = createInput();
      const sheets = input.product.groups.find((group) => group.key === "sheets");
      if (!sheets || sheets.type !== "number") throw new Error("Expected numeric sheets group");
      sheets.additionalUnitPriceMinor = Number.MAX_SAFE_INTEGER;

      const result = evaluateConfiguration(input);

      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "money_overflow",
          location: { kind: "group", groupKey: "sheets" },
          params: { operation: "number_price" }
        })
      );
    });
  });

  it("returns identical output for equivalent input insertion order", () => {
    const first = createInput();
    first.selections = { cover: "acrylic", size: "small", finish: "foil", sheets: 24 };
    first.availability["foil-material"] = "out";
    first.availability["adhesive-material"] = "out";

    const second = createInput();
    second.selections = { sheets: 24, finish: "foil", size: "small", cover: "acrylic" };
    second.availability = {
      "adhesive-material": "out",
      "foil-material": "out",
      "acrylic-material": "available",
      "leather-material": "available",
      "linen-material": "available"
    };
    const finishGroup = second.product.groups.find((group) => group.key === "finish");
    if (!finishGroup || finishGroup.type === "number") {
      throw new Error("Expected discrete finish group");
    }
    const foilValue = finishGroup.values.find((value) => value.id === "foil");
    if (!foilValue) throw new Error("Expected foil Option Value");
    foilValue.requirements.reverse();
    foilValue.componentIds.reverse();

    expect(evaluateConfiguration(second)).toEqual(evaluateConfiguration(first));
  });

  it.each([
    { name: "valid result", quantity: 3 },
    { name: "invalid result", quantity: 0 }
  ])("returns $name matching public evaluation schema", ({ quantity }) => {
    const input = createInput();
    input.quantity = quantity;

    expect(() => ConfigurationEvaluationSchema.parse(evaluateConfiguration(input))).not.toThrow();
  });

  it.each(["usd", "ZZZ"])("rejects invalid ISO 4217 currency %s", (currency) => {
    expect(CurrencyCodeSchema.safeParse(currency).success).toBe(false);
  });
});
