-- v7.1 — Phase A3: 슬롯 RPC 4개 매장별 재작성
--
-- 변경:
--   • p_drop_id → p_partner_id (인자 시그니처 교체)
--   • owner 검증: info_drops JOIN partners → partners 직접 lookup
--   • upsert ON CONFLICT: (drop_id, slot_date, slot_time)
--                       → (partner_id, slot_date, (COALESCE(slot_time,'')))
--     ← v7.1 스키마 마이그의 표현식 인덱스와 정확히 일치해야 함.
--   • delete WHERE 절 slot_time 비교도 COALESCE 로 NULL 안전.
--   • get_available_slots: 공개 STABLE 유지 + anon/authenticated grant.
--
-- 보존:
--   • 정산 트리거(on_reservation_confirmed) / catcher UNIQUE / 쿠폰 무관.
--   • SECURITY DEFINER + search_path='public,pg_catalog' 패턴 유지.
--   • 자리수 1~100 CHECK 유지 (upsert).
--
-- ROLLBACK (수동, 이전 본문 그대로 복원):
--   아래 "[ROLLBACK]" 블록의 4 함수 정의를 그대로 실행하면 v7.0 상태로 복귀.
--   단 스키마(UNIQUE/인덱스) 도 v7.1_slots_partner_level.sql 의 ROLLBACK 절
--   먼저 실행 필요.

