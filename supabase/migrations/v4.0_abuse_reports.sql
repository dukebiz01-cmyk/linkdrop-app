-- v4.0 — abuse_reports 신고 시스템 (가짜매장·부적절·스팸·사기·저작권)
-- WHY: 사용자가 Drop을 신고하면 운영자가 검토. official_status='rejected' 처리 근거.

-- 신고 사유 enum (사용자 노출용은 한글, 저장은 영문)
CREATE TYPE abuse_report_reason AS ENUM (
  'fake_store',          -- 가짜 매장 사칭
  'inappropriate',       -- 부적절한 내용
  'spam',                -- 스팸/도배
  'fraud',               -- 사기/허위
  'copyright',           -- 저작권 침해
  'other'                -- 기타
);

-- 신고 처리 상태
CREATE TYPE abuse_report_status AS ENUM (
  'pending',             -- 대기 중
  'reviewing',           -- 검토 중
  'resolved',            -- 해결됨
  'rejected'             -- 반려됨
);

-- abuse_reports 테이블
CREATE TABLE IF NOT EXISTS abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 신고 대상
  drop_id uuid NOT NULL REFERENCES info_drops(id) ON DELETE CASCADE,

  -- 신고자 정보 (익명 신고도 가능)
  reporter_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_ip_hash text NULL,
  reporter_device_id text NULL,

  -- 신고 내용
  reason abuse_report_reason NOT NULL,
  description text NULL,  -- 선택 입력

  -- 처리 상태
  status abuse_report_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid NULL REFERENCES auth.users(id),
  reviewed_at timestamptz NULL,
  reviewer_note text NULL,

  -- 메타
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_abuse_reports_drop_id
  ON abuse_reports(drop_id);

CREATE INDEX IF NOT EXISTS idx_abuse_reports_status
  ON abuse_reports(status)
  WHERE status IN ('pending', 'reviewing');

CREATE INDEX IF NOT EXISTS idx_abuse_reports_created_at
  ON abuse_reports(created_at DESC);

-- 같은 IP에서 같은 Drop 중복 신고 방지.
-- WHY: 스펙은 24h 윈도우를 요구했으나 partial-index WHERE 절은 IMMUTABLE 함수만 허용
--      (now() 는 STABLE → ERROR). 24h 정책은 application/트리거 레벨로 분리, 인덱스는
--      strict "1 IP : 1 신고 / 1 Drop" 로 유지.
CREATE UNIQUE INDEX IF NOT EXISTS idx_abuse_reports_dedup
  ON abuse_reports(drop_id, reporter_ip_hash)
  WHERE reporter_ip_hash IS NOT NULL;

-- RLS 활성화
ALTER TABLE abuse_reports ENABLE ROW LEVEL SECURITY;

-- 신고 작성: 누구나 가능 (anon 포함)
CREATE POLICY "anyone_can_create_abuse_reports"
  ON abuse_reports
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 신고 조회: 본인 신고 또는 관리자만
CREATE POLICY "users_can_view_own_reports"
  ON abuse_reports
  FOR SELECT
  TO authenticated
  USING (reporter_user_id = auth.uid());

-- 코멘트
COMMENT ON TABLE abuse_reports IS '신고 시스템: 가짜매장·부적절·스팸·사기·저작권 신고 접수';
COMMENT ON COLUMN abuse_reports.reporter_ip_hash IS '익명 신고자 IP 해시 (중복 방지)';
COMMENT ON COLUMN abuse_reports.reason IS 'fake_store|inappropriate|spam|fraud|copyright|other';
