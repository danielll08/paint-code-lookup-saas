import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { UserProfile } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { isHostedSupabaseConfigured } from "@/lib/oauth-config";
import { getSessionFromCookies } from "@/lib/session";
import { getStandaloneProfile } from "@/lib/standalone-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/** Verified identity from either the direct Google OAuth session cookie or the Supabase session JWT. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // 1. Check direct Google OAuth session token first
  try {
    const direct = await getSessionFromCookies();
    if (direct?.id) {
      return { id: direct.id, email: direct.email };
    }
  } catch {
    // Proceed to Supabase check
  }

  // 2. Fall back to Supabase session validation if configured
  if (isSupabaseConfigured()) {
    try {
      await connection();
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      if (!error && data?.claims?.sub) {
        return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
      }
    } catch {
      // Non-fatal when Supabase is not reachable
    }
  }

  return null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in user's profile row (loads from Supabase or autonomous standalone store). */
export const getProfile = cache(async (): Promise<UserProfile> => {
  const user = await requireUser();

  // 1. If hosted Supabase is configured, load from public.users table
  if (isHostedSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
      if (data) return data;

      // Self-healing fallback: If user was authenticated via Google OAuth and trigger is delayed
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
    } catch (dbError) {
      console.warn("[getProfile] Supabase profile read failed, switching to standalone profile:", dbError);
    }
  }

  // 2. Autonomous standalone profile (used on Vercel without hosted Supabase)
  const session = await getSessionFromCookies();
  return await getStandaloneProfile(user.id, user.email, session?.name);
});
