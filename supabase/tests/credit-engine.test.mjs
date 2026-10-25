// Integration tests for the credit engine migration, run against a real
// (embedded) PostgreSQL server so that SELECT ... FOR UPDATE, CHECK constraints,
// UNIQUE keys and RLS behave exactly as they do on Supabase.
//
//   npm run test:db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");
const port = 54000 + Math.floor(Math.random() * 1000);

// Minimal stand-in for what Supabase provides before user migrations run.
const SUPABASE_SHIM = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    email TEXT,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb
  );
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE PUBLICATION supabase_realtime;
`;

let server;
let dataDir;
let pool;

async function createUser(email = `${randomUUID()}@test.dev`) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, '{"full_name":"Test User"}')`,
    [id, email],
  );
  return id;
}

async function balanceOf(userId) {
  const { rows } = await pool.query(
    "SELECT credit_balance, subscription_credits FROM public.users WHERE id = $1",
    [userId],
  );
  return rows[0];
}

async function topUp(userId, amount) {
  const { rows } = await pool.query(
    "SELECT public.grant_credits($1, $2, 'TOPUP_PURCHASE', $3, 'test top-up') AS granted",
    [userId, amount, `evt_${randomUUID()}`],
  );
  return rows[0].granted;
}

async function deduct(userId, vrm, client = pool) {
  const { rows } = await client.query(
    "SELECT public.deduct_credit_for_lookup($1, $2, 'mock') AS id",
    [userId, vrm],
  );
  return rows[0].id;
}

async function ledgerSum(userId) {
  const { rows } = await pool.query(
    "SELECT COALESCE(SUM(amount), 0)::int AS total FROM public.credit_transactions WHERE user_id = $1",
    [userId],
  );
  return rows[0].total;
}

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "paintcode-pg-"));
  server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase("app");

  pool = new pg.Pool({
    host: "localhost",
    port,
    user: "postgres",
    password: "postgres",
    database: "app",
    max: 30,
  });
  await pool.query(SUPABASE_SHIM);
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
});

