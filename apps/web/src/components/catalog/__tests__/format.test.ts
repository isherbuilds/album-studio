import { describe, expect, it } from "vite-plus/test";

import { parseMajorAmount } from "@/components/catalog/format";

describe("parseMajorAmount", () => {
  it("parses locale decimal separators into minor units", () => {
    expect(parseMajorAmount("12.34", 2, "en-US")).toBe(1234);
    expect(parseMajorAmount("12,34", 2, "de-DE")).toBe(1234);
  });

  it("rejects invalid precision and non-positive amounts", () => {
    expect(parseMajorAmount("12,345", 2, "de-DE")).toBeUndefined();
    expect(parseMajorAmount("0", 2, "en-US")).toBeUndefined();
  });
});
