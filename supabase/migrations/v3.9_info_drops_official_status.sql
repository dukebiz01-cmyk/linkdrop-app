-- v3.9 — info_drops.official_status (Drop 인증 상태)
-- WHY: v3.0 락 — drops 자리에 info_drops 사용. official=공식 인증, user_shared=일반 사용자,
--      pending=검토 중, rejected=반려. 기본값 user_shared 로 기존 139행 자동 채움.

ALTER TABLE info_drops ADD COLUMN IF NOT EXISTS official_status text
  CHECK (official_status IN ('official','user_shared','pending','rejected'))
  DEFAULT 'user_shared' NOT NULL;

CREATE INDEX IF NOT EXISTS idx_info_drops_official_status
  ON info_drops(official_status)
  WHERE official_status = 'official';

COMMENT ON COLUMN info_drops.official_status IS 'Drop 인증 상태';
