-- v5.11 — get_active_store_coupons(p_partner_id) RETURNS TABLE
--
-- 위저드 Step 2 쿠폰 분기에서 매장 활성 쿠폰 전체 목록 조회 (드롭다운).
-- coupons_public_read 정책(is_active=true) 통과. SECURITY DEFINER 로 일관.

CREATE OR REPLACE FUNCTION public.get_active_store_coupons(p_partner_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  coupon_type text,
  gift_item text,
  discount_value numeric,
  discount_unit text,
  is_active boolean,
  valid_from timestamptz,
  valid_until timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT c.id, c.title, c.coupon_type, c.gift_item,
         c.discount_value, c.discount_unit, c.is_active,
         c.valid_from, c.valid_until
  FROM public.coupons c
  WHERE c.partner_id = p_partner_id
    AND c.is_active = true
  ORDER BY c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_store_coupons(uuid) TO anon, authenticated;
