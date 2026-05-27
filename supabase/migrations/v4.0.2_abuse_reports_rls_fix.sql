-- v4.0.2 — abuse_reports RLS 정책 roles 보정
-- WHY: v4.0 의 INSERT 정책은 TO public 인데 anon role 에 적용 안 됨 (production E2E
--      테스트에서 'new row violates row-level security policy' 발생). consultation_leads
--      등 작동하는 anon-INSERT 테이블은 TO anon, authenticated 형태. 동일 패턴으로 교체.

DROP POLICY IF EXISTS "anyone_can_create_abuse_reports" ON abuse_reports;

CREATE POLICY "anyone_can_create_abuse_reports"
  ON abuse_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
