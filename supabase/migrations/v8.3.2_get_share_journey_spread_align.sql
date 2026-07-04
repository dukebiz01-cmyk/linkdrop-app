-- v8.3.2 — get_share_journey 집계 정합 (SM-1 ↔ SM-3 spread 기준 통일)
--
-- 배경: SM-1(v8.3) spread = 체인 원점 기준 · fraud 미배제 / SM-3(v8.4 get_feed_spread_count)
--   = 드랍 기준 · fraud_decision='block' 배제. 어뷰징 노드 발생·다중 체인 드랍에서
--   상세(아코디언·시트) ↔ 피드 타일 숫자가 갈라짐 → spread CTE 만 v8.4 술어로 동일화.
-- 변경: spread CTE 단독 교체(원점·chain_origin 스코프 → 드랍 총량, v8.4 술어 복사).
--   노드 반환 로직(walk/visible/역할/마스킹/origin_check 게이트) 무수정.
-- 이력: v8.3(신설) → v8.3.1(role '최고공헌' 정정) → v8.3.2(spread 집계 정합, 본 건).

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
  -- v8.3.2 — v8.4(get_feed_spread_count) 술어 동일 복사(문구 차이 금지): 드랍 기준 ·
  --   fraud_decision='block' 배제 · published + is_public. 다중 체인 드랍에서도 피드와 일치.
  SELECT count(se2.id)::int AS n
  FROM public.info_drops d2
  JOIN public.share_events se2
    ON se2.info_drop_id = d2.id
   AND se2.fraud_decision IS DISTINCT FROM 'block'
  WHERE d2.id = (SELECT oc.info_drop_id FROM origin_check oc)
    AND d2.status = 'published'
    AND d2.is_public = true
)
SELECT
  v.node_pos::int AS "position",
  CASE
    WHEN p.display_name IS NULL OR length(trim(p.display_name)) < 6 THEN '참여자'
    ELSE left(trim(p.display_name), 3) || '***' || right(trim(p.display_name), 2)
  END AS masked_name,
  CASE
    WHEN v.node_pos = 1 THEN '개척'
    WHEN v.node_pos = v.visible_count THEN '최고공헌'
    ELSE '전달'
  END AS role,
  COALESCE(v.sender_user_id = auth.uid(), false) AS is_viewer, -- anon(uid null) = false 고정
  (COALESCE(v.conversion_count, 0) > 0) AS has_conversion,
  (SELECT n FROM spread) AS spread_count
FROM visible v
LEFT JOIN public.profiles p ON p.id = v.sender_user_id
WHERE (SELECT ok FROM origin_check)
ORDER BY v.node_pos;
$function$;
