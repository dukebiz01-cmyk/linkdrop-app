-- v5.13 — toggle_coupon_active(p_coupon_id, p_active) RETURNS coupons
--
-- 매장 주인이 본인 쿠폰의 is_active 를 즉시 on/off (일시 중단/재개).
--
-- 명세 SQL 결함 정정:
--   • WHERE partner_id = auth.uid() (불가) → partners.owner_user_id 경유.
--   • updated_at = now() → 컬럼 없음 → 제거.
--
-- 회귀 안전:
--   • claim_coupon 이 이미 IF NOT v_coupon.is_active THEN RAISE 'COUPON_INACTIVE'
--     → 비활성 쿠폰 새 발급 자동 차단 (변경 X).
--   • 이미 발급된 coupon_claims 는 별개 → 손님 사용 흐름 무영향.
--   • get_active_store_coupons (v5.11) 가 is_active=true 필터 → 위저드
--     드롭다운에서 자동 제외.
--   • get_drop_detail.coupon 도 is_active=true 필터 (v5.10/v5.12) → /d/
--     자동 매칭에서 자동 제외.

CREATE OR REPLACE FUNCTION public.toggle_coupon_active(
  p_coupon_id uuid,
  p_active    boolean
)
RETURNS public.coupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.coupons;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- partners.owner_user_id 경유 owner 검증 + UPDATE.
  UPDATE public.coupons c
     SET is_active = p_active
   WHERE c.id = p_coupon_id
     AND EXISTS (
       SELECT 1 FROM public.partners p
       WHERE p.id = c.partner_id AND p.owner_user_id = v_uid
     )
  RETURNING c.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'COUPON_NOT_FOUND_OR_NOT_OWNED';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_coupon_active(uuid, boolean) TO authenticated;
