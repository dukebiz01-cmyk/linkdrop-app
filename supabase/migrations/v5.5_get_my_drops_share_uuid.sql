-- ============================================
-- v5.5 — get_my_drops: 각 drop 에 share_uuid 키 추가
--
-- 목적: /me 의 "내 카드" 섹션에서 비지니스 메이커가 카드 카운트 아래에
--       "성과 보기" 링크(/results/{share_uuid}) 를 띄울 수 있도록 share_uuid
--       를 반환에 포함. 첫 share_event(메이커 원본)의 share_uuid 1개.
--
-- 패턴: 시그니처 동일 → CREATE OR REPLACE (오버로딩 위험 없음, get_drop_detail v5.2
--       선례).
--
-- 본문 보존: N1 Step 0 에서 dump 한 원본과 동일. share_uuid 1키만 추가.
--           SECURITY DEFINER · LANGUAGE · SET search_path · AUTH_REQUIRED 가드 ·
--           jsonb_agg · ORDER BY · LIMIT/OFFSET · LEFT JOIN content_sources ·
--           기존 11키(id·purpose·status·ai_summary·view_count·share_count·
--           conversion_count·created_at·published_at·source) 일체 100% 보존.
--
-- 의존성: 호출처 영향 0 (반환 키만 늘어남). me.tsx 가 share_uuid 옵셔널 사용.
-- 롤백: 파일 하단 주석의 원본 정의로 복원.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_my_drops(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
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
        'view_count',       COALESCE(d.view_count, 0),
        'share_count',      COALESCE(d.share_count, 0),
        'conversion_count', COALESCE(d.conversion_count, 0),
        'created_at',       d.created_at,
        'published_at',     d.published_at,
        'source', jsonb_build_object(
          'title',         cs.title,
          'thumbnail_url', cs.thumbnail_url,
          'provider',      cs.provider::text
        ),
        -- v5.5: 첫 share_event(메이커 원본)의 share_uuid. 없으면 null.
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

-- ============================================
-- 롤백용 원본 정의 (v5.5 이전 — share_uuid 키 없음)
-- ============================================
-- CREATE OR REPLACE FUNCTION public.get_my_drops(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
--  RETURNS jsonb
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'pg_catalog'
-- AS $function$
-- DECLARE
--   v_uid    uuid := auth.uid();
--   v_result jsonb;
-- BEGIN
--   IF v_uid IS NULL THEN
--     RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
--   END IF;
--   SELECT COALESCE(jsonb_agg(t.row ORDER BY t.created_at DESC), '[]'::jsonb)
--   INTO v_result
--   FROM (
--     SELECT d.created_at, jsonb_build_object(
--       'id', d.id, 'purpose', d.purpose::text, 'status', d.status::text,
--       'ai_summary', d.ai_summary,
--       'view_count', COALESCE(d.view_count, 0),
--       'share_count', COALESCE(d.share_count, 0),
--       'conversion_count', COALESCE(d.conversion_count, 0),
--       'created_at', d.created_at, 'published_at', d.published_at,
--       'source', jsonb_build_object(
--         'title', cs.title, 'thumbnail_url', cs.thumbnail_url, 'provider', cs.provider::text
--       )
--     ) AS row
--     FROM public.info_drops d
--     LEFT JOIN public.content_sources cs ON cs.id = d.source_id
--     WHERE d.owner_user_id = v_uid
--       AND (p_status IS NULL OR d.status::text = p_status)
--     ORDER BY d.created_at DESC
--     LIMIT  GREATEST(COALESCE(p_limit, 20), 0)
--     OFFSET GREATEST(COALESCE(p_offset, 0), 0)
--   ) t;
--   RETURN v_result;
-- END; $function$;
