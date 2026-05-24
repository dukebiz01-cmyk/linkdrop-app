-- v3.7 Tier 4 — 파트너(매장) 백엔드: partners.slug + RPC 2종
--
-- ⚠⚠ 명세 파일 — 아직 적용하지 않음 (Duke 검토 대기). ⚠⚠
-- 적용:  node scripts/apply-migration.mjs v3.7_tier4_partner_rpc supabase/migrations/v3.7_tier4_partner_rpc.sql
--
-- 배경: Tier 4 비즈니스(매장) 라우트 — 매장 공개 페이지(/store/{slug})와
--       파트너 대시보드. 결정 락 — 새 테이블 금지, partners 확장 + RPC 만.
--
-- 적용 전 확인 필요(MCP 끊겨 미검증 — gen types 기준 추정):
--   1) verification_status enum 의 '승인' 라벨 — 본 파일은 'verified' 로 가정.
--      실제 라벨이 다르면 §2 get_store_by_slug 의 비교값을 교체할 것.
--   2) claim_status enum 의 '사용됨' 라벨 — §3 은 'used' 로 가정.
--   3) is_partner_staff(...) 의 인자 순서 — §3 은 (p_partner_id, p_user_id) 로 가정.
--      `\df public.is_partner_staff` 로 확인 후 맞출 것.
--   매장↔Drop 연결 경로: info_drops.campaign_id → drop_campaigns.partner_id.

-- ============================================================
-- 1. partners 확장 — slug (매장 공개 페이지 핸들)
-- ============================================================
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS slug text;

-- slug 고유성 — 대소문자 무시, NULL 허용(점진 채움 → 부분 인덱스).
CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_slug_lower
  ON public.partners (lower(slug))
  WHERE slug IS NOT NULL;

-- slug 형식 — 영문 소문자/숫자/하이픈 2~40자.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partners_slug_format') THEN
    ALTER TABLE public.partners
      ADD CONSTRAINT partners_slug_format
      CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]{2,40}$');
  END IF;
END $$;

COMMENT ON COLUMN public.partners.slug IS
  'v3.7 매장 공개 페이지 핸들 (/store/{slug}). 점진 채움 — NULL 허용.';

-- ============================================================
-- 2. get_store_by_slug — 무로그인 매장 공개 페이지 데이터
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_store_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_partner_id uuid;
  v_result     jsonb;
BEGIN
  -- 검증 완료 매장만 공개.
  -- 'approved' = partners verification_status enum의 verified 의미 라벨
  -- (enum: pending, in_review, approved, rejected, revoked)
  SELECT id INTO v_partner_id
  FROM public.partners
  WHERE lower(slug) = lower(p_slug)
    AND verification_status::text = 'approved';

  IF v_partner_id IS NULL THEN
    RETURN NULL;   -- 라우트에서 404 처리
  END IF;

  SELECT jsonb_build_object(
    'partner', jsonb_build_object(
      'id',              p.id,
      'name',            p.display_name,
      'kind',            p.partner_kind::text,
      'slug',            p.slug,
      'address',         p.address,
      'lat',             p.lat,
      'lng',             p.lng,
      'phone',           p.contact_phone,
      'reservation_url', p.reservation_url
    ),
    -- 이 매장 캠페인에 연결된 게시 Drop
    'drops', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',         d.id,
        'purpose',    d.purpose::text,
        'ai_summary', d.ai_summary,
        'view_count', COALESCE(d.view_count, 0),
        'source', jsonb_build_object(
          'title',         cs.title,
          'thumbnail_url', cs.thumbnail_url
        )
      ) ORDER BY d.created_at DESC)
      FROM public.info_drops d
      JOIN public.drop_campaigns dc       ON dc.id = d.campaign_id
      LEFT JOIN public.content_sources cs ON cs.id = d.source_id
      WHERE dc.partner_id = p.id
        AND d.published_at IS NOT NULL
    ), '[]'::jsonb),
    -- 진행 중 쿠폰
    'active_coupons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',             c.id,
        'title',          c.title,
        'coupon_type',    c.coupon_type,
        'discount_unit',  c.discount_unit,
        'discount_value', c.discount_value,
        'valid_until',    c.valid_until
      ))
      FROM public.coupons c
      WHERE c.partner_id = p.id
        AND COALESCE(c.is_active, false)
        AND (c.valid_until IS NULL OR c.valid_until > now())
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.partners p
  WHERE p.id = v_partner_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_store_by_slug IS
  'v3.7 매장 공개 페이지(무로그인) — partner 정보 + 게시 Drop + 진행 쿠폰.';

