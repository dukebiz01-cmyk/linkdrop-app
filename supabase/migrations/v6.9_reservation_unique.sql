-- v6.9 — A4 ④ partial UNIQUE (활성 예약 abuse 차단)
--
-- 같은 catcher 가 같은 drop 에 활성(pending/confirmed) 예약 1건만.
-- 취소/완료/거절/만료 이후 재예약 허용 (status partial).
--
-- 기존 27행 영향:
--   • catcher_user_id NULL → partial WHERE 절에서 자동 제외 → 충돌 0.
--   • 향후 catcher 채워지는 신규 행부터 차단 발효.
--
-- status 값 확인 (사전검증):
--   CHECK status IN ('pending','confirmed','completed','cancelled','rejected','expired')
--   활성 = pending + confirmed (확정 후 재예약 허용 정책).

CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_active_catcher
  ON public.reservations (drop_id, catcher_user_id)
  WHERE catcher_user_id IS NOT NULL
    AND status IN ('pending', 'confirmed');

COMMENT ON INDEX public.uq_reservations_active_catcher IS
  'A4 abuse 차단 — 같은 catcher 가 같은 drop 에 활성 예약 1건만 (확정 후 재예약 허용).';
