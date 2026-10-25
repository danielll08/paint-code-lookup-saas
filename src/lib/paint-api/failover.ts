import { PaintApiError, type PaintApiAdapter, type StandardizedVehiclePaintData } from "./types";

export type ProviderAttempt = {
  provider: string;
  outcome: "SUCCESS" | "NO_PAINT_CODE" | "NOT_FOUND" | "ERROR" | "TIMEOUT";
  durationMs: number;
  error?: string;
};

export type FailoverResult =
  | { outcome: "SUCCESS"; data: StandardizedVehiclePaintData; attempts: ProviderAttempt[] }
  /** At least one provider answered, but none had a paint code. */
  | { outcome: "NO_DATA"; data: StandardizedVehiclePaintData | null; attempts: ProviderAttempt[] }
  /** Every provider failed technically (5xx, timeout, network). */
  | { outcome: "ERROR"; attempts: ProviderAttempt[] };

async function callWithTimeout(
  adapter: PaintApiAdapter,
  vrm: string,
  timeoutMs: number,
): Promise<StandardizedVehiclePaintData> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new PaintApiError(`Timed out after ${timeoutMs} ms`, adapter.name, "TIMEOUT");
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    // Race as well as abort, in case an adapter ignores the signal.
    return await Promise.race([adapter.lookupByVrm(vrm, { signal: controller.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls providers in order (e.g. cheapest first) and stops at the first one that
 * returns a paint code. A provider that is down, slow, or has no paint code
 * hands over to the next one (PRD 1.2.3 failover).
 */
export async function lookupWithFailover(
  adapters: PaintApiAdapter[],
  vrm: string,
  timeoutMs: number,
): Promise<FailoverResult> {
  const attempts: ProviderAttempt[] = [];
  let bestPartial: StandardizedVehiclePaintData | null = null;
  let anyAnswered = false;

  for (const adapter of adapters) {
    const started = Date.now();
    try {
      const data = await callWithTimeout(adapter, vrm, timeoutMs);
      const durationMs = Date.now() - started;
      anyAnswered = true;

      if (data.found && data.paintCode && data.paintCode.trim() !== "") {
        attempts.push({ provider: adapter.name, outcome: "SUCCESS", durationMs });
        return { outcome: "SUCCESS", data, attempts };
      }
      attempts.push({ provider: adapter.name, outcome: data.found ? "NO_PAINT_CODE" : "NOT_FOUND", durationMs });
      if (data.found && !bestPartial) bestPartial = data;
    } catch (error) {
      const isTimeout = error instanceof PaintApiError && error.kind === "TIMEOUT";
      attempts.push({
        provider: adapter.name,
        outcome: isTimeout ? "TIMEOUT" : "ERROR",
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return anyAnswered ? { outcome: "NO_DATA", data: bestPartial, attempts } : { outcome: "ERROR", attempts };
}