-- ============================================================
-- 3. get_partner_dashboard — 파트너 대시보드 집계 (owner/staff 전용)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_partner_dashboard(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  SELECT owner_user_id INTO v_owner
  FROM public.partners WHERE id = p_partner_id;

  IF v_owner IS NULL THEN
    RETURN NULL;   -- 라우트에서 404 처리
  END IF;

  -- owner 본인 또는 partner_staff 만 열람.
  -- is_partner_staff 시그니처: (_user_id uuid, _partner_id uuid)
  IF v_owner <> v_uid AND NOT public.is_partner_staff(v_uid, p_partner_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = '42501';
  END IF;

  SELECT jsonb_build_object(
    'partner', jsonb_build_object(
      'id',                  p.id,
      'name',                p.display_name,
      'slug',                p.slug,
      'kind',                p.partner_kind::text,
      'verification_status', p.verification_status::text
    ),
    'stats', jsonb_build_object(
      'campaign_count',
        (SELECT count(*) FROM public.drop_campaigns WHERE partner_id = p.id),
      'drop_count',
        (SELECT count(*) FROM public.info_drops d
           JOIN public.drop_campaigns dc ON dc.id = d.campaign_id
          WHERE dc.partner_id = p.id),
      'total_views',
        (SELECT COALESCE(sum(d.view_count), 0) FROM public.info_drops d
           JOIN public.drop_campaigns dc ON dc.id = d.campaign_id
          WHERE dc.partner_id = p.id),
      'coupon_count',
        (SELECT count(*) FROM public.coupons WHERE partner_id = p.id),
      'coupon_claim_count',
        (SELECT count(*) FROM public.coupon_claims cc
           JOIN public.coupons c ON c.id = cc.coupon_id
          WHERE c.partner_id = p.id),
      'coupon_used_count',
        (SELECT count(*) FROM public.coupon_claims cc
           JOIN public.coupons c ON c.id = cc.coupon_id
          WHERE c.partner_id = p.id AND cc.status::text = 'used')
    ),
    'campaigns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',               dc.id,
        'title',            dc.campaign_title,
        'status',           dc.campaign_status::text,
        'budget_limit_krw', dc.budget_limit_krw,
        'budget_used_krw',  dc.budget_used_krw,
        'starts_at',        dc.starts_at,
        'ends_at',          dc.ends_at
      ) ORDER BY dc.created_at DESC)
      FROM public.drop_campaigns dc
      WHERE dc.partner_id = p.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.partners p
  WHERE p.id = p_partner_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_partner_dashboard IS
  'v3.7 파트너 대시보드 — owner/staff 전용. 캠페인/Drop/쿠폰 집계.';

-- ============================================================
-- 4. 권한
-- ============================================================
-- 매장 공개 페이지 — 무로그인 열람 (결정 락 2-4).
GRANT EXECUTE ON FUNCTION public.get_store_by_slug(text)      TO anon, authenticated;
-- 대시보드 — 로그인 필수, 내부에서 owner/staff 재검증.
GRANT EXECUTE ON FUNCTION public.get_partner_dashboard(uuid)  TO authenticated;

-- 검증 (적용 후):
--   SELECT slug FROM public.partners LIMIT 1;                       -- 컬럼 존재
--   -- slug 채운 매장이 있으면:
--   SELECT get_store_by_slug('<slug>');                            -- jsonb 또는 null
--   SELECT get_partner_dashboard('<owner 인 partner uuid>');        -- jsonb 객체
--   -- 타인 partner uuid 로 호출 시 FORBIDDEN(42501) 확인.
