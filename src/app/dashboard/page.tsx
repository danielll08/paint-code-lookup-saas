import type { Metadata } from "next";
import { Suspense } from "react";
import { LookupWorkspace, LookupWorkspaceSkeleton } from "@/components/dashboard/lookup-workspace";
import { RecentLookupsTable } from "@/components/dashboard/recent-lookups-table";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import type { VehicleLookup } from "@/lib/database.types";
import { toLookupView } from "@/lib/lookup/types";
import { isHostedSupabaseConfigured } from "@/lib/oauth-config";
import { getStandaloneLookups } from "@/lib/standalone-store";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paint code lookup" };

async function RecentLookups() {
  const user = await requireUser();
  let lookups: VehicleLookup[] | null = null;

  if (isHostedSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("vehicle_lookups")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) {
        lookups = data;
      }
    } catch {
      // Fall through to standalone lookups
    }
  }

  if (!lookups) {
    lookups = await getStandaloneLookups(user.id);
  }

  return <RecentLookupsTable lookups={lookups.map(toLookupView)} />;
}

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <Suspense fallback={<LookupWorkspaceSkeleton />}>
        <LookupWorkspace />
      </Suspense>
      <Suspense fallback={<Card className="h-64 animate-pulse">{null}</Card>}>
        <RecentLookups />
      </Suspense>
    </div>
  );
}