after(async () => {
  await pool?.end();
  await server?.stop();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

describe("profile bootstrap", () => {
  test("a new auth user gets a profile with 0 credits", async () => {
    const id = await createUser("new@test.dev");
    const { rows } = await pool.query("SELECT * FROM public.users WHERE id = $1", [id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, "new@test.dev");
    assert.equal(rows[0].full_name, "Test User");
    assert.equal(rows[0].credit_balance, 0);
    assert.equal(rows[0].subscription_status, "inactive");
  });
});

describe("balance constraints", () => {
  test("CHECK (credit_balance >= 0) rejects a negative balance", async () => {
    const id = await createUser();
    // Keep subscription_credits <= credit_balance so only the non-negative rule can fail.
    await assert.rejects(
      pool.query("UPDATE public.users SET credit_balance = -1, subscription_credits = -1 WHERE id = $1", [id]),
      (err) => ["credit_balance_non_negative", "subscription_credits_non_negative"].includes(err.constraint),
    );
    await assert.rejects(
      pool.query("UPDATE public.users SET credit_balance = credit_balance - 1 WHERE id = $1", [id]),
      /violates check constraint/,
    );
    assert.equal((await balanceOf(id)).credit_balance, 0);
  });

  test("deducting with 0 credits raises INSUFFICIENT_CREDITS", async () => {
    const id = await createUser();
    await assert.rejects(deduct(id, "AB12CDE"), /INSUFFICIENT_CREDITS/);
    assert.equal((await balanceOf(id)).credit_balance, 0);
  });
});

describe("race conditions (SELECT ... FOR UPDATE)", () => {
  test("20 simultaneous lookups with 5 credits: exactly 5 succeed, balance ends at 0", async () => {
    const id = await createUser();
    await topUp(id, 5);

    const attempts = Array.from({ length: 20 }, (_, i) => deduct(id, `RACE${i}`));
    const results = await Promise.allSettled(attempts);

    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 5);
    assert.equal(rejected.length, 15);
    for (const r of rejected) assert.match(String(r.reason), /INSUFFICIENT_CREDITS/);

    assert.equal((await balanceOf(id)).credit_balance, 0);
    assert.equal(await ledgerSum(id), 0);
  });

  test("10 simultaneous clicks on the same plate are charged only once", async () => {
    const id = await createUser();
    await topUp(id, 10);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => deduct(id, "SAME123")),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    assert.equal(ok.length, 1);
    for (const r of results.filter((x) => x.status === "rejected")) {
      assert.match(String(r.reason), /LOOKUP_IN_PROGRESS/);
    }
    assert.equal((await balanceOf(id)).credit_balance, 9);
  });
});

describe("lookup lifecycle", () => {
  test("refund restores the credit exactly once", async () => {
    const id = await createUser();
    await topUp(id, 1);
    const lookupId = await deduct(id, "NF404");
    assert.equal((await balanceOf(id)).credit_balance, 0);

    const first = await pool.query("SELECT public.refund_lookup($1, 'API_NO_DATA') AS b", [lookupId]);
    assert.equal(first.rows[0].b, 1);

    const second = await pool.query("SELECT public.refund_lookup($1, 'API_ERROR') AS b", [lookupId]);
    assert.equal(second.rows[0].b, null);

    const { rows } = await pool.query("SELECT status, failure_reason FROM public.vehicle_lookups WHERE id = $1", [lookupId]);
    assert.equal(rows[0].status, "NOT_FOUND_REFUNDED");
    assert.equal(rows[0].failure_reason, "API_NO_DATA");
    assert.equal((await balanceOf(id)).credit_balance, 1);
    assert.equal(await ledgerSum(id), 1);
  });

  test("concurrent refunds of one lookup only refund once", async () => {
    const id = await createUser();
    await topUp(id, 1);
    const lookupId = await deduct(id, "DUPREF");
    await Promise.allSettled(
      Array.from({ length: 8 }, () => pool.query("SELECT public.refund_lookup($1, 'API_ERROR')", [lookupId])),
    );
    assert.equal((await balanceOf(id)).credit_balance, 1);
  });

  test("a completed lookup is cached: re-deducting the same plate is refused", async () => {
    const id = await createUser();
    await topUp(id, 3);
    const lookupId = await deduct(id, "LY9TCAR");
    const done = await pool.query(
      `SELECT public.complete_lookup($1, 'mock', 'LY9T', 'Mythos Black', 'Metallic', 'Door shut',
                                     'Audi', 'A4', 2019, 'Black', '****1234', '{"ok":true}'::jsonb) AS ok`,
      [lookupId],
    );
    assert.equal(done.rows[0].ok, true);
    await assert.rejects(deduct(id, "LY9TCAR"), /CACHED_RESULT_AVAILABLE/);
    assert.equal((await balanceOf(id)).credit_balance, 2);

    // A refund after success must be a no-op.
    const refund = await pool.query("SELECT public.refund_lookup($1, 'API_ERROR') AS b", [lookupId]);
    assert.equal(refund.rows[0].b, null);
    assert.equal((await balanceOf(id)).credit_balance, 2);
  });

  test("complete_lookup refuses an empty paint code", async () => {
    const id = await createUser();
    await topUp(id, 1);
    const lookupId = await deduct(id, "NOPAINT1");
    await assert.rejects(
      pool.query(
        "SELECT public.complete_lookup($1, 'mock', NULL, NULL, NULL, NULL, 'BMW', '320i', 2018, 'Black', NULL, NULL)",
        [lookupId],
      ),
      /PAINT_CODE_REQUIRED/,
    );
  });

  test("stale PENDING lookups are swept and refunded", async () => {
    const id = await createUser();
    await topUp(id, 2);
    const lookupId = await deduct(id, "STALE01");
    await pool.query("UPDATE public.vehicle_lookups SET created_at = NOW() - INTERVAL '10 minutes' WHERE id = $1", [lookupId]);
    const { rows } = await pool.query("SELECT public.refund_stale_pending_lookups($1) AS n", [id]);
    assert.equal(rows[0].n, 1);
    assert.equal((await balanceOf(id)).credit_balance, 2);
  });
});

describe("Stripe idempotency & subscription buckets", () => {
  test("the same Stripe event id never credits twice, even concurrently", async () => {
    const id = await createUser();
    const eventId = `evt_${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        pool.query("SELECT public.grant_credits($1, 10, 'TOPUP_PURCHASE', $2, 'pack') AS g", [id, eventId]),
      ),
    );
    assert.equal(results.filter((r) => r.rows[0].g === true).length, 1);
    assert.equal((await balanceOf(id)).credit_balance, 10);
  });

  test("renewal without rollover expires only subscription credits, never top-ups", async () => {
    const id = await createUser();
    await topUp(id, 5);
    const grant = (eventId) =>
      pool.query(
        "SELECT public.grant_subscription_credits($1, 50, $2, 'pro', NOW() + INTERVAL '30 days', false, 'Pro plan') AS g",
        [id, eventId],
      );
    await grant("evt_period_1");
    assert.deepEqual(await balanceOf(id), { credit_balance: 55, subscription_credits: 50 });

    // Spend 3: they come out of the subscription bucket first.
    for (const vrm of ["SUB1", "SUB2", "SUB3"]) await deduct(id, vrm);
    assert.deepEqual(await balanceOf(id), { credit_balance: 52, subscription_credits: 47 });

    await grant("evt_period_2");
    assert.deepEqual(await balanceOf(id), { credit_balance: 55, subscription_credits: 50 });

    // Replayed webhook is ignored.
    const replay = await grant("evt_period_2");
    assert.equal(replay.rows[0].g, false);
    assert.deepEqual(await balanceOf(id), { credit_balance: 55, subscription_credits: 50 });

    // Cancellation expires the plan credits but the 5 top-up credits survive.
    await pool.query("SELECT public.expire_subscription_credits($1, 'cancelled')", [id]);
    assert.deepEqual(await balanceOf(id), { credit_balance: 5, subscription_credits: 0 });
    assert.equal(await ledgerSum(id), 5);
  });

  test("renewal with rollover keeps unused subscription credits", async () => {
    const id = await createUser();
    await pool.query(
      "SELECT public.grant_subscription_credits($1, 20, 'evt_roll_1', 'starter', NULL, true, 'Starter')",
      [id],
    );
    await pool.query(
      "SELECT public.grant_subscription_credits($1, 20, 'evt_roll_2', 'starter', NULL, true, 'Starter')",
      [id],
    );
    assert.deepEqual(await balanceOf(id), { credit_balance: 40, subscription_credits: 40 });
  });
});

describe("row level security", () => {
  async function asUser(userId, fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
      return await fn(client);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }

  test("a user sees only their own rows and cannot write balances or call RPCs", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await topUp(alice, 3);
    await topUp(bob, 7);

    await asUser(alice, async (client) => {
      const { rows } = await client.query("SELECT id, credit_balance FROM public.users");
      assert.deepEqual(rows, [{ id: alice, credit_balance: 3 }]);
      const ledger = await client.query("SELECT DISTINCT user_id FROM public.credit_transactions");
      assert.deepEqual(ledger.rows, [{ user_id: alice }]);
    });

    await asUser(alice, async (client) => {
      await assert.rejects(
        client.query("UPDATE public.users SET credit_balance = 999 WHERE id = $1", [alice]),
        /permission denied/,
      );
    });

    await asUser(alice, async (client) => {
      await assert.rejects(
        client.query("SELECT public.grant_credits($1, 100, 'ADMIN_ADJUSTMENT', NULL, 'hack')", [alice]),
        /permission denied/,
      );
    });

    await asUser(alice, async (client) => {
      await assert.rejects(deduct(bob, "STEAL1", client), /permission denied/);
    });

    assert.equal((await balanceOf(alice)).credit_balance, 3);
    assert.equal((await balanceOf(bob)).credit_balance, 7);
  });
});
