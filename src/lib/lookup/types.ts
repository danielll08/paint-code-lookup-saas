import type { LookupStatus, VehicleLookup } from "@/lib/database.types";

/** What the browser receives about one lookup (no raw provider payload). */
export type LookupView = {
  id: string;
  vrm: string;
  status: LookupStatus;
  paintCode: string | null;
  paintName: string | null;
  paintFinish: string | null;
  codeLocationHint: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  registeredColor: string | null;
  vinPartial: string | null;
  provider: string;
  createdAt: string;
};

export type LookupApiResponse =
  | { status: "success"; charged: boolean; cached: boolean; lookup: LookupView; balance: number }
  | { status: "no_paint_code"; charged: false; lookup: LookupView | null; balance: number; message: string }
  | { status: "provider_error"; charged: false; balance: number; message: string }
  | { status: "insufficient_credits"; balance: number; message: string }
  | { status: "rate_limited"; retryAfterMs: number; message: string }
  | { status: "in_progress"; message: string }
  | { status: "invalid"; message: string }
  | { status: "unauthorized"; message: string };

export function toLookupView(row: VehicleLookup): LookupView {
  return {
    id: row.id,
    vrm: row.vrm_normalized,
    status: row.status,
    paintCode: row.paint_code,
    paintName: row.paint_name,
    paintFinish: row.paint_finish,
    codeLocationHint: row.code_location_hint,
    make: row.vehicle_make,
    model: row.vehicle_model,
    year: row.vehicle_year,
    registeredColor: row.registered_color,
    vinPartial: row.vin_partial,
    provider: row.api_provider,
    createdAt: row.created_at,
  };
}
