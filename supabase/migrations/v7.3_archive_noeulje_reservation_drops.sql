-- v7.3 — 노을재(282dca5c) 옛 예약 드롭 94개 archived 처리
--
-- 배경:
--   · 2026-06-01 부터 노을재 = 쿠폰 통합 정책 (예약/구매/상담 신규 0).
--   · 예약 드롭 94 개 = 2026-05-14 ~ 2026-05-31 옛 데이터.
--   · "옛 잔재 정리" — 검색/탐색 feed 에서 제외, 옛 데이터 동선 정돈.
--
-- 효과 (READ v7.2 진단 확정):
--   ✅ feed-queries.ts published 필터에서 제외 (검색/탐색 미노출)
--   ✅ info_drops RLS drops_published_read 차단 (소유자 외 SELECT 0)
--   ⚠️ share_uuid 직접 진입은 차단 X (get_drop_detail SECURITY DEFINER 우회) —
--      이번 작업 범위 외. 별도 필터 추가는 별 작업.
--   ✅ RPC 8 개 본문에 published/archived 분기 0 → 회귀 0
--      (claim_coupon / confirm/reject_reservation / create_reservation_anon /
--       get_partner_results / get_partner_dashboard / get_drop_detail /
--       get_drop_results 모두 정상 동작)
--
-- 무영향 (별도 테이블):
--   · share_events 98 행
--   · lifecycle_events 94 행
--   · reservations 24 행 (옛 confirmed/pending/rejected)
--   · conversion_events 18 행 (정산 이력 보존)
--   · 정산 트리거 on_reservation_confirmed
--
-- 백업 (롤백용 — 94 id, created_at ASC):
--   c4fc152c, c03777f6, edcb49a7, 666dba14, 08408a0e, c6abea51, c5cd0f37,
--   1ba8b872, a4b8cfef, 0d9abde0, 98722a8c, 5a960f8b, 77914049, 9f1ebfbd,
--   e24e2559, 61cda4f5, b860cc9b, dce9cce2, ad905e88, 7302f0fc, 449ac11a,
--   6fca54a7, f68ea405, 06b7773c, 28d50691, e810ea93, bdd82f85, 905af655,
--   7803b3c3, c8cb334f, 90059524, 4bd0252e, 7497a464, a9b71837, 94a9d33e,
--   7f5e9b05, b164358b, ff3d7408, 86f9629c, c2cfeed6, f59cb67f, 48f0c961,
--   989361c9, 0e78b7f7, b9713308, d9d0be5f, 390429ab, e8cebfab, 23d5d9db,
--   7296b676, 089c05b1, 4d803362, 31b7954e, dbcb2eb5, f9de1c12, 31ae02c4,
--   fbe3e730, 9e9d47b2, e8f2d94e, bc0205fa, fd15188e, 4b7f96aa, 181df2d0,
--   7533430b, 3c98d14a, 08039a1e, 616f9a9e, 951f2bc3, c4a2ada0, 221afd65,
--   775093c2, 6da11983, 3e92b92b, a85c229c, 8a52231a, 42e190e6, d2ab2064,
--   d281ac2c, 5fbc80ab, 9e9fee8b, b05c5b26, 84eb11f4, f2428a0f, cf947986,
--   5c386b43, bdd40f43, 30a1db6e, d270bc9a, 1187cebb, 1efc3dd9, 27e3006b,
--   f7dca0c5, 8b18c600, b7b5285a
--
-- ROLLBACK (94 개 일괄):
--   UPDATE public.info_drops SET status='published'
--   WHERE partner_id='282dca5c-aa4f-4800-9866-7e513b834c45'
--     AND purpose='예약'
--     AND status='archived'
--     AND created_at < '2026-06-01';

UPDATE public.info_drops
SET status = 'archived'
WHERE partner_id = '282dca5c-aa4f-4800-9866-7e513b834c45'
  AND purpose = '예약'
  AND status = 'published';
