-- ============================================
-- v5.3 — get_drop_results: B3 성과 리포트 5블록 키 추가
--
-- 목적: 메이커가 자기 Drop의 성과를 5블록으로 보는 리포트 UI에
--       필요한 집계를 RPC 한 번에 반환.
--
-- 추가 5키 (모두 drop 단위 — d.id 기준):
--   channels                 — 공유 채널 분해 (블록 3)
--   hour_buckets             — 시간대별 조회 (블록 5)
--   confirmed_conversions    — 확정 전환 (쿠폰 사용 등) (블록 4 확정)
--   estimated_conversions    — 추정 전환 (conversion_events) (블록 4 추정)
--   unique_visitors_estimate — 고유 방문자 추정 (블록 2 — device_hash NULL 우회)
--
-- 패턴: 시그니처 동일 → CREATE OR REPLACE (오버로딩 위험 없음).
--
-- 본문 보존: B3-0 dump와 동일 — share_uuid·click_count·unique_clicker_count·
--           conversion_count·drop·events 6키 100% 보존, FROM/JOIN/WHERE 그대로.
--           jsonb_build_object 안에 5키만 추가.
--
-- 의존성: 호출처(`/api/...`·feed-queries 등) 영향 0 (반환 키만 늘어남).
-- 롤백: 파일 하단 주석의 원본 정의로 복원.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_drop_results(p_share_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'share_uuid',           se.share_uuid,
    'click_count',          se.click_count,
    'unique_clicker_count', se.unique_clicker_count,
    'conversion_count',     se.conversion_count,
    'drop', jsonb_build_object(
      'id',               d.id,
      'view_count',       d.view_count,
      'share_count',      d.share_count,
      'conversion_count', d.conversion_count
    ),
    'events', COALESCE((
      SELECT jsonb_object_agg(ev.event_type, ev.cnt)
      FROM (
        SELECT event_type, count(*) AS cnt
        FROM public.lifecycle_events
        WHERE info_drop_id = d.id
        GROUP BY event_type
      ) ev
    ), '{}'::jsonb),
    -- ▼▼ v5.3: B3 5블록 (모두 drop 전체 단위 — d.id) ▼▼
    -- 블록 3 — 공유 채널 분해 (kakao/sms/instagram_dm/copy_link/other)
    'channels', COALESCE((
      SELECT jsonb_object_agg(c.channel::text, c.cnt)
      FROM (
        SELECT channel, count(*) AS cnt
        FROM public.share_events
        WHERE info_drop_id = d.id
        GROUP BY channel
      ) c
    ), '{}'::jsonb),
    -- 블록 5 — 시간대별 조회 (click_audit_logs ← share_events 경유)
    'hour_buckets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hour', h.hr, 'views', h.cnt) ORDER BY h.hr)
      FROM (
        SELECT date_trunc('hour', cal.created_at) AS hr, count(*) AS cnt
        FROM public.click_audit_logs cal
        WHERE cal.share_event_id IN (
          SELECT se2.id FROM public.share_events se2 WHERE se2.info_drop_id = d.id
        )
        GROUP BY 1
      ) h
    ), '[]'::jsonb),
    -- 블록 4 확정 — 쿠폰 실제 사용 (coupon_redemptions ← coupon_claims ← share_events 2-hop)
    'confirmed_conversions', jsonb_build_object(
      'coupon_used', COALESCE((
        SELECT count(*)
        FROM public.coupon_redemptions cr
        JOIN public.coupon_claims cc ON cc.id = cr.coupon_claim_id
        JOIN public.share_events se3 ON se3.id = cc.share_event_id
        WHERE se3.info_drop_id = d.id
      ), 0)
    ),
    -- 블록 4 추정 — conversion_events conversion_type별 (coupon_use/reservation_confirm/sale_complete 등)
    'estimated_conversions', COALESCE((
      SELECT jsonb_object_agg(e.conversion_type::text, e.cnt)
      FROM (
        SELECT conversion_type, count(*) AS cnt
        FROM public.conversion_events
        WHERE info_drop_id = d.id
        GROUP BY conversion_type
      ) e
    ), '{}'::jsonb),
    -- 블록 2 — 고유 방문자 추정 (ip_hash distinct ← click_audit_logs, share_events 경유)
    -- device_hash가 전부 NULL이라 ip_hash로 우회. 정확도 후속(device_hash 채우기 별도).
    'unique_visitors_estimate', COALESCE((
      SELECT count(DISTINCT cal2.ip_hash)
      FROM public.click_audit_logs cal2
      WHERE cal2.share_event_id IN (
        SELECT se4.id FROM public.share_events se4 WHERE se4.info_drop_id = d.id
      ) AND cal2.ip_hash IS NOT NULL
    ), 0)
    -- ▲▲ v5.3 추가 끝 ▲▲
  )
  INTO v_result
  FROM public.share_events se
  JOIN public.info_drops d ON d.id = se.info_drop_id
  WHERE se.share_uuid = p_share_uuid;

  RETURN v_result;
END;
$function$;

-- ============================================
-- 롤백용 원본 정의 (v5.3 이전 — 6키만)
-- ============================================
-- CREATE OR REPLACE FUNCTION public.get_drop_results(p_share_uuid uuid)
--  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
--  SET search_path TO 'public', 'pg_catalog'
-- AS $function$
-- DECLARE v_result jsonb;
-- BEGIN
--   SELECT jsonb_build_object(
--     'share_uuid',           se.share_uuid,
--     'click_count',          se.click_count,
--     'unique_clicker_count', se.unique_clicker_count,
--     'conversion_count',     se.conversion_count,
--     'drop', jsonb_build_object(
--       'id', d.id, 'view_count', d.view_count,
--       'share_count', d.share_count, 'conversion_count', d.conversion_count
--     ),
--     'events', COALESCE((
--       SELECT jsonb_object_agg(ev.event_type, ev.cnt)
--       FROM (
--         SELECT event_type, count(*) AS cnt
--         FROM public.lifecycle_events
--         WHERE info_drop_id = d.id
--         GROUP BY event_type
--       ) ev
--     ), '{}'::jsonb)
--   )
--   INTO v_result
--   FROM public.share_events se
--   JOIN public.info_drops d ON d.id = se.info_drop_id
--   WHERE se.share_uuid = p_share_uuid;
--   RETURN v_result;
-- END; $function$;
