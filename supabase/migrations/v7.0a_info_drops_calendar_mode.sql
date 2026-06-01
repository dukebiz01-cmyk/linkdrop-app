-- v7.0a — info_drops.calendar_mode 컬럼 신설
--
-- 배경 (작업 0.5/0.7 결정):
--   • info_drops 에 calendar_mode 컬럼이 없어 업주 달력(작업 2)에서
--     드롭의 캘린더 모드를 알 수 없었음.
--   • ReserveFunnelSheet.tsx:132 가 매번 'date_range' 하드코딩 →
--     reservations 29행 전부 date_range. 다른 값 0.
--   • Duke "통일 구조" 의도 — 1차 UI 는 date_range 만, 단 DB·RPC 는
--     date_time_slot 까지 받음. 컬럼 신설로 토대 마련.
--
-- 영향 사전검증 (작업 0.7):
--   • 트리거 2개 (updated_at, sync_purpose) — 신규 컬럼 무관, 회귀 0.
--   • create_drop_v2 = 명시 컬럼 INSERT → DEFAULT 자동 채움, 수정 불필요.
--   • 의존 view/matview 0개.
--   • 기존 CHECK (ad_disclosure, official_status) 무관.
--
-- 기존 195행 영향:
--   NOT NULL + DEFAULT 'date_range' → 전부 'date_range' 자동 채움.

ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS calendar_mode text
    NOT NULL DEFAULT 'date_range'
    CHECK (calendar_mode IN ('date_range', 'date_time_slot'));

COMMENT ON COLUMN public.info_drops.calendar_mode IS
  '예약 캘린더 모드. 1차 = date_range(숙박)만 UI 지원, date_time_slot 은 Phase 2.';
