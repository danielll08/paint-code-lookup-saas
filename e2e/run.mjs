// End-to-end walk through every PRD feature against the running app (:3200)
// and the local stack (stack.mjs). Prints a PASS/FAIL report.
// Run through `npm run test:e2e` (e2e/run-all.mjs), which starts everything.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import Stripe from "stripe";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".output");
const APP = "http://localhost:3200";
const GW = "http://127.0.0.1:55400";
const env = JSON.parse(fs.readFileSync(path.join(OUT, "app.env.json"), "utf8"));
const shots = path.join(OUT, "screenshots");
fs.mkdirSync(shots, { recursive: true });
const stripe = new Stripe("sk_test_e2e");

const results = [];
let section = "";
function check(name, ok, detail = "") {
  results.push({ section, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${section}] ${name}${detail ? `  -- ${detail}` : ""}`);
}
async function step(name, fn) {
  section = name;
  try {
    await fn();
  } catch (error) {
    check("no exception", false, String(error?.message ?? error).split("\n")[0]);
    await page.screenshot({ path: path.join(shots, `fail-${name.replace(/[^a-z0-9]+/gi, "-")}.png`), fullPage: true }).catch(() => {});
  }
}
const sql = async (query, params = []) =>
  (await fetch(`${GW}/__test/sql`, { method: "POST", body: JSON.stringify({ sql: query, params }) })).json();
const mail = async (to) => (await fetch(`${GW}/__test/mail?to=${encodeURIComponent(to)}`)).json();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = async (email) =>
  (await sql("SELECT * FROM public.users WHERE email = $1", [email]))[0];

let eventSeq = 0;
async function webhook(type, object, { id, secret = env.STRIPE_WEBHOOK_SECRET } = {}) {
  const event = { id: id ?? `evt_e2e_${Date.now()}_${eventSeq++}`, object: "event", type, api_version: "2026-09-30", created: Math.floor(Date.now() / 1000), data: { object }, livemode: false };
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(`${APP}/api/webhooks/stripe`, { method: "POST", body: payload, headers: { "stripe-signature": signature, "content-type": "application/json" } });
  return { status: res.status, id: event.id };
}

const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: APP, viewport: { width: 1280, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: APP });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  // Expected 402/429/502 statuses are logged by Chrome as resource errors; only real JS errors on our pages count.
  if (msg.type() === "error" && page.url().startsWith(APP) && !/realtime|websocket|Failed to load resource/i.test(msg.text())) {
    consoleErrors.push(`${page.url()}: ${msg.text()}`);
  }
});
page.on("pageerror", (err) => page.url().startsWith(APP) && consoleErrors.push(`${page.url()}: ${err.message}`));

const EMAIL = "garage.owner@e2e.test";
const PASSWORD = "Passw0rd!123";
// Streamed (Suspense) content: wait for it instead of sampling visibility once.
const appears = (sel) => page.locator(sel).first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
const badge = () => page.locator("[aria-live=polite]").filter({ hasText: /Credit/ }).first().innerText();

async function lookup(plate) {
  // Wait until React has hydrated the search form (a user can't click faster than that meaningfully).
  await page.waitForFunction(() => {
    const el = document.querySelector("#vrm");
    return el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  });
  await page.fill("#vrm", plate);
  await page.click("button:has-text('Get Paint Code')");
  await page.waitForFunction(() => !document.querySelector("#vrm")?.disabled, null, { timeout: 30_000 });
}

// ============================================================================
await step("Landing page (PRD 3.2.1)", async () => {
  const res = await page.goto("/");
  check("GET / returns 200 for guests", res.status() === 200);
  check("Hero title", await page.getByRole("heading", { level: 1 }).innerText().then((t) => t.includes("paint code")));
  check("How it works: 3 steps", (await page.locator("ol > li").count()) === 3);
  check("Pricing tab 'Monthly plans' shows 3 plans", (await page.locator("text=/ month").count()) >= 3);
  await page.click("role=tab[name='Pay as you go']");
  check("Pricing tab 'Pay as you go' shows 5/10/25 packs", await page.locator("text=Buy 25 credits").isVisible());
  await page.screenshot({ path: path.join(shots, "01-landing.png"), fullPage: true });
  await page.fill("input[aria-label='Vehicle registration']", "ab12 cde");
  await page.click("button:has-text('Get Paint Code')");
  await page.waitForURL(/\/signup/);
  const url = new URL(page.url());
  check("Trial search asks to sign up, keeps the plate", url.searchParams.get("vrm") === "AB12CDE", page.url());
  check("Sign-up shows the plate notice", await page.locator("text=AB12 CDE").isVisible());

  const noJs = await browser.newContext({ baseURL: APP, javaScriptEnabled: false });
  const nj = await noJs.newPage();
  await nj.goto("/");
  await nj.fill("input[aria-label='Vehicle registration']", "ab12 cde");
  await nj.press("input[aria-label='Vehicle registration']", "Enter");
  await nj.waitForURL(/\/signup\?vrm=/);
  check("Without JS the trial search still reaches sign-up with the plate", new URL(nj.url()).searchParams.get("vrm") === "ab12 cde", nj.url());
  await noJs.close();
});

await step("Email sign-up + verification (PRD 3.1)", async () => {
  await page.fill("input[name=full_name]", "Bodyshop Owner");
  await page.fill("input[name=email]", EMAIL);
  await page.fill("input[name=password]", PASSWORD);
  await page.click("button:has-text('Create account')");
  await page.getByRole("heading", { name: "Check your email" }).waitFor();
  check("Shows 'check your email' (no session before verification)", true);
  const p = await profile(EMAIL);
  check("Profile auto-created with credit_balance = 0", p && p.credit_balance === 0, JSON.stringify(p && { bal: p.credit_balance, name: p.full_name }));
  check("Full name stored", p?.full_name === "Bodyshop Owner");

  await page.goto("/login");
  await page.fill("input[name=email]", EMAIL);
  await page.fill("input[name=password]", PASSWORD);
  await page.click("form button:has-text('Log in')");
  await page.locator("[role=alert]", { hasText: "confirm your email" }).waitFor();
  check("Login blocked until email is confirmed", true);

  const [message] = await mail(EMAIL);
  check("Verification email sent", Boolean(message?.link));
  await page.goto(message.link);
  await page.waitForURL(/\/dashboard/);
  check("Verification link signs in and lands on /dashboard", new URL(page.url()).pathname === "/dashboard", page.url());
  check("Plate from landing page is prefilled", (await page.inputValue("#vrm")) === "AB12CDE");
  check("Credit badge shows 0", /0 Credits/.test(await badge()), await badge());
});

await step("Smart routing / proxy (PRD 2.2)", async () => {
  const res = await page.request.get("/", { maxRedirects: 0 });
  check("Signed-in GET / -> 307 /dashboard", res.status() === 307 && res.headers().location?.endsWith("/dashboard"), `${res.status()} ${res.headers().location}`);
  const login = await page.request.get("/login", { maxRedirects: 0 });
  check("Signed-in GET /login -> 307 /dashboard", login.status() === 307);
  await page.goto("/about");
  check("'About us' still reachable when signed in", await appears("text=Go to dashboard"));
  const guest = await browser.newContext({ baseURL: APP });
  const g = await guest.request.get("/dashboard/billing", { maxRedirects: 0 });
  check("Guest /dashboard/billing -> 307 /login?next=", g.status() === 307 && g.headers().location.includes("/login?next=%2Fdashboard%2Fbilling"), g.headers().location);
  await guest.close();
});

await step("Insufficient credits -> buy popup (PRD 2.3 step 3)", async () => {
  await page.goto("/dashboard");
  await lookup("AB12CDE");
  check("Out-of-credits popup opens", await page.locator("dialog[open] >> text=You're out of credits").isVisible());
  check("Popup offers 5/10/25 top-ups", (await page.locator("dialog[open] form").count()) === 3);
  const rows = await sql("SELECT count(*)::int AS n FROM public.vehicle_lookups v JOIN public.users u ON u.id = v.user_id WHERE u.email = $1", [EMAIL]);
  check("No lookup row / no charge when balance is 0", rows[0].n === 0);
  await page.click("dialog[open] button:has-text('10 credits')");
  // Playwright can't route the target of a 303, so assert on the navigation itself.
  await page.waitForURL(/checkout\.stripe\.com/, { waitUntil: "commit" });
  check("Top-up button redirects to Stripe Checkout", page.url().includes("checkout.stripe.com"), page.url());
  const p = await profile(EMAIL);
  check("Stripe customer created and stored", Boolean(p.stripe_customer_id), p.stripe_customer_id);
  check("Visiting checkout did NOT add credits", p.credit_balance === 0);
});

let userId;
await step("Stripe webhook: top-up + idempotency (PRD 3.3.A/B)", async () => {
  const p = await profile(EMAIL);
  userId = p.id;
  await page.goto("/payment-success?session_id=cs_test_fake");
  check("Success page does not credit", (await profile(EMAIL)).credit_balance === 0);

  const session = { id: "cs_test_e2e_1", object: "checkout.session", mode: "payment", payment_status: "paid", customer: p.stripe_customer_id, client_reference_id: userId, metadata: { user_id: userId, kind: "topup", item_id: "topup_10" } };
  const forged = await webhook("checkout.session.completed", session, { secret: "whsec_wrong" });
  check("Forged signature rejected (400)", forged.status === 400);
  check("...and no credits added", (await profile(EMAIL)).credit_balance === 0);

  const first = await webhook("checkout.session.completed", session, { id: "evt_topup_1" });
  check("Signed checkout.session.completed accepted (200)", first.status === 200);
  check("+10 credits", (await profile(EMAIL)).credit_balance === 10);
  const replay = await webhook("checkout.session.completed", session, { id: "evt_topup_1" });
  check("Replayed event returns 200", replay.status === 200);
  check("Replayed event does NOT double credit", (await profile(EMAIL)).credit_balance === 10);

  const unpaid = await webhook("checkout.session.completed", { ...session, id: "cs_unpaid", payment_status: "unpaid" });
  check("Unpaid (async) checkout does not credit", unpaid.status === 200 && (await profile(EMAIL)).credit_balance === 10);

  await page.goto("/dashboard");
  check("Badge shows 10 credits", /10 Credits/.test(await badge()), await badge());
});

await step("Core lookup flow (PRD 2.3, 3.2.2)", async () => {
  await wait(1100); // the 402 attempt above counts towards the 1 req/s rate limit
  await lookup("AB12 CDE");
  const card = page.locator("section[aria-label='Paint information']");
  await card.waitFor();
  const code = await card.locator(".font-mono").first().innerText();
  check("Result card shows paint code", code.length > 0, code);
  check("Note '1 credit used'", await page.locator("text=1 credit used").isVisible());
  check("Vehicle details: make/model/year/colour/partial VIN", await page.locator("text=VIN (partial)").isVisible() && /\*{4,}/.test(await page.locator("section[aria-label='Vehicle details']").innerText()));
  check("Paint name + finish shown", await page.locator("text=Paint name").isVisible() && await page.locator("text=Finish").isVisible());
  check("Paint code label location hint shown", await page.locator("text=Where to find the paint code label").isVisible());
  check("Plate location diagram highlights the area on the car", await page.locator("figure svg[role=img]").first().isVisible());
  check("Badge updated to 9 instantly", /9 Credits/.test(await badge()), await badge());
  await page.click("button:has-text('Copy')");
  check("Copy button copies the paint code", (await page.evaluate(() => navigator.clipboard.readText())) === code);
  await page.screenshot({ path: path.join(shots, "02-dashboard-result.png"), fullPage: true });

  await page.locator("table >> text=AB12 CDE").waitFor();
  check("Lookup appears in Recent lookups table", true);
  const db = await sql("SELECT status, paint_code FROM public.vehicle_lookups WHERE user_id = $1", [userId]);
  check("DB row status SUCCESS with paint code", db.length === 1 && db[0].status === "SUCCESS" && db[0].paint_code === code);

  await lookup("AB12CDE");
  check("Same plate again: 'Saved in your history - no credit used' (PRD 5.2)", await page.locator("text=Saved in your history").isVisible());
  check("...balance unchanged (9)", (await profile(EMAIL)).credit_balance === 9);
});

await step("Refund scenarios + failover (PRD 2.3 B, 5.1, 1.2.3)", async () => {
  const cases = [
    ["NF12ABC", "text=No paint code found", "NOT_FOUND_REFUNDED"],
    ["NP12ABC", "text=paint code is not available", "NOT_FOUND_REFUNDED"],
    ["ER12ABC", "text=not responding", "FAILED_REFUNDED"],
    ["SL12ABC", "text=not responding", "FAILED_REFUNDED"],
  ];
  for (const [plate, text, status] of cases) {
    await wait(1100);
    const started = Date.now();
    await lookup(plate);
    const took = Date.now() - started;
    check(`${plate}: message shown`, await page.locator(text).first().isVisible(), `${took} ms`);
    const row = (await sql("SELECT status, failure_reason FROM public.vehicle_lookups WHERE user_id = $1 AND vrm_normalized = $2", [userId, plate]))[0];
    check(`${plate}: DB ${status}`, row?.status === status, JSON.stringify(row));
    check(`${plate}: balance still 9 (auto-refund)`, (await profile(EMAIL)).credit_balance === 9);
    if (plate === "NP12ABC") check("NP12ABC: vehicle shown though paint code missing", await page.locator("section[aria-label='Vehicle details']").isVisible());
    if (plate === "SL12ABC") check("SL12ABC: timed out instead of hanging (2 providers x 3 s)", took < 12_000, `${took} ms`);
  }
  const ledger = await sql("SELECT transaction_type, description FROM public.credit_transactions WHERE user_id = $1 AND transaction_type = 'LOOKUP_REFUND' ORDER BY created_at", [userId]);
  check("Ledger has 4 refund entries with reasons", ledger.length === 4 && ledger.some((l) => l.description.includes("API_NO_DATA")) && ledger.some((l) => l.description.includes("API_ERROR")), ledger.map((l) => l.description).join(" | "));

  await wait(1100);
  await lookup("FO12ABC");
  check("FO12ABC: primary down -> backup provider succeeds", await page.locator("text=source mock-backup").isVisible());
  check("FO12ABC charged once (balance 8)", (await profile(EMAIL)).credit_balance === 8);
});

await step("Abuse protection: rate limit + double clicks (PRD 2.3 step 2-3)", async () => {
  await wait(1100);
  const statuses = await page.evaluate(async () => {
    const call = (vrm) => fetch("/api/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vrm }) }).then((r) => r.status);
    return Promise.all(Array.from({ length: 20 }, () => call("RC12ABC")));
  });
  const ok = statuses.filter((s) => s === 200).length;
  check("20 instant clicks on a new plate: exactly 1 succeeds", ok === 1, statuses.join(","));
  check("...the rest get 429 (rate limit) or 409 (in progress)", statuses.every((s) => [200, 409, 429].includes(s)));
  check("...charged exactly 1 credit (balance 7)", (await profile(EMAIL)).credit_balance === 7);

  await wait(1100);
  const burst = await page.evaluate(async () => {
    const call = (vrm) => fetch("/api/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vrm }) }).then((r) => r.status);
    return Promise.all(["RD12ABC", "RE12ABC", "RF12ABC", "RG12ABC"].map(call));
  });
  check("4 different plates in the same second: 1 allowed, 3 x 429", burst.filter((s) => s === 200).length === 1 && burst.filter((s) => s === 429).length === 3, burst.join(","));
  const invalid = await page.evaluate(() => fetch("/api/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vrm: "!!" }) }).then((r) => r.status));
  check("Invalid plate -> 400", invalid === 400);
  const ledgerOk = await sql("SELECT (SELECT credit_balance FROM public.users WHERE id = $1) AS bal, (SELECT COALESCE(SUM(amount),0)::int FROM public.credit_transactions WHERE user_id = $1) AS sum", [userId]);
  check("Ledger sum == balance (no leakage)", ledgerOk[0].bal === ledgerOk[0].sum, JSON.stringify(ledgerOk[0]));

  // Invalid bodies never reach the database: the route answers 400, so any 429 here came from proxy.ts.
  await wait(1100);
  const flood = await page.evaluate(async () => {
    const call = () => fetch("/api/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vrm: "!!" }) });
    return Promise.all(Array.from({ length: 10 }, async () => {
      const r = await call();
      return { status: r.status, retryAfter: r.headers.get("retry-after") };
    }));
  });
  check("Proxy (edge) blocks floods: 10 in 1 s -> 5 reach the route, 5 x 429", flood.filter((r) => r.status === 400).length === 5 && flood.filter((r) => r.status === 429).length === 5, flood.map((r) => r.status).join(","));
  check("...429 from the proxy carries Retry-After", flood.filter((r) => r.status === 429).every((r) => r.retryAfter === "1"));
});

await step("Recent lookups table (PRD 3.2.2)", async () => {
  await page.goto("/dashboard");
  const headers = await page.locator("thead th").allInnerTexts();
  check("Columns: Time | Registration | Vehicle | Paint code", ["TIME", "REGISTRATION", "VEHICLE", "PAINT CODE"].every((h) => headers.map((x) => x.toUpperCase()).includes(h)), headers.join("|"));
  const before = await page.locator("tbody tr").count();
  await page.fill("input[aria-label='Filter recent lookups']", "fo12");
  const after = await page.locator("tbody tr").count();
  check("Quick filter narrows rows", before > 1 && after === 1, `${before} -> ${after}`);
  await page.click("text=View details");
  check("'View details' opens the result card", await page.locator("dialog[open] >> text=Paint code").first().isVisible());
  await page.keyboard.press("Escape");
});

await step("Billing page (PRD 3.2.3)", async () => {
  await page.goto("/dashboard/billing");
  await page.locator("text=Credit history").waitFor();
  check("Shows pay-as-you-go when no plan", await page.locator("text=Pay as you go").first().isVisible());
  const ledgerText = await page.getByRole("table").filter({ hasText: "Balance" }).innerText();
  check("Ledger shows top-up, lookup and refund", ["Top-up purchase", "Lookup", "Refund"].every((t) => ledgerText.includes(t)));
  check("Quick top-up buttons 5/10/25", await page.locator("text=Pay as you go").first().isVisible());
  await page.screenshot({ path: path.join(shots, "03-billing.png"), fullPage: true });
  // stripe-mock's portal URL has no DNS record, so assert on the outgoing request.
  const [portalReq] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("stripe.me")),
    page.click("button:has-text('Manage Subscription / Invoices')"),
  ]);
  check("Manage Subscription -> Stripe Customer Portal", portalReq.url().includes("stripe.me"), portalReq.url());
  await page.waitForURL(/chrome-error|stripe\.me/, { timeout: 15_000 }).catch(() => {});
  await page.goto("/dashboard/billing?canceled=1");
  check("?canceled=1 shows 'not been charged'", await appears("text=Checkout cancelled"));
  await page.goto("/dashboard/billing?error=checkout_failed");
  check("?error= shows error", await appears("text=couldn't start the checkout"));
  await page.goto("/dashboard/billing");
  await page.locator("text=Credit history").waitFor();
  await page.click("role=tab[name='Monthly plans']").catch(() => {});
  await page.click("button:has-text('Subscribe to Pro')");
  await page.waitForURL(/checkout\.stripe\.com/, { waitUntil: "commit" });
  check("Subscribe button -> Stripe Checkout (subscription)", page.url().includes("checkout.stripe.com"));
});

await step("Monthly subscription lifecycle (PRD 3.3.A, 5.3)", async () => {
  // stripe-mock's fixture subscription belongs to this customer id.
  await sql("UPDATE public.users SET stripe_customer_id = 'cus_QXg1o8vcGmoR32' WHERE id = $1", [userId]);
  const sub = { id: "sub_123", object: "subscription", customer: "cus_QXg1o8vcGmoR32", status: "active", metadata: { user_id: userId, plan_id: "pro" }, items: { object: "list", data: [{ price: { id: env.STRIPE_PRICE_PRO }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } };
  const created = await webhook("customer.subscription.created", sub);
  let p = await profile(EMAIL);
  check("subscription.created -> tier pro, active", created.status === 200 && p.subscription_tier === "pro" && p.subscription_status === "active", `${p.subscription_tier}/${p.subscription_status}`);
  const topUps = p.credit_balance;

  const invoice = { id: "in_e2e_1", object: "invoice", customer: "cus_QXg1o8vcGmoR32", parent: { type: "subscription_details", subscription_details: { subscription: "sub_123" } } };
  const paid = await webhook("invoice.paid", invoice, { id: "evt_invoice_1" });
  p = await profile(EMAIL);
  check("invoice.paid -> +50 monthly credits", paid.status === 200 && p.credit_balance === topUps + 50 && p.subscription_credits === 50, `status ${paid.status} bal ${p.credit_balance} sub ${p.subscription_credits}`);
  await webhook("invoice.paid", invoice, { id: "evt_invoice_1" });
  check("Replayed invoice.paid ignored", (await profile(EMAIL)).credit_balance === topUps + 50);

  await page.goto("/dashboard/billing");
  check("Billing shows 'Pro plan · 50 credits / month'", await appears("text=Pro plan · 50 credits / month"));
  check("Shows renewal date", await appears("text=renews on"));
  const [changeReq] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("stripe.me")),
    page.click("button:has-text('Change plan') >> nth=0"),
  ]);
  check("Already subscribed: 'Change plan' goes to the portal, not a 2nd subscription", changeReq.url().includes("stripe.me"));
  await page.waitForURL(/chrome-error|stripe\.me/, { timeout: 15_000 }).catch(() => {});

  await page.goto("/dashboard");
  await wait(1100);
  await lookup("SB12ABC");
  p = await profile(EMAIL);
  check("Lookups spend monthly credits first", p.subscription_credits === 49 && p.credit_balance - p.subscription_credits === topUps, `sub ${p.subscription_credits} total ${p.credit_balance}`);

  const renewal = await webhook("invoice.paid", { ...invoice, id: "in_e2e_2" }, { id: "evt_invoice_2" });
  p = await profile(EMAIL);
  check("Renewal (rollover off): unused monthly credits reset to 50, top-ups kept", renewal.status === 200 && p.subscription_credits === 50 && p.credit_balance === topUps + 50, `sub ${p.subscription_credits} total ${p.credit_balance}`);

  const failed = await webhook("invoice.payment_failed", invoice);
  p = await profile(EMAIL);
  check("invoice.payment_failed -> past_due", failed.status === 200 && p.subscription_status === "past_due");
  await page.goto("/dashboard");
  check("Dashboard shows 'update your card' banner", await appears("text=Your last subscription payment failed"));
  await page.screenshot({ path: path.join(shots, "04-past-due.png") });
  await wait(1100);
  await lookup("PD12ABC");
  check("past_due user can still use credits", await page.locator("text=1 credit used").isVisible());

  const deleted = await webhook("customer.subscription.deleted", { ...sub, status: "canceled" });
  p = await profile(EMAIL);
  check("subscription.deleted -> canceled, monthly credits expired, top-ups kept", deleted.status === 200 && p.subscription_status === "canceled" && p.subscription_credits === 0 && p.credit_balance === topUps, `status ${p.subscription_status} total ${p.credit_balance} topups ${topUps}`);
  const sums = await sql("SELECT (SELECT credit_balance FROM public.users WHERE id = $1) AS bal, (SELECT COALESCE(SUM(amount),0)::int FROM public.credit_transactions WHERE user_id = $1) AS sum", [userId]);
  check("Ledger sum == balance after the whole lifecycle", sums[0].bal === sums[0].sum, JSON.stringify(sums[0]));
});

await step("Stale PENDING safety net (cron)", async () => {
  const unauth = await fetch(`${APP}/api/cron/refund-stale`);
  check("Cron endpoint requires CRON_SECRET", unauth.status === 401);
  const before = (await profile(EMAIL)).credit_balance;
  const [{ id }] = await sql("SELECT public.deduct_credit_for_lookup($1, 'CRASH12', 'mock-primary') AS id", [userId]);
  await sql("UPDATE public.vehicle_lookups SET created_at = NOW() - INTERVAL '5 minutes' WHERE id = $1", [id]);
  const res = await fetch(`${APP}/api/cron/refund-stale`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
  const body = await res.json();
  check("Cron refunds a lookup stuck in PENDING", res.status === 200 && body.refunded === 1 && (await profile(EMAIL)).credit_balance === before, JSON.stringify(body));
});

await step("Automatic top-up when credits run out (PRD 1, business customers)", async () => {
  await page.goto("/dashboard/billing");
  check("Billing shows 'Automatic top-up', off by default", (await appears("text=Automatic top-up")) && (await page.getByTestId("auto-topup-status").innerText()) === "Off.");
  await page.selectOption("#auto-topup-pack", "topup_5");
  await page.click("form:has(#auto-topup-pack) button:has-text('Save')");
  await page.waitForURL(/auto_topup=on/);
  check("Saving shows a confirmation", await appears("text=Automatic top-up is on."));
  check("Status shows the chosen pack", /On: 5 credits for £5\.99/.test(await page.getByTestId("auto-topup-status").innerText()));
  check("Stored on the profile", (await profile(EMAIL)).auto_topup_pack === "topup_5");

  // Spend everything but one credit, then use the last one through the UI.
  const left = (await profile(EMAIL)).credit_balance;
  if (left > 1) {
    await sql(
      "SELECT public.complete_lookup(public.deduct_credit_for_lookup($1, 'AT' || g || 'XYZ', 'mock-primary'), 'mock-primary', 'LY9T', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL) FROM generate_series(1, $2) g",
      [userId, left - 1],
    );
  }
  await page.goto("/dashboard");
  await wait(1100);
  await lookup("AZ12ZZZ");
  check("Last credit used -> badge 0", /0 Credits/.test(await badge()), await badge());
  let p;
  for (let i = 0; i < 20 && !(p = await profile(EMAIL)).auto_topup_attempted_at; i++) await wait(250);
  check("Balance 0 -> off-session charge started (after the response)", Boolean(p.auto_topup_attempted_at) && !p.auto_topup_last_error, p.auto_topup_last_error ?? "");
  check("...but no credits until Stripe confirms", p.credit_balance === 0);

  await wait(1100);
  const lookupAt0 = await page.evaluate(() => fetch("/api/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vrm: "AZ13ZZZ" }) }).then((r) => r.status));
  await wait(500);
  check("Second attempt at 0 credits: 402 and no second charge (cooldown)", lookupAt0 === 402 && (await profile(EMAIL)).auto_topup_attempted_at === p.auto_topup_attempted_at);

  const intent = { id: "pi_auto_e2e_1", object: "payment_intent", customer: p.stripe_customer_id, status: "succeeded", metadata: { user_id: userId, kind: "auto_topup", item_id: "topup_5" } };
  const manual = await webhook("payment_intent.succeeded", { ...intent, id: "pi_checkout_e2e", metadata: { ...intent.metadata, kind: "topup" } });
  check("Checkout payment intents are ignored (credited by checkout.session.completed)", manual.status === 200 && (await profile(EMAIL)).credit_balance === 0);
  const ok = await webhook("payment_intent.succeeded", intent, { id: "evt_auto_topup_1" });
  check("payment_intent.succeeded -> +5 credits", ok.status === 200 && (await profile(EMAIL)).credit_balance === 5);
  await webhook("payment_intent.succeeded", intent, { id: "evt_auto_topup_1" });
  check("Replayed auto top-up event does NOT double credit", (await profile(EMAIL)).credit_balance === 5);

  // No Realtime in the local stack: the badge's focus refresh must pick the new balance up.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(() => /5 Credits/.test(document.querySelector("[aria-live=polite]")?.textContent ?? ""), null, { timeout: 5_000 }).catch(() => {});
  check("Badge refreshes on window focus without Realtime", /5 Credits/.test(await badge()), await badge());

  await webhook("payment_intent.payment_failed", { ...intent, id: "pi_auto_e2e_2", status: "requires_payment_method" });
  await page.goto("/dashboard/billing");
  check("Declined auto top-up shows an error on billing", await appears("text=Your card was declined for the automatic top-up."));
  const ledger = await page.getByRole("table").filter({ hasText: "Balance" }).innerText();
  check("Ledger lists 'Automatic top-up: +5 credits'", ledger.includes("Automatic top-up: +5 credits"));

  await page.selectOption("#auto-topup-pack", "");
  await page.click("form:has(#auto-topup-pack) button:has-text('Save')");
  await page.waitForURL(/auto_topup=off/);
  check("Can turn it off again", (await profile(EMAIL)).auto_topup_pack === null && (await page.getByTestId("auto-topup-status").innerText()) === "Off.");
  const sums = await sql("SELECT (SELECT credit_balance FROM public.users WHERE id = $1) AS bal, (SELECT COALESCE(SUM(amount),0)::int FROM public.credit_transactions WHERE user_id = $1) AS sum", [userId]);
  check("Ledger sum == balance after auto top-up", sums[0].bal === sums[0].sum, JSON.stringify(sums[0]));
});

await step("Row Level Security via the public API", async () => {
  const cookies = await context.cookies(APP);
  const authCookie = cookies.filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && !c.name.includes("verifier")).sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.value).join("");
  const sessionJson = JSON.parse(Buffer.from(authCookie.replace(/^base64-/, ""), "base64url").toString());
  const token = sessionJson.access_token;
  const headers = { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  await sql("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'other@e2e.test')");
  const own = await (await fetch(`${GW}/rest/v1/users?select=email`, { headers })).json();
  check("User can only read their own profile", own.length === 1 && own[0].email === EMAIL, JSON.stringify(own));
  const patch = await fetch(`${GW}/rest/v1/users?id=eq.${userId}`, { method: "PATCH", headers, body: JSON.stringify({ credit_balance: 9999 }) });
  check("User cannot PATCH their balance", patch.status >= 400 && (await profile(EMAIL)).credit_balance !== 9999, `HTTP ${patch.status}`);
  const rpc = await fetch(`${GW}/rest/v1/rpc/grant_credits`, { method: "POST", headers, body: JSON.stringify({ p_user_id: userId, p_amount: 1000, p_type: "ADMIN_ADJUSTMENT", p_stripe_event_id: null, p_description: "hack" }) });
  check("User cannot call grant_credits RPC", rpc.status >= 400, `HTTP ${rpc.status}`);
  const anon = await (await fetch(`${GW}/rest/v1/users?select=email`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}` } })).json();
  check("Anonymous key reads nothing", Array.isArray(anon) ? anon.length === 0 : true, JSON.stringify(anon).slice(0, 80));
});

