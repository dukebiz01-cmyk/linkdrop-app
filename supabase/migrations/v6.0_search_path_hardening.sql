-- ============================================
-- v6.0 — DEFINER + search_path 미명시 7 RPC 하드닝 (E-AUDIT 🔴 #1)
--
-- 메모리 #24: SECURITY DEFINER 함수는 search_path 명시 필수. 미명시 시 호출자
-- session search_path 를 그대로 받아 동명 함수/객체로 hijack 가능.
--
-- 영향: 7 RPC 모두 본문에 extensions 스키마 함수 사용 0 (digest/crypt/hmac/encode/
-- decode/uuid_generate_v4/gen_salt 등 0건. 사용 함수 = now(), COALESCE, GREATEST,
-- EXISTS — 모두 pg_catalog). 따라서 `public, pg_catalog` 만으로 충분.
--
-- 변경: 7 RPC 에 `SET search_path TO 'public', 'pg_catalog'` 추가.
--       본문·시그니처·반환·LANGUAGE·SECURITY DEFINER·STABLE/VOLATILE 100% 보존.
--       모두 CREATE OR REPLACE (시그니처 불변).
--
-- 영향 분석:
--   - confirm_reservation        — UPDATE reservations / now()
--   - create_reservation_anon    — SELECT/INSERT reservations·reservation_contacts·
--                                   reservation_notifications, UPDATE reservation_slots
--   - get_partner_reservations   — SELECT JOIN reservations + reservation_contacts
--   - is_active_partner_owner    — SELECT EXISTS partners
--   - redeem_coupon (v1)         — SELECT/UPDATE coupon_claims, INSERT coupon_redemptions,
--                                   INSERT conversion_events (v2 가 UI 호출자이지만 v1 도
--                                   search_path 강화)
--   - reject_reservation         — SELECT/UPDATE reservations·reservation_slots
--   - trigger_reservation_conversion — SELECT info_drops·share_events, INSERT
--                                   conversion_events. 트리거 함수(DEFINER) — OLD/NEW
--                                   접근 search_path 무관.
--
-- 보존: 이미 search_path 있는 8 RPC (claim_coupon·create_drop_v2·gen_share_code·
--       get_drop_detail·get_drop_results·get_my_drops·redeem_coupon_v2·resolve_short_link)
--       무변경. PII/RLS 정책 무변경 (Step1 확인 — user_private_profiles 의 anon ALL 은
--       `auth.uid() = user_id` 가드로 사실상 인증된 본인만, 유출 없음).
--
-- 검증: 적용 후 7 RPC 모두 proconfig 에 search_path 포함, 시그니처(args) 불변.
-- 롤백: 각 함수 dump 를 파일 하단 주석에 보존.
-- ============================================

-- 1) confirm_reservation
CREATE OR REPLACE FUNCTION public.confirm_reservation(p_reservation_id uuid, p_partner_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  UPDATE reservations
  SET status = 'confirmed',
      partner_message = p_partner_message,
      confirmed_at = now(),
      updated_at = now()
  WHERE id = p_reservation_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found or already processed';
  END IF;
END;
$function$;

-- 2) create_reservation_anon
CREATE OR REPLACE FUNCTION public.create_reservation_anon(p_drop_id uuid, p_share_event_id uuid, p_visitor_id uuid, p_calendar_mode text, p_reserved_date date, p_time_slot text, p_check_in_date date, p_check_out_date date, p_guest_count integer, p_name text, p_phone_hash text, p_phone_last4 text, p_customer_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_partner_id uuid;
  v_reservation_id uuid;
BEGIN
  SELECT partner_id INTO v_partner_id FROM info_drops WHERE id = p_drop_id;
  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Drop has no partner';
  END IF;

  INSERT INTO reservations (
    drop_id, share_event_id, partner_id, visitor_id,
    calendar_mode, reserved_date, time_slot,
    check_in_date, check_out_date,
    guest_count, customer_message
  ) VALUES (
    p_drop_id, p_share_event_id, v_partner_id, p_visitor_id,
    p_calendar_mode, p_reserved_date, p_time_slot,
    p_check_in_date, p_check_out_date,
    p_guest_count, p_customer_message
  ) RETURNING id INTO v_reservation_id;

  INSERT INTO reservation_contacts (
    reservation_id, visitor_id, requester_name, phone_hash, phone_last4
  ) VALUES (
    v_reservation_id, p_visitor_id, p_name, p_phone_hash, p_phone_last4
  );

  INSERT INTO reservation_notifications (reservation_id, target_type, channel)
  VALUES (v_reservation_id, 'partner', 'email');

  UPDATE reservation_slots
  SET current_bookings = current_bookings + 1,
      updated_at = now()
  WHERE drop_id = p_drop_id
    AND slot_date = COALESCE(p_reserved_date, p_check_in_date)
    AND (slot_time = p_time_slot OR (slot_time IS NULL AND p_time_slot IS NULL));

  RETURN v_reservation_id;
END;
$function$;

-- 3) get_partner_reservations
CREATE OR REPLACE FUNCTION public.get_partner_reservations(p_partner_id uuid)
 RETURNS TABLE(reservation_id uuid, drop_id uuid, calendar_mode text, reserved_date date, time_slot text, check_in_date date, check_out_date date, guest_count integer, status text, customer_name text, phone_last4 text, customer_message text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT
    r.id,
    r.drop_id,
    r.calendar_mode,
    r.reserved_date,
    r.time_slot,
    r.check_in_date,
    r.check_out_date,
    r.guest_count,
    r.status,
    c.requester_name,
    c.phone_last4,
    r.customer_message,
    r.created_at
  FROM reservations r
  LEFT JOIN reservation_contacts c ON c.reservation_id = r.id
  WHERE r.partner_id = p_partner_id
  ORDER BY r.created_at DESC;
$function$;

-- 4) is_active_partner_owner
CREATE OR REPLACE FUNCTION public.is_active_partner_owner(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM partners
    WHERE owner_user_id = _user_id
      AND verification_status = 'approved'
  );
