import { describe, expect, it } from "vite-plus/test";

import { createPaymentSummary } from "@tsu-stack/core/payment";

describe("createPaymentSummary", () => {
  it("marks zero-total Orders as paid", () => {
    expect(createPaymentSummary({ amountMinor: 0, currency: "USD" }, 0).state).toBe("paid");
  });

  it("rejects paid totals outside Order bounds", () => {
    expect(() => createPaymentSummary({ amountMinor: 100, currency: "USD" }, 101)).toThrow(
      "Paid amount is outside Order total"
    );
  });
});
