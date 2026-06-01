-- v5.12 — info_drops.funnel_coupon_id + set_drop_funnel_coupon RPC
--          + get_drop_detail.coupon 우선 분기
--
-- 명세 SQL 결함 정정:
--   • drops → info_drops (본체 테이블).
--   • partner_id = auth.uid() (불가) → partners.owner_user_id 경유.
--   • funnel_coupon_id 컬럼 없으므로 추가 (신규 테이블 0 · 신규 enum 0 보존 규칙 충족).
--   • 받는 사람 화면 반영을 위해 get_drop_detail.coupon 서브쿼리에 funnel_coupon_id
--     우선 매칭 분기 추가 (없으면 기존 partner_id 자동 매칭으로 fallback).

ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS funnel_coupon_id uuid NULL REFERENCES public.coupons(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.info_drops.funnel_coupon_id IS
  '메이커가 위저드에서 직접 선택한 funnelCoupon. NULL 이면 get_drop_detail 가 partner_id 기준 자동 매칭 fallback.';

-- 메이커가 자기 drop 의 funnelCoupon 을 선택/변경. coupons.partner_id 의 owner 본인.
CREATE OR REPLACE FUNCTION public.set_drop_funnel_coupon(
  p_drop_id   uuid,
  p_coupon_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- drop 의 owner = 본인 검증.
  IF NOT EXISTS (
    SELECT 1 FROM public.info_drops d
    WHERE d.id = p_drop_id AND d.owner_user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'NOT_DROP_OWNER';
  END IF;

  -- coupon NULL 허용 (선택 해제). NOT NULL 일 때는 본인 매장 쿠폰 검증.
  IF p_coupon_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.coupons c
      JOIN public.partners p ON p.id = c.partner_id
      WHERE c.id = p_coupon_id
        AND p.owner_user_id = v_uid
        AND c.is_active = true
    ) THEN
      RAISE EXCEPTION 'NOT_OWNER_COUPON';
    END IF;
  END IF;

  UPDATE public.info_drops
  SET funnel_coupon_id = p_coupon_id,
      updated_at = now()
  WHERE id = p_drop_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_drop_funnel_coupon(uuid, uuid) TO authenticated;

-- get_drop_detail.coupon 우선 분기: funnel_coupon_id 있으면 그 쿠폰 우선.
-- 본문은 v5.10 그대로, coupon 서브쿼리만 보강.
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
