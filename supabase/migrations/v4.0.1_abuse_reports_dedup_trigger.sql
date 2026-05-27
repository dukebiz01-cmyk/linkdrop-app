-- v4.0.1 — abuse_reports 24h 중복 방지 트리거
-- WHY: v4.0 에서 시도한 partial-index 24h 윈도우는 IMMUTABLE 제약으로 불가.
--      strict "1 IP : 1 신고 / 1 Drop" 인덱스(영구 차단)를 제거하고 트리거로 교체.

-- 기존 영구 unique 인덱스 제거
DROP INDEX IF EXISTS idx_abuse_reports_dedup;

-- 24h 윈도우 중복 방지 트리거 함수
CREATE OR REPLACE FUNCTION prevent_abuse_report_dedup()
RETURNS TRIGGER AS $$
BEGIN
  -- ip_hash가 NULL이면 (로그인 사용자) 통과
  IF NEW.reporter_ip_hash IS NULL THEN
    RETURN NEW;
  END IF;

  -- 같은 IP에서 같은 Drop에 24시간 이내 신고 있으면 거부
  IF EXISTS (
    SELECT 1 FROM abuse_reports
    WHERE drop_id = NEW.drop_id
      AND reporter_ip_hash = NEW.reporter_ip_hash
      AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'duplicate_report_within_24h'
      USING HINT = '24시간 이내 동일 신고 존재';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 등록
CREATE TRIGGER trg_prevent_abuse_report_dedup
  BEFORE INSERT ON abuse_reports
  FOR EACH ROW
  EXECUTE FUNCTION prevent_abuse_report_dedup();

COMMENT ON FUNCTION prevent_abuse_report_dedup IS
  '24h 윈도우 내 같은 IP+Drop 중복 신고 차단';
