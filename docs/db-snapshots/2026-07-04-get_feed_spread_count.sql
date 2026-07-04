-- # DB 실정의 스냅샷(형상관리용). migrations 아님 — 재적용 금지.
-- # 원본 마이그레이션 = v8.4_get_feed_spread_count.sql (SM-3).
-- # 캡처: 2026-07-04 · pg_get_functiondef · md5(def)=bc4c4316d89ec08dfe61124181a20046

CREATE OR REPLACE FUNCTION public.get_feed_spread_count(p_drop_ids uuid[])
 RETURNS TABLE(drop_id uuid, spread_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT d.id AS drop_id, count(se.id)::int AS spread_count
  FROM public.info_drops d
  JOIN public.share_events se
    ON se.info_drop_id = d.id
   AND se.fraud_decision IS DISTINCT FROM 'block'
  WHERE d.id = ANY(p_drop_ids)
    AND d.status = 'published'
    AND d.is_public = true
  GROUP BY d.id;
$function$
