-- v8.3.1 — get_share_journey role 문자열 정정: '결정타' → '최고공헌' (SM-2 v1.1 작업 0.5)
--   CREATE OR REPLACE 재정의 — 문자열만 변경, 로직·컬럼·보안 무변경(v8.3 원문 기반).
-- (이하 v8.3 원문 헤더 유지)
-- v8.3 — get_share_journey(p_share_uuid uuid) 공유지도 체인 조회 (SM-1)
--
-- 목적: 수신카드 공유지도용 체인(개척→…→현재) + 확산 규모 — 서버측 마스킹 단일 창구.
--   1-B-2(get_feed_remaining_stock) SECURITY DEFINER 패턴 미러.
--
-- 반환: 노드 행 집합(개척→현재 순) — spread_count 는 각 행에 동일값 반복(단일 규모).
--   · masked_name: 서버측 마스킹만 반환 — 앞3 + '***' + 뒤2, 6자 미만/이름 없음 = '참여자'.
--     ⛔ 원본 user_id·원본 표시명 미반환(반환 컬럼에 없음). 이름 소스 = profiles.display_name
--     (기존 "…님이 보냈어요" 표기와 동일 소스 — public_profiles 의 원본).
--   · role: position 1 = '개척' / 마지막 = '최고공헌' / 중간 = '전달' (단일 노드 = '개척').
--   · is_viewer: 호출자(auth.uid()) 노드만 true — 본인 실명 치환은 클라 몫(서버는 마스킹본만).
--   · has_conversion: share_events.conversion_count > 0 (실측 기준 택1 — 집계 카운터 단일 소스).
--     구매·수령 신원은 절대 미반환(플래그만 — 익명 "구매자" 노드는 클라 생성).
--   · 확산 규모: 동일 드랍 + 동일 체인 원점(root 이벤트 + chain_origin_user_id=원점 유저) 카운트.
--
-- 안전:
--   · SECURITY DEFINER + search_path 고정 · published + is_public 드랍의 공유만(비공개 = 0행).
--   · 재귀 depth ≤ 20 가드(무한 방지) · fraud_decision='block' 노드 미표시.
--   · 원점 대조: 시작 이벤트의 chain_origin_user_id 가 있으면 walk 최상단 sender 와 일치해야
--     반환(불일치 = 신뢰 불가 체인 → 0행, §0 보수).
--   · GRANT EXECUTE anon/authenticated.

CREATE OR REPLACE FUNCTION public.get_share_journey(p_share_uuid uuid)
RETURNS TABLE (
  "position" int, -- 예약어라 인용(클라 JSON 키는 동일하게 position)
  masked_name text,
  role text,
  is_viewer boolean,
  has_conversion boolean,
  spread_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_share_journey(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_share_journey(uuid) TO anon, authenticated;
