-- v3.6 Tier 2 — 사용자(활동/쿠폰/설정) 백엔드: profiles 확장 + RPC 4종
--
-- ⚠⚠ 명세 파일 — 아직 적용하지 않음 (Duke 검토 대기). ⚠⚠
-- 적용:  node scripts/apply-migration.mjs v3.6_tier2_user_rpc supabase/migrations/v3.6_tier2_user_rpc.sql
--
-- 배경: Tier 2 활동/설정 라우트(내 Drop·받은 쿠폰·프로필 편집·활동 통계)가
--       기대하는 백엔드. 결정 락 — 새 테이블 금지, 기존 테이블 확장 + RPC 만.
--
-- 적용 전 확인 필요(MCP 끊겨 미검증 — gen types 기준 추정):
--   1) public_profiles view 의 현재 정의 — 컬럼 추가 전 기존 SELECT 보존 확인.
--   2) get_drop_results 의 기존 시그니처 — 아래 §6 참조.
--   3) drop_status / claim_status enum 의 실제 라벨 — 본 파일은 enum 라벨 비교를
--      피하고 ::text 비교 또는 published_at NULL 검사로 우회했다.

-- ============================================================
-- 1. profiles 확장 — username(공개 핸들) + bio(소개문)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS bio      text;

-- username 고유성 — 대소문자 무시, NULL 허용(점진 채움 → 부분 인덱스).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- username 형식 — 영문 소문자/숫자/언더스코어 3~20자.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_format
      CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
  END IF;
END $$;

-- bio 길이 가드 — 160자.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bio_length') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_bio_length
      CHECK (bio IS NULL OR char_length(bio) <= 160);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.username IS 'v3.6 공개 핸들(@username). 점진 채움 — NULL 허용.';
COMMENT ON COLUMN public.profiles.bio      IS 'v3.6 프로필 소개문 (최대 160자).';

-- public_profiles view 확장 — username/bio 를 무로그인 maker 표시에 노출.
-- ⚠ 기존 view 는 (id, display_name, avatar_url) 3컬럼. CREATE OR REPLACE VIEW 는
--   기존 컬럼의 순서·이름·타입을 보존해야 하므로 뒤에만 컬럼을 덧붙인다.
--   적용 전 `\d+ public.public_profiles` 로 현재 정의(WHERE 절 유무)를 확인할 것.
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, display_name, avatar_url, username, bio
  FROM public.profiles;

-- ============================================================
-- 2. get_my_drops — 내가 만든 Drop 목록 (info_drops.owner_user_id = auth.uid())
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_drops(
  p_status text DEFAULT NULL,   -- NULL=전체, 그 외 drop_status 라벨 문자열
  p_limit  int  DEFAULT 20,
  p_offset int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
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
$$;

COMMENT ON FUNCTION public.get_my_drops IS
  'v3.6 내가 만든 Drop 목록 (owner=auth.uid()). p_status 로 상태 필터, 페이지네이션.';

-- ============================================================
-- 3. get_my_coupons — 내가 받은 쿠폰 목록 (coupon_claims.catcher_user_id = auth.uid())
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_coupons(
  p_status text DEFAULT NULL    -- NULL=전체, 그 외 claim_status 라벨 문자열
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  SELECT COALESCE(jsonb_agg(t.row ORDER BY t.issued_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      cc.issued_at,
      jsonb_build_object(
        'claim_id',   cc.id,
        'claim_code', cc.claim_code,
        'status',     cc.status::text,
        'issued_at',  cc.issued_at,
        'used_at',    cc.used_at,
        'expires_at', cc.expires_at,
        'coupon', jsonb_build_object(
          'id',             c.id,
          'title',          c.title,
          'coupon_type',    c.coupon_type,
          'discount_unit',  c.discount_unit,
          'discount_value', c.discount_value,
          'valid_until',    c.valid_until
        ),
        'partner', jsonb_build_object(
          'id',   p.id,
          'name', p.display_name,
          'kind', p.partner_kind::text
        )
      ) AS row
    FROM public.coupon_claims cc
    JOIN public.coupons  c ON c.id = cc.coupon_id
    JOIN public.partners p ON p.id = c.partner_id
    WHERE cc.catcher_user_id = v_uid
      AND (p_status IS NULL OR cc.status::text = p_status)
    ORDER BY cc.issued_at DESC
  ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_my_coupons IS
  'v3.6 내가 받은 쿠폰 목록 (catcher=auth.uid()). coupon+partner 조인. p_status 필터.';

-- ============================================================
-- 4. get_user_stats — 내 활동 요약 통계
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  RETURN jsonb_build_object(
    'drop_count',
      (SELECT count(*) FROM public.info_drops WHERE owner_user_id = v_uid),
    'published_drop_count',
      (SELECT count(*) FROM public.info_drops
        WHERE owner_user_id = v_uid AND published_at IS NOT NULL),
    'total_views',
      (SELECT COALESCE(sum(view_count), 0) FROM public.info_drops WHERE owner_user_id = v_uid),
    'total_shares',
      (SELECT COALESCE(sum(share_count), 0) FROM public.info_drops WHERE owner_user_id = v_uid),
    'total_conversions',
      (SELECT COALESCE(sum(conversion_count), 0) FROM public.info_drops WHERE owner_user_id = v_uid),
    'coupon_count',
      (SELECT count(*) FROM public.coupon_claims WHERE catcher_user_id = v_uid),
    'share_event_count',
      (SELECT count(*) FROM public.share_events WHERE sender_user_id = v_uid)
  );
END;
$$;

COMMENT ON FUNCTION public.get_user_stats IS
  'v3.6 내 활동 요약 — Drop/조회/공유/전환/쿠폰 합계 (auth.uid() 기준).';

-- ============================================================
-- 5. 권한 — RPC 는 로그인 사용자만
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_my_drops(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_coupons(text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats()             TO authenticated;

-- ============================================================
-- 6. get_drop_results — p_period(기간) 파라미터 추가  [지시 노트, 본 파일 미포함]
-- ============================================================
-- get_drop_results 는 gen types 의 Functions 목록에 없어 현재 시그니처를 확정 못 한다.
-- 적용 담당자는 아래를 수행한다:
--   (1) `\df+ public.get_drop_results` 로 현재 인자/본문 확인.
--   (2) p_period 가 없으면 기존 본문 위에 다음을 추가:
--         p_period text DEFAULT 'all'   -- 'all' | '7d' | '30d'
--       이벤트 시계열 집계 부분에 다음 필터를 건다:
--         AND (p_period = 'all'
--              OR created_at >= now() - (CASE p_period
--                   WHEN '7d'  THEN interval '7 days'
--                   WHEN '30d' THEN interval '30 days'
--                   ELSE interval '100 years' END))
--   (3) DEFAULT 값이 있으므로 기존 1-인자 호출과 호환 — DROP 불필요.
-- 기존 본문을 모르는 상태로 CREATE OR REPLACE 하면 로직이 파괴되므로
-- 본 마이그레이션 파일에는 get_drop_results 정의를 포함하지 않는다.

-- 검증 (적용 후):
--   SELECT username, bio FROM public.profiles LIMIT 1;          -- 컬럼 존재
--   SELECT get_my_drops(NULL, 5, 0);                            -- jsonb 배열
--   SELECT get_my_coupons(NULL);                                -- jsonb 배열
--   SELECT get_user_stats();                                    -- jsonb 객체
--   SELECT * FROM public.public_profiles LIMIT 1;               -- username/bio 컬럼
