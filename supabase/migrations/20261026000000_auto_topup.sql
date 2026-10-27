-- =============================================================================
-- Auto top-up (PRD 1: business customers "automatically buy a top-up when the
-- monthly allowance runs out").
--
--   * auto_topup_pack NULL = off. Otherwise the pack charged off-session to the
--     card saved on the Stripe customer when the balance reaches 0.
--   * claim_auto_topup() locks the user row (SELECT ... FOR UPDATE) and stamps
--     auto_topup_attempted_at, so concurrent lookups can start at most one
--     charge per cooldown window. Credits are still only granted by the Stripe
--     webhook (payment_intent.succeeded), idempotent on stripe_event_id.
-- =============================================================================

ALTER TABLE public.users
    ADD COLUMN auto_topup_pack TEXT CHECK (auto_topup_pack IN ('topup_5', 'topup_10', 'topup_25')),
    ADD COLUMN auto_topup_attempted_at TIMESTAMPTZ,
    ADD COLUMN auto_topup_last_error TEXT;

CREATE OR REPLACE FUNCTION public.claim_auto_topup(
    p_user_id UUID,
    p_cooldown INTERVAL DEFAULT INTERVAL '10 minutes'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND
       OR v_user.auto_topup_pack IS NULL
       OR v_user.stripe_customer_id IS NULL
       OR v_user.credit_balance > 0
       OR (v_user.auto_topup_attempted_at IS NOT NULL AND v_user.auto_topup_attempted_at > NOW() - p_cooldown) THEN
        RETURN NULL;
    END IF;

    UPDATE public.users
       SET auto_topup_attempted_at = NOW(), updated_at = NOW()
     WHERE id = p_user_id;

    RETURN v_user.auto_topup_pack;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_auto_topup(UUID, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auto_topup(UUID, INTERVAL) TO service_role;
