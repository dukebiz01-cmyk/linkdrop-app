-- v7.1 — Phase A4: create_reservation_anon 슬롯 차감 절을 매장별로 교체
--
-- 변경 범위 (본문 1곳만):
--   기존:  WHERE drop_id  = p_drop_id
--          AND slot_date  = COALESCE(p_reserved_date, p_check_in_date)
--          AND (slot_time = p_time_slot OR (slot_time IS NULL AND p_time_slot IS NULL))
--   변경:  WHERE partner_id = v_partner_id
--          AND slot_date    = COALESCE(p_reserved_date, p_check_in_date)
--          AND COALESCE(slot_time, '') = COALESCE(p_time_slot, '')
--
-- 무수정:
--   • 시그니처 (14인자, p_catcher_user_id 포함, commit 886ebf4)
--   • 120초 dup 가드 / reservations INSERT / reservation_contacts /
--     reservation_notifications / RAISE EXCEPTION / RETURN
--   • SECURITY DEFINER + search_path
--   • v_partner_id 는 이미 함수 안에서 SELECT 됨 (info_drops 에서)
--
-- 보존: 정산 트리거(on_reservation_confirmed) 회귀 0, catcher UNIQUE 무관.
--
-- ROLLBACK: 아래 [ROLLBACK] 블록의 v7.0 본문(commit 886ebf4) 그대로 복원.
--           단 v7.1_slots_partner_level.sql 의 스키마 ROLLBACK 도 필요.

-- ─────────────────────────────────────────────────────────────────────
-- [ROLLBACK] v7.0 본문 (참고용 주석, 실행 금지)
-- ─────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE FUNCTION public.create_reservation_anon(
--   p_drop_id uuid, p_share_event_id uuid, p_visitor_id uuid,
--   p_calendar_mode text, p_reserved_date date, p_time_slot text,
--   p_check_in_date date, p_check_out_date date, p_guest_count integer,
--   p_name text, p_phone_hash text, p_phone_last4 text,
--   p_customer_message text, p_catcher_user_id uuid DEFAULT NULL
-- ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
-- SET search_path TO 'public', 'pg_catalog' AS $$
-- ...
--   UPDATE reservation_slots
--   SET current_bookings = current_bookings + 1, updated_at = now()
--   WHERE drop_id = p_drop_id                                  -- ← ROLLBACK 시
--     AND slot_date = COALESCE(p_reserved_date, p_check_in_date)
--     AND (slot_time = p_time_slot OR (slot_time IS NULL AND p_time_slot IS NULL));
-- ...
-- $$;
-- ─────────────────────────────────────────────────────────────────────

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
  p_catcher_user_id  uuid DEFAULT NULL
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
    catcher_user_id
  ) VALUES (
    p_drop_id, p_share_event_id, v_partner_id, p_visitor_id,
    p_calendar_mode, p_reserved_date, p_time_slot,
    p_check_in_date, p_check_out_date,
    p_guest_count, p_customer_message,
    p_catcher_user_id
  ) RETURNING id INTO v_reservation_id;

  INSERT INTO reservation_contacts (
    reservation_id, visitor_id, requester_name, phone_hash, phone_last4
  ) VALUES (
    v_reservation_id, p_visitor_id, p_name, p_phone_hash, p_phone_last4
  );

  INSERT INTO reservation_notifications (reservation_id, target_type, channel)
  VALUES (v_reservation_id, 'partner', 'email');

  -- v7.1 — 슬롯 차감을 매장 기준으로. v_partner_id 는 위에서 이미 SELECT 됨.
  -- COALESCE NULL 안전 매칭으로 date_range(slot_time NULL) / time_slot 모두 처리.
  UPDATE reservation_slots
  SET current_bookings = current_bookings + 1,
      updated_at       = now()
  WHERE partner_id = v_partner_id
    AND slot_date  = COALESCE(p_reserved_date, p_check_in_date)
    AND COALESCE(slot_time, '') = COALESCE(p_time_slot, '');

  RETURN v_reservation_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_reservation_anon(
  uuid, uuid, uuid, text, date, text, date, date, integer, text, text, text, text, uuid
) TO anon, authenticated, PUBLIC;
