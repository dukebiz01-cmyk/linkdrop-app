-- ============================================================
-- v2.3 step 1 — Coupon security hardening
--
-- Adds:
--   * generate_claim_code_v2(p_length)  — 12-char Crockford-style
--     alphanumeric code generator (A-Z minus O/I/L + 2-9), backed by
--     extensions.gen_random_bytes for cryptographic randomness, with
--     collision-retry against coupon_claims.claim_code.
--   * claim_coupon (replacement) — switches to the v2 generator and
--     adds total_count quota enforcement + audit row on issue.
--   * redeem_coupon_v2 — 6-step validation (code, status, claim TTL,
--     coupon active+window, staff authorization, amount sanity) plus
--     row-level locking on the claim, per-staff rate limits (30/min,
--     200/hour) and full audit logging of every attempt.
--   * coupon_audit_logs — append-only audit trail. Writable only by
--     SECURITY DEFINER functions; readable by admin/staff, partner
--     owners, and the acting user.
--
-- Backward compatibility:
--   The original redeem_coupon(p_claim_code, p_staff_id, p_amount_krw)
--   is intentionally left in place. Callers should migrate to
--   redeem_coupon_v2; redeem_coupon will be removed in a later step
--   once all clients are switched over.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Audit log table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupon_audit_logs (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action        text NOT NULL,
  claim_id      uuid REFERENCES public.coupon_claims(id) ON DELETE SET NULL,
  claim_code    text,
  coupon_id     uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  partner_id    uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  error_code    text,
  amount_krw    numeric,
  ip            inet,
  user_agent    text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_audit_action_check CHECK (
    action IN (
      'claim_issued',
      'redeem_attempt',
      'redeem_success',
      'redeem_fail'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_coupon_audit_actor_created
  ON public.coupon_audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_audit_claim
  ON public.coupon_audit_logs (claim_id);
CREATE INDEX IF NOT EXISTS idx_coupon_audit_action_created
  ON public.coupon_audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_audit_partner_created
  ON public.coupon_audit_logs (partner_id, created_at DESC);

ALTER TABLE public.coupon_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupon_audit_admin_read ON public.coupon_audit_logs;
CREATE POLICY coupon_audit_admin_read
  ON public.coupon_audit_logs
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  );

DROP POLICY IF EXISTS coupon_audit_partner_read ON public.coupon_audit_logs;
CREATE POLICY coupon_audit_partner_read
  ON public.coupon_audit_logs
  FOR SELECT
  USING (
    partner_id IS NOT NULL
    AND auth.uid() IN (
      SELECT owner_user_id FROM public.partners WHERE id = partner_id
    )
  );

DROP POLICY IF EXISTS coupon_audit_actor_read ON public.coupon_audit_logs;
CREATE POLICY coupon_audit_actor_read
  ON public.coupon_audit_logs
  FOR SELECT
  USING (auth.uid() = actor_user_id);

-- No INSERT/UPDATE/DELETE policies — writes happen only via
-- SECURITY DEFINER functions in this file.

-- ------------------------------------------------------------
-- 2) Secure claim code generator
-- 32-character alphabet excludes confusables: 0, 1, O, I, L.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_claim_code_v2(p_length int DEFAULT 12)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_alphabet  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_alpha_len int  := length(v_alphabet);
  v_code      text;
  v_buf       bytea;
  v_attempt   int  := 0;
  i           int;
BEGIN
  IF p_length < 8 OR p_length > 32 THEN
    RAISE EXCEPTION 'INVALID_CODE_LENGTH';
  END IF;

  LOOP
    v_code := '';
    v_buf  := extensions.gen_random_bytes(p_length);
    FOR i IN 0 .. p_length - 1 LOOP
      v_code := v_code
             || substr(v_alphabet, (get_byte(v_buf, i) % v_alpha_len) + 1, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.coupon_claims WHERE claim_code = v_code
    );

    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      RAISE EXCEPTION 'CLAIM_CODE_GENERATION_FAILED';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_claim_code_v2(int) FROM PUBLIC;
-- Internal helper. Not granted to authenticated.

-- ------------------------------------------------------------
-- 3) claim_coupon — replace to use v2 generator + audit + quota
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_coupon(
  p_coupon_id        uuid,
  p_share_event_id   uuid,
  p_catcher_user_id  uuid
)
RETURNS TABLE(claim_id uuid, claim_code text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_coupon     coupons%ROWTYPE;
  v_existing   coupon_claims%ROWTYPE;
  v_claim_code text;
  v_expires_at timestamptz;
  v_new_claim  coupon_claims%ROWTYPE;
  v_claimed    bigint;
BEGIN
  SELECT * INTO v_coupon FROM coupons WHERE id = p_coupon_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COUPON_NOT_FOUND';
  END IF;

  IF NOT v_coupon.is_active THEN
    RAISE EXCEPTION 'COUPON_INACTIVE';
  END IF;

  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > NOW() THEN
    RAISE EXCEPTION 'COUPON_NOT_YET_VALID';
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    RAISE EXCEPTION 'COUPON_EXPIRED';
  END IF;

  -- Per-user idempotency: if the user already has a claim, return it.
  SELECT * INTO v_existing
    FROM coupon_claims
   WHERE coupon_id = p_coupon_id
     AND catcher_user_id = p_catcher_user_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.claim_code, v_existing.expires_at;
    RETURN;
  END IF;

  -- Best-effort global quota check (counts issued + used claims).
  IF v_coupon.total_count IS NOT NULL THEN
    SELECT count(*) INTO v_claimed
      FROM coupon_claims
     WHERE coupon_id = p_coupon_id
       AND status IN ('issued','used');
    IF v_claimed >= v_coupon.total_count THEN
      RAISE EXCEPTION 'COUPON_QUOTA_EXHAUSTED';
    END IF;
  END IF;

  v_claim_code := public.generate_claim_code_v2(12);
  v_expires_at := COALESCE(v_coupon.valid_until, NOW() + INTERVAL '7 days');

  INSERT INTO coupon_claims (
    coupon_id, share_event_id, catcher_user_id, claim_code, expires_at
  )
  VALUES (
    p_coupon_id, p_share_event_id, p_catcher_user_id, v_claim_code, v_expires_at
  )
  RETURNING * INTO v_new_claim;

  INSERT INTO public.coupon_audit_logs (
    actor_user_id, action, claim_id, claim_code, coupon_id, partner_id, metadata
  )
  VALUES (
    p_catcher_user_id, 'claim_issued',
    v_new_claim.id, v_new_claim.claim_code,
    v_coupon.id, v_coupon.partner_id,
    jsonb_build_object('share_event_id', p_share_event_id)
  );

  RETURN QUERY SELECT v_new_claim.id, v_new_claim.claim_code, v_new_claim.expires_at;
END;
$$;

-- ------------------------------------------------------------
-- 4) redeem_coupon_v2 — 6-step validation + audit + rate limit
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_coupon_v2(
  p_claim_code text,
  p_staff_id   uuid,
  p_amount_krw numeric DEFAULT NULL,
  p_ip         inet    DEFAULT NULL,
  p_user_agent text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_claim         coupon_claims%ROWTYPE;
  v_coupon        coupons%ROWTYPE;
  v_partner_id    uuid;
  v_redemption_id uuid;
  v_authorized    boolean := false;
  v_recent_count  int;
  v_hourly_count  int;
  v_normalized    text;
  v_error         text;
BEGIN
  -- ----- Rate limit (per acting staff) -----
  IF p_staff_id IS NOT NULL THEN
    SELECT count(*) INTO v_recent_count
      FROM public.coupon_audit_logs
     WHERE actor_user_id = p_staff_id
       AND action IN ('redeem_attempt','redeem_success','redeem_fail')
       AND created_at > NOW() - interval '1 minute';
    IF v_recent_count >= 30 THEN
      INSERT INTO public.coupon_audit_logs
        (actor_user_id, action, claim_code, error_code, ip, user_agent)
      VALUES
        (p_staff_id, 'redeem_fail', p_claim_code, 'RATE_LIMIT_MINUTE', p_ip, p_user_agent);
      RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
    END IF;

    SELECT count(*) INTO v_hourly_count
      FROM public.coupon_audit_logs
     WHERE actor_user_id = p_staff_id
       AND action IN ('redeem_attempt','redeem_success','redeem_fail')
       AND created_at > NOW() - interval '1 hour';
    IF v_hourly_count >= 200 THEN
      INSERT INTO public.coupon_audit_logs
        (actor_user_id, action, claim_code, error_code, ip, user_agent)
      VALUES
        (p_staff_id, 'redeem_fail', p_claim_code, 'RATE_LIMIT_HOUR', p_ip, p_user_agent);
      RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
    END IF;
  END IF;

  -- ----- Log attempt -----
  INSERT INTO public.coupon_audit_logs
    (actor_user_id, action, claim_code, ip, user_agent)
  VALUES
    (p_staff_id, 'redeem_attempt', p_claim_code, p_ip, p_user_agent);

  -- Normalize: trim whitespace + uppercase. New codes use uppercase alphabet
  -- already; older codes (MD5 + upper) are uppercase too, so this is safe.
  v_normalized := upper(trim(p_claim_code));
  IF v_normalized IS NULL OR length(v_normalized) < 6 THEN
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_code, error_code, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', p_claim_code, 'INVALID_CODE_FORMAT', p_ip, p_user_agent);
    RAISE EXCEPTION 'INVALID_CLAIM_CODE_FORMAT';
  END IF;

  -- ----- Step 1: code exists; lock the row -----
  SELECT * INTO v_claim
    FROM public.coupon_claims
   WHERE claim_code = v_normalized
   FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_code, error_code, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', v_normalized, 'INVALID_CLAIM_CODE', p_ip, p_user_agent);
    RAISE EXCEPTION 'INVALID_CLAIM_CODE';
  END IF;

  -- ----- Step 2: status must be 'issued' -----
  IF v_claim.status <> 'issued' THEN
    v_error := 'STATUS_' || upper(v_claim.status::text);
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_id, claim_code, error_code, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', v_claim.id, v_normalized, v_error, p_ip, p_user_agent);
    RAISE EXCEPTION 'CLAIM_NOT_REDEEMABLE: %', v_claim.status;
  END IF;

  -- ----- Step 3: claim within TTL -----
  IF v_claim.expires_at IS NOT NULL AND v_claim.expires_at < NOW() THEN
    UPDATE public.coupon_claims SET status = 'expired' WHERE id = v_claim.id;
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_id, claim_code, error_code, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', v_claim.id, v_normalized, 'CLAIM_EXPIRED', p_ip, p_user_agent);
    RAISE EXCEPTION 'CLAIM_EXPIRED';
  END IF;

  -- ----- Step 4: parent coupon is active and within window -----
  SELECT * INTO v_coupon FROM public.coupons WHERE id = v_claim.coupon_id;
  v_partner_id := v_coupon.partner_id;

  IF NOT v_coupon.is_active THEN
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_id, claim_code, coupon_id, partner_id, error_code, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', v_claim.id, v_normalized, v_coupon.id, v_partner_id, 'COUPON_INACTIVE', p_ip, p_user_agent);
    RAISE EXCEPTION 'COUPON_INACTIVE';
  END IF;
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > NOW() THEN
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_id, claim_code, coupon_id, partner_id, error_code, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', v_claim.id, v_normalized, v_coupon.id, v_partner_id, 'COUPON_NOT_YET_VALID', p_ip, p_user_agent);
    RAISE EXCEPTION 'COUPON_NOT_YET_VALID';
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_id, claim_code, coupon_id, partner_id, error_code, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', v_claim.id, v_normalized, v_coupon.id, v_partner_id, 'COUPON_EXPIRED', p_ip, p_user_agent);
    RAISE EXCEPTION 'COUPON_EXPIRED';
  END IF;

  -- ----- Step 5: staff authorization -----
  IF p_staff_id IS NULL THEN
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_id, claim_code, coupon_id, partner_id, error_code, ip, user_agent)
    VALUES
      (NULL, 'redeem_fail', v_claim.id, v_normalized, v_coupon.id, v_partner_id, 'STAFF_REQUIRED', p_ip, p_user_agent);
    RAISE EXCEPTION 'STAFF_REQUIRED';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.partners
      WHERE id = v_partner_id AND owner_user_id = p_staff_id
    UNION ALL
    SELECT 1 FROM public.partner_staff
      WHERE partner_id = v_partner_id
        AND staff_user_id = p_staff_id
        AND is_active = true
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_id, claim_code, coupon_id, partner_id, error_code, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', v_claim.id, v_normalized, v_coupon.id, v_partner_id, 'UNAUTHORIZED_STAFF', p_ip, p_user_agent);
    RAISE EXCEPTION 'UNAUTHORIZED_STAFF';
  END IF;

  -- ----- Step 6: amount sanity -----
  IF p_amount_krw IS NOT NULL AND p_amount_krw < 0 THEN
    INSERT INTO public.coupon_audit_logs
      (actor_user_id, action, claim_id, claim_code, coupon_id, partner_id, error_code, amount_krw, ip, user_agent)
    VALUES
      (p_staff_id, 'redeem_fail', v_claim.id, v_normalized, v_coupon.id, v_partner_id, 'INVALID_AMOUNT', p_amount_krw, p_ip, p_user_agent);
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- ----- Commit: mark used + insert redemption + conversion event -----
  UPDATE public.coupon_claims
     SET status = 'used', used_at = NOW()
   WHERE id = v_claim.id;

  INSERT INTO public.coupon_redemptions
    (coupon_claim_id, partner_id, redeemed_by_staff_id, redeem_amount_krw)
  VALUES
    (v_claim.id, v_partner_id, p_staff_id, p_amount_krw)
  RETURNING id INTO v_redemption_id;

  INSERT INTO public.conversion_events (
    share_event_id, conversion_type, source_id,
    gross_amount_krw, partner_fee_krw, reward_pool_krw, platform_fee_krw
  )
  VALUES (
    v_claim.share_event_id, 'coupon_use', v_redemption_id,
    COALESCE(p_amount_krw, 0), 0, 0, 0
  );

  INSERT INTO public.coupon_audit_logs (
    actor_user_id, action, claim_id, claim_code, coupon_id, partner_id,
    amount_krw, ip, user_agent, metadata
  )
  VALUES (
    p_staff_id, 'redeem_success', v_claim.id, v_normalized, v_coupon.id, v_partner_id,
    p_amount_krw, p_ip, p_user_agent,
    jsonb_build_object('redemption_id', v_redemption_id)
  );

  RETURN v_redemption_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coupon_v2(text, uuid, numeric, inet, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_coupon_v2(text, uuid, numeric, inet, text) TO authenticated;
