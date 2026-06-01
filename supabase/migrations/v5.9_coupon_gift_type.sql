-- v5.9 — 증정 쿠폰(gift) 타입 + 품목 컬럼
--
-- 배경: 캠핑장 업주 실 요청 — 본인 매점에서 나가는 증정품(장작 1박스, 음료
--       등)을 쿠폰으로 주고 싶음. LinkDrop 코드 = 교환권, 기존 claim→redeem
--       흐름 그대로 재사용. 현 cash 정산 (reward_ledger) 은 redeem_amount_krw
--       기준이라 증정은 amount=NULL/0 으로 안전 분배 (split=0).
--
-- 현 스키마: coupons.coupon_type 은 자유 text (enum X · CHECK X). 'gift'
--           값 추가에 ALTER TYPE/제약 조정 불필요. 새 컬럼만 추가.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS gift_item text NULL;

COMMENT ON COLUMN public.coupons.gift_item IS
  'coupon_type=''gift'' 일 때 증정 품목명 (예: "장작 1박스"). 그 외 NULL.';
