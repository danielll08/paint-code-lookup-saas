import { paintApiProviderNames } from "@/lib/env";
import { ExampleHttpPaintProvider } from "./providers/http-template";
import { MockPaintProvider } from "./providers/mock";
import type { PaintApiAdapter } from "./types";

export { lookupWithFailover } from "./failover";
export type { FailoverResult, ProviderAttempt } from "./failover";
export type { PaintApiAdapter, StandardizedVehiclePaintData } from "./types";

// Plug-and-play registry: add one line per new provider adapter.
const REGISTRY: Record<string, () => PaintApiAdapter> = {
  "mock-primary": () => new MockPaintProvider({ name: "mock-primary", role: "primary" }),
  "mock-backup": () => new MockPaintProvider({ name: "mock-backup", role: "backup" }),
  "example-http": () => {
    const url = process.env.EXAMPLE_PAINT_API_URL;
    const key = process.env.EXAMPLE_PAINT_API_KEY;
    if (!url || !key) throw new Error("example-http provider needs EXAMPLE_PAINT_API_URL and EXAMPLE_PAINT_API_KEY");
    return new ExampleHttpPaintProvider(url, key);
  },
};

let chain: PaintApiAdapter[] | undefined;

/** Providers in failover order, from PAINT_API_PROVIDERS. */
export function getPaintProviders(): PaintApiAdapter[] {
  if (chain) return chain;
  const names = paintApiProviderNames();
  const unknown = names.filter((name) => !REGISTRY[name]);
  if (unknown.length) throw new Error(`Unknown paint API provider(s): ${unknown.join(", ")}`);
  if (!names.length) throw new Error("PAINT_API_PROVIDERS is empty");
  chain = names.map((name) => REGISTRY[name]());
  return chain;
}
