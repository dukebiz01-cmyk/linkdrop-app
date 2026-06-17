-- B1 — get_coupon_by_claim_code(p_claim_code) : URL-QR(/r/{claim_code}) 확인 페이지용 조회 RPC
--
-- 목적: claim_code 하나로 쿠폰 "표시정보" + 뷰어의 redeem 권한을 무권한(anon+authenticated) 반환.
--   /coupon/$claim_code loader 는 catcher_user_id(본인)로만 조회 = 본인 전용 → (B) 직원·anon 조회용 신규.
--   ⚠️ 적용은 SQL Editor 에서 직접. (CC 작성만, 실행 안 함.)
--
-- 보안/원칙:
--   - SECURITY DEFINER (coupon_claims = RLS 미설정·직접 SELECT 불가, coupons = owner-only RLS 우회 위해).
--   - ★ PII 반환 금지 — phone_hash / visitor_id / catcher_user_id / 고객 전화·이름 절대 미포함.
--     (claim_code 는 QR 에 담겨 스캔되는 값 자체라 반환 OK. store_address/phone 은 '매장' 공개정보.)
--   - not found → NULL 반환(호출부 404). 신규 테이블/컬럼 0, 기존 함수 무수정.
--   - can_redeem: 로그인 호출자가 그 쿠폰 partner 의 owner 또는 활성 staff 인지. anon → false.
--
-- 실제 컬럼(확인): coupon_claims(claim_code,status,used_at,expires_at,coupon_id) ·
--   coupons(title,coupon_type,discount_value,discount_unit,conditions,valid_from,valid_until,partner_id,gift_item) ·
--   partners(display_name,owner_user_id,partner_kind,address). is_partner_staff(_user_id,_partner_id) 순서(v3.7/v6.5).

CREATE OR REPLACE FUNCTION public.get_coupon_by_claim_code(p_claim_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_claim      public.coupon_claims%ROWTYPE;
  v_coupon     public.coupons%ROWTYPE;
  v_partner    public.partners%ROWTYPE;
  v_can_redeem boolean := false;
BEGIN
  IF p_claim_code IS NULL OR btrim(p_claim_code) = '' THEN
    RETURN NULL;
  END IF;

  -- 1) claim_code 로 클레임 1건 (catcher 제약 없음)
  SELECT * INTO v_claim
  FROM public.coupon_claims
  WHERE claim_code = btrim(p_claim_code)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL; -- 호출부에서 404 처리
  END IF;

  -- 2) 쿠폰 본체
  SELECT * INTO v_coupon FROM public.coupons WHERE id = v_claim.coupon_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 3) 매장
  SELECT * INTO v_partner FROM public.partners WHERE id = v_coupon.partner_id;

  -- 4) 뷰어 redeem 권한 — 로그인 + (해당 매장 owner OR 활성 staff). anon(uid null) → false.
  IF v_uid IS NOT NULL AND v_partner.id IS NOT NULL THEN
    v_can_redeem :=
      (v_partner.owner_user_id = v_uid)
      OR public.is_partner_staff(v_uid, v_partner.id); -- 시그니처: (_user_id, _partner_id)
  END IF;

  -- 5) 표시용 jsonb (PII 없음)
  RETURN jsonb_build_object(
    -- 클레임 상태
    'claim_code',     v_claim.claim_code,
    'status',         v_claim.status::text,   -- issued | used | expired | cancelled
    'used_at',        v_claim.used_at,
    'expires_at',     v_claim.expires_at,
    -- 매장(공개정보)
    'store_name',     v_partner.display_name,
    'store_kind',     v_partner.partner_kind::text,
    'store_address',  v_partner.address,
    -- 혜택
    'title',          v_coupon.title,
    'coupon_type',    v_coupon.coupon_type,   -- 예: discount | gift
    'gift_item',      v_coupon.gift_item,     -- 증정형이면 품목, 아니면 null
    'discount_value', v_coupon.discount_value,
    'discount_unit',  v_coupon.discount_unit, -- 예: KRW | percent
    'conditions',     v_coupon.conditions,    -- jsonb (min_amount 등)
    'valid_from',     v_coupon.valid_from,
    'valid_until',    v_coupon.valid_until,
    -- 뷰어 권한
    'can_redeem',     v_can_redeem
  );
END;
$function$;

-- GRANT — anon + authenticated 둘 다 조회 가능(직원·손님·미로그인 확인 페이지).
REVOKE ALL ON FUNCTION public.get_coupon_by_claim_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coupon_by_claim_code(text) TO anon, authenticated;


-- ── (선택) claim_code 단건 보장 인덱스 ──────────────────────────────────────
-- 현재 claim_code 는 UNIQUE 미선언(RPC 충돌검사로만 보장). 1건 조회 확실히 하려면 추가 권장.
-- ⚠️ 기존 중복 없을 때만 성공 — 실행 전 아래로 중복 확인:
--   SELECT claim_code, count(*) FROM public.coupon_claims GROUP BY claim_code HAVING count(*) > 1;
-- 중복 0 이면:
--   CREATE UNIQUE INDEX IF NOT EXISTS uniq_coupon_claims_claim_code
--     ON public.coupon_claims (claim_code);


-- ── 검증 (SQL Editor) ───────────────────────────────────────────────────────
-- 1) anon 시점(미로그인) — can_redeem=false, 표시정보 채워짐:
--   SELECT public.get_coupon_by_claim_code('<실제 claim_code>');
-- 2) 직원 시점 — can_redeem=true 확인(claims 의 jwt sub 주입):
--   SELECT set_config('request.jwt.claims', json_build_object('sub','<STAFF_OR_OWNER_UUID>')::text, true);
--   SELECT public.get_coupon_by_claim_code('<실제 claim_code>') ->> 'can_redeem';  -- true
-- 3) 없는 코드 → NULL:
--   SELECT public.get_coupon_by_claim_code('NO_SUCH_CODE') IS NULL;  -- true
-- 4) PII 미포함 확인 — 반환 키에 phone/visitor/catcher 없는지:
--   SELECT (public.get_coupon_by_claim_code('<실제 claim_code>')) ?| array['phone_hash','visitor_id','catcher_user_id'];  -- false
