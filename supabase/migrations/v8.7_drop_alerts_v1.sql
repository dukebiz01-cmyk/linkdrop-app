-- v8.7 — drop_alerts v1 (재입고 알림 신청) — FIX-41
--
-- ⚠️ 2026-07-12 Duke 가 Supabase SQL Editor 로 라이브 DB 에 선적용 완료.
--    이 파일은 레포 장부 기록용 — DB 재실행 금지(이미 적용됨).
--    아래 원문은 2026-07-12 라이브 실측(information_schema/pg_constraint/pg_policies)으로
--    재구성한 실적용분과 동일 명세.
--
-- 설계 의도:
--   · alert_type = 'restock' 고정(CHECK) — v2 에서 유형 확장 시 CHECK 완화.
--   · status: waiting(신청) → notified(발신 완료 · v2 서버 발신 전용) / cancelled(예약어).
--     v1 취소는 행 DELETE(본인 RLS) — cancelled 상태 전환은 쓰지 않는다.
--   · UPDATE 정책 없음(의도): notified 전환·notified_at 갱신은 service_role(v2 Edge/배치)
--     전용 — 클라이언트가 알림 상태를 위조할 수 없게 한다.
--   · drop_id 는 FK 없음(실적용분 그대로) — 드롭 삭제 시 잔존 행은 읽기 시점 조인 실패로
--     무해(알림함에서 판정 불가 표기).

CREATE TABLE IF NOT EXISTS public.drop_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drop_id     uuid NOT NULL,
  alert_type  text NOT NULL DEFAULT 'restock' CHECK (alert_type = 'restock'),
  status      text NOT NULL DEFAULT 'waiting'
              CHECK (status IN ('waiting', 'notified', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE (user_id, drop_id, alert_type)
);

ALTER TABLE public.drop_alerts ENABLE ROW LEVEL SECURITY;

-- RLS 3정책 — 본인 행만. UPDATE 정책 없음(위 설계 의도 참조).
CREATE POLICY drop_alerts_select_own ON public.drop_alerts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY drop_alerts_insert_own ON public.drop_alerts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY drop_alerts_delete_own ON public.drop_alerts
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE public.drop_alerts IS
  '재입고 알림 신청(v1 — 앱 내 알림함 도달 한정). notified 전환은 service_role 전용(v2).';

-- 롤백(수동):
--   DROP TABLE IF EXISTS public.drop_alerts;
