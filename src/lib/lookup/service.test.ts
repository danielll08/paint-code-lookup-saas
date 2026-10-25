import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleLookup } from "@/lib/database.types";

type RpcHandler = (args: Record<string, unknown>) => { data: unknown; error: { message: string } | null };

const db = vi.hoisted(() => ({
  cached: null as VehicleLookup | null,
  balance: 5,
  lookups: new Map<string, VehicleLookup>(),
  rpc: {} as Record<string, RpcHandler>,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rateLimited: false,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkLookupRateLimit: async () => ({ allowed: !db.rateLimited, retryAfterMs: db.rateLimited ? 800 : 0 }),
}));

vi.mock("@/lib/supabase/admin", () => {
  function query(table: string) {
    const filters: Record<string, unknown> = {};
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      gte: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: table === "vehicle_lookups" ? db.cached : null, error: null }),
      single: async () => {
        if (table === "users") return { data: { credit_balance: db.balance }, error: null };
        const row = db.lookups.get(String(filters.id));
        return { data: row ?? null, error: row ? null : { message: "not found" } };
      },
    };
    return builder;
  }
  const client = {
    from: query,
    rpc: async (name: string, args: Record<string, unknown>) => {
      db.rpcCalls.push({ name, args });
      return db.rpc[name]?.(args) ?? { data: null, error: null };
    },
  };
  return { createAdminClient: () => client };
});

const { performLookup } = await import("./service");

function row(id: string, vrm: string, patch: Partial<VehicleLookup> = {}): VehicleLookup {
  return {
    id,
    user_id: "user-1",
    vrm_normalized: vrm,
    api_provider: "mock-primary",
    status: "PENDING",
    paint_code: null,
    paint_name: null,
    paint_finish: null,
    code_location_hint: null,
    vehicle_make: null,
    vehicle_model: null,
    vehicle_year: null,
    registered_color: null,
    vin_partial: null,
    raw_api_response: null,
    failure_reason: null,
    cost_credits: 1,
    deducted_bucket: "TOPUP",
    created_at: new Date().toISOString(),
    completed_at: null,
    ...patch,
  };
}

const calledRpcs = () => db.rpcCalls.map((c) => c.name).filter((n) => n !== "refund_stale_pending_lookups");

beforeEach(() => {
  db.cached = null;
  db.balance = 5;
  db.lookups.clear();
  db.rpcCalls = [];
  db.rateLimited = false;
  db.rpc = {
    deduct_credit_for_lookup: (args) => {
      if (db.balance < 1) return { data: null, error: { message: "INSUFFICIENT_CREDITS" } };
      db.balance -= 1;
      db.lookups.set("lookup-1", row("lookup-1", String(args.p_vrm)));
      return { data: "lookup-1", error: null };
    },
    complete_lookup: (args) => {
      const current = db.lookups.get(String(args.p_lookup_id))!;
      db.lookups.set(current.id, { ...current, status: "SUCCESS", paint_code: String(args.p_paint_code), api_provider: String(args.p_provider) });
      return { data: true, error: null };
    },
    refund_lookup: (args) => {
      const current = db.lookups.get(String(args.p_lookup_id))!;
      db.balance += 1;
      const status = args.p_reason === "API_NO_DATA" ? "NOT_FOUND_REFUNDED" : "FAILED_REFUNDED";
      db.lookups.set(current.id, { ...current, status });
      return { data: db.balance, error: null };
    },
  };
});

describe("performLookup (PRD 2.3)", () => {
  it("rejects invalid input without touching credits", async () => {
    const { httpStatus, body } = await performLookup("user-1", "!!");
    expect(httpStatus).toBe(400);
    expect(body.status).toBe("invalid");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("serves a 30-day cached result for free", async () => {
    db.cached = row("old", "AB12CDE", { status: "SUCCESS", paint_code: "LY9T" });
    const { body } = await performLookup("user-1", "ab12 cde");
    expect(body).toMatchObject({ status: "success", cached: true, charged: false });
    expect(calledRpcs()).toEqual([]);
    expect(db.balance).toBe(5);
  });

  it("rate limits before deducting", async () => {
    db.rateLimited = true;
    const { httpStatus } = await performLookup("user-1", "AB12CDE");
    expect(httpStatus).toBe(429);
    expect(calledRpcs()).toEqual([]);
  });

  it("charges 1 credit and completes a successful lookup", async () => {
    const { httpStatus, body } = await performLookup("user-1", "AB12CDE");
    expect(httpStatus).toBe(200);
    expect(body).toMatchObject({ status: "success", charged: true, cached: false, balance: 4 });
    expect(calledRpcs()).toEqual(["deduct_credit_for_lookup", "complete_lookup"]);
  });

  it("refunds with API_NO_DATA when the vehicle is not found", async () => {
    const { body } = await performLookup("user-1", "NF12ABC");
    expect(body).toMatchObject({ status: "no_paint_code", charged: false, balance: 5 });
    const refund = db.rpcCalls.find((c) => c.name === "refund_lookup");
    expect(refund?.args.p_reason).toBe("API_NO_DATA");
  });

  it("refunds with API_NO_DATA when the paint code is missing (PRD 5.1)", async () => {
    const { body } = await performLookup("user-1", "NP12ABC");
    expect(body.status).toBe("no_paint_code");
    if (body.status === "no_paint_code") expect(body.lookup?.make).toBeTruthy();
    expect(db.balance).toBe(5);
  });

  it("refunds with API_ERROR when every provider fails", async () => {
    const { httpStatus, body } = await performLookup("user-1", "ER12ABC");
    expect(httpStatus).toBe(502);
    expect(body).toMatchObject({ status: "provider_error", charged: false, balance: 5 });
    expect(db.rpcCalls.find((c) => c.name === "refund_lookup")?.args.p_reason).toBe("API_ERROR");
  });

  it("fails over to the backup provider", async () => {
    const { body } = await performLookup("user-1", "FO12ABC");
    expect(body.status).toBe("success");
    if (body.status === "success") expect(body.lookup.provider).toBe("mock-backup");
  });

  it("returns 402 when the user has no credits", async () => {
    db.balance = 0;
    const { httpStatus, body } = await performLookup("user-1", "AB12CDE");
    expect(httpStatus).toBe(402);
    expect(body.status).toBe("insufficient_credits");
  });
});
