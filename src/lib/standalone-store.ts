import "server-only";

import { cookies } from "next/headers";
import type { UserProfile, VehicleLookup } from "@/lib/database.types";

const STATE_COOKIE = "paint_state_data";
const DEFAULT_CREDITS = 50;

interface StandaloneUserState {
  credits: number;
  lookups: VehicleLookup[];
}

// In-memory cache per instance
const memoryStore = new Map<string, StandaloneUserState>();

async function readState(userId: string): Promise<StandaloneUserState> {
  if (memoryStore.has(userId)) {
    return memoryStore.get(userId)!;
  }

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(STATE_COOKIE)?.value;
    if (raw) {
      const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as StandaloneUserState;
      if (typeof decoded.credits === "number" && Array.isArray(decoded.lookups)) {
        memoryStore.set(userId, decoded);
        return decoded;
      }
    }
  } catch {
    // Ignore cookie read / parse issues
  }

  const initial: StandaloneUserState = {
    credits: DEFAULT_CREDITS,
    lookups: [],
  };
  memoryStore.set(userId, initial);
  return initial;
}

async function writeState(userId: string, state: StandaloneUserState): Promise<void> {
  memoryStore.set(userId, state);
  try {
    const cookieStore = await cookies();
    const serialized = Buffer.from(JSON.stringify(state)).toString("base64url");
    cookieStore.set(STATE_COOKIE, serialized, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch {
    // In Server Components cookies may be read-only; mutations occur in Route Handlers/Actions
  }
}

export async function getStandaloneProfile(
  userId: string,
  email: string | null,
  fullName?: string | null
): Promise<UserProfile> {
  const state = await readState(userId);
  const now = new Date().toISOString();

  return {
    id: userId,
    email: email ?? `${userId}@paintcode.saas`,
    full_name: fullName ?? null,
    credit_balance: state.credits,
    subscription_credits: 0,
    subscription_status: "active",
    subscription_tier: "starter",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null,
    auto_topup_pack: null,
    auto_topup_attempted_at: null,
    auto_topup_last_error: null,
    created_at: now,
    updated_at: now,
  };
}

export async function getStandaloneLookups(userId: string): Promise<VehicleLookup[]> {
  const state = await readState(userId);
  return state.lookups;
}

export async function deductStandaloneCredit(userId: string): Promise<{ success: boolean; balance: number }> {
  const state = await readState(userId);
  if (state.credits <= 0) {
    return { success: false, balance: 0 };
  }
  state.credits -= 1;
  await writeState(userId, state);
  return { success: true, balance: state.credits };
}

export async function refundStandaloneCredit(userId: string): Promise<number> {
  const state = await readState(userId);
  state.credits += 1;
  await writeState(userId, state);
  return state.credits;
}

export async function saveStandaloneLookup(
  userId: string,
  lookup: Omit<VehicleLookup, "id" | "created_at">
): Promise<VehicleLookup> {
  const state = await readState(userId);
  const fullRecord: VehicleLookup = {
    ...lookup,
    id: `vlk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  };

  // Prepend to lookups history (max 50)
  state.lookups = [fullRecord, ...state.lookups.slice(0, 49)];
  await writeState(userId, state);
  return fullRecord;
}
