-- v4.0.3 — prevent_abuse_report_dedup() 를 SECURITY DEFINER 로 격상
-- WHY: 트리거 함수가 INVOKER 권한으로 실행되면 anon role 의 SELECT 정책 부재로
--      EXISTS 서브쿼리가 항상 빈 결과 → 24h 중복 차단 미동작 (production E2E 에서
--      같은 IP+Drop 2회 연속 POST 가 모두 success 반환).
--      SECURITY DEFINER 로 함수 소유자(postgres) 권한 사용 → RLS 우회 → dedup 정상.
--      search_path 고정으로 함수 하이재킹 방지.

CREATE OR REPLACE FUNCTION prevent_abuse_report_dedup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;
