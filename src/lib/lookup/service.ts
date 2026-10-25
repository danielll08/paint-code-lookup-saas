import "server-only";

import type { Json, VehicleLookup } from "@/lib/database.types";
import { paintApiTimeoutMs } from "@/lib/env";
import { getPaintProviders, lookupWithFailover, type FailoverResult } from "@/lib/paint-api";
import { checkLookupRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskVin, parseVehicleIdentifier } from "@/lib/vrm";
import { toLookupView, type LookupApiResponse } from "./types";

const CACHE_DAYS = 30;

type HttpResult = { httpStatus: number; body: LookupApiResponse };

async function findCachedLookup(userId: string, vrm: string): Promise<VehicleLookup | null> {
  const since = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createAdminClient()
    .from("vehicle_lookups")
    .select("*")
    .eq("user_id", userId)
    .eq("vrm_normalized", vrm)
    .eq("status", "SUCCESS")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Cache lookup failed: ${error.message}`);
  return data;
}

async function currentBalance(userId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("users")
    .select("credit_balance")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error(`Balance read failed: ${error?.message ?? "no row"}`);
  return data.credit_balance;
}

async function loadLookup(lookupId: string): Promise<VehicleLookup> {
  const { data, error } = await createAdminClient().from("vehicle_lookups").select("*").eq("id", lookupId).single();
  if (error || !data) throw new Error(`Lookup ${lookupId} not found: ${error?.message ?? "no row"}`);
  return data;
}

async function refund(lookupId: string, reason: "API_NO_DATA" | "API_ERROR", provider: string | null, raw: Json) {
  const { error } = await createAdminClient().rpc("refund_lookup", {
    p_lookup_id: lookupId,
    p_reason: reason,
    p_provider: provider,
    p_raw: raw,
  });
  // If this fails the PENDING row is still swept by refund_stale_pending_lookups.
  if (error) console.error(`[lookup] refund failed for ${lookupId}:`, error.message);
}

function cachedResponse(row: VehicleLookup, balance: number): HttpResult {
  return {
    httpStatus: 200,
    body: { status: "success", charged: false, cached: true, lookup: toLookupView(row), balance },
  };
}

/**
 * The core lookup flow (PRD 2.3):
 *   1. normalise + 30-day per-user cache (free)
 *   2. rate limit (1 req/s)
 *   3. atomic deduction under a row lock (deduct_credit_for_lookup)
 *   4. provider call with failover + 10 s timeout
 *   5a. success -> COMPLETED      5b. no paint code / error -> auto-refund
 */
export async function performLookup(userId: string, rawInput: string): Promise<HttpResult> {
  const identifier = parseVehicleIdentifier(rawInput);
  if (!identifier) {
    return {
      httpStatus: 400,
      body: { status: "invalid", message: "Enter a valid registration (e.g. AB12 CDE) or a 17-character VIN." },
    };
  }
  const vrm = identifier.value;
  const admin = createAdminClient();

  // 1. Cache / history: same user, same plate, last 30 days -> no credit, no API cost.
  const cached = await findCachedLookup(userId, vrm);
  if (cached) return cachedResponse(cached, await currentBalance(userId));

  // 2. Rate limit before touching the credit row.
  const rate = await checkLookupRateLimit(userId);
  if (!rate.allowed) {
    return {
      httpStatus: 429,
      body: { status: "rate_limited", retryAfterMs: rate.retryAfterMs, message: "Too many requests. Please wait a second." },
    };
  }

  // Safety net: refund anything this user left PENDING after a crash.
  await admin.rpc("refund_stale_pending_lookups", { p_user_id: userId });

  const providers = getPaintProviders();

  // 3. Atomic deduction (SELECT ... FOR UPDATE inside the function).
  const { data: lookupId, error: deductError } = await admin.rpc("deduct_credit_for_lookup", {
    p_user_id: userId,
    p_vrm: vrm,
    p_provider: providers[0].name,
  });

  if (deductError || !lookupId) {
    const message = deductError?.message ?? "";
    if (message.includes("INSUFFICIENT_CREDITS")) {
      return {
        httpStatus: 402,
        body: {
          status: "insufficient_credits",
          balance: await currentBalance(userId),
          message: "You have no credits left. Buy more credits to continue.",
        },
      };
    }
    if (message.includes("CACHED_RESULT_AVAILABLE")) {
      const row = await findCachedLookup(userId, vrm);
      if (row) return cachedResponse(row, await currentBalance(userId));
    }
    if (message.includes("LOOKUP_IN_PROGRESS")) {
      return {
        httpStatus: 409,
        body: { status: "in_progress", message: "This plate is already being looked up. Please wait." },
      };
    }
    throw new Error(`Credit deduction failed: ${message || "no lookup id returned"}`);
  }

  // 4. Provider call. Any unexpected failure past this point must refund.
  let result: FailoverResult;
  try {
    result = await lookupWithFailover(providers, vrm, paintApiTimeoutMs());
  } catch (error) {
    await refund(lookupId, "API_ERROR", null, { error: String(error) });
    throw error;
  }

  if (result.outcome === "SUCCESS") {
    const { data } = result;
    const { data: completed, error } = await admin.rpc("complete_lookup", {
      p_lookup_id: lookupId,
      p_provider: data.providerName,
      p_paint_code: data.paintCode!,
      p_paint_name: data.paintDescription,
      p_paint_finish: data.paintFinish ?? null,
      p_code_location_hint: data.codeLocationHint ?? null,
      p_make: data.make || null,
      p_model: data.model || null,
      p_year: data.year || null,
      p_registered_color: data.registeredColor || null,
      p_vin_partial: maskVin(data.vin),
      p_raw: { data, attempts: result.attempts } as unknown as Json,
    });
    if (error) {
      await refund(lookupId, "API_ERROR", data.providerName, { error: error.message });
      throw new Error(`Saving lookup failed: ${error.message}`);
    }
    const row = await loadLookup(lookupId);
    return {
      httpStatus: 200,
      // completed === false: the row was already settled (swept + refunded), so it was free.
      body: { status: "success", charged: completed === true, cached: false, lookup: toLookupView(row), balance: await currentBalance(userId) },
    };
  }

  // 5b. Auto-refund (PRD 2.3 case B, 5.1).
  if (result.outcome === "NO_DATA") {
    await refund(lookupId, "API_NO_DATA", result.data?.providerName ?? null, {
      data: result.data,
      attempts: result.attempts,
    } as unknown as Json);
    const row = await loadLookup(lookupId);
    const view = toLookupView(row);
    if (result.data) {
      view.make = result.data.make || null;
      view.model = result.data.model || null;
      view.year = result.data.year || null;
      view.registeredColor = result.data.registeredColor || null;
      view.vinPartial = maskVin(result.data.vin);
    }
    return {
      httpStatus: 200,
      body: {
        status: "no_paint_code",
        charged: false,
        lookup: view,
        balance: await currentBalance(userId),
        message: result.data
          ? "We found the vehicle, but the paint code is not available from our data sources yet. You have not been charged."
          : "No paint code found for this registration. You have not been charged.",
      },
    };
  }

  await refund(lookupId, "API_ERROR", null, { attempts: result.attempts } as unknown as Json);
  return {
    httpStatus: 502,
    body: {
      status: "provider_error",
      charged: false,
      balance: await currentBalance(userId),
      message: "Our vehicle data provider is not responding. You have not been charged - please try again shortly.",
    },
  };
}
