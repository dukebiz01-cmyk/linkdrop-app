-- v7.10 — F4-6 S1: 예약 슬롯 배치 upsert RPC (클램프·92일·건수 반환)
--
-- 목적: 캠핑장 파일럿 — 31일 수동 입력 해소. "시작일~종료일 + 요일 반복 +
--   자리수 일괄"을 원자적 1회 호출로 처리.
--
-- 사전 검증 (실 DB 2026-08-01 조회):
--   • uq_slots_partner_date_time = (partner_id, slot_date, COALESCE(slot_time,''::text))
--     → ON CONFLICT conflict_target 정확 일치 필수 (v7.1 동형).
--   • bulk_upsert_reservation_slots 부재 확인 → 신규 CREATE + GRANT 필요
--     (CREATE OR REPLACE 아님 — 기존 grant 승계 없음).
--   • reservation_slots 트리거 0개, RLS enabled (SECURITY DEFINER 라 무영향).
--   • 정산 트리거(on_reservation_confirmed) 는 reservations 테이블 소속 — 무관.
--
-- 설계 결정 (Duke 확정):
--   • 클램프: 예약 든 날 자리수 하향 시 max_capacity = GREATEST(신규값, current_bookings)
--     → 오버부킹 상태 원천 차단. protected 건수로 보고.
--   • 상한: p_end - p_start <= 92 (약 3개월) 서버 강제.
--   • 요일: ISO 규약 1=월 … 7=일 (EXTRACT(ISODOW)).
--   • date_range 전용 파일럿. p_slot_time 은 Phase 2(시간형) 시그니처 예약만 —
--     NULL 이면 calendar_mode='date_range', 값 있으면 'date_time_slot'.
--   • 반환 = {applied(총 upsert 일수), overwritten(기존 행 덮어쓴 일수),
--     protected(클램프 발동 일수)}. overwritten ⊆ applied, protected ⊆ overwritten.
--   • is_blocked 는 단건 upsert 동형(예약 든 날도 차단 가능 — 정책 변경 없음).
--
-- ROLLBACK (수동):
--   DROP FUNCTION IF EXISTS public.bulk_upsert_reservation_slots(uuid, date, date, int[], int, boolean, text);

BEGIN;

CREATE FUNCTION public.bulk_upsert_reservation_slots(
  p_partner_id   uuid,
  p_start        date,
  p_end          date,
  p_weekdays     int[],
  p_max_capacity int,
  p_is_blocked   boolean DEFAULT false,
  p_slot_time    text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_owner       uuid;
  v_mode        text;
  v_applied     int;
  v_overwritten int;
  v_protected   int;
BEGIN
  -- owner 검증 (v7.1 동형 — partners 직접 lookup)
  SELECT owner_user_id INTO v_owner
  FROM partners
  WHERE id = p_partner_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized for partner %', p_partner_id;
  END IF;

  IF p_start > p_end THEN
    RAISE EXCEPTION 'invalid range: start % after end %', p_start, p_end;
  END IF;

  IF (p_end - p_start) > 92 THEN
    RAISE EXCEPTION 'range too long (max 92 days): %', (p_end - p_start);
  END IF;

  IF p_weekdays IS NULL OR cardinality(p_weekdays) = 0 THEN
    RAISE EXCEPTION 'weekdays required (ISO 1=Mon..7=Sun)';
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(p_weekdays) AS w WHERE w < 1 OR w > 7) THEN
    RAISE EXCEPTION 'weekday out of range (1~7): %', p_weekdays;
  END IF;

  IF p_max_capacity < 1 OR p_max_capacity > 100 THEN
    RAISE EXCEPTION 'capacity out of range (1~100): %', p_max_capacity;
  END IF;

  v_mode := CASE WHEN p_slot_time IS NULL THEN 'date_range' ELSE 'date_time_slot' END;

  -- 건수 선집계 (덮어씀·클램프 예정 행). 함수 전체가 단일 트랜잭션이라
  -- 이어지는 INSERT 와의 어긋남은 실질 0 (슬롯 쓰기는 owner 단독 경로).
  WITH days AS (
    SELECT g.d::date AS slot_date
    FROM generate_series(p_start::timestamp, p_end::timestamp, interval '1 day') AS g(d)
    WHERE EXTRACT(ISODOW FROM g.d)::int = ANY (p_weekdays)
  ),
  pre AS (
    SELECT s.slot_date, s.current_bookings
    FROM reservation_slots s
    JOIN days dd ON dd.slot_date = s.slot_date
    WHERE s.partner_id = p_partner_id
      AND COALESCE(s.slot_time, '') = COALESCE(p_slot_time, '')
  )
  SELECT
    (SELECT count(*) FROM days),
    (SELECT count(*) FROM pre),
    (SELECT count(*) FROM pre WHERE current_bookings > p_max_capacity)
  INTO v_applied, v_overwritten, v_protected;

  -- ON CONFLICT conflict_target = uq_slots_partner_date_time 표현식 인덱스와
  -- 정확 일치 필수 (v7.1 동형). 클램프: 예약 수 미만으로 자리수 하향 금지.
  INSERT INTO reservation_slots (
    partner_id, calendar_mode, slot_date, slot_time,
    max_capacity, is_blocked
  )
  SELECT
    p_partner_id, v_mode, d.slot_date, p_slot_time,
    p_max_capacity, p_is_blocked
  FROM (
    SELECT g.d::date AS slot_date
    FROM generate_series(p_start::timestamp, p_end::timestamp, interval '1 day') AS g(d)
    WHERE EXTRACT(ISODOW FROM g.d)::int = ANY (p_weekdays)
  ) AS d
  ON CONFLICT (partner_id, slot_date, (COALESCE(slot_time, '')))
  DO UPDATE SET
    max_capacity  = GREATEST(EXCLUDED.max_capacity, reservation_slots.current_bookings),
    is_blocked    = EXCLUDED.is_blocked,
    calendar_mode = EXCLUDED.calendar_mode,
    updated_at    = now();

  RETURN jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'overwritten', v_overwritten,
    'protected', v_protected
  );
END;
$function$;

-- 신규 CREATE 라 grant 자동 승계 없음 — 명시 필수 (v7.1 패턴 동형).
GRANT EXECUTE ON FUNCTION
  public.bulk_upsert_reservation_slots(uuid, date, date, int[], int, boolean, text)
  TO authenticated;

COMMIT;
