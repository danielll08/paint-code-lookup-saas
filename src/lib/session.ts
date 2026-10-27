import type { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "paint_session";

export interface SessionPayload {
  id: string;
  email: string | null;
  name?: string;
  picture?: string;
  exp: number; // Unix timestamp in seconds
}

const DEFAULT_SECRET = "paint-code-saas-fallback-secret-key-32b-min";

function getSecretKey(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET || DEFAULT_SECRET;
}

// Convert string key to CryptoKey using Web Crypto (available in Node and Edge runtime)
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = enc.encode(getSecretKey());
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Signs a session payload and returns a compact token: header.payload.signature */
export async function createSessionToken(
  user: Omit<SessionPayload, "exp">,
  ttlSeconds = 60 * 60 * 24 * 30 // 30 days
): Promise<string> {
  const enc = new TextEncoder();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: SessionPayload = { ...user, exp };

  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const dataToSign = enc.encode(`${headerB64}.${payloadB64}`);

  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign("HMAC", key, dataToSign);
  const signatureB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/** Verifies token signature and expiry, returning the decoded payload or null. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const enc = new TextEncoder();
    const dataToVerify = enc.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);

    const key = await getCryptoKey();
    const isValid = await crypto.subtle.verify("HMAC", key, signature as BufferSource, dataToVerify);
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload: SessionPayload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/** Extracts session payload from cookies in Next.js Server Components / Actions. */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/** Sets the session cookie on a NextResponse object. */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/** Clears the session cookie on a NextResponse object. */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE_NAME);
}
