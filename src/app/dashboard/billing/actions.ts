"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTopUpPack } from "@/lib/plans";
import { maybeAutoTopUp } from "@/lib/stripe/auto-topup";
import { createAdminClient } from "@/lib/supabase/admin";

/** Turn automatic top-ups on (with a pack) or off. Clients cannot write to users directly (RLS). */
export async function saveAutoTopUp(formData: FormData) {
  const user = await requireUser();
  const pack = getTopUpPack(String(formData.get("pack") ?? ""));

  const { error } = await createAdminClient()
    .from("users")
    .update({ auto_topup_pack: pack?.id ?? null, auto_topup_last_error: null, auto_topup_attempted_at: null })
    .eq("id", user.id);
  if (error) {
    console.error("[billing] saveAutoTopUp", error);
    redirect("/dashboard/billing?error=auto_topup_failed");
  }

  // Already at 0 credits? Top up straight away instead of waiting for the next lookup.
  if (pack) after(() => maybeAutoTopUp(user.id).catch((err) => console.error("[auto-topup]", err)));
  redirect(`/dashboard/billing?auto_topup=${pack ? "on" : "off"}`);
}
