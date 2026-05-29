-- ============================================
-- v5.6a — 노을재 owner 의 info_drops 중 partner_id NULL 인 행 백필
--
-- 목적: H1-d funnel 활성화 전제. create_reservation_anon 이 info_drops.partner_id
--       를 직접 읽고 NULL 이면 RAISE EXCEPTION 'Drop has no partner' 로 실패한다.
--       노을재 owner 의 예약 drops 92건 + 그 외 일부가 partner_id NULL 이라 RPC 호출
--       자체가 막혀 있었다. 데이터 결함 백필로 해결 (RPC 본문 무변경 — 메모리 §76).
--
-- 안전:
--   - WHERE 절이 노을재 partner 의 owner_user_id 와 일치하는 drops 중 partner_id IS NULL
--     만 매치. 다른 매장 / 다른 메이커 drops 무영향.
--   - 기존 값이 있는 행은 덮어쓰지 않음 (IS NULL 조건).
--
-- 롤백: 정상 데이터 채움이라 불필요. 필요 시 UPDATE 직전 NULL 로 되돌릴 수 있음.
-- ============================================

UPDATE public.info_drops
SET partner_id = '282dca5c-aa4f-4800-9866-7e513b834c45'
WHERE owner_user_id IN (
  SELECT owner_user_id FROM public.partners
  WHERE id = '282dca5c-aa4f-4800-9866-7e513b834c45'
)
AND partner_id IS NULL;
