import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseSecretKey, supabaseUrl } from "@/lib/env";

let adminClient: SupabaseClient<Database> | undefined;

/**
 * Service-role client. Bypasses RLS and is the only role allowed to execute the
 * credit functions. Never import this from client code.
 */
export function createAdminClient(): SupabaseClient<Database> {
  adminClient ??= createClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
