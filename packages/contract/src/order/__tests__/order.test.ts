import { describe, expect, it } from "vite-plus/test";

import {
  OrderDetailSchema,
  OrderPlaceInputSchema,
  OrderSnapshotSchema
} from "@tsu-stack/contract/order";

const snapshot = {
  product: { id: "product-1", name: "Wedding Album", slug: "wedding-album" },
  quantity: 2,
  projectName: "Maya & Arjun",
  selections: [
    {
      componentIds: ["linen-roll"],
      groupKey: "cover",
      groupLabel: "Cover",
      kind: "option",
      optionValueId: "linen",
      optionValueLabel: "Linen"
    },
    {
      groupKey: "pages",
      groupLabel: "Pages",
      kind: "number",
      selected: 28
    }
  ],
  perUnitBreakdown: [
    { kind: "base", amountMinor: 50_000 },
    {
      kind: "option",
      groupKey: "cover",
      optionValueId: "linen",
      amountMinor: 2_000
    },
    {
      kind: "number",
      groupKey: "pages",
      selected: 28,
      additionalUnits: 8,
      unitPriceMinor: 200,
      amountMinor: 1_600
    }
  ],
  perUnitTotal: { amountMinor: 53_600, currency: "INR" },
  orderTotal: { amountMinor: 107_200, currency: "INR" }
};

describe("Order contract", () => {
  it("parses placement acceptance and immutable configured Product snapshot", () => {
    expect(
      OrderPlaceInputSchema.parse({
        acceptedPrice: {
          orderTotal: snapshot.orderTotal,
          perUnitBreakdown: snapshot.perUnitBreakdown,
          perUnitTotal: snapshot.perUnitTotal
        },
        draftId: "draft-1",
        organizationSlug: "demo-studio"
      })
    ).toEqual({
      acceptedPrice: {
        orderTotal: snapshot.orderTotal,
        perUnitBreakdown: snapshot.perUnitBreakdown,
        perUnitTotal: snapshot.perUnitTotal
      },
      draftId: "draft-1",
      organizationSlug: "demo-studio"
    });
    expect(OrderSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("keeps mutable Order fields outside immutable snapshot", () => {
    const detail = OrderDetailSchema.parse({
      cancellationStatus: "none",
      createdAt: "2026-07-14T10:00:00.000Z",
      number: "AS-000001",
      projectName: "Corrected name",
      snapshot,
      status: "placed"
    });

    expect(detail.projectName).toBe("Corrected name");
    expect(detail.snapshot.projectName).toBe("Maya & Arjun");
  });
});