-- ─────────────────────────────────────────────────────────────────────
-- [ROLLBACK] v7.0 본문 (참고용 주석, 실행 금지)
-- ─────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE FUNCTION public.upsert_reservation_slot(
--   p_drop_id uuid, p_slot_date date, p_calendar_mode text,
--   p_slot_time text DEFAULT NULL, p_max_capacity int DEFAULT 1,
--   p_is_blocked boolean DEFAULT false
-- ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
-- SET search_path TO 'public', 'pg_catalog' AS $$
-- DECLARE v_owner uuid; v_partner_id uuid; v_slot_id uuid;
-- BEGIN
--   SELECT p.owner_user_id, p.id INTO v_owner, v_partner_id
--   FROM info_drops d JOIN partners p ON p.id = d.partner_id
--   WHERE d.id = p_drop_id;
--   IF v_owner IS NULL OR v_owner <> auth.uid() THEN
--     RAISE EXCEPTION 'not authorized for drop %', p_drop_id;
--   END IF;
--   ... (calendar_mode/capacity CHECK 후 INSERT ON CONFLICT)
--   ON CONFLICT (drop_id, slot_date, slot_time) DO UPDATE ...
-- END; $$;
--
-- CREATE OR REPLACE FUNCTION public.delete_reservation_slot(
--   p_drop_id uuid, p_slot_date date, p_slot_time text DEFAULT NULL
-- ) ...
--   DELETE FROM reservation_slots WHERE drop_id = p_drop_id ...
--
-- CREATE OR REPLACE FUNCTION public.get_partner_slots(
--   p_drop_id uuid, p_from date, p_to date
-- ) RETURNS jsonb ...
--   WHERE drop_id = p_drop_id AND slot_date BETWEEN p_from AND p_to
--
-- CREATE OR REPLACE FUNCTION public.get_available_slots(
--   p_drop_id uuid, p_date date
-- ) RETURNS TABLE(slot_time text, available boolean, remaining integer)
-- STABLE SET search_path TO 'public', 'pg_catalog' AS $$
--   SELECT slot_time, (current_bookings < max_capacity AND NOT is_blocked) AS available,
--          GREATEST(0, max_capacity - current_bookings) AS remaining
--   FROM reservation_slots WHERE drop_id = p_drop_id AND slot_date = p_date
--   ORDER BY slot_time NULLS FIRST;
-- $$;
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ── (1) upsert_reservation_slot — 매장별 마킹 ────────────────────────
DROP FUNCTION IF EXISTS public.upsert_reservation_slot(uuid, date, text, text, int, boolean);

CREATE FUNCTION public.upsert_reservation_slot(
  p_partner_id uuid,
  p_slot_date  date,
  p_calendar_mode text,
  p_slot_time  text    DEFAULT NULL,
  p_max_capacity int   DEFAULT 1,
  p_is_blocked boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_owner uuid;
  v_slot_id uuid;
BEGIN
  -- owner 검증 (partners 직접 lookup)
  SELECT owner_user_id INTO v_owner
  FROM partners
  WHERE id = p_partner_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized for partner %', p_partner_id;
  END IF;

  IF p_calendar_mode NOT IN ('date_range', 'date_time_slot') THEN
    RAISE EXCEPTION 'invalid calendar_mode %', p_calendar_mode;
  END IF;

  IF p_max_capacity < 1 OR p_max_capacity > 100 THEN
    RAISE EXCEPTION 'capacity out of range (1~100): %', p_max_capacity;
  END IF;

  -- ON CONFLICT 의 conflict_target = uq_slots_partner_date_time 표현식 인덱스
  -- ((partner_id, slot_date, (COALESCE(slot_time,'')))) 와 정확히 일치 필수.
  INSERT INTO reservation_slots (
    partner_id, calendar_mode, slot_date, slot_time,
    max_capacity, is_blocked
  ) VALUES (
    p_partner_id, p_calendar_mode, p_slot_date, p_slot_time,
    p_max_capacity, p_is_blocked
  )
  ON CONFLICT (partner_id, slot_date, (COALESCE(slot_time, '')))
  DO UPDATE SET
    max_capacity  = EXCLUDED.max_capacity,
    is_blocked    = EXCLUDED.is_blocked,
    calendar_mode = EXCLUDED.calendar_mode,
    updated_at    = now()
  RETURNING id INTO v_slot_id;

  RETURN jsonb_build_object('slot_id', v_slot_id, 'ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION
  public.upsert_reservation_slot(uuid, date, text, text, int, boolean)
  TO authenticated;

-- ── (2) delete_reservation_slot — 매장별 마킹 해제 ────────────────────
DROP FUNCTION IF EXISTS public.delete_reservation_slot(uuid, date, text);

CREATE FUNCTION public.delete_reservation_slot(
  p_partner_id uuid,
  p_slot_date  date,
  p_slot_time  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  SELECT owner_user_id INTO v_owner
  FROM partners
  WHERE id = p_partner_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized for partner %', p_partner_id;
  END IF;

  -- COALESCE 비교로 NULL slot_time 안전 매칭. 예약 들어온 슬롯은 보호.
  DELETE FROM reservation_slots
  WHERE partner_id = p_partner_id
    AND slot_date  = p_slot_date
    AND COALESCE(slot_time, '') = COALESCE(p_slot_time, '')
    AND current_bookings = 0;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION
  public.delete_reservation_slot(uuid, date, text)
  TO authenticated;

-- ── (3) get_partner_slots — 업주 슬롯 현황 ────────────────────────────
DROP FUNCTION IF EXISTS public.get_partner_slots(uuid, date, date);

CREATE FUNCTION public.get_partner_slots(
  p_partner_id uuid,
  p_from date,
  p_to   date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_owner  uuid;
  v_result jsonb;
BEGIN
  SELECT owner_user_id INTO v_owner
  FROM partners
  WHERE id = p_partner_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized for partner %', p_partner_id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slot_date',        slot_date,
    'slot_time',        slot_time,
    'max_capacity',     max_capacity,
    'current_bookings', current_bookings,
    'is_blocked',       is_blocked,
    'calendar_mode',    calendar_mode
  ) ORDER BY slot_date, slot_time), '[]'::jsonb) INTO v_result
  FROM reservation_slots
  WHERE partner_id = p_partner_id
    AND slot_date BETWEEN p_from AND p_to;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION
  public.get_partner_slots(uuid, date, date)
  TO authenticated;

-- ── (4) get_available_slots — 손님용 (공개) ──────────────────────────
DROP FUNCTION IF EXISTS public.get_available_slots(uuid, date);

CREATE FUNCTION public.get_available_slots(
  p_partner_id uuid,
  p_date       date
)
RETURNS TABLE(
  slot_date        date,
  slot_time        text,
  max_capacity     integer,
  current_bookings integer,
  available        integer
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT slot_date, slot_time, max_capacity, current_bookings,
         GREATEST(max_capacity - current_bookings, 0) AS available
  FROM reservation_slots
  WHERE partner_id = p_partner_id
    AND is_blocked = false
    AND slot_date >= p_date
  ORDER BY slot_date, slot_time;
$function$;

GRANT EXECUTE ON FUNCTION
  public.get_available_slots(uuid, date)
  TO anon, authenticated;

COMMIT;
