import { describe, expect, it } from "vitest";
import { zonesFromHint } from "./code-location-diagram";

describe("zonesFromHint", () => {
  it("maps provider hints to the areas of the car", () => {
    expect(zonesFromHint("Plate under the bonnet on the front strut tower, or on the driver's door pillar.")).toEqual(["door", "engine"]);
    expect(zonesFromHint("Sticker in the spare wheel well (boot floor) and in the service book.")).toEqual(["boot"]);
    expect(zonesFromHint("Sticker on the driver's door shut.")).toEqual(["door"]);
  });

  it("returns nothing when the hint names no known area", () => {
    expect(zonesFromHint("Check the service book.")).toEqual([]);
    expect(zonesFromHint(null)).toEqual([]);
  });
});
