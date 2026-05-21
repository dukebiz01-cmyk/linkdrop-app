-- v3.4 Step 7 — 무로그인 쿠폰 claim 지원
--
-- Step 7 §5: /api/coupons/claim 은 무로그인 + phone 으로 쿠폰을 받는다(claim).
-- 진단 결과:
--   - 기존 claim_coupon(p_coupon_id, p_share_event_id, p_catcher_user_id) 은
--     로그인 사용자(catcher_user_id) 전용 — 무로그인 phone claim 불가.
--   - coupon_claims 에 phone_hash / visitor_id 컬럼이 없음.
--   - coupons 에 remaining_count 없음 — total_count(발행 한도) + per_user_limit(1인 한도).
--   - claim_status enum = issued/used/expired/cancelled ('pending' 없음 → 'issued' 사용).
--
-- (a)안: coupon_claims 확장 + 무로그인 claim RPC 신규. 기존 claim_coupon 은 미변경.

-- (1) coupon_claims 확장 — 무로그인 식별 컬럼 (catcher_user_id 는 이미 nullable)
ALTER TABLE public.coupon_claims
  ADD COLUMN IF NOT EXISTS phone_hash text;
ALTER TABLE public.coupon_claims
  ADD COLUMN IF NOT EXISTS visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_claims_coupon_phone
  ON public.coupon_claims (coupon_id, phone_hash);

COMMENT ON COLUMN public.coupon_claims.phone_hash IS
  '무로그인 claim 시 SHA256(phone). 로그인 claim(catcher_user_id)은 NULL.';

-- (2) claim_coupon_anon — 무로그인 phone 기반 쿠폰 claim
CREATE OR REPLACE FUNCTION public.claim_coupon_anon(
  p_coupon_id       uuid,
  p_phone           text,
  p_visitor_anon_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_visitor_id uuid;
  v_phone_hash text;
  v_coupon     public.coupons%ROWTYPE;
  v_claimed    integer;
  v_per_user   integer;
  v_claim_id   uuid;
  v_claim_code text;
BEGIN
  -- 쿠폰 유효성
  SELECT * INTO v_coupon FROM public.coupons WHERE id = p_coupon_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon_not_found';
  END IF;
  IF v_coupon.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'coupon_inactive';
  END IF;
  IF v_coupon.valid_from IS NOT NULL AND now() < v_coupon.valid_from THEN
    RAISE EXCEPTION 'coupon_not_started';
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;

  v_visitor_id := public.upsert_visitor(p_visitor_anon_id);
  v_phone_hash := public.hash_phone(p_phone);

  -- 1인 한도 (per_user_limit 기본 1) — 같은 phone 으로 중복 claim 방지
  v_per_user := COALESCE(v_coupon.per_user_limit, 1);
  IF (SELECT count(*) FROM public.coupon_claims
      WHERE coupon_id = p_coupon_id AND phone_hash = v_phone_hash) >= v_per_user THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  -- 총 발행 한도 (total_count)
  IF v_coupon.total_count IS NOT NULL THEN
    SELECT count(*) INTO v_claimed
    FROM public.coupon_claims WHERE coupon_id = p_coupon_id;
    IF v_claimed >= v_coupon.total_count THEN
      RAISE EXCEPTION 'quota_exceeded';
    END IF;
  END IF;

  -- 6자리 인증 코드 + claim INSERT (status='issued', 무로그인이라 catcher_user_id NULL)
  v_claim_code := lpad(floor(random() * 1000000)::text, 6, '0');
  INSERT INTO public.coupon_claims (
    coupon_id, visitor_id, phone_hash, claim_code, status, expires_at
  ) VALUES (
    p_coupon_id, v_visitor_id, v_phone_hash, v_claim_code, 'issued', v_coupon.valid_until
  )
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object('claim_id', v_claim_id, 'claim_code', v_claim_code);
END;
$$;

COMMENT ON FUNCTION public.claim_coupon_anon IS
  '무로그인 phone 기반 쿠폰 claim. visitor upsert + phone_hash + 1인/총 한도 검사 + 6자리 claim_code 발급. 기존 claim_coupon(로그인 catcher)과 별개.';

GRANT EXECUTE ON FUNCTION public.claim_coupon_anon(uuid,text,text) TO anon, authenticated;

-- 검증 (적용 후):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='coupon_claims' AND column_name IN ('phone_hash','visitor_id'); 기대: 2행.
-- SELECT proname FROM pg_proc WHERE proname='claim_coupon_anon'; 기대: 1행.
-- SELECT has_function_privilege('anon','public.claim_coupon_anon(uuid,text,text)','EXECUTE'); 기대: true.
