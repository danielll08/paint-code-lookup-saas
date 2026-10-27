"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getGoogleClientId, isHostedSupabaseConfigured } from "@/lib/oauth-config";
import { getOrigin } from "@/lib/origin";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string; email?: string };

const credentials = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function signInWithPassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: firstIssue(parsed.error), email };

  if (!isSupabaseConfigured()) {
    return { error: "Password authentication is disabled. Please click 'Continue with Google'.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email address first - check your inbox.", email };
    }
    return { error: "Incorrect email or password.", email };
  }
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signUpWithPassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: firstIssue(parsed.error), email };

  if (!isSupabaseConfigured()) {
    return { error: "Password registration is disabled. Please click 'Continue with Google'.", email };
  }

  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const origin = await getOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      // PRD 3.1: email verification is required before the first sign-in.
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: fullName ? { full_name: fullName } : undefined,
    },
  });
  if (error) return { error: error.message, email };

  // Email confirmations disabled (local dev): the user is signed in straight away.
  if (data.session) redirect(next);

  return { message: `We sent a confirmation link to ${parsed.data.email}. Open it to activate your account.`, email };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const origin = await getOrigin();

  // If hosted Supabase is configured, attempt Supabase OAuth first
  if (isHostedSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (!error && data?.url) {
        redirect(data.url);
      }
    } catch (err) {
      console.warn("[signInWithGoogle] Supabase OAuth unavailable, using direct Google OAuth fallback:", err);
    }
  }

  // Resilient Standalone Direct Google OAuth (Works out-of-the-box on Vercel)
  const clientId = getGoogleClientId();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `${origin}/auth/callback`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "select_account");
  if (next) authUrl.searchParams.set("state", next);

  redirect(authUrl.toString());
}

export async function requestPasswordReset(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = z.email().safeParse(email);
  if (!parsed.success) return { error: "Enter a valid email address.", email };

  if (!isSupabaseConfigured()) {
    return { message: "If an account exists for that email, a reset link is on its way.", email };
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the account exists (no account enumeration).
  return { message: "If an account exists for that email, a reset link is on its way.", email };
}

export async function updatePassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== formData.get("confirm")) return { error: "Passwords do not match." };

  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
