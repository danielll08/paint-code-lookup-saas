import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";
import { formatVrm, maskVin, normalizeVrm, parseVehicleIdentifier } from "./vrm";

describe("normalizeVrm", () => {
  it("removes spaces and uppercases (PRD 2.3 step 1)", () => {
    expect(normalizeVrm("ab12 cde")).toBe("AB12CDE");
    expect(normalizeVrm(" ab-12.cde ")).toBe("AB12CDE");
  });
});

describe("parseVehicleIdentifier", () => {
  it("accepts UK registrations", () => {
    expect(parseVehicleIdentifier("AB12 CDE")).toEqual({ kind: "VRM", value: "AB12CDE" });
    expect(parseVehicleIdentifier("A1")).toEqual({ kind: "VRM", value: "A1" });
  });

  it("accepts 17-character VINs and rejects I/O/Q", () => {
    expect(parseVehicleIdentifier("WAUZZZ8K9BA123456")).toEqual({ kind: "VIN", value: "WAUZZZ8K9BA123456" });
    expect(parseVehicleIdentifier("WAUZZZ8K9BA12345O")).toBeNull();
  });

  it("rejects junk", () => {
    expect(parseVehicleIdentifier("")).toBeNull();
    expect(parseVehicleIdentifier("ABCDEFG")).toBeNull(); // no digit
    expect(parseVehicleIdentifier("123456")).toBeNull(); // no letter
    expect(parseVehicleIdentifier("AB12CDEFGH")).toBeNull(); // too long for a plate
  });
});

describe("formatting", () => {
  it("formats current-style plates with a space", () => {
    expect(formatVrm("AB12CDE")).toBe("AB12 CDE");
    expect(formatVrm("A1")).toBe("A1");
  });

  it("masks the middle of the VIN", () => {
    expect(maskVin("WAUZZZ8K9BA123456")).toBe("WAU**********3456");
    expect(maskVin(null)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("only allows same-origin relative paths", () => {
    expect(safeNextPath("/dashboard/billing")).toBe("/dashboard/billing");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});