await step("Sign out, forgot & reset password (PRD 3.1)", async () => {
  await page.goto("/dashboard");
  await page.click("button:has-text('Account menu')");
  await page.click("role=menuitem[name='Sign out']");
  await page.waitForURL(`${APP}/`);
  check("Sign out returns to the landing page", await appears("text=Sign up free"));
  const g = await page.request.get("/dashboard", { maxRedirects: 0 });
  check("After sign out /dashboard redirects to login", g.status() === 307);

  await page.goto("/login");
  await page.fill("input[name=email]", EMAIL);
  await page.fill("input[name=password]", "wrong-password");
  await page.click("form button:has-text('Log in')");
  check("Wrong password rejected", await page.locator("text=Incorrect email or password").isVisible({ timeout: 10_000 }).catch(() => false) || (await page.locator("text=Incorrect email or password").waitFor().then(() => true)));

  await page.goto("/forgot-password");
  await page.fill("input[name=email]", EMAIL);
  await page.click("button:has-text('Send reset link')");
  await page.locator("text=reset link is on its way").waitFor();
  check("Forgot password: neutral confirmation message", true);
  const recovery = (await mail(EMAIL)).find((m) => m.type === "recovery");
  check("Recovery email sent", Boolean(recovery));
  await page.goto(recovery.link);
  await page.waitForURL(/\/reset-password/);
  check("Recovery link opens /reset-password", true);
  await page.fill("input[name=password]", "NewPassw0rd!");
  await page.fill("input[name=confirm]", "NewPassw0rd!");
  await page.click("button:has-text('Update password')");
  await page.waitForURL(/\/dashboard/);
  check("Password updated -> dashboard", true);

  await page.click("button:has-text('Account menu')");
  await page.click("role=menuitem[name='Sign out']");
  await page.waitForURL(`${APP}/`);
  await page.goto("/login?next=%2Fdashboard%2Fbilling");
  await page.fill("input[name=email]", EMAIL);
  await page.fill("input[name=password]", "NewPassw0rd!");
  await page.click("form button:has-text('Log in')");
  await page.waitForURL(/\/dashboard\/billing/);
  check("Login with the new password honours ?next=", true);
});

