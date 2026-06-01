-- v6.8 — A4 ② create_reservation_anon 에 catcher_user_id 인자 + INSERT 추가
--
-- 본문 로직 무수정 원칙:
--   • 인자 14번째 p_catcher_user_id uuid DEFAULT NULL 추가 (호환).
--   • reservations INSERT 컬럼/VALUES 에 catcher_user_id / p_catcher_user_id 추가.
--   • partner lookup · 120초 dup 가드 · reservation_contacts INSERT ·
--     reservation_notifications INSERT · reservation_slots UPDATE 전부 그대로.
--   • search_path / DEFINER / 반환형 / 함수명 그대로.
--
-- 오버로딩 방지:
--   • CREATE OR REPLACE 가 같은 시그니처일 때만 덮어씀. 인자 수가 13→14 로
--     바뀌므로 새 함수가 생성되고 13인자 버전이 남음.
--   • → 기존 13인자 버전을 DROP 후 14인자 버전 CREATE.
--   • 새 인자 DEFAULT NULL 이라 14인자 함수 하나만 있어도 기존 13인자 호출도
--     자동 매칭됨 (PostgreSQL DEFAULT 자동 적용).

DROP FUNCTION IF EXISTS public.create_reservation_anon(
  uuid, uuid, uuid, text, date, text, date, date, integer, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.create_reservation_anon(
  p_drop_id          uuid,
  p_share_event_id   uuid,
  p_visitor_id       uuid,
  p_calendar_mode    text,
  p_reserved_date    date,
  p_time_slot        text,
  p_check_in_date    date,
  p_check_out_date   date,
  p_guest_count      integer,
  p_name             text,
  p_phone_hash       text,
  p_phone_last4      text,
  p_customer_message text,
  p_catcher_user_id  uuid DEFAULT NULL   -- ← A4: 14번째, 카카오 로그인 후 funnel 시점 profiles.id
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_partner_id uuid;
  v_reservation_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT partner_id INTO v_partner_id FROM info_drops WHERE id = p_drop_id;
  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Drop has no partner';
  END IF;

  -- RSV-DUP-FIX (B): 120초 내 동일 활성 예약 있으면 기존 id 반환 (다중 기기/세션 더블 방어)
  SELECT id INTO v_existing_id
  FROM reservations
  WHERE drop_id = p_drop_id
    AND visitor_id = p_visitor_id
    AND check_in_date IS NOT DISTINCT FROM p_check_in_date
    AND check_out_date IS NOT DISTINCT FROM p_check_out_date
    AND guest_count = p_guest_count
    AND status NOT IN ('cancelled', 'rejected', 'expired')
    AND created_at > now() - interval '120 seconds'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO reservations (
    drop_id, share_event_id, partner_id, visitor_id,
    calendar_mode, reserved_date, time_slot,
    check_in_date, check_out_date,
    guest_count, customer_message,
    catcher_user_id                                       -- ← A4 추가
  ) VALUES (
    p_drop_id, p_share_event_id, v_partner_id, p_visitor_id,
    p_calendar_mode, p_reserved_date, p_time_slot,
    p_check_in_date, p_check_out_date,
    p_guest_count, p_customer_message,
    p_catcher_user_id                                     -- ← A4 추가
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

GRANT EXECUTE ON FUNCTION public.create_reservation_anon(
  uuid, uuid, uuid, text, date, text, date, date, integer, text, text, text, text, uuid
) TO anon, authenticated, PUBLIC;
