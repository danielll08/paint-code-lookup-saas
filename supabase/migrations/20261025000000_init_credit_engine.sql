-- =============================================================================
-- Paint Code Lookup SaaS - core schema & atomic credit engine (PRD section 4.2)
--
-- Guarantees:
--   * credit_balance can never go negative (CHECK >= 0, enforced by Postgres).
--   * Every balance mutation locks the user's row with SELECT ... FOR UPDATE, so
--     concurrent lookups for the same user are serialised (no race condition).
--   * Stripe webhooks are idempotent: stripe_event_id is UNIQUE in the ledger.
--   * A lookup can be refunded at most once (partial UNIQUE index).
--   * Clients can only READ their own rows (RLS). Every write goes through the
--     SECURITY DEFINER functions below, which only the service_role may execute.
--
-- Lock ordering (to avoid deadlocks): users row first, then vehicle_lookups row.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Users & balance
--    credit_balance        = total spendable credits (what the UI shows).
--    subscription_credits  = the part of credit_balance granted by the monthly
--                            plan. It may expire on renewal / cancellation when
--                            rollover is disabled. The remainder
--                            (credit_balance - subscription_credits) are top-up
--                            credits, which never expire (PRD 3.3.A).
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    stripe_customer_id TEXT UNIQUE,
    credit_balance INTEGER NOT NULL DEFAULT 0 CONSTRAINT credit_balance_non_negative CHECK (credit_balance >= 0),
    subscription_credits INTEGER NOT NULL DEFAULT 0 CONSTRAINT subscription_credits_non_negative CHECK (subscription_credits >= 0),
    subscription_status TEXT NOT NULL DEFAULT 'inactive'
        CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
    subscription_tier TEXT CHECK (subscription_tier IN ('starter', 'pro', 'agency')),
    stripe_subscription_id TEXT UNIQUE,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subscription_credits_within_balance CHECK (subscription_credits <= credit_balance)
);

-- -----------------------------------------------------------------------------
-- 2. Credit ledger (audit trail + webhook de-duplication)
-- -----------------------------------------------------------------------------
CREATE TABLE public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount <> 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'SUBSCRIPTION_CREDIT',
        'SUBSCRIPTION_EXPIRY',
        'TOPUP_PURCHASE',
        'LOOKUP_DEDUCTION',
        'LOOKUP_REFUND',
        'ADMIN_ADJUSTMENT'
    )),
    credit_bucket TEXT NOT NULL DEFAULT 'TOPUP' CHECK (credit_bucket IN ('SUBSCRIPTION', 'TOPUP')),
    stripe_event_id TEXT UNIQUE,
    reference_lookup_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_tx_user_created ON public.credit_transactions(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Vehicle lookups (history + 30-day per-user cache)
-- -----------------------------------------------------------------------------
CREATE TABLE public.vehicle_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vrm_normalized TEXT NOT NULL CHECK (vrm_normalized ~ '^[A-Z0-9]{1,17}$'),
    api_provider TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED_REFUNDED', 'NOT_FOUND_REFUNDED')),
    paint_code TEXT,
    paint_name TEXT,
    paint_finish TEXT,
    code_location_hint TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER,
    registered_color TEXT,
    vin_partial TEXT,
    raw_api_response JSONB,
    failure_reason TEXT,
    cost_credits INTEGER NOT NULL DEFAULT 1 CHECK (cost_credits >= 0),
    deducted_bucket TEXT CHECK (deducted_bucket IN ('SUBSCRIPTION', 'TOPUP')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    -- A successful lookup must carry a paint code (PRD 5.1: no paint code = no charge).
    CONSTRAINT success_requires_paint_code CHECK (status <> 'SUCCESS' OR paint_code IS NOT NULL)
);

CREATE INDEX idx_lookups_user_vrm ON public.vehicle_lookups(user_id, vrm_normalized, created_at DESC);
CREATE INDEX idx_lookups_user_created ON public.vehicle_lookups(user_id, created_at DESC);
CREATE INDEX idx_lookups_pending ON public.vehicle_lookups(created_at) WHERE status = 'PENDING';

ALTER TABLE public.credit_transactions
    ADD CONSTRAINT credit_transactions_lookup_fk
    FOREIGN KEY (reference_lookup_id) REFERENCES public.vehicle_lookups(id) ON DELETE SET NULL;

-- One deduction and at most one refund per lookup: refunds can never be doubled.
CREATE UNIQUE INDEX uq_one_deduction_per_lookup
    ON public.credit_transactions(reference_lookup_id) WHERE transaction_type = 'LOOKUP_DEDUCTION';
CREATE UNIQUE INDEX uq_one_refund_per_lookup
    ON public.credit_transactions(reference_lookup_id) WHERE transaction_type = 'LOOKUP_REFUND';

-- -----------------------------------------------------------------------------
-- 4. Housekeeping triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create the profile (credit_balance = 0) for every new auth user,
-- whether they signed up with email/password or Google OAuth (PRD 3.1).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.id::text || '@users.invalid'),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
        UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_changed
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_email_change();