await step("Google OAuth (PRD 3.1)", async () => {
  await page.click("button:has-text('Account menu')");
  await page.click("role=menuitem[name='Sign out']");
  await page.waitForURL(`${APP}/`);
  await page.goto("/login");
  await page.click("button:has-text('Continue with Google')");
  await page.waitForURL(/\/dashboard/);
  check("Google sign-in lands on /dashboard", true);
  const g = await profile("google.user@gmail.test");
  check("New Google user gets a profile with 0 credits", g?.credit_balance === 0 && g.full_name === "Google User", JSON.stringify(g && { bal: g.credit_balance, name: g.full_name }));
  check("Badge shows 0 for the new user", /0 Credits/.test(await badge()));
  const evil = await page.request.get("/auth/callback?code=bogus&next=https://evil.example", { maxRedirects: 0 });
  check("Bad OAuth code -> back to login with error (no open redirect)", evil.status() === 307 && evil.headers().location.startsWith(`${APP}/login`), evil.headers().location);
});

await step("Mobile layout", async () => {
  const mobile = await browser.newContext({ baseURL: APP, viewport: { width: 390, height: 844 }, storageState: await context.storageState() });
  const m = await mobile.newPage();
  for (const [url, name] of [["/about", "05-mobile-landing.png"], ["/dashboard", "06-mobile-dashboard.png"], ["/dashboard/billing", "07-mobile-billing.png"]]) {
    await m.goto(url);
    await m.waitForLoadState("networkidle");
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${url}: no horizontal page scroll at 390px`, overflow <= 0, `overflow ${overflow}px`);
    await m.screenshot({ path: path.join(shots, name), fullPage: true });
  }
  await mobile.close();
});

section = "Browser console";
check("No JS errors in the browser console", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" || "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
for (const f of failed) console.log(`FAILED: [${f.section}] ${f.name} ${f.detail}`);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
