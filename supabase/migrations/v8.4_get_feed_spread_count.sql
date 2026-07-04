-- v8.4 — get_feed_spread_count(p_drop_ids uuid[]) 피드 확산 규모 배치 (SM-3)
--
-- 목적: 피드 타일 "N명 확산" 컴팩트 표시용 배치 1회 호출 — 1-B-2 패턴 미러.
-- 집계: 드랍 단위 share_events 카운트(fraud_decision='block' 배제 미러).
--   SM-1(get_share_journey) spread_count 와 동일 기준 의미 — 단일 체인 드랍에서 동일 숫자.
--   (참고: SM-1 spread 는 체인 원점 기준이라 다체인 드랍에서는 체인별 부분값 — 피드는 드랍
--    총량. 단일 체인 = 동일. SM-1 쪽은 fraud 필터 미적용이 기존 상태 — 본 함수는 지시대로 배제.)
-- 필터 미러: published + is_public 한정(비공개 행 미반환) · search_path 고정 ·
--   REVOKE public 후 GRANT anon/authenticated. 읽기 전용.

CREATE OR REPLACE FUNCTION public.get_feed_spread_count(p_drop_ids uuid[])
RETURNS TABLE (drop_id uuid, spread_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT d.id AS drop_id, count(se.id)::int AS spread_count
  FROM public.info_drops d
  JOIN public.share_events se
    ON se.info_drop_id = d.id
   AND se.fraud_decision IS DISTINCT FROM 'block'
  WHERE d.id = ANY(p_drop_ids)
    AND d.status = 'published'
    AND d.is_public = true
  GROUP BY d.id;
$$;

REVOKE ALL ON FUNCTION public.get_feed_spread_count(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_feed_spread_count(uuid[]) TO anon, authenticated;