-- =============================================================================
-- 5. Atomic credit functions
-- =============================================================================

-- 5.1 Deduct 1 credit and open a PENDING lookup (PRD 2.3 step 3).
CREATE OR REPLACE FUNCTION public.deduct_credit_for_lookup(p_user_id UUID, p_vrm TEXT, p_provider TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_balance INTEGER;
    v_subscription_credits INTEGER;
    v_bucket TEXT;
    v_lookup_id UUID;
BEGIN
    -- MOST IMPORTANT STEP: lock this user's row. If the user fires 10 requests in
    -- the same millisecond, requests 2..10 wait here until request 1 commits.
    SELECT credit_balance, subscription_credits
      INTO v_current_balance, v_subscription_credits
      FROM public.users
     WHERE id = p_user_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;

    -- Re-check under the lock: a request that queued behind an identical one must
    -- not pay twice for the same plate.
    IF EXISTS (
        SELECT 1 FROM public.vehicle_lookups
         WHERE user_id = p_user_id
           AND vrm_normalized = p_vrm
           AND status = 'SUCCESS'
           AND created_at > NOW() - INTERVAL '30 days'
    ) THEN
        RAISE EXCEPTION 'CACHED_RESULT_AVAILABLE';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.vehicle_lookups
         WHERE user_id = p_user_id
           AND vrm_normalized = p_vrm
           AND status = 'PENDING'
           AND created_at > NOW() - INTERVAL '2 minutes'
    ) THEN
        RAISE EXCEPTION 'LOOKUP_IN_PROGRESS';
    END IF;

    IF v_current_balance < 1 THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;

    -- Spend expiring subscription credits before never-expiring top-up credits.
    v_bucket := CASE WHEN v_subscription_credits > 0 THEN 'SUBSCRIPTION' ELSE 'TOPUP' END;

    UPDATE public.users
       SET credit_balance = credit_balance - 1,
           subscription_credits = subscription_credits - CASE WHEN v_bucket = 'SUBSCRIPTION' THEN 1 ELSE 0 END
     WHERE id = p_user_id;

    INSERT INTO public.vehicle_lookups (user_id, vrm_normalized, api_provider, status, cost_credits, deducted_bucket)
    VALUES (p_user_id, p_vrm, p_provider, 'PENDING', 1, v_bucket)
    RETURNING id INTO v_lookup_id;

    INSERT INTO public.credit_transactions
        (user_id, amount, balance_after, transaction_type, credit_bucket, reference_lookup_id, description)
    VALUES
        (p_user_id, -1, v_current_balance - 1, 'LOOKUP_DEDUCTION', v_bucket, v_lookup_id, 'Lookup VRM: ' || p_vrm);

    RETURN v_lookup_id;
END;
$$;

