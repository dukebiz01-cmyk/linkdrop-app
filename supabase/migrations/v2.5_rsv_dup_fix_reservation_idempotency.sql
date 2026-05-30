-- RSV-DUP-FIX (B) — create_reservation_anon 120초 멱등 LOOKUP 추가
-- 원인: 클라이언트 더블탭/재오픈 재제출이 같은 (drop_id, visitor_id, 날짜, 인원) 으로
--       reservations 다중 INSERT. 프론트 가드(A)만으론 다중 기기/세션 못 잡음.
-- 결정: INSERT 전에 120초 윈도우 LOOKUP. 동일 활성 예약 있으면 그 id 반환 (멱등).
--       customer_message 는 LOOKUP 키에서 제외 — 메모 다른 의도적 재예약(이꼬미 케이스)은 허용.
-- 보존: SECURITY DEFINER, search_path, 모든 INSERT/UPDATE/contacts/notifications/slots 100%.
-- 롤백: Downloads/RSV-DUP-FIX-ROLLBACK-create_reservation_anon.sql

CREATE OR REPLACE FUNCTION public.create_reservation_anon(
  p_drop_id uuid,
  p_share_event_id uuid,
  p_visitor_id uuid,
  p_calendar_mode text,
  p_reserved_date date,
  p_time_slot text,
  p_check_in_date date,
  p_check_out_date date,
  p_guest_count integer,
  p_name text,
  p_phone_hash text,
  p_phone_last4 text,
  p_customer_message text
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
