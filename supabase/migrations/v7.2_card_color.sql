-- =====================================================================
-- v7.2_card_color.sql
-- B 통합 b단계 — 메이커 카드 배경색(cardColor) 영속화 슬라이스
-- 라이브 검증 완료(2026-06-27): card_color 컬럼 없음 / get_drop_detail=v7.1c 동일 /
--   템플릿=set_drop_funnel_coupon·update_drop_key_points 골격 / GRANT anon 생존
-- 패턴: update_drop_key_points 복제(소유권=owner_user_id 검증만, 색은 추가검증 불필요)
-- §0: 색은 메이커가 고른 값을 저장만(생성/조작 0). nullable=옛 행 NULL=기존 흰배경 fallback.
-- 실행: Supabase SQL Editor(프로젝트 xukxtzjfqfwalqpmfidb) 직접 실행. (db push 금지)
-- =====================================================================

-- 1) info_drops 에 카드 배경색 컬럼 (nullable, default 없음 — 옛 드롭=NULL=흰배경 fallback)
ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS card_color text;

COMMENT ON COLUMN public.info_drops.card_color IS
  '메이커가 스튜디오에서 고른 카드 배경색(A+B 색자유, 임의 문자열/hex). NULL=옛 드롭=손님 흰배경 fallback.';


-- 2) set_drop_card_color RPC (update_drop_key_points 정본 복제)
CREATE OR REPLACE FUNCTION public.set_drop_card_color(p_drop_id uuid, p_color text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.info_drops d
    WHERE d.id = p_drop_id AND d.owner_user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'NOT_DROP_OWNER';
  END IF;
  UPDATE public.info_drops
  SET card_color = p_color,
      updated_at = now()
  WHERE id = p_drop_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_drop_card_color(uuid, text) TO authenticated;


-- 3) get_drop_detail — 라이브 v7.1c 본문 전체 복사 + drop 객체에 'card_color' 한 줄 추가
--    (CREATE OR REPLACE 는 부분수정 불가 → 본문 통째 + 1줄. ★변경=drop 객체 card_color 뿐)
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
      'card_color', d.card_color            -- ← v7.2 추가
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

-- 재GRANT (CREATE OR REPLACE 후 grant 소실 함정 대비 — 메모리 #24. anon=소비자 /d 불가침)
GRANT EXECUTE ON FUNCTION public.get_drop_detail(uuid) TO anon, authenticated, service_role;


-- =====================================================================
-- 검증 (적용 직후 별도 실행 — 마이그레이션엔 포함 안 함)
-- =====================================================================
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='info_drops' AND column_name='card_color';
-- SELECT proname FROM pg_proc WHERE proname='set_drop_card_color' AND pronamespace='public'::regnamespace;
-- SELECT grantee, privilege_type FROM information_schema.role_routine_grants
--   WHERE routine_schema='public' AND routine_name IN ('get_drop_detail','set_drop_card_color') ORDER BY routine_name, grantee;


-- =====================================================================
-- ROLLBACK (역순 필수 — 함수 먼저 복원 후 컬럼 DROP)
-- =====================================================================
-- 1. get_drop_detail 를 v7.1c 본문(card_color 줄 제거)으로 CREATE OR REPLACE 복원 + 재GRANT
-- 2. DROP FUNCTION IF EXISTS public.set_drop_card_color(uuid, text);
-- 3. ALTER TABLE public.info_drops DROP COLUMN IF EXISTS card_color;
-- (순서 어기면 get_drop_detail 이 없는 컬럼 d.card_color 참조 → 런타임 에러)
