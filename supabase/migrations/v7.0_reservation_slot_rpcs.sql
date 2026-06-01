-- v7.0 — 예약 슬롯 RPC 4개 (업주 마킹 + 별건 search_path)
--
-- 작업 1 (revive_B). 2모드(date_range | date_time_slot) 다 받음, 1차 UI 는 date_range 만 호출.
-- 패턴: SECURITY DEFINER + search_path='public,pg_catalog' + owner 검증 + grant authenticated.
--
-- 사전검증 (작업 0/0.5/0.7):
--   • reservation_slots 컬럼: drop_id, partner_id, calendar_mode(CHECK date_range|date_time_slot),
--     slot_date, slot_time, max_capacity, current_bookings, is_blocked, UNIQUE(drop_id, slot_date, slot_time)
--   • 차감 = create_reservation_anon 본문에 current_bookings+1 (이미 동작, 무수정)
--   • get_available_slots(uuid, date) RETURNS TABLE(slot_time text, available boolean, remaining int) STABLE
--   • info_drops.calendar_mode 컬럼 v7.0a 적용 (작업 2 에서 SELECT)
--   • info_drops 의 owner = partners.owner_user_id (info_drops.partner_id JOIN partners.id)
--
-- 보존:
--   • create_reservation_anon 무수정
--   • 정산 트리거(on_reservation_confirmed) 회귀 0

-- ──────────────────────────────────────────────────────────────────
-- (1) upsert_reservation_slot — 날짜 클릭 → 저장
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_reservation_slot(
  p_drop_id uuid,
  p_slot_date date,
  p_calendar_mode text,
  p_slot_time text DEFAULT NULL,
  p_max_capacity int DEFAULT 1,
  p_is_blocked boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_owner uuid;
  v_partner_id uuid;
  v_slot_id uuid;
BEGIN
  -- owner 검증 (drop → partner → owner)
  SELECT p.owner_user_id, p.id INTO v_owner, v_partner_id
  FROM info_drops d
  JOIN partners p ON p.id = d.partner_id
  WHERE d.id = p_drop_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized for drop %', p_drop_id;
  END IF;

  IF p_calendar_mode NOT IN ('date_range', 'date_time_slot') THEN
    RAISE EXCEPTION 'invalid calendar_mode %', p_calendar_mode;
  END IF;

  IF p_max_capacity < 1 OR p_max_capacity > 100 THEN
    RAISE EXCEPTION 'capacity out of range (1~100): %', p_max_capacity;
  END IF;

  INSERT INTO reservation_slots (
    drop_id, partner_id, calendar_mode, slot_date, slot_time,
    max_capacity, is_blocked
  ) VALUES (
    p_drop_id, v_partner_id, p_calendar_mode, p_slot_date, p_slot_time,
    p_max_capacity, p_is_blocked
  )
  ON CONFLICT (drop_id, slot_date, slot_time)
  DO UPDATE SET
    max_capacity = EXCLUDED.max_capacity,
    is_blocked = EXCLUDED.is_blocked,
    calendar_mode = EXCLUDED.calendar_mode,
    updated_at = now()
  RETURNING id INTO v_slot_id;

  RETURN jsonb_build_object('slot_id', v_slot_id, 'ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.upsert_reservation_slot(uuid, date, text, text, int, boolean)
  TO authenticated;

-- ──────────────────────────────────────────────────────────────────
-- (2) delete_reservation_slot — 마킹 해제 (예약 있으면 막음)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_reservation_slot(
  p_drop_id uuid,
  p_slot_date date,
  p_slot_time text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  SELECT p.owner_user_id INTO v_owner
  FROM info_drops d
  JOIN partners p ON p.id = d.partner_id
  WHERE d.id = p_drop_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized for drop %', p_drop_id;
  END IF;

  DELETE FROM reservation_slots
  WHERE drop_id = p_drop_id
    AND slot_date = p_slot_date
    AND (slot_time = p_slot_time OR (slot_time IS NULL AND p_slot_time IS NULL))
    AND current_bookings = 0;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_reservation_slot(uuid, date, text)
  TO authenticated;

-- ──────────────────────────────────────────────────────────────────
-- (3) get_partner_slots — 업주 슬롯 현황 (월 범위)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_partner_slots(
  p_drop_id uuid,
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_owner uuid;
  v_result jsonb;
BEGIN
  SELECT p.owner_user_id INTO v_owner
  FROM info_drops d
  JOIN partners p ON p.id = d.partner_id
  WHERE d.id = p_drop_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized for drop %', p_drop_id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slot_date', slot_date,
    'slot_time', slot_time,
    'max_capacity', max_capacity,
    'current_bookings', current_bookings,
    'is_blocked', is_blocked,
    'calendar_mode', calendar_mode
  ) ORDER BY slot_date, slot_time), '[]'::jsonb) INTO v_result
  FROM reservation_slots
  WHERE drop_id = p_drop_id
    AND slot_date BETWEEN p_from AND p_to;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_partner_slots(uuid, date, date)
  TO authenticated;

-- ──────────────────────────────────────────────────────────────────
-- (4) 별건: get_available_slots search_path 추가 (본문 무수정, 일관성)
-- ──────────────────────────────────────────────────────────────────
ALTER FUNCTION public.get_available_slots(uuid, date)
  SET search_path TO 'public', 'pg_catalog';
