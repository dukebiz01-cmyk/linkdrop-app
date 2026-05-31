-- MYCARD-STATS — get_my_drops 본문 확장: info_drops 캐시 → 실시간 집계
-- 진단(diagnose-mycard-stats-zero): info_drops.{view,share,conversion}_count 채우는 트리거 0개
--   → 영원히 0 고정. 상세(get_drop_results)는 실시간 집계라 정상.
-- 결정(옵션 a): get_my_drops 본문에 서브쿼리 추가. get_drop_results와 동일 출처·정의로
--   리스트 숫자 = 성과보기 숫자 일치. 클라 무수정 (jsonb 키 그대로).
-- 보존: get_drop_results 본문·info_drops 캐시 컬럼·다른 RPC·트리거·스키마.
-- 권한: CREATE OR REPLACE 후 PUBLIC EXECUTE 재부여 (#24 회귀 방지).
-- 롤백: Downloads/MYCARD-STATS-ROLLBACK-get_my_drops.sql

CREATE OR REPLACE FUNCTION public.get_my_drops(
  p_status text DEFAULT NULL::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  SELECT COALESCE(jsonb_agg(t.row ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      d.created_at,
      jsonb_build_object(
        'id',               d.id,
        'purpose',          d.purpose::text,
        'status',           d.status::text,
        'ai_summary',       d.ai_summary,
        -- ▼▼ 실시간 집계: get_drop_results와 동일 출처·정의 ▼▼
        -- view_count: 첫 share_event(메이커 원본)의 click_count
        --   = get_drop_results(share_uuid)의 click_count (share 단위).
        --   "성과보기" 진입 시 share_uuid(첫 share_event)를 넘기므로 동일 숫자.
        'view_count', COALESCE((
          SELECT se.click_count FROM public.share_events se
          WHERE se.info_drop_id = d.id
          ORDER BY se.created_at ASC LIMIT 1
        ), 0),
        -- share_count: 해당 drop의 전체 share_events 수 (원본+재공유 합)
        'share_count', COALESCE((
          SELECT count(*) FROM public.share_events
          WHERE info_drop_id = d.id
        ), 0),
        -- conversion_count: 확정 전환 = coupon_used + reservation_confirm
        --   = get_drop_results의 confirmed_conversions.coupon_used
        --     + estimated_conversions.reservation_confirm (drop 단위)
        'conversion_count',
          COALESCE((
            SELECT count(*)
            FROM public.coupon_redemptions cr
            JOIN public.coupon_claims cc ON cc.id = cr.coupon_claim_id
            JOIN public.share_events se ON se.id = cc.share_event_id
            WHERE se.info_drop_id = d.id
          ), 0)
          + COALESCE((
            SELECT count(*) FROM public.conversion_events
            WHERE info_drop_id = d.id
              AND conversion_type = 'reservation_confirm'
          ), 0),
        -- ▲▲ 실시간 집계 끝 ▲▲
        'created_at',       d.created_at,
        'published_at',     d.published_at,
        'source', jsonb_build_object(
          'title',         cs.title,
          'thumbnail_url', cs.thumbnail_url,
          'provider',      cs.provider::text
        ),
        -- v5.5: 첫 share_event(메이커 원본)의 share_uuid
        'share_uuid', (
          SELECT se.share_uuid FROM public.share_events se
          WHERE se.info_drop_id = d.id
          ORDER BY se.created_at ASC LIMIT 1
        )
      ) AS row
    FROM public.info_drops d
    LEFT JOIN public.content_sources cs ON cs.id = d.source_id
    WHERE d.owner_user_id = v_uid
      AND (p_status IS NULL OR d.status::text = p_status)
    ORDER BY d.created_at DESC
    LIMIT  GREATEST(COALESCE(p_limit, 20), 0)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN v_result;
END;
$function$;

-- 권한 재부여 (#24 — CREATE OR REPLACE 후 grant 회귀 방지)
GRANT EXECUTE ON FUNCTION public.get_my_drops(text, integer, integer) TO PUBLIC;
