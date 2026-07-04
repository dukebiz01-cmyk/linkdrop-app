-- # DB 실정의 스냅샷(형상관리용). migrations 아님 — 재적용 금지.
-- # 원본 마이그레이션 = v8.3_get_share_journey.sql (SM-1).
-- # 캡처: 2026-07-04 · pg_get_functiondef · md5(def)=532c92d94f71cd9ff57e70855960d0bd

CREATE OR REPLACE FUNCTION public.get_share_journey(p_share_uuid uuid)
 RETURNS TABLE("position" integer, masked_name text, role text, is_viewer boolean, has_conversion boolean, spread_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
WITH RECURSIVE start_event AS (
  SELECT se.id, se.parent_share_event_id, se.sender_user_id, se.conversion_count,
         se.fraud_decision, se.chain_origin_user_id, se.info_drop_id
  FROM public.share_events se
  JOIN public.info_drops d ON d.id = se.info_drop_id
  WHERE se.share_uuid = p_share_uuid
    AND d.status = 'published'
    AND d.is_public = true
),
walk AS (
  SELECT s.id, s.parent_share_event_id, s.sender_user_id, s.conversion_count, s.fraud_decision,
         1 AS hop
  FROM start_event s
  UNION ALL
  SELECT p.id, p.parent_share_event_id, p.sender_user_id, p.conversion_count, p.fraud_decision,
         w.hop + 1
  FROM walk w
  JOIN public.share_events p ON p.id = w.parent_share_event_id
  WHERE w.hop < 20 -- depth ≤ 20 가드
),
ordered AS (
  SELECT w.*, row_number() OVER (ORDER BY w.hop DESC) AS pos_all
  FROM walk w
),
visible AS (
  SELECT o.*, row_number() OVER (ORDER BY o.pos_all) AS node_pos,
         count(*) OVER () AS visible_count
  FROM ordered o
  WHERE o.fraud_decision IS DISTINCT FROM 'block' -- 어뷰징 노드 미표시
),
root AS (
  SELECT o.id AS root_id, o.sender_user_id AS origin_user FROM ordered o WHERE o.pos_all = 1
),
origin_check AS (
  SELECT (s.chain_origin_user_id IS NULL OR s.chain_origin_user_id = r.origin_user) AS ok,
         s.info_drop_id
  FROM start_event s, root r
),
spread AS (
  SELECT count(*)::int AS n
  FROM public.share_events se2, root r, origin_check oc
  WHERE se2.info_drop_id = oc.info_drop_id
    AND (se2.id = r.root_id
         OR (r.origin_user IS NOT NULL AND se2.chain_origin_user_id = r.origin_user))
)
SELECT
  v.node_pos::int AS "position",
  CASE
    WHEN p.display_name IS NULL OR length(trim(p.display_name)) < 6 THEN '참여자'
    ELSE left(trim(p.display_name), 3) || '***' || right(trim(p.display_name), 2)
  END AS masked_name,
  CASE
    WHEN v.node_pos = 1 THEN '개척'
    WHEN v.node_pos = v.visible_count THEN '결정타'
    ELSE '전달'
  END AS role,
  COALESCE(v.sender_user_id = auth.uid(), false) AS is_viewer, -- anon(uid null) = false 고정
  (COALESCE(v.conversion_count, 0) > 0) AS has_conversion,
  (SELECT n FROM spread) AS spread_count
FROM visible v
LEFT JOIN public.profiles p ON p.id = v.sender_user_id
WHERE (SELECT ok FROM origin_check)
ORDER BY v.node_pos;
$function$
