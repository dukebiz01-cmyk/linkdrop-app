-- v6.6 — B3 성과 RPC 성능 인덱스 (CREATE INDEX 만, 데이터·로직 무영향)
--
-- 사전 확인 (작업 0):
--   • 7개 컬럼 모두 실재 ✅
--   • 우리 대상 컬럼 기존 인덱스 0건 (다른 컬럼 인덱스만 존재 — 무관) ✅
--   • → 7개 전부 신규 생성
--
-- 데이터 134~190행 수준이라 일반 CREATE INDEX 로 락 영향 무시 가능 (CONCURRENTLY 불필요).
-- IF NOT EXISTS 로 멱등 (재실행 안전).

-- 🔴 1순위 (get_partner_results 가 매번 조회)
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_info_drop_id
  ON public.lifecycle_events (info_drop_id);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_share_event_id
  ON public.lifecycle_events (share_event_id);

CREATE INDEX IF NOT EXISTS idx_drop_share_edges_info_drop_id
  ON public.drop_share_edges (info_drop_id);

-- 🟡 2순위 (조회 잦음)
CREATE INDEX IF NOT EXISTS idx_conversion_events_visitor_id
  ON public.conversion_events (visitor_id);

CREATE INDEX IF NOT EXISTS idx_coupon_claims_visitor_id
  ON public.coupon_claims (visitor_id);

CREATE INDEX IF NOT EXISTS idx_reservations_visitor_id
  ON public.reservations (visitor_id);

CREATE INDEX IF NOT EXISTS idx_reservation_slots_partner_id
  ON public.reservation_slots (partner_id);
