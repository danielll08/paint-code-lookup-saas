import { notFound, PaintApiError, type LookupOptions, type PaintApiAdapter, type StandardizedVehiclePaintData } from "../types";

// Sample catalogue used to fabricate realistic responses while no real provider
// has been signed (PRD 4.3 "MockPaintProvider").
const CATALOGUE = [
  { make: "Audi", model: "A4 Avant S line", color: "Black", code: "LY9T", name: "Mythos Black", finish: "Metallic" },
  { make: "BMW", model: "320d M Sport", color: "Black", code: "475", name: "Black Sapphire", finish: "Metallic" },
  { make: "BMW", model: "118i Sport", color: "White", code: "300", name: "Alpine White", finish: "Solid" },
  { make: "Volkswagen", model: "Golf R-Line", color: "Black", code: "LC9X", name: "Deep Black", finish: "Pearl" },
  { make: "Volkswagen", model: "Polo SE", color: "White", code: "LB9A", name: "Pure White", finish: "Solid" },
  { make: "Mercedes-Benz", model: "C220d AMG Line", color: "Black", code: "197", name: "Obsidian Black", finish: "Metallic" },
  { make: "Toyota", model: "Yaris Icon", color: "White", code: "040", name: "Super White II", finish: "Solid" },
  { make: "Nissan", model: "Qashqai N-Connecta", color: "Grey", code: "KAD", name: "Gun Metallic", finish: "Metallic" },
  { make: "Honda", model: "Civic Sport", color: "Black", code: "NH731P", name: "Crystal Black", finish: "Pearl" },
  { make: "Ford", model: "Fiesta ST-Line", color: "Grey", code: "J7", name: "Magnetic", finish: "Metallic" },
] as const;

const LOCATION_HINTS: Record<string, string> = {
  Audi: "Sticker in the spare wheel well and on the first page of the service book.",
  BMW: "Plate under the bonnet on the front strut tower, or on the driver's door pillar.",
  Volkswagen: "Sticker in the spare wheel well (boot floor) and in the service book.",
  "Mercedes-Benz": "Plate on the driver's door pillar (B-pillar) or under the bonnet near the slam panel.",
  Toyota: "Plate on the driver's door shut, look for the 'C/TR' value.",
  Nissan: "Plate under the bonnet on the slam panel, or on the driver's door pillar.",
  Honda: "Sticker on the driver's door shut.",
  Ford: "Plate on the driver's door B-pillar, 'PAINT' line on the VIN label.",
};

export type MockProviderOptions = {
  name: string;
  /** Primary mocks fail plates starting with "FO" so failover to the backup can be tested. */
  role: "primary" | "backup";
  latencyMs?: number;
};

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * Deterministic test scenarios, keyed on the normalised plate:
 *   NF...   / contains 404  -> vehicle not found               (refund: API_NO_DATA)
 *   NP...                   -> vehicle found, paint code null  (refund: API_NO_DATA)
 *   ER...                   -> provider HTTP 500               (refund: API_ERROR)
 *   SLOW... / SL...         -> responds after 12 s (> timeout) (refund: API_ERROR)
 *   FO...                   -> primary fails, backup succeeds  (failover, charged)
 *   anything else           -> success with a paint code
 */
export class MockPaintProvider implements PaintApiAdapter {
  readonly name: string;
  private readonly role: MockProviderOptions["role"];
  private readonly latencyMs: number;

  constructor(options: MockProviderOptions) {
    this.name = options.name;
    this.role = options.role;
    this.latencyMs = options.latencyMs ?? Number(process.env.MOCK_PAINT_API_LATENCY_MS ?? 600);
  }

  async lookupByVrm(vrm: string, { signal }: LookupOptions): Promise<StandardizedVehiclePaintData> {
    if (vrm.startsWith("SL")) {
      await sleep(12_000, signal);
    } else {
      await sleep(this.latencyMs, signal);
    }

    if (vrm.startsWith("ER")) {
      throw new PaintApiError("Mock provider returned HTTP 500", this.name, "ERROR", 500);
    }
    if (vrm.startsWith("FO") && this.role === "primary") {
      throw new PaintApiError("Mock primary provider is down (failover test)", this.name, "ERROR", 503);
    }
    if (vrm.startsWith("NF") || vrm.includes("404")) {
      return notFound(vrm, this.name);
    }

    const car = CATALOGUE[hash(vrm) % CATALOGUE.length];
    const year = 2012 + (hash(`${vrm}:year`) % 13);
    const vin = `WMOCK${String(hash(`${vrm}:vin`)).padStart(12, "0")}`.slice(0, 17);
    const partial = vrm.startsWith("NP");

    return {
      found: true,
      vrm,
      vin,
      make: car.make,
      model: car.model,
      year,
      registeredColor: car.color,
      paintCode: partial ? null : car.code,
      paintDescription: partial ? null : `${car.name} ${car.finish === "Solid" ? "" : car.finish}`.trim(),
      paintFinish: partial ? undefined : car.finish,
      codeLocationHint: LOCATION_HINTS[car.make],
      providerName: this.name,
    };
  }
}
