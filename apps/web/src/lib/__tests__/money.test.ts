import { describe, expect, it } from "vite-plus/test";

import { parseMajorAmount } from "@/lib/money";

describe("parseMajorAmount", () => {
  it("parses locale decimal separators into minor units", () => {
    expect(parseMajorAmount("12.34", "USD", "en-US")).toBe(1234);
    expect(parseMajorAmount("12,34", "EUR", "de-DE")).toBe(1234);
    expect(parseMajorAmount("1,234.56", "USD", "en-US")).toBe(123_456);
    expect(parseMajorAmount("1,23,456.78", "INR", "te-IN")).toBe(12_345_678);
    expect(parseMajorAmount("123", "JPY", "ja-JP")).toBe(123);
  });

  it("rejects invalid precision and non-positive amounts", () => {
    expect(parseMajorAmount("12,345", "EUR", "de-DE")).toBeUndefined();
    expect(parseMajorAmount("0", "USD", "en-US", { minimumMinor: 1 })).toBeUndefined();
    expect(parseMajorAmount("0", "USD", "en-US")).toBe(0);
    expect(parseMajorAmount("1.5", "JPY", "ja-JP")).toBeUndefined();
    expect(parseMajorAmount("999999999999999999", "USD", "en-US")).toBeUndefined();
  });
});
