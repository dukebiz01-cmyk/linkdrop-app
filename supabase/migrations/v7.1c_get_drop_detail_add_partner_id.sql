-- v7.1c — get_drop_detail RPC 의 drop jsonb 에 partner_id 1키 추가
--
-- 배경 (Phase C):
--   • 손님 캘린더가 매장 슬롯(reservation_slots)을 보려면 partner_id 필요.
--   • get_drop_detail 의 detail.drop 에 partner_id 가 없어서 클라가
--     라운드트립 추가 없이는 못 얻음.
--   • 가장 깨끗한 길 = RPC 반환에 partner_id 추가 (드롭 레벨).
--
-- 변경 (1줄만):
--   detail.drop jsonb 에 'partner_id', d.partner_id 추가.
--   기존 키 (id, purpose, ai_summary, ai_key_points, reservation_data) 그대로.
--   다른 필드 (store, intent, source, maker, coupon, ctas, blocks, products,
--   curator_message, share_uuid, share_code, created_at) 전부 무수정.
--
-- 회귀: 정보 드롭/쿠폰 드롭 화면이 새 키를 무시하면 영향 0. anon SELECT
--       유지 (공개 STABLE 의미). 정산 트리거/catcher UNIQUE 무관.
--
-- ROLLBACK:
--   아래 [ROLLBACK] 블록의 v7.0 본문(partner_id 키 없음) 그대로 복원.

-- ─────────────────────────────────────────────────────────────────────
-- [ROLLBACK] v7.0 본문 (참고용 주석, 실행 금지)
-- ─────────────────────────────────────────────────────────────────────
--   ... (생략 — 'drop' jsonb 에 partner_id 없는 형태)
--   'drop', jsonb_build_object(
--     'id', d.id, 'purpose', d.purpose::text,
--     'ai_summary', d.ai_summary, 'ai_key_points', d.ai_key_points,
--     'reservation_data', d.reservation_data
--   ),
-- ─────────────────────────────────────────────────────────────────────

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
      'reservation_data', d.reservation_data,
      'partner_id', d.partner_id            -- ← v7.1c 추가
    ),
    'intent', jsonb_build_object('key', it.key, 'name', it.name, 'purpose', it.purpose::text),
    'source', jsonb_build_object(
      'title', cs.title, 'thumbnail_url', cs.thumbnail_url, 'source_url', cs.source_url,
      'author_name', cs.author_name, 'provider', cs.provider::text, 'duration_sec', cs.duration_sec
    ),
    'maker', (
      SELECT jsonb_build_object('display_name', pp.display_name, 'avatar_url', pp.avatar_url)
      FROM public.public_profiles pp WHERE pp.id = se.sender_user_id
    ),
    'store', COALESCE(
      (SELECT jsonb_build_object(
        'name', p.display_name, 'kind', p.partner_kind::text,
        'address', p.address, 'lat', p.lat, 'lng', p.lng,
        'phone', p.contact_phone, 'reservation_url', p.reservation_url
      )
      FROM public.drop_campaigns dc
      JOIN public.partners p ON p.id = dc.partner_id
      WHERE dc.id = d.campaign_id),
      (SELECT jsonb_build_object(
        'name', p.display_name, 'kind', p.partner_kind::text,
        'address', p.address, 'lat', p.lat, 'lng', p.lng,
        'phone', p.contact_phone, 'reservation_url', p.reservation_url
      )
      FROM public.partners p WHERE p.id = d.partner_id)
    ),
    -- v5.12: funnel_coupon_id 우선 → 없거나 비활성/만료면 partner_id 자동 매칭 fallback.
    'coupon', COALESCE(
      (
        SELECT jsonb_build_object(
          'id', c.id, 'title', c.title,
          'conditions', c.conditions,
          'valid_from', c.valid_from, 'valid_until', c.valid_until,
          'coupon_type', c.coupon_type, 'gift_item', c.gift_item
        )
        FROM public.coupons c
        WHERE c.id = d.funnel_coupon_id
          AND c.is_active = true
          AND (c.valid_from IS NULL OR c.valid_from <= now())
          AND (c.valid_until IS NULL OR c.valid_until >= now())
      ),
      (
        SELECT jsonb_build_object(
          'id', c.id, 'title', c.title,
          'conditions', c.conditions,
          'valid_from', c.valid_from, 'valid_until', c.valid_until,
          'coupon_type', c.coupon_type, 'gift_item', c.gift_item
        )
        FROM public.coupons c
        WHERE c.partner_id = d.partner_id
          AND c.is_active = true
          AND (c.valid_from IS NULL OR c.valid_from <= now())
          AND (c.valid_until IS NULL OR c.valid_until >= now())
        ORDER BY c.valid_from DESC NULLS LAST
        LIMIT 1
      )
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

-- #24 GRANT 재확인 (CREATE OR REPLACE 는 보존하지만 명시)
GRANT EXECUTE ON FUNCTION public.get_drop_detail(uuid)
  TO anon, authenticated, service_role;
