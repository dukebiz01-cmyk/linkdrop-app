-- v6.3 — conversion_events UNIQUE 교정 + writer 정합 (A-FIX2)
--
-- 단일 (conversion_type, source_id) UNIQUE → type별 부분 UNIQUE 인덱스 2개로 교체.
-- coupon_use 멱등 보존(source_id=coupon_redemptions.id), reservation_confirm은
-- reservation 단위 멱등으로 변경(reservation_id) → 드랍별 다건 예약 확정 허용.
--
-- 동시에 잠재 더블 INSERT 버그 해소:
--   redeem_coupon_v2/v1이 coupon_redemptions INSERT(트리거 발화 → conversion_events
--   INSERT) 직후 자신도 conversion_events INSERT(ON CONFLICT 없음) → 호출 시 항상
--   23505 EXCEPTION 트랜잭션 롤백. 트리거가 더 풍부한 컬럼(chain_path/depth/
--   advocate/origin/occurred_at)으로 처리하므로 RPC 측 INSERT는 잉여 → 제거.
--
-- 보존: 함수 가드(rate-limit/audit/staff auth)·RETURNING·search_path·DEFINER·
-- distribute_rewards_safe 분배 호출·금액 컬럼·trigger_reservation_conversion
-- 발화 조건·chain_path 로직 100%.
--
-- 롤백: supabase/migrations/v6.3_conversion_unique_rework_ROLLBACK.sql

BEGIN;

-- =====================================================================
-- (A) 스키마 — 단일 UNIQUE 제약 DROP + type별 부분 UNIQUE 인덱스 2개
-- =====================================================================
ALTER TABLE public.conversion_events
  DROP CONSTRAINT conversion_events_conversion_type_source_id_key;

-- coupon_use: source_id = coupon_redemptions.id (사용 처리 1건당 conversion 1건)
CREATE UNIQUE INDEX uniq_conversion_coupon_use
  ON public.conversion_events (source_id)
  WHERE conversion_type = 'coupon_use';

-- reservation_confirm: reservation_id 단위 멱등 (드랍별 다건 확정 허용)
CREATE UNIQUE INDEX uniq_conversion_reservation_confirm
  ON public.conversion_events (reservation_id)
  WHERE conversion_type = 'reservation_confirm' AND reservation_id IS NOT NULL;

-- =====================================================================
-- (B) trigger_redemption_to_conversion_v21
--     ON CONFLICT (conversion_type, source_id) → ON CONFLICT (source_id)
--     WHERE conversion_type='coupon_use' (부분 UNIQUE 인덱스 매칭)
--     나머지 본문(distribute_rewards_safe 호출 보호 포함) 보존.
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
    ON CONFLICT (source_id) WHERE conversion_type = 'coupon_use' DO NOTHING
    RETURNING id INTO v_conversion_id;

    IF v_conversion_id IS NOT NULL THEN
      PERFORM distribute_rewards_safe(v_conversion_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- (C) redeem_coupon_v2 — 잉여 conversion_events INSERT 블록 제거.
--     coupon_redemptions INSERT의 AFTER ROW 트리거가 더 풍부한 컬럼으로
--     conversion_events 1행 자동 처리(distribute_rewards_safe 분배 포함).
--     기존 RPC 측 INSERT는 트리거와 더블 → 같은 source_id로 부분 UNIQUE 충돌.
--     나머지(rate-limit / audit log / staff auth / RETURN / search_path / DEFINER) 보존.
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

  -- ----- Commit: mark used + insert redemption -----
  UPDATE public.coupon_claims
     SET status = 'used', used_at = NOW()
   WHERE id = v_claim.id;

  INSERT INTO public.coupon_redemptions
    (coupon_claim_id, partner_id, redeemed_by_staff_id, redeem_amount_krw)
  VALUES
    (v_claim.id, v_partner_id, p_staff_id, p_amount_krw)
  RETURNING id INTO v_redemption_id;

  -- v6.3 (A-FIX2): conversion_events INSERT 제거.
  -- AFTER INSERT 트리거 redemption_to_conversion_after_insert (trigger_redemption_to_conversion_v21)
  -- 가 conversion_events 1행을 chain_path/depth/advocate/origin/occurred_at 포함해서
  -- 자동 INSERT + distribute_rewards_safe 분배 호출. 기존 RPC 측 INSERT는 같은 source_id
  -- (= v_redemption_id) 더블 → uniq_conversion_coupon_use 충돌 EXCEPTION 유발.

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
-- (D) redeem_coupon (v1) — 잉여 conversion_events INSERT 블록 제거.
--     UI 호출 0건이나 정합성을 위해 동일 패턴 제거.
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

  -- v6.3 (A-FIX2): conversion_events INSERT 제거.
  -- AFTER INSERT 트리거가 conversion_events 1행 자동 처리(redeem_coupon_v2 주석 참조).

  RETURN v_redemption_id;
END;
$function$;

-- =====================================================================
-- (E) trigger_reservation_conversion — ON CONFLICT 안전망 추가.
--     confirm_reservation의 WHERE status='pending' 가드로 재발화 의미상 불가능하나
--     비용 0인 멱등 안전망. A-FIX(v6.2)의 chain_path 처리·발화 조건 100% 보존.
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

    -- v6.2: share_events 에 chain_path 컬럼이 없어 42703 발생하던 문제 수정.
    -- chain_depth 단독 SELECT, v_chain_path 는 NULL 유지 → INSERT 의 COALESCE
    -- 가 ARRAY[]::uuid[] 빈 배열로 채움. chain 추적은 파일럿 미사용.
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
    )
    ON CONFLICT (reservation_id) WHERE conversion_type = 'reservation_confirm' DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
