-- ============================================
-- v6.2 — trigger_reservation_conversion: SELECT 에서 없는 컬럼 chain_path 제거 (42703)
--
-- 원인 (A-FIX-READ 확정):
--   share_events 에 chain_path 컬럼이 없는데 트리거 본문이 SELECT chain_path
--   를 시도 → undefined_column (42703). AFTER UPDATE 트리거 실패 → confirm
--   UPDATE 롤백 → 사장님 [확정] 통째로 실패. conversion_events 0건 무한 유지.
--   conversion_events.chain_path 는 멀쩡히 존재 (NOT NULL, default '{}'::uuid[]).
--   문제는 SELECT 쪽뿐.
--
-- 결정 — 옵션 A (SELECT 에서 chain_path 제거):
--   share_events 에 chain_path 컬럼 추가(B) 는 파일럿 미사용 chain 추적 위해
--   DDL + 백필 부담 → 불필요. SELECT 를 chain_depth 단독으로 좁히고 v_chain_path
--   변수는 NULL 초기값 유지 → INSERT 의 COALESCE(v_chain_path, ARRAY[]::uuid[])
--   가 빈 배열로 채움. 의미 손실 0 (파일럿 chain 추적 미사용, 향후 share_events
--   에 chain_path 추가되면 SELECT 1줄만 부활).
--
-- 변경: SELECT chain_path 한 단어만 제거. DECLARE v_chain_path 그대로. INSERT
--   부분 그대로 (COALESCE 포함). 발화 조건·SECURITY DEFINER·search_path(v6.0)·
--   나머지 본문 100% 보존.
--
-- 영향 분석:
--   - on_reservation_confirmed 트리거 정의 (AFTER UPDATE) 무변경 — 함수 본문만 교체
--   - conversion_events·share_events·reservations 테이블 DDL 0
--   - confirm_reservation / get_partner_reservations / reject_reservation RPC 무변경
--   - 클라이언트 0 (배포 불필요)
--
-- 회귀: 없음. SELECT 좁히기 + COALESCE 빈 배열 fallback 으로 INSERT 의미 동일.
-- 롤백: 파일 하단 주석의 원본 정의 (v6.0) 로 복원.
-- ============================================

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
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- 롤백용 원본 정의 (v6.0 — chain_path SELECT 시 42703)
-- ============================================
-- CREATE OR REPLACE FUNCTION public.trigger_reservation_conversion()
--  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
--  SET search_path TO 'public', 'pg_catalog'
-- AS $function$
-- DECLARE
--   v_source_id uuid; v_chain_path uuid[]; v_chain_depth int;
-- BEGIN
--   IF NEW.status='confirmed' AND OLD.status='pending' AND NEW.share_event_id IS NOT NULL THEN
--     SELECT source_id INTO v_source_id FROM info_drops WHERE id = NEW.drop_id;
--     -- 이 줄이 42703 유발:
--     SELECT chain_path, chain_depth
--     INTO v_chain_path, v_chain_depth
--     FROM share_events WHERE id = NEW.share_event_id;
--     INSERT INTO conversion_events (...) VALUES (...);
--   END IF;
--   RETURN NEW;
-- END; $function$;
