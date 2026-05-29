-- ============================================
-- v5.6 — get_drop_detail: 반환 jsonb 에 coupon 키 추가
--
-- 목적: H1-d funnel — /d/{share_uuid} 수신자 카드가 "예약 문의하고 쿠폰 받기" CTA
--       노출 가능 여부와 발급 대상 coupon 식별을 위해 drop 의 partner 기준 active
--       coupon 1건을 반환에 포함. coupon 없으면 null → UI 측 CTA 미노출.
--
-- 매핑: drop.partner_id → coupons.partner_id (단순 JOIN). drop.partner_id 가
--       NULL 인 옛 drops 은 v5.6a 백필로 채워졌고, 향후 메이커는 partner.register
--       흐름에서 drop 생성 시 자동 채워야 한다 (별 트랙).
--
-- 패턴: 시그니처 동일 → CREATE OR REPLACE (오버로딩 위험 없음, v5.2 선례).
--
-- 본문 보존: v5.2 dump 와 동일. coupon 1키만 추가.
--           기존 11키(share_uuid·share_code·curator_message·created_at·drop·
--           intent·source·maker·store·ctas·blocks·products) 100% 보존. SECURITY
--           DEFINER · LANGUAGE · SET search_path · increment_share_view 부수호출
--           일체 보존.
--
-- 의존성: 호출처(/d/$shareUuid loader) 영향 0 — 반환 키만 늘어남. 클라이언트는
--         coupon 옵셔널 사용.
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
    -- v5.6: H1-d funnel — drop 의 partner 의 active coupon 1건 (가장 최신 valid_from)
    'coupon', (
      SELECT jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'conditions', c.conditions,
        'valid_from', c.valid_from,
        'valid_until', c.valid_until
      )
      FROM public.coupons c
      WHERE c.partner_id = d.partner_id
        AND c.is_active = true
        AND (c.valid_from IS NULL OR c.valid_from <= now())
        AND (c.valid_until IS NULL OR c.valid_until >= now())
      ORDER BY c.valid_from DESC NULLS LAST
      LIMIT 1
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
-- 롤백용 원본 정의 (v5.2 — coupon 키 없음)
-- ============================================
-- (v5.2 본문에서 'coupon' 서브쿼리 1개만 빼면 동일. v5.6 위 정의에서 v5.6 주석
--  블록을 통째 제거하면 v5.2 형태가 된다.)
