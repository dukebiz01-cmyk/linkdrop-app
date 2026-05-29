-- ============================================
-- v6.1 — create_drop_v2 partner 자동 매핑 + get_drop_detail store partner_id 직속 fallback
--
-- 목적: 신규 drop 이 partner_id=NULL 로 생성되어 H1-d funnel CTA("예약 문의하고
--       쿠폰 받기") 가 안 뜨던 근본 원인 해결. 파일럿 매장 owner 가 새 drop 만들
--       때마다 자동으로 partner_id 채움 + campaign 없어도 store 객체 채움.
--
-- 변경 2건 (CREATE OR REPLACE, 시그니처 불변):
--   A. create_drop_v2 — info_drops INSERT 에 partner_id 자동 매핑 추가
--      (auth.uid() → partners.owner_user_id AND verification_status='approved')
--   B. get_drop_detail — store 키를 COALESCE(campaign 경유, partner 직속) 로 확장
--
-- V61-READ 확정 사실:
--   - create_drop_v2 시그니처: (uuid, uuid, jsonb, text, uuid, text), DEFINER,
--     search_path=public,pg_catalog, auth.uid() 사용. INSERT 에 partner_id 빠짐.
--   - 업주↔partner: partners.owner_user_id = auth.uid() AND verification_status
--     ='approved' (1:N, 별도 조인 테이블 없음).
--   - info_drops.partner_id nullable=YES. owner_user_id NOT NULL.
--   - get_drop_detail.coupon JOIN = c.partner_id=d.partner_id (정확). store 만
--     drop_campaigns 경유 → campaign_id 100% NULL 이라 항상 NULL 반환.
--
-- 회귀 0:
--   - partner owner 아닌 일반 catcher 유저: SELECT INTO v_partner_id 가 0건 매치
--     → NULL 유지 → 기존 동작 그대로 (info_drops.partner_id nullable).
--   - 다중 매장 owner: LIMIT 1 임의 선택 (파일럿 1 owner = 1 partner 가정,
--     wizard 가 partner_id 명시하는 건 별 트랙).
--
-- 보존: 시그니처·DEFINER·search_path·share_code 로직·blocks·RETURNING·반환·예외·
--       coupon JOIN·다른 모든 키 100% 보존. surgical 편집만.
--
-- 롤백: 파일 하단 주석의 원본 정의로 복원. 클라이언트 영향 0 (배포 불필요).
-- ============================================

-- ============================================
-- A. create_drop_v2 — partner_id 자동 매핑
-- ============================================
CREATE OR REPLACE FUNCTION public.create_drop_v2(p_intent_id uuid, p_source_id uuid, p_blocks jsonb DEFAULT '[]'::jsonb, p_curator_message text DEFAULT NULL::text, p_campaign_id uuid DEFAULT NULL::uuid, p_share_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_drop_id    uuid;
  v_share_uuid uuid;
  v_msg        text;
  v_partner_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  -- v6.1: owner 의 승인된 partner 자동 매핑 (1 owner = 1 approved partner 가정).
  -- 조회 0건이면 v_partner_id 는 NULL 유지 → 기존 동작 그대로 (회귀 0).
  SELECT id INTO v_partner_id
  FROM public.partners
  WHERE owner_user_id = v_uid
    AND verification_status = 'approved'
  LIMIT 1;

  -- info_drops (purpose 는 trg_sync_info_drop_purpose 가 intent_id 로 채움)
  INSERT INTO public.info_drops (owner_user_id, intent_id, source_id, campaign_id, status, partner_id)
  VALUES (v_uid, p_intent_id, p_source_id, p_campaign_id, 'published', v_partner_id)
  RETURNING id INTO v_drop_id;

  -- component_blocks (블록 배열)
  INSERT INTO public.component_blocks (
    info_drop_id, block_kind, block_data, block_config, position, is_locked,
    video_start_seconds, video_end_seconds
  )
  SELECT
    v_drop_id,
    (elem->>'block_kind')::public.block_kind,
    COALESCE(elem->'block_data', '{}'::jsonb),
    COALESCE(elem->'block_config', '{}'::jsonb),
    COALESCE((elem->>'position')::integer, (ord - 1)),
    COALESCE((elem->>'is_locked')::boolean, false),
    NULLIF(elem->>'video_start_seconds', '')::integer,
    NULLIF(elem->>'video_end_seconds', '')::integer
  FROM jsonb_array_elements(p_blocks) WITH ORDINALITY AS t(elem, ord);

  -- share_events (share_uuid/channel 등 default)
  v_msg := NULLIF(trim(COALESCE(p_curator_message, '')), '');
  INSERT INTO public.share_events (info_drop_id, sender_user_id, curator_message, share_code)
  VALUES (v_drop_id, v_uid, v_msg, p_share_code)
  RETURNING share_uuid INTO v_share_uuid;

  RETURN jsonb_build_object('info_drop_id', v_drop_id, 'share_uuid', v_share_uuid);
END;
$function$;

-- ============================================
-- B. get_drop_detail — store COALESCE (campaign 경유 + partner 직속 fallback)
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
    -- v6.1: 매장(store) — campaign 경유 1차 + drop.partner_id 직속 2차 fallback.
    -- 2차 서브쿼리의 jsonb_build_object 키는 1차와 100% 동일 (name·kind·address·
    -- lat·lng·phone·reservation_url). 키 다르면 클라 깨짐.
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
-- 롤백용 원본 정의 (v6.1 이전)
-- ============================================
-- A. create_drop_v2 (v6.0): DECLARE 에 v_partner_id 없음. SELECT INTO 없음.
--    INSERT 컬럼 5개 (owner_user_id, intent_id, source_id, campaign_id, status).
-- B. get_drop_detail (v5.6): store = drop_campaigns 경유 단일 서브쿼리.
--    'store', (SELECT jsonb_build_object(...) FROM drop_campaigns dc JOIN partners p
--             ON p.id=dc.partner_id WHERE dc.id=d.campaign_id),
-- 롤백 시 위 v6.0/v5.6 정의로 CREATE OR REPLACE.
