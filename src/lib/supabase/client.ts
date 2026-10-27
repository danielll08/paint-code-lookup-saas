import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!isSupabaseConfigured()) {
    return null as unknown as ReturnType<typeof createBrowserClient<Database>>;
  }
  browserClient ??= createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
  return browserClient;
}
