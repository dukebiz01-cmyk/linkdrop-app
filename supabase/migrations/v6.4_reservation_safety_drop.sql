-- v6.4 (A-FIX2b) — trigger_reservation_conversion 안전망 ON CONFLICT 제거 (42P10 정정)
--
-- A-FIX2 (E)로 추가한 ON CONFLICT predicate가 부분 인덱스
-- uniq_conversion_reservation_confirm 의 predicate 와 불일치:
--   인덱스      : WHERE conversion_type='reservation_confirm' AND reservation_id IS NOT NULL
--   ON CONFLICT : WHERE conversion_type='reservation_confirm'   ← reservation_id IS NOT NULL 누락
-- → 42P10 (matching index 못 찾음) → 확정 실패.
--
-- 결정: 안전망 자체 제거.
--   - 같은 reservation의 pending→confirmed 재발화는 confirm_reservation의
--     WHERE status='pending' 가드가 이미 차단.
--   - 만에 하나의 중복 INSERT 시도는 부분 UNIQUE 인덱스가 EXCEPTION으로 막음.
--   - 안전망은 "비용 0·가치 낮음"으로 넣었던 것 → 42P10 유발이므로 제거가 정공법.
--
-- 보존: INSERT 컬럼·VALUES·chain_path COALESCE(A-FIX v6.2)·발화 조건
-- (NEW.status='confirmed' AND OLD.status='pending' AND NEW.share_event_id IS NOT NULL)
-- ·source_id 경로·SECURITY DEFINER·search_path 100%.

BEGIN;

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

    -- v6.4 (A-FIX2b): ON CONFLICT 안전망 제거.
    -- 부분 인덱스 predicate(... AND reservation_id IS NOT NULL)와 ON CONFLICT
    -- predicate 불일치로 42P10 유발. 재발화 차단은 confirm_reservation의
    -- WHERE status='pending' 이, 무결성은 uniq_conversion_reservation_confirm 가 담당.
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
