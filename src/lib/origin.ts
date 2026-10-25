import "server-only";

import { headers } from "next/headers";
import { siteUrl } from "@/lib/env";

/** Public origin used to build redirect URLs (Stripe, auth emails, OAuth). */
export async function getOrigin(): Promise<string> {
  const configured = siteUrl();
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
