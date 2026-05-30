-- REPORT-RESHARE — get_drop_results 에 reshare_count 한 필드 추가 (v5.4 → v5.5)
-- 진단(diagnose-step6-report-data): 재공유 = share_events.parent_share_event_id IS NOT NULL.
-- 기존 본문 100% 보존 + 최상위 jsonb에 reshare_count 1줄만 추가.
-- 함수 내부 d.id (info_drops 별칭) 재사용 — 새 조회 안 추가.
-- estimated_conversions 화이트리스트는 별도 작업, 손대지 않음.
-- 롤백: Downloads/REPORT-RESHARE-ROLLBACK-get_drop_results.sql

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
    -- ▼▼ v5.5 추가: 재공유 카운트 (share_events.parent_share_event_id IS NOT NULL) ▼▼
    'reshare_count',        COALESCE((
      SELECT count(*)
      FROM public.share_events sere
      WHERE sere.info_drop_id = d.id
        AND sere.parent_share_event_id IS NOT NULL
    ), 0),
    -- ▲▲ v5.5 추가 끝 ▲▲
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
    -- 블록 3 — 공유 채널 분해 (v5.3)
    'channels', COALESCE((
      SELECT jsonb_object_agg(c.channel::text, c.cnt)
      FROM (
        SELECT channel, count(*) AS cnt
        FROM public.share_events
        WHERE info_drop_id = d.id
        GROUP BY channel
      ) c
    ), '{}'::jsonb),
    -- 블록 5 — 시간대별 조회 (v5.3)
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
    -- 블록 4 확정 — 쿠폰 실제 사용 (v5.3)
    'confirmed_conversions', jsonb_build_object(
      'coupon_used', COALESCE((
        SELECT count(*)
        FROM public.coupon_redemptions cr
        JOIN public.coupon_claims cc ON cc.id = cr.coupon_claim_id
        JOIN public.share_events se3 ON se3.id = cc.share_event_id
        WHERE se3.info_drop_id = d.id
      ), 0)
    ),
    -- v5.4: 블록 4 추정 — conversion_events + lifecycle_events 화이트리스트 합산
    'estimated_conversions', COALESCE((
      SELECT jsonb_object_agg(u.key, u.cnt)
      FROM (
        SELECT e.conversion_type::text AS key, count(*) AS cnt
        FROM public.conversion_events e
        WHERE e.info_drop_id = d.id
        GROUP BY e.conversion_type
        UNION ALL
        SELECT le.event_type AS key, count(*) AS cnt
        FROM public.lifecycle_events le
        WHERE le.info_drop_id = d.id
          AND le.event_type IN (
            'reservation_click','phone_click','directions_click','share_click'
          )
        GROUP BY le.event_type
      ) u
    ), '{}'::jsonb),
    -- 블록 2 — 고유 방문자 추정 (v5.3)
    'unique_visitors_estimate', COALESCE((
      SELECT count(DISTINCT cal2.ip_hash)
      FROM public.click_audit_logs cal2
      WHERE cal2.share_event_id IN (
        SELECT se4.id FROM public.share_events se4 WHERE se4.info_drop_id = d.id
      ) AND cal2.ip_hash IS NOT NULL
    ), 0)
  )
  INTO v_result
  FROM public.share_events se
  JOIN public.info_drops d ON d.id = se.info_drop_id
  WHERE se.share_uuid = p_share_uuid;

  RETURN v_result;
END;
$function$;
