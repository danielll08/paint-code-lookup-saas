import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Global safety net (see vercel.json): refunds lookups stuck in PENDING, e.g.
// when a serverless function was killed mid-request. Vercel Cron sends
// `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ refunded: 0, note: "Standalone mode active" });
  }

  try {
    const { data, error } = await createAdminClient().rpc("refund_stale_pending_lookups", {
      p_user_id: null,
      p_older_than: "2 minutes",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ refunded: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
