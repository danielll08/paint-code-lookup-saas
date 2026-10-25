import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { UserProfile } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
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

/** The signed-in user's profile row (read through RLS). */
export const getProfile = cache(async (): Promise<UserProfile> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (error || !data) {
    // Auth user exists but the profile trigger has not run (should not happen).
    throw new Error(`Profile not found for user ${user.id}: ${error?.message ?? "no row"}`);
  }
  return data;
});
