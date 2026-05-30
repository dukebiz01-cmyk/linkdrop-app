-- v6.3 ROLLBACK — restore pre-A-FIX2 state.
-- 5 함수 + 1 제약 백업. A-FIX2 마이그 실패/롤백 시 이 파일을 그대로 apply.
-- 함수 본문은 적용 전 pg_get_functiondef로 추출한 원본 그대로.
--
-- 적용 순서(롤백): 제약 복구 → 함수 본문 원상 → 인덱스 제거(부분 인덱스)
-- 데이터 변경 0. 트랜잭션으로 감쌈.

BEGIN;

-- =====================================================================
-- (Z1) 부분 UNIQUE 인덱스 제거 (A-FIX2가 새로 만든 것)
-- =====================================================================
DROP INDEX IF EXISTS public.uniq_conversion_coupon_use;
DROP INDEX IF EXISTS public.uniq_conversion_reservation_confirm;

-- =====================================================================
-- (Z2) 원래 단일 UNIQUE 제약 복구
-- 원본 정의: UNIQUE (conversion_type, source_id)
-- =====================================================================
ALTER TABLE public.conversion_events
  ADD CONSTRAINT conversion_events_conversion_type_source_id_key
  UNIQUE (conversion_type, source_id);

-- =====================================================================
-- (Z3) trigger_redemption_to_conversion_v21 — ON CONFLICT 원상
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trigger_redemption_to_conversion_v21()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_claim           coupon_claims%ROWTYPE;
  v_share_event     share_events%ROWTYPE;
  v_chain_path      UUID[];
  v_direct_advocate UUID;
  v_chain_origin    UUID;
  v_conversion_id   UUID;
BEGIN
  SELECT * INTO v_claim FROM coupon_claims WHERE id = NEW.coupon_claim_id;

  IF v_claim.share_event_id IS NOT NULL THEN
    SELECT * INTO v_share_event FROM share_events WHERE id = v_claim.share_event_id;

    v_direct_advocate := v_share_event.sender_user_id;
    v_chain_origin    := COALESCE(v_share_event.chain_origin_user_id, v_share_event.sender_user_id);
    v_chain_path      := ARRAY[v_chain_origin, v_direct_advocate];

    INSERT INTO conversion_events (
      share_event_id, conversion_type, source_id,
      gross_amount_krw,
      chain_path, chain_depth,
      direct_advocate_user_id, chain_origin_user_id,
      occurred_at
    ) VALUES (
      v_claim.share_event_id, 'coupon_use'::conversion_type, NEW.id,
      NEW.redeem_amount_krw,
      v_chain_path, COALESCE(v_share_event.chain_depth, 0),
      v_direct_advocate, v_chain_origin,
      NEW.redeemed_at
    )
    ON CONFLICT (conversion_type, source_id) DO NOTHING
    RETURNING id INTO v_conversion_id;

    IF v_conversion_id IS NOT NULL THEN
      PERFORM distribute_rewards_safe(v_conversion_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- (Z4) redeem_coupon_v2 — 잉여 conversion_events INSERT 복구
-- =====================================================================
CREATE OR REPLACE FUNCTION public.redeem_coupon_v2(
  p_claim_code text,
  p_staff_id uuid,
  p_amount_krw numeric DEFAULT NULL::numeric,
  p_ip inet DEFAULT NULL::inet,
  p_user_agent text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

-- =====================================================================
-- (Z5) redeem_coupon (v1) — 잉여 conversion_events INSERT 복구
-- =====================================================================
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_claim_code text,
  p_staff_id uuid,
  p_amount_krw numeric DEFAULT NULL::numeric
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_claim coupon_claims%ROWTYPE;
  v_coupon coupons%ROWTYPE;
  v_partner_id UUID;
  v_redemption_id UUID;
BEGIN
  SELECT * INTO v_claim FROM coupon_claims WHERE claim_code = p_claim_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CLAIM_CODE: %', p_claim_code;
  END IF;

  IF v_claim.status <> 'issued' THEN
    RAISE EXCEPTION 'CLAIM_ALREADY_USED_OR_EXPIRED: status = %', v_claim.status;
  END IF;

  IF v_claim.expires_at IS NOT NULL AND v_claim.expires_at < NOW() THEN
    UPDATE coupon_claims SET status = 'expired' WHERE id = v_claim.id;
    RAISE EXCEPTION 'CLAIM_EXPIRED';
  END IF;

  SELECT * INTO v_coupon FROM coupons WHERE id = v_claim.coupon_id;
  v_partner_id := v_coupon.partner_id;

  UPDATE coupon_claims SET status = 'used', used_at = NOW() WHERE id = v_claim.id;

  INSERT INTO coupon_redemptions (coupon_claim_id, partner_id, redeemed_by_staff_id, redeem_amount_krw)
    VALUES (v_claim.id, v_partner_id, p_staff_id, p_amount_krw)
    RETURNING id INTO v_redemption_id;

  INSERT INTO conversion_events (
    share_event_id, conversion_type, source_id,
    gross_amount_krw, partner_fee_krw, reward_pool_krw, platform_fee_krw
  )
  VALUES (
    v_claim.share_event_id, 'coupon_use', v_redemption_id,
    COALESCE(p_amount_krw, 0), 0, 0, 0
  );

  RETURN v_redemption_id;
END;
$function$;

-- =====================================================================
-- (Z6) trigger_reservation_conversion — A-FIX(v6.2) 본문 원상 (ON CONFLICT 없음)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trigger_reservation_conversion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_source_id uuid;
  v_chain_path uuid[];
  v_chain_depth int;
BEGIN
  IF NEW.status = 'confirmed'
     AND OLD.status = 'pending'
     AND NEW.share_event_id IS NOT NULL THEN

    SELECT source_id INTO v_source_id FROM info_drops WHERE id = NEW.drop_id;

    SELECT chain_depth
    INTO v_chain_depth
    FROM share_events
    WHERE id = NEW.share_event_id;

    INSERT INTO conversion_events (
      share_event_id, conversion_type, source_id,
      gross_amount_krw, partner_fee_krw, reward_pool_krw, platform_fee_krw,
      occurred_at, chain_path, chain_depth,
      info_drop_id, visitor_id, reservation_id
    ) VALUES (
      NEW.share_event_id, 'reservation_confirm', v_source_id,
      0, 0, 0, 0,
      now(),
      COALESCE(v_chain_path, ARRAY[]::uuid[]),
      COALESCE(v_chain_depth, 0),
      NEW.drop_id, NEW.visitor_id, NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
