-- ============================================
-- v5.2 — get_drop_detail: 반환 jsonb에 share_code 추가
--
-- 목적: 재공유 흐름에서 /d/ 페이지가 share_code(6자)를 알 수 있도록
--       반환에 추가. 클라이언트가 drop.how/{share_code} 단축 URL 조립.
--
-- 패턴: 시그니처 동일 → CREATE OR REPLACE (오버로딩 위험 없음).
--
-- 본문 보존: 작업 A(B2-1 dump)와 동일. share_code 1곳만 추가:
--   jsonb_build_object 시작 부분에 'share_code', se.share_code 추가
--   (SELECT FROM share_events se 이미 있어 se.share_code 자동 접근).
--   increment_share_view 호출·JOIN·다른 키 100% 보존.
--
-- 의존성: 시그니처 불변이므로 호출처 영향 0.
-- 롤백: 파일 하단 주석의 원본 정의로 복원.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_drop_detail(p_share_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_result         jsonb;
  v_share_event_id uuid;
BEGIN
  SELECT se.id, jsonb_build_object(
    'share_uuid',      se.share_uuid,
    'share_code',      se.share_code,
    'curator_message', se.curator_message,
    'created_at',      se.created_at,
    'drop', jsonb_build_object(
      'id', d.id, 'purpose', d.purpose::text,
      'ai_summary', d.ai_summary, 'ai_key_points', d.ai_key_points,
      'reservation_data', d.reservation_data
    ),
    'intent', jsonb_build_object('key', it.key, 'name', it.name, 'purpose', it.purpose::text),
    'source', jsonb_build_object(
      'title', cs.title, 'thumbnail_url', cs.thumbnail_url, 'source_url', cs.source_url,
      'author_name', cs.author_name, 'provider', cs.provider::text, 'duration_sec', cs.duration_sec
    ),
    -- v3.5: 공유자(maker) — public_profiles view 경유
    'maker', (
      SELECT jsonb_build_object('display_name', pp.display_name, 'avatar_url', pp.avatar_url)
      FROM public.public_profiles pp WHERE pp.id = se.sender_user_id
    ),
    -- v3.5: 매장(store) — campaign 경유 best-effort (campaign 없으면 NULL)
    'store', (
      SELECT jsonb_build_object(
        'name', p.display_name, 'kind', p.partner_kind::text,
        'address', p.address, 'lat', p.lat, 'lng', p.lng,
        'phone', p.contact_phone, 'reservation_url', p.reservation_url
      )
      FROM public.drop_campaigns dc
      JOIN public.partners p ON p.id = dc.partner_id
      WHERE dc.id = d.campaign_id
    ),
    'ctas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cta_type', c.cta_type, 'label', c.label, 'url', c.url,
        'is_primary', c.is_primary, 'sort_order', c.sort_order
      ) ORDER BY c.sort_order)
      FROM public.drop_ctas c WHERE c.drop_id = d.id
    ), '[]'::jsonb),
    'blocks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'block_kind', b.block_kind, 'block_data', b.block_data,
        'block_config', b.block_config, 'position', b.position,
        'video_start_seconds', b.video_start_seconds, 'video_end_seconds', b.video_end_seconds
      ) ORDER BY b.position)
      FROM public.component_blocks b WHERE b.info_drop_id = d.id
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pd.id, 'product_name_guess', pd.product_name_guess,
        'brand_guess', pd.brand_guess, 'confidence', pd.confidence,
        'offers', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'seller_name', po.seller_name, 'seller_country', po.seller_country,
            'platform', po.platform, 'product_url', po.product_url,
            'price', po.price, 'currency', po.currency,
            'estimated_total_price', po.estimated_total_price
          ))
          FROM public.product_offers po WHERE po.detection_id = pd.id
        ), '[]'::jsonb)
      ) ORDER BY pd.sort_order)
      FROM public.product_detections pd WHERE pd.drop_id = d.id
    ), '[]'::jsonb)
  )
  INTO v_share_event_id, v_result
  FROM public.share_events se
  JOIN public.info_drops d        ON d.id = se.info_drop_id
  LEFT JOIN public.intent_types it    ON it.id = d.intent_id
  LEFT JOIN public.content_sources cs ON cs.id = d.source_id
  WHERE se.share_uuid = p_share_uuid;

  IF v_share_event_id IS NOT NULL THEN
    PERFORM public.increment_share_view(v_share_event_id);
  END IF;

  RETURN v_result;
END;
$function$;

-- ============================================
-- 롤백용 원본 정의 (v5.2 이전 상태 — share_code 키 없음)
-- ============================================
-- CREATE OR REPLACE FUNCTION public.get_drop_detail(p_share_uuid uuid)
--  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
--  SET search_path TO 'public', 'pg_catalog'
-- AS $function$
-- DECLARE v_result jsonb; v_share_event_id uuid;
-- BEGIN
--   SELECT se.id, jsonb_build_object(
--     'share_uuid', se.share_uuid,
--     'curator_message', se.curator_message,
--     'created_at', se.created_at,
--     'drop', jsonb_build_object(...),
--     'intent', jsonb_build_object(...),
--     'source', jsonb_build_object(...),
--     'maker', (...),
--     'store', (...),
--     'ctas', COALESCE((...), '[]'::jsonb),
--     'blocks', COALESCE((...), '[]'::jsonb),
--     'products', COALESCE((...), '[]'::jsonb)
--   )
--   INTO v_share_event_id, v_result
--   FROM public.share_events se
--   JOIN public.info_drops d ON d.id = se.info_drop_id
--   LEFT JOIN public.intent_types it ON it.id = d.intent_id
--   LEFT JOIN public.content_sources cs ON cs.id = d.source_id
--   WHERE se.share_uuid = p_share_uuid;
--   IF v_share_event_id IS NOT NULL THEN
--     PERFORM public.increment_share_view(v_share_event_id);
--   END IF;
--   RETURN v_result;
-- END; $function$;
