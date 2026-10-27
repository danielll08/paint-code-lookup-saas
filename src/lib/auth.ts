import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { UserProfile } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/** Verified identity from the session JWT, deduplicated per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  // Session validation compares the JWT expiry with the current time, so it must
  // never be part of a prerender (Cache Components flags Date.now() otherwise).
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in user's profile row (read through RLS with resilient self-healing fallback). */
export const getProfile = cache(async (): Promise<UserProfile> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  if (data) return data;

  // Self-healing fallback: If user was authenticated via Google OAuth and trigger is delayed
  try {
    const admin = createAdminClient();
    const { data: authUser } = await admin.auth.admin.getUserById(user.id);
    if (authUser?.user) {
      const fullName =
        authUser.user.user_metadata?.full_name ??
        authUser.user.user_metadata?.name ??
        null;
      const email = authUser.user.email ?? `${user.id}@users.invalid`;
      const { data: created } = await admin
        .from("users")
        .upsert({ id: user.id, email, full_name: fullName }, { onConflict: "id" })
        .select("*")
        .single();
      if (created) return created;
    }
  } catch (syncError) {
    console.error("[getProfile] self-healing profile recovery error:", syncError);
  }

  throw new Error(`Profile could not be resolved for user ${user.id}`);
});
