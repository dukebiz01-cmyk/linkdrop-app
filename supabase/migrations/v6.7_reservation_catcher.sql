-- v6.7 — A4 ① reservations.catcher_user_id 컬럼 (nullable)
--
-- 메모리 #21 + 헬스 스캔 A4: visitor_id 만으로 abuse 가능 → catcher_user_id
-- 추가. FK profiles(id) = 쿠폰 (coupon_claims.catcher_user_id) 패턴 일관.
-- nullable → 기존 27행 영향 0. 점진 채움.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS catcher_user_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_catcher_user_id
  ON public.reservations (catcher_user_id);

COMMENT ON COLUMN public.reservations.catcher_user_id IS
  '예약자 = 카카오 로그인 후 funnel 시점의 profiles.id. nullable (기존/무로그인 흐름 호환).';
