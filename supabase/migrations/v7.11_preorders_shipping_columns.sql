-- v7.11 — F6-4 S1: preorders 배송지 4컬럼 (Duke 승인 SQL 원문)
--
-- 전부 nullable(기존 행 호환) · 롤백 = 컬럼 잔존 무해(DROP 불요).
-- 소비: create_preorder v2(v7.12)가 INSERT 동봉 · 파트너/손님 표시 3면(F6-4b).

ALTER TABLE public.preorders
  ADD COLUMN IF NOT EXISTS receiver_name text,
  ADD COLUMN IF NOT EXISTS receiver_phone text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS shipping_address_detail text;
