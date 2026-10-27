# PaintCode Finder — Paint Code Lookup SaaS

Users enter a UK registration (VRM) or a VIN and get the car's OEM paint code. Lookups are paid with credits, bought through Stripe. The full spec is in `t_i_li_u_y_u_c_u_s_n_ph_m_prd_paint_code_lookup_saas.md` (the PRD).

**Stack:** Next.js 16 (App Router, Cache Components, `proxy.ts`) · Tailwind CSS 4 · Supabase (PostgreSQL + Auth) · Stripe · Upstash Redis (optional).

## Quick start

```bash
npm install
cp .env.example .env.local           # fill in the Supabase + Stripe keys
npx supabase start                   # local Postgres + Auth (needs Docker)
npx supabase db reset                # applies supabase/migrations
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # copy the whsec_ into .env.local
npm run dev
```

For a deployed site, add a Stripe webhook endpoint at `<site>/api/webhooks/stripe` with these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created|updated|deleted`, `payment_intent.succeeded` and `payment_intent.payment_failed`.

For a hosted Supabase project, run `npx supabase link` and then `npx supabase db push`. In the dashboard, turn on **Confirm email** and the **Google** provider, and add `<site>/auth/callback` to the allowed redirect URLs.

### Try it without any Supabase/Stripe account

```bash
npm run e2e:setup   # once: downloads PostgREST, stripe-mock and Playwright's Chromium
npm run demo        # http://localhost:3000, login demo@paintcode.test / Demo12345! (20 credits)
```

`npm run demo` starts a local stand-in for the services (`e2e/stack.mjs`):
- an embedded PostgreSQL that runs the real migrations;
- PostgREST, the same API layer Supabase uses;
- a small emulator of the Supabase Auth endpoints that issues real signed JWTs;
- stripe-mock.

Sign-up confirmation emails are shown at `http://127.0.0.1:55400/__test/mail`. All data is discarded when you stop the demo. Realtime and the Stripe-hosted Checkout/Portal pages are not emulated.

### Tests

| Script | What it checks |
| --- | --- |
| `npm run test:db` | Runs the migration on a **real embedded PostgreSQL** and tests race conditions, the CHECK constraints, refunds, webhook idempotency, RLS and the auto top-up lock (17 tests) |
| `npm test` | Vitest: VRM parsing, adapters/failover, the lookup + refund flow, Stripe signature checks |
| `npm run test:e2e` | Builds the app and drives it in Chromium against the local stack. Covers every PRD flow (133 checks): sign-up and email verification, Google, password reset, lookups, refunds, failover, rate limiting (route and proxy), signed webhooks, the subscription lifecycle, automatic top-up, the badge refresh, RLS and mobile layout. Screenshots are saved to `e2e/.output/` |
| `npm run lint` / `npm run build` | ESLint and the production build |

## Architecture

```
src/proxy.ts                      Routing: signed in + "/" -> 307 /dashboard; signed out + /dashboard -> /login;
                                  burst guard: > 5 POST /api/lookup per second -> 429 before any database work
supabase/migrations/*.sql         Schema, CHECK (>= 0), SELECT ... FOR UPDATE functions, RLS
src/lib/lookup/service.ts         Core flow (PRD 2.3): cache -> rate limit -> deduct -> provider -> complete | refund
src/lib/paint-api/                Adapter Pattern: types, failover chain, mock + HTTP template providers
src/lib/stripe/webhook.ts         Idempotent handlers (checkout, invoice.paid / payment_failed, subscription.*, payment_intent.*)
src/lib/stripe/auto-topup.ts      Off-session top-up charge when an opted-in user reaches 0 credits
src/app/api/webhooks/stripe       The only place credits are added after a payment (signature verified)
src/app/dashboard                 Search box, result card, history, billing + ledger
```

### Credit safety (Zero Credit Leakage)
- `users.credit_balance CHECK (>= 0)`: the database rejects any write that would make the balance negative.
- `deduct_credit_for_lookup` locks the user row with `SELECT ... FOR UPDATE`. Concurrent clicks wait in line, and a second click on the same plate gets `LOOKUP_IN_PROGRESS` instead of being charged again.
- Credits are refunded automatically when there is no data, no paint code (PRD 5.1) or a provider error/timeout. A partial UNIQUE index allows only one refund per lookup.
- Lookups stuck in `PENDING` (for example, the server crashed) are refunded before the user's next lookup and also by the cron job at `/api/cron/refund-stale` (see `vercel.json`).
- Stripe webhooks: `stripe_event_id UNIQUE`. When Stripe sends the same event again, the handler returns `200` and adds nothing.
- The credit functions can only be run with the `service_role` key. On the client, RLS allows reading only your own rows.

### Credit buckets & rollover
`subscription_credits` is the part of the balance that comes from the monthly plan and is spent first. Top-up credits (`credit_balance - subscription_credits`) **never expire**. With `SUBSCRIPTION_CREDIT_ROLLOVER=false` (the default), unused plan credits expire at renewal and when the subscription is cancelled.

### Automatic top-up
On `/dashboard/billing` a user can pick a pack (or Off). When a lookup leaves the balance at 0, the lookup route schedules `maybeAutoTopUp` with `after()`, so the response is not delayed. `claim_auto_topup` locks the user row and allows at most one charge every 10 minutes. The charge is an off-session PaymentIntent on the card saved on the Stripe customer (from the subscription, or from a top-up bought while auto top-up is on). Credits are still added only by the `payment_intent.succeeded` webhook, idempotent on the event id. A declined card shows a message on the billing page.

### Credit badge
The badge listens to Supabase Realtime on the user's row. It also re-reads the balance when the tab regains focus and every 30 s, in case the websocket is blocked or an event is missed.

### Adding a real provider (Milestone 3)
Copy `src/lib/paint-api/providers/http-template.ts`, map the provider's JSON to `StandardizedVehiclePaintData`, add one line to the `REGISTRY` in `src/lib/paint-api/index.ts`, then set `PAINT_API_PROVIDERS=new-provider,mock-backup`. No UI or billing code needs to change.

### Mock test plates
| Plate starts with | Result |
| --- | --- |
| anything else (e.g. `AB12CDE`) | Paint code found, 1 credit used |
| `NF` (or contains `404`) | Vehicle not found, refunded (`API_NO_DATA`) |
| `NP` | Vehicle found but no paint code, refunded (`API_NO_DATA`) |
| `ER` | Provider HTTP 500, refunded (`API_ERROR`) |
| `SL` | Responds after 12 s, times out after 10 s, refunded |
| `FO` | Primary provider down, backup succeeds (failover) |

Stripe test card: `4242 4242 4242 4242`. Pricing in `src/lib/plans.ts` is a placeholder until the client confirms it (PRD section 7).
