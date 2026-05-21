-- v3.2 Step 5 — 카톡 공유 백엔드 보강
--
-- 정합성 점검 (2026-05-20): 기존 공유 RPC 는 v3.0/v3.1 schema 와 충돌 없음.
--   - increment_share_view: share_events.click_count 만 증가 — 신규 컬럼 무관.
--   - ld_create_share_edge_v3: share_events INSERT(신규 컬럼 없음) + drop_share_contexts
--     + intents 참조 — 전부 v3 미변경 테이블. info_drops 미INSERT → purpose NOT NULL 무관.
--   - trigger_share_event_edge_v21 / chain_v21: share_events 트리거 (PR #17 SECURITY DEFINER).
--   → 신규/수정 불필요.
--
-- 유일한 보강: get_drop_detail 호출 시 해당 share 의 조회수를 자동 +1.
--   기존엔 increment_share_view 를 클라이언트가 별도 호출해야 했음 → get_drop_detail 에 통합.

CREATE OR REPLACE FUNCTION public.get_drop_detail(p_share_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_result         jsonb;
  v_share_event_id uuid;
BEGIN
  SELECT se.id, jsonb_build_object(
    'share_uuid',      se.share_uuid,
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

  -- 조회수 통합: 받은 사람 화면 조회 시 share click_count +1
  IF v_share_event_id IS NOT NULL THEN
    PERFORM public.increment_share_view(v_share_event_id);
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_drop_detail IS
  '받은 사람 화면(무로그인) 일괄 조회 + 조회 시 increment_share_view 자동 호출 (v3.2).';

-- 검증 (적용 후):
-- 1) SELECT public.get_drop_detail('<유효 share_uuid>'::uuid) IS NOT NULL;  기대: true.
-- 2) 같은 share 에 대해 호출 전/후 share_events.click_count 비교 → +1 확인.
-- 3) SELECT has_function_privilege('anon','public.get_drop_detail(uuid)','EXECUTE');  기대: true (보존).
