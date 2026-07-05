-- P7a is_public 백필 박제 (migrations 아님 · 재적용 금지)
-- 시점: 2026-07-05 · 운영 a870d410 · HEAD b88393f 기준
-- 목적: is_public UI(P7b) 도입 전 DEFAULT false로 깔린 게시 카드를 공개 복원
--       → P7c 탐색 필터 활성화 시 파일럿 카드 129건 전멸 방지
-- 신호 컬럼 확정: status='published' (published_at은 전 게시 카드 NULL이라 사용 불가 — 실측 확인)
--
-- [BEFORE] published/is_public=false = 117 · published/is_public=true = 12
-- [실행]
UPDATE public.info_drops
SET is_public = true
WHERE status = 'published' AND is_public = false;
-- [AFTER] published/is_public=true = 129 · published/is_public=false = 0  (검증 통과)
--
-- 멱등: 재실행 시 0 rows (published/false 부재). archived(298)·draft(3)는 무접촉.
