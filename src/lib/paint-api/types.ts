// The single normalised shape the whole web app consumes (PRD 4.3). Every
// provider adapter maps its own JSON into this, so UI and billing code never
// change when a provider is added or swapped.
export interface StandardizedVehiclePaintData {
  found: boolean;
  vrm: string;
  vin?: string;
  make: string;
  model: string;
  year: number;
  registeredColor: string;
  paintCode: string | null; // OEM paint code (the thing customers pay for)
  paintDescription: string | null; // Manufacturer paint name
  paintFinish?: string; // Metallic / Solid / Pearl
  codeLocationHint?: string; // Where the paint code sticker is on the car
  providerName: string;
}

export interface LookupOptions {
  /** Aborted when the per-provider timeout elapses. */
  signal: AbortSignal;
}

/**
 * Contract for a vehicle data provider. Implementations:
 *   - return `{ found: true, ... }` when the vehicle is known (paintCode may be null),
 *   - return `{ found: false, ... }` for "no such vehicle" (HTTP 404 style),
 *   - throw `PaintApiError` (or anything) for outages, 5xx, auth errors, timeouts.
 */
export interface PaintApiAdapter {
  readonly name: string;
  lookupByVrm(vrm: string, options: LookupOptions): Promise<StandardizedVehiclePaintData>;
}

export class PaintApiError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly kind: "ERROR" | "TIMEOUT" = "ERROR",
    readonly status?: number,
  ) {
    super(message);
    this.name = "PaintApiError";
  }
}

export function notFound(vrm: string, providerName: string): StandardizedVehiclePaintData {
  return {
    found: false,
    vrm,
    make: "",
    model: "",
    year: 0,
    registeredColor: "",
    paintCode: null,
    paintDescription: null,
    providerName,
  };
}
