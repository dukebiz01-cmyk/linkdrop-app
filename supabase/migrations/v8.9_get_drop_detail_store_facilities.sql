-- v8.9 — S3-4 보정: get_drop_detail.store 에 facilities 추가 (additive 1키, 타 로직 무수정)
-- 근거: 카드 그리드 [시설 정보] 셀 공급원(partners.facilities jsonb — 노을재 실데이터 5종).
-- 의존 호출부: d.$shareUuid loader(명시 키 파싱)·api/drops/$shareCode(패스스루) — additive 무해.
-- 롤백: 직전 정의는 scratchpad 백업(v8.9-rollback-get_drop_detail.sql) — facilities 2줄 제거본과 동일.
-- 수칙: 적용 후 GRANT EXECUTE 재확인(anon/authenticated/service_role) + 호출 재검증.

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
      'partner_id', d.partner_id,
      'card_color', d.card_color
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
        'phone', p.contact_phone, 'reservation_url', p.reservation_url,
        'facilities', p.facilities
      )
      FROM public.drop_campaigns dc
      JOIN public.partners p ON p.id = dc.partner_id
      WHERE dc.id = d.campaign_id),
      (SELECT jsonb_build_object(
        'name', p.display_name, 'kind', p.partner_kind::text,
        'address', p.address, 'lat', p.lat, 'lng', p.lng,
        'phone', p.contact_phone, 'reservation_url', p.reservation_url,
        'facilities', p.facilities
      )
      FROM public.partners p WHERE p.id = d.partner_id)
    ),
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
    ), '[]'::jsonb),
    -- v8.1(Phase 1-B) — 파생 재고. 메인 product 블록(stock_limit 非null)일 때만, 아니면 null.
    'remaining_stock', (
      SELECT NULLIF(b.block_data->>'stock_limit', '')::int
             - COALESCE((
                 SELECT SUM(po.quantity)::int
                 FROM public.preorders po
                 WHERE po.drop_id = d.id
                   AND po.status IN ('pending','confirmed','fulfilled')
               ), 0)
      FROM public.component_blocks b
      WHERE b.info_drop_id = d.id
        AND b.block_kind = 'product'
        AND (b.block_data->>'ref_drop_id') IS NULL
        AND NULLIF(b.block_data->>'stock_limit', '') IS NOT NULL
      ORDER BY b.created_at ASC
      LIMIT 1
    )
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

-- 수칙 — CREATE OR REPLACE 후 GRANT 재확인(기존 ACL: anon/authenticated/service_role EXECUTE).
GRANT EXECUTE ON FUNCTION public.get_drop_detail(uuid) TO anon, authenticated, service_role;