-- 5.2 Mark a PENDING lookup as SUCCESS (PRD 2.3 case A). Returns false if the
--     lookup was already settled (e.g. swept as stale and refunded).
CREATE OR REPLACE FUNCTION public.complete_lookup(
    p_lookup_id UUID,
    p_provider TEXT,
    p_paint_code TEXT,
    p_paint_name TEXT,
    p_paint_finish TEXT,
    p_code_location_hint TEXT,
    p_make TEXT,
    p_model TEXT,
    p_year INTEGER,
    p_registered_color TEXT,
    p_vin_partial TEXT,
    p_raw JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status TEXT;
BEGIN
    IF p_paint_code IS NULL OR btrim(p_paint_code) = '' THEN
        RAISE EXCEPTION 'PAINT_CODE_REQUIRED';
    END IF;

    SELECT status INTO v_status
      FROM public.vehicle_lookups
     WHERE id = p_lookup_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LOOKUP_NOT_FOUND';
    END IF;

    IF v_status <> 'PENDING' THEN
        RETURN FALSE;
    END IF;

    UPDATE public.vehicle_lookups
       SET status = 'SUCCESS',
           api_provider = p_provider,
           paint_code = btrim(p_paint_code),
           paint_name = p_paint_name,
           paint_finish = p_paint_finish,
           code_location_hint = p_code_location_hint,
           vehicle_make = p_make,
           vehicle_model = p_model,
           vehicle_year = p_year,
           registered_color = p_registered_color,
           vin_partial = p_vin_partial,
           raw_api_response = p_raw,
           completed_at = NOW()
     WHERE id = p_lookup_id;

    RETURN TRUE;
END;
$$;

-- 5.3 Auto-refund a PENDING lookup (PRD 2.3 case B and 5.1).
--     p_reason: 'API_NO_DATA' | 'API_ERROR' | 'STALE_PENDING'
--     Returns the new balance, or NULL if the lookup was already settled.
CREATE OR REPLACE FUNCTION public.refund_lookup(
    p_lookup_id UUID,
    p_reason TEXT,
    p_provider TEXT DEFAULT NULL,
    p_raw JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_status TEXT;
    v_vrm TEXT;
    v_cost INTEGER;
    v_bucket TEXT;
    v_subscription_status TEXT;
    v_new_balance INTEGER;
BEGIN
    IF p_reason NOT IN ('API_NO_DATA', 'API_ERROR', 'STALE_PENDING') THEN
        RAISE EXCEPTION 'INVALID_REFUND_REASON';
    END IF;

    SELECT user_id INTO v_user_id FROM public.vehicle_lookups WHERE id = p_lookup_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'LOOKUP_NOT_FOUND';
    END IF;

    -- Lock order: user first, then the lookup.
    SELECT subscription_status INTO v_subscription_status
      FROM public.users WHERE id = v_user_id FOR UPDATE;

    SELECT status, vrm_normalized, cost_credits, deducted_bucket
      INTO v_status, v_vrm, v_cost, v_bucket
      FROM public.vehicle_lookups
     WHERE id = p_lookup_id
       FOR UPDATE;

    IF v_status <> 'PENDING' THEN
        RETURN NULL; -- already settled: never refund twice
    END IF;

    -- Subscription credits go back to the subscription bucket only while the plan
    -- is still live; otherwise the customer gets a never-expiring top-up credit.
    IF v_bucket = 'SUBSCRIPTION' AND v_subscription_status NOT IN ('active', 'trialing', 'past_due') THEN
        v_bucket := 'TOPUP';
    END IF;
    v_bucket := COALESCE(v_bucket, 'TOPUP');

    UPDATE public.vehicle_lookups
       SET status = CASE WHEN p_reason = 'API_NO_DATA' THEN 'NOT_FOUND_REFUNDED' ELSE 'FAILED_REFUNDED' END,
           api_provider = COALESCE(p_provider, api_provider),
           raw_api_response = COALESCE(p_raw, raw_api_response),
           failure_reason = p_reason,
           completed_at = NOW()
     WHERE id = p_lookup_id;

    IF v_cost > 0 THEN
        UPDATE public.users
           SET credit_balance = credit_balance + v_cost,
               subscription_credits = subscription_credits + CASE WHEN v_bucket = 'SUBSCRIPTION' THEN v_cost ELSE 0 END
         WHERE id = v_user_id
        RETURNING credit_balance INTO v_new_balance;

        INSERT INTO public.credit_transactions
            (user_id, amount, balance_after, transaction_type, credit_bucket, reference_lookup_id, description)
        VALUES
            (v_user_id, v_cost, v_new_balance, 'LOOKUP_REFUND', v_bucket, p_lookup_id,
             'Refund (' || p_reason || '): ' || v_vrm);
    ELSE
        SELECT credit_balance INTO v_new_balance FROM public.users WHERE id = v_user_id;
    END IF;

    RETURN v_new_balance;
END;
$$;

-- 5.4 Safety net: refund lookups left PENDING by a crashed/timed-out request so
--     no credit is ever silently lost. Called before each lookup and safe to run
--     from a cron job (pg_cron / Vercel cron) with p_user_id = NULL.
CREATE OR REPLACE FUNCTION public.refund_stale_pending_lookups(
    p_user_id UUID DEFAULT NULL,
    p_older_than INTERVAL DEFAULT INTERVAL '2 minutes'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lookup RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_lookup IN
        SELECT id FROM public.vehicle_lookups
         WHERE status = 'PENDING'
           AND created_at < NOW() - p_older_than
           AND (p_user_id IS NULL OR user_id = p_user_id)
         ORDER BY created_at
    LOOP
        IF public.refund_lookup(v_lookup.id, 'STALE_PENDING') IS NOT NULL THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$;

-- 5.5 One-off top-up / admin grant. Idempotent on p_stripe_event_id:
--     returns TRUE when credits were added, FALSE when the event was already processed.
CREATE OR REPLACE FUNCTION public.grant_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_type TEXT,
    p_stripe_event_id TEXT,
    p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;
    IF p_type NOT IN ('TOPUP_PURCHASE', 'ADMIN_ADJUSTMENT') THEN
        RAISE EXCEPTION 'INVALID_TRANSACTION_TYPE';
    END IF;

    PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;

    IF p_stripe_event_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.credit_transactions WHERE stripe_event_id = p_stripe_event_id
    ) THEN
        RETURN FALSE;
    END IF;

    BEGIN
        UPDATE public.users
           SET credit_balance = credit_balance + p_amount
         WHERE id = p_user_id
        RETURNING credit_balance INTO v_new_balance;

        INSERT INTO public.credit_transactions
            (user_id, amount, balance_after, transaction_type, credit_bucket, stripe_event_id, description)
        VALUES
            (p_user_id, p_amount, v_new_balance, p_type, 'TOPUP', p_stripe_event_id, p_description);
    EXCEPTION WHEN unique_violation THEN
        -- Belt and braces: the UNIQUE key rolls back the balance change as well.
        RETURN FALSE;
    END;

    RETURN TRUE;
END;
$$;

-- 5.6 Monthly allowance from `invoice.paid` (PRD 3.3.A). Idempotent on event id.
--     p_rollover = FALSE: unused subscription credits from the previous period are
--     expired first (top-up credits are never touched).
CREATE OR REPLACE FUNCTION public.grant_subscription_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_stripe_event_id TEXT,
    p_tier TEXT,
    p_period_end TIMESTAMPTZ,
    p_rollover BOOLEAN,
    p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_balance INTEGER;
    v_subscription_credits INTEGER;
    v_new_balance INTEGER;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;
    IF p_stripe_event_id IS NULL THEN
        RAISE EXCEPTION 'STRIPE_EVENT_ID_REQUIRED';
    END IF;

    SELECT credit_balance, subscription_credits
      INTO v_balance, v_subscription_credits
      FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;

    IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE stripe_event_id = p_stripe_event_id) THEN
        RETURN FALSE;
    END IF;

    BEGIN
        IF NOT p_rollover AND v_subscription_credits > 0 THEN
            UPDATE public.users
               SET credit_balance = credit_balance - v_subscription_credits,
                   subscription_credits = 0
             WHERE id = p_user_id
            RETURNING credit_balance INTO v_balance;

            INSERT INTO public.credit_transactions
                (user_id, amount, balance_after, transaction_type, credit_bucket, description)
            VALUES
                (p_user_id, -v_subscription_credits, v_balance, 'SUBSCRIPTION_EXPIRY', 'SUBSCRIPTION',
                 'Unused monthly credits expired at renewal');
        END IF;

        UPDATE public.users
           SET credit_balance = credit_balance + p_amount,
               subscription_credits = subscription_credits + p_amount,
               subscription_status = 'active',
               subscription_tier = p_tier,
               current_period_end = COALESCE(p_period_end, current_period_end)
         WHERE id = p_user_id
        RETURNING credit_balance INTO v_new_balance;

        INSERT INTO public.credit_transactions
            (user_id, amount, balance_after, transaction_type, credit_bucket, stripe_event_id, description)
        VALUES
            (p_user_id, p_amount, v_new_balance, 'SUBSCRIPTION_CREDIT', 'SUBSCRIPTION', p_stripe_event_id, p_description);
    EXCEPTION WHEN unique_violation THEN
        RETURN FALSE;
    END;

    RETURN TRUE;
END;
$$;

-- 5.7 Expire remaining subscription credits (subscription cancelled, rollover off).
--     Naturally idempotent: a second call finds 0 subscription credits.
CREATE OR REPLACE FUNCTION public.expire_subscription_credits(p_user_id UUID, p_description TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_subscription_credits INTEGER;
    v_new_balance INTEGER;
BEGIN
    SELECT subscription_credits INTO v_subscription_credits
      FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;

    IF v_subscription_credits = 0 THEN
        RETURN 0;
    END IF;

    UPDATE public.users
       SET credit_balance = credit_balance - v_subscription_credits,
           subscription_credits = 0
     WHERE id = p_user_id
    RETURNING credit_balance INTO v_new_balance;

    INSERT INTO public.credit_transactions
        (user_id, amount, balance_after, transaction_type, credit_bucket, description)
    VALUES
        (p_user_id, -v_subscription_credits, v_new_balance, 'SUBSCRIPTION_EXPIRY', 'SUBSCRIPTION', p_description);

    RETURN v_subscription_credits;
END;
$$;

-- =============================================================================
-- 6. Row Level Security: users may only READ their own data.
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);

CREATE POLICY "credit_transactions_select_own" ON public.credit_transactions
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "vehicle_lookups_select_own" ON public.vehicle_lookups
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Defence in depth: even without a policy, no client role can write these tables.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.users, public.credit_transactions, public.vehicle_lookups
    FROM anon, authenticated;
REVOKE ALL ON public.users, public.credit_transactions, public.vehicle_lookups FROM anon;

-- Credit functions are server-only (called with the service_role key after the
-- server has authenticated the user). Never expose them to the browser.
REVOKE ALL ON FUNCTION public.deduct_credit_for_lookup(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_lookup(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_lookup(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_stale_pending_lookups(UUID, INTERVAL) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_subscription_credits(UUID, INTEGER, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_subscription_credits(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_auth_user_email_change() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.deduct_credit_for_lookup(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_lookup(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_lookup(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_stale_pending_lookups(UUID, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_subscription_credits(UUID, INTEGER, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_subscription_credits(UUID, TEXT) TO service_role;

-- =============================================================================
-- 7. Realtime: push balance changes to the dashboard credit badge.
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
END;
$$;