$function$;

-- 5) redeem_coupon (v1 — UI 호출 0건. search_path 만 부착. 삭제는 파일럿 후 별도)
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_claim_code text, p_staff_id uuid, p_amount_krw numeric DEFAULT NULL::numeric)
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

-- 6) reject_reservation
CREATE OR REPLACE FUNCTION public.reject_reservation(p_reservation_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_drop_id uuid;
  v_date date;
  v_time text;
BEGIN
  SELECT drop_id, COALESCE(reserved_date, check_in_date), time_slot
    INTO v_drop_id, v_date, v_time
  FROM reservations
  WHERE id = p_reservation_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found or already processed';
  END IF;

  UPDATE reservations
  SET status = 'rejected',
      partner_message = p_reason,
      updated_at = now()
  WHERE id = p_reservation_id;

  UPDATE reservation_slots
  SET current_bookings = GREATEST(0, current_bookings - 1),
      updated_at = now()
  WHERE drop_id = v_drop_id
    AND slot_date = v_date
    AND (slot_time = v_time OR (slot_time IS NULL AND v_time IS NULL));
END;
$function$;

-- 7) trigger_reservation_conversion
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

    SELECT chain_path, chain_depth
    INTO v_chain_path, v_chain_depth
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

-- ============================================
-- 롤백용 원본 정의 (v6.0 이전 — proconfig=null)
-- ============================================
-- 7 함수 모두 본문 동일, 차이는 `SET search_path TO 'public', 'pg_catalog'` 한 줄.
-- 롤백 시 각 함수의 CREATE OR REPLACE 본문에서 SET 줄만 제거. proconfig 가 null 로
-- 돌아오면 원상복귀.
