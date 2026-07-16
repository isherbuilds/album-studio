import { describe, expect, it } from "vite-plus/test";

import {
  ProductCreateInputSchema,
  ProductEditConfigurationInputSchema,
  ProductEditPricingInputSchema
} from "@tsu-stack/contract/product";

const organizationSlug = "album-studio";

const configurationInput = {
  expectedRevision: 1,
  groups: [
    {
      key: "cover",
      label: "Cover",
      required: true,
      type: "single" as const,
      values: [
        {
          componentIds: ["linen-component"],
          id: "linen",
          imageUrl: null,
          label: "Linen",
          requirements: []
        }
      ]
    },
    {
      included: 10,
      key: "sheets",
      label: "Sheets",
      maximum: 30,
      minimum: 10,
      required: true,
      step: 2,
      type: "number" as const
    }
  ],
  organizationSlug,
  productSlug: "signature-album"
};

describe("product editor contracts", () => {
  it("lets a Manager submit configuration without monetary fields", () => {
    expect(ProductEditConfigurationInputSchema.parse(configurationInput)).toEqual(
      configurationInput
    );
  });

  it("rejects monetary fields hidden inside Manager-accessible mutations", () => {
    expect(() =>
      ProductCreateInputSchema.parse({
        basePriceMinor: 10_000,
        description: null,
        imageUrls: [],
        name: "Signature album",
        organizationSlug,
        slug: "signature-album"
      })
    ).toThrow(/unrecognized key/i);

    expect(() =>
      ProductEditConfigurationInputSchema.parse({
        ...configurationInput,
        groups: [
          {
            ...configurationInput.groups[0],
            values: [
              {
                ...configurationInput.groups[0]?.values?.[0],
                priceAdjustmentMinor: 500
              }
            ]
          }
        ]
      })
    ).toThrow(/unrecognized key/i);

    expect(() =>
      ProductEditConfigurationInputSchema.parse({
        ...configurationInput,
        groups: [
          {
            ...configurationInput.groups[1],
            additionalUnitPriceMinor: 100
          }
        ]
      })
    ).toThrow(/unrecognized key/i);
  });

  it("rejects duplicate product images", () => {
    expect(() =>
      ProductCreateInputSchema.parse({
        description: null,
        imageUrls: ["https://example.com/cover.jpg", "https://example.com/cover.jpg"],
        name: "Signature album",
        organizationSlug,
        slug: "signature-album"
      })
    ).toThrow(/unique/i);
  });

  it("permits an incomplete discrete draft while enforcing stable editor identity", () => {
    const incomplete = ProductEditConfigurationInputSchema.parse({
      ...configurationInput,
      groups: [{ ...configurationInput.groups[0], values: [] }]
    });
    expect(incomplete.groups[0]).toMatchObject({ key: "cover", values: [] });

    expect(() =>
      ProductEditConfigurationInputSchema.parse({
        ...configurationInput,
        groups: [
          configurationInput.groups[0],
          {
            key: "lining",
            label: "Lining",
            required: false,
            type: "single",
            values: [
              {
                componentIds: [],
                id: "linen",
                imageUrl: null,
                label: "Linen lining",
                requirements: []
              }
            ]
          }
        ]
      })
    ).toThrow(/unique/i);
  });

  it("only permits requirements that target values in earlier groups", () => {
    expect(() =>
      ProductEditConfigurationInputSchema.parse({
        ...configurationInput,
        groups: [
          {
            key: "finish",
            label: "Finish",
            required: false,
            type: "single",
            values: [
              {
                componentIds: [],
                id: "foil",
                imageUrl: null,
                label: "Foil",
                requirements: [{ groupKey: "cover", optionValueIds: ["linen"] }]
              }
            ]
          },
          configurationInput.groups[0]
        ]
      })
    ).toThrow(/earlier group/i);
  });

  it("accepts a complete Owner pricing snapshot with unique targets", () => {
    expect(
      ProductEditPricingInputSchema.parse({
        basePriceMinor: 10_000,
        expectedRevision: 2,
        numericGroupPrices: [{ additionalUnitPriceMinor: 250, groupKey: "sheets" }],
        optionValuePrices: [{ optionValueId: "linen", priceAdjustmentMinor: 0 }],
        organizationSlug,
        productSlug: "signature-album"
      })
    ).toMatchObject({ basePriceMinor: 10_000 });

    expect(() =>
      ProductEditPricingInputSchema.parse({
        basePriceMinor: 10_000,
        expectedRevision: 2,
        numericGroupPrices: [],
        optionValuePrices: [
          { optionValueId: "linen", priceAdjustmentMinor: 0 },
          { optionValueId: "linen", priceAdjustmentMinor: 500 }
        ],
        organizationSlug,
        productSlug: "signature-album"
      })
    ).toThrow(/unique/i);
  });
});
