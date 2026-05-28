-- ============================================
-- v5.4 — get_drop_results.estimated_conversions: lifecycle_events 합산
--
-- 목적: B3-2 리포트의 "추정 전환" 카드에 외부 클릭(예약/전화/길찾기/공유)
--       시그널이 노출되도록 conversion_events + lifecycle_events 합산.
--
--       기존 v5.3 estimated_conversions = conversion_events.conversion_type별 분포만.
--       새 4개 event_type 화이트리스트(`reservation_click`, `phone_click`,
--       `directions_click`, `share_click`)를 lifecycle_events에서 추가 집계해
--       동일 jsonb 객체에 합쳐 넣는다.
--
-- 패턴: 시그니처 동일 → CREATE OR REPLACE (오버로딩 위험 없음).
--
-- 본문 보존: v5.3 dump 와 동일. estimated_conversions 1키만 UNION ALL 합산으로 교체.
--           기존 10키(share_uuid·click_count·unique_clicker_count·conversion_count·
--           drop·events·channels·hour_buckets·confirmed_conversions·
--           unique_visitors_estimate) 100% 보존.
--
-- 의존성: lifecycle_events.info_drop_id 직접 조인. share_event_id는 track_drop_event
--         RPC가 NULL 로 INSERT 하므로 사용 불가 — info_drop_id 기준 집계.
-- 롤백: 파일 하단 주석의 v5.3 정의로 복원.
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
    -- ▼▼ v5.4: 블록 4 추정 — conversion_events + lifecycle_events 화이트리스트 합산 ▼▼
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
    -- ▲▲ v5.4 변경 끝 ▲▲
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

-- ============================================
-- 롤백용 원본 정의 (v5.3 — estimated_conversions가 conversion_events 단일 소스)
-- ============================================
-- (v5.3 estimated_conversions 본문)
-- 'estimated_conversions', COALESCE((
--   SELECT jsonb_object_agg(e.conversion_type::text, e.cnt)
--   FROM (
--     SELECT conversion_type, count(*) AS cnt
--     FROM public.conversion_events
--     WHERE info_drop_id = d.id
--     GROUP BY conversion_type
--   ) e
-- ), '{}'::jsonb),
