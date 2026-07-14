import { describe, expect, it } from "vite-plus/test";

import { computeEffectiveAvailability } from "@tsu-stack/core/inventory";

describe("inventory effective availability", () => {
  describe("override precedence", () => {
    it("returns an explicit `available` override verbatim even when quantity would say out", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "0",
          lowStockThreshold: "5",
          availabilityOverride: "available"
        })
      ).toBe("available");
    });

    it("returns an explicit `low` override verbatim even when quantity would say available", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "1000",
          lowStockThreshold: "5",
          availabilityOverride: "low"
        })
      ).toBe("low");
    });

    it("returns an explicit `out` override verbatim even when quantity would say available", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "1000",
          lowStockThreshold: "5",
          availabilityOverride: "out"
        })
      ).toBe("out");
    });
  });

  describe("automatic derivation", () => {
    it("derives `out` when quantity is zero", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "0",
          lowStockThreshold: "5",
          availabilityOverride: "automatic"
        })
      ).toBe("out");
    });

    it("derives `out` when quantity is negative", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "-3",
          lowStockThreshold: "5",
          availabilityOverride: "automatic"
        })
      ).toBe("out");
    });

    it("derives `low` when quantity equals the threshold", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "5",
          lowStockThreshold: "5",
          availabilityOverride: "automatic"
        })
      ).toBe("low");
    });

    it("derives `low` when quantity is below the threshold but above zero", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "2",
          lowStockThreshold: "5",
          availabilityOverride: "automatic"
        })
      ).toBe("low");
    });

    it("derives `available` when quantity is one above the threshold", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "6",
          lowStockThreshold: "5",
          availabilityOverride: "automatic"
        })
      ).toBe("available");
    });

    it("derives `available` when the threshold is zero and quantity is positive", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "1",
          lowStockThreshold: "0",
          availabilityOverride: "automatic"
        })
      ).toBe("available");
    });

    it("honours fractional numeric strings at the boundary", () => {
      expect(
        computeEffectiveAvailability({
          quantity: "5.0001",
          lowStockThreshold: "5",
          availabilityOverride: "automatic"
        })
      ).toBe("available");
    });
  });
});
