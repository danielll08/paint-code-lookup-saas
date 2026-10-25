import { describe, expect, it } from "vitest";
import { lookupWithFailover } from "./failover";
import { MockPaintProvider } from "./providers/mock";
import { notFound, PaintApiError, type PaintApiAdapter, type StandardizedVehiclePaintData } from "./types";

const primary = new MockPaintProvider({ name: "mock-primary", role: "primary", latencyMs: 1 });
const backup = new MockPaintProvider({ name: "mock-backup", role: "backup", latencyMs: 1 });
const signal = new AbortController().signal;

function fake(name: string, impl: (vrm: string) => Promise<StandardizedVehiclePaintData>): PaintApiAdapter & { calls: number } {
  const adapter = {
    name,
    calls: 0,
    lookupByVrm(vrm: string) {
      adapter.calls++;
      return impl(vrm);
    },
  };
  return adapter;
}

const withPaint = (vrm: string, providerName: string): StandardizedVehiclePaintData => ({
  found: true,
  vrm,
  make: "Audi",
  model: "A4",
  year: 2019,
  registeredColor: "Black",
  paintCode: "LY9T",
  paintDescription: "Mythos Black Metallic",
  providerName,
});

describe("MockPaintProvider scenarios", () => {
  it("returns a deterministic paint code for normal plates", async () => {
    const a = await primary.lookupByVrm("AB12CDE", { signal });
    const b = await primary.lookupByVrm("AB12CDE", { signal });
    expect(a.found).toBe(true);
    expect(a.paintCode).toBeTruthy();
    expect(a).toEqual(b);
  });

  it("simulates not found, missing paint code and provider errors", async () => {
    expect((await primary.lookupByVrm("NF12ABC", { signal })).found).toBe(false);
    const partial = await primary.lookupByVrm("NP12ABC", { signal });
    expect(partial.found).toBe(true);
    expect(partial.paintCode).toBeNull();
    await expect(primary.lookupByVrm("ER12ABC", { signal })).rejects.toBeInstanceOf(PaintApiError);
  });

  it("fails FO plates on the primary only", async () => {
    await expect(primary.lookupByVrm("FO12ABC", { signal })).rejects.toThrow(/down/);
    expect((await backup.lookupByVrm("FO12ABC", { signal })).paintCode).toBeTruthy();
  });
});

describe("lookupWithFailover", () => {
  it("stops at the first provider with a paint code", async () => {
    const a = fake("a", async (vrm) => withPaint(vrm, "a"));
    const b = fake("b", async (vrm) => withPaint(vrm, "b"));
    const result = await lookupWithFailover([a, b], "AB12CDE", 1000);
    expect(result.outcome).toBe("SUCCESS");
    expect(b.calls).toBe(0);
  });

  it("fails over when the cheap provider errors or has no paint code", async () => {
    const down = fake("down", async () => {
      throw new Error("503");
    });
    const noPaint = fake("no-paint", async (vrm) => ({ ...withPaint(vrm, "no-paint"), paintCode: null }));
    const good = fake("good", async (vrm) => withPaint(vrm, "good"));
    const result = await lookupWithFailover([down, noPaint, good], "AB12CDE", 1000);
    expect(result.outcome).toBe("SUCCESS");
    if (result.outcome === "SUCCESS") expect(result.data.providerName).toBe("good");
    expect(result.attempts.map((a) => a.outcome)).toEqual(["ERROR", "NO_PAINT_CODE", "SUCCESS"]);
  });

  it("reports NO_DATA (refund API_NO_DATA) when providers answer without a paint code", async () => {
    const missing = fake("a", async (vrm) => notFound(vrm, "a"));
    const partial = fake("b", async (vrm) => ({ ...withPaint(vrm, "b"), paintCode: "  " }));
    const result = await lookupWithFailover([missing, partial], "AB12CDE", 1000);
    expect(result.outcome).toBe("NO_DATA");
    if (result.outcome === "NO_DATA") expect(result.data?.make).toBe("Audi");
  });

  it("reports ERROR (refund API_ERROR) when every provider fails, including timeouts", async () => {
    const slow = fake("slow", () => new Promise(() => {})); // never resolves, ignores the signal
    const broken = fake("broken", async () => {
      throw new PaintApiError("500", "broken");
    });
    const result = await lookupWithFailover([slow, broken], "AB12CDE", 50);
    expect(result.outcome).toBe("ERROR");
    expect(result.attempts.map((a) => a.outcome)).toEqual(["TIMEOUT", "ERROR"]);
  });

  it("times out the mock SLOW scenario through its abort signal", async () => {
    const result = await lookupWithFailover([primary], "SLOW123", 50);
    expect(result.outcome).toBe("ERROR");
    expect(result.attempts[0].outcome).toBe("TIMEOUT");
  });
});
