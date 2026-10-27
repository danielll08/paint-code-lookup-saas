import { describe, expect, it } from "vitest";
import { resolveApproximateColor } from "./color-swatch";

describe("resolveApproximateColor", () => {
  it("resolves black and dark shades", () => {
    expect(resolveApproximateColor("Mythos Black Metallic", "Black")).toEqual({
      hex: "#17181c",
      isLight: false,
    });
  });

  it("resolves white and marks it light", () => {
    expect(resolveApproximateColor("Alpine White", "White")).toEqual({
      hex: "#f4f5f7",
      isLight: true,
    });
  });

  it("resolves red and blue tones", () => {
    expect(resolveApproximateColor("Misano Red", "Red")).toEqual({
      hex: "#dc2626",
      isLight: false,
    });
    expect(resolveApproximateColor("Deep Sea Blue", "Blue")).toEqual({
      hex: "#2563eb",
      isLight: false,
    });
  });

  it("falls back to default dark slate when no match found", () => {
    expect(resolveApproximateColor(null, null)).toEqual({
      hex: "#334155",
      isLight: false,
    });
  });
});
