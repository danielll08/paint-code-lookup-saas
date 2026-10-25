import { notFound, PaintApiError, type LookupOptions, type PaintApiAdapter, type StandardizedVehiclePaintData } from "../types";

/**
 * Template for a real provider (Milestone 3). Copy this file, adjust the request
 * and the mapping in `toStandard`, then register it in ../index.ts. Nothing in
 * the UI or billing code needs to change.
 *
 * Enabled with PAINT_API_PROVIDERS=example-http,mock-backup and:
 *   EXAMPLE_PAINT_API_URL=https://api.example.com/v1/vehicle
 *   EXAMPLE_PAINT_API_KEY=...
 */
type ExampleProviderResponse = {
  vehicle?: {
    registration: string;
    vin?: string;
    manufacturer: string;
    model: string;
    year_of_manufacture: number;
    colour: string;
    paint?: { code?: string | null; name?: string | null; type?: string | null; location?: string | null };
  };
};

export class ExampleHttpPaintProvider implements PaintApiAdapter {
  readonly name = "example-http";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async lookupByVrm(vrm: string, { signal }: LookupOptions): Promise<StandardizedVehiclePaintData> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}?vrm=${encodeURIComponent(vrm)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
        signal,
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = signal.aborted;
      throw new PaintApiError(
        timedOut ? "Provider timed out" : `Network error: ${(error as Error).message}`,
        this.name,
        timedOut ? "TIMEOUT" : "ERROR",
      );
    }

    if (response.status === 404) return notFound(vrm, this.name);
    if (!response.ok) {
      throw new PaintApiError(`Provider returned HTTP ${response.status}`, this.name, "ERROR", response.status);
    }

    return this.toStandard(vrm, (await response.json()) as ExampleProviderResponse);
  }

  private toStandard(vrm: string, body: ExampleProviderResponse): StandardizedVehiclePaintData {
    const v = body.vehicle;
    if (!v) return notFound(vrm, this.name);
    return {
      found: true,
      vrm,
      vin: v.vin,
      make: v.manufacturer,
      model: v.model,
      year: v.year_of_manufacture,
      registeredColor: v.colour,
      paintCode: v.paint?.code?.trim() || null,
      paintDescription: v.paint?.name ?? null,
      paintFinish: v.paint?.type ?? undefined,
      codeLocationHint: v.paint?.location ?? undefined,
      providerName: this.name,
    };
  }
}
