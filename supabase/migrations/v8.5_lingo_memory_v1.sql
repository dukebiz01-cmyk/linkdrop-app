-- v8.5 — 링고AI 기억 골격 v1 (T1): 신규 테이블 4개만 추가. 기존 테이블/함수/Edge 무접촉.
--
--   lingo_sessions   — 대화 세션 (surface 단위, voice 확장 자리 input_channel)
--   lingo_messages   — 세션 내 메시지 (role user/lingo, 토큰·비용 추적)
--   lingo_user_state — 유저×surface 단일 상태 (stage 게이트: guide/assist/standby)
--   lingo_user_facts — 장기 기억 (fact/preference, 본인 삭제 가능)
--
-- RLS 골격 = ai_feedback_cache.sql 패턴: 본인 SELECT 만, 쓰기는 Edge service_role 전용
--   (RLS 우회). 예외 — lingo_user_facts 본인 DELETE 허용 / lingo_messages SELECT 는
--   본인 소유 세션 소속 메시지만(EXISTS).
-- 유저 FK = public.profiles(id) ON DELETE CASCADE (ai_feedback_cache 동일).

-- ============================================================
-- 1) lingo_sessions — 대화 세션
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lingo_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  surface       text        NOT NULL DEFAULT 'studio',
  context       jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- 현재 드롭 id·영상 요약 참조 등
  input_channel text        NOT NULL DEFAULT 'text',       -- voice 확장 자리
  status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);

COMMENT ON TABLE public.lingo_sessions IS
  '링고AI 대화 세션. surface(studio 등) 단위, context 에 현재 작업 참조(jsonb).';

-- ============================================================
-- 2) lingo_messages — 세션 내 메시지
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lingo_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES public.lingo_sessions(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'lingo')),
  content     text        NOT NULL,
  meta        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  tokens_used int,
  cost_krw    numeric,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lingo_messages_session_created
  ON public.lingo_messages (session_id, created_at);

COMMENT ON TABLE public.lingo_messages IS
  '링고AI 세션 메시지 (role=user/lingo). tokens_used·cost_krw 로 비용 추적(ai_generations 계열).';

-- ============================================================
-- 3) lingo_user_state — 유저×surface 상태 (stage 게이트)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lingo_user_state (
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  surface           text        NOT NULL DEFAULT 'studio',
  stage             text        NOT NULL DEFAULT 'guide'
                                CHECK (stage IN ('guide', 'assist', 'standby')),
  sessions_count    int         NOT NULL DEFAULT 0,
  completions_count int         NOT NULL DEFAULT 0,
  last_session_id   uuid,
  last_seen_at      timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, surface)  -- upsert onConflict 키 (ai_feedback_cache 시맨틱)
);

COMMENT ON TABLE public.lingo_user_state IS
  '링고AI 유저×surface 단일 상태. stage(guide→assist→standby) 로 개입 강도 게이트.';

-- ============================================================
-- 4) lingo_user_facts — 장기 기억 (본인 삭제 가능)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lingo_user_facts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fact              text        NOT NULL,
  kind              text        NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact', 'preference')),
  source_session_id uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lingo_user_facts_user_id
  ON public.lingo_user_facts (user_id);

COMMENT ON TABLE public.lingo_user_facts IS
  '링고AI 장기 기억(fact/preference). 사용자가 본인 기억을 직접 삭제 가능(RLS DELETE).';

-- ============================================================
-- RLS — ai_feedback_cache 골격: 본인 SELECT 만, INSERT/UPDATE 는 Edge service_role
--   전용(정책 부재 = 기본 deny, service_role 은 RLS 우회). GRANT 는 정책과 이중 차단.
-- ============================================================

ALTER TABLE public.lingo_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lingo_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lingo_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lingo_user_facts ENABLE ROW LEVEL SECURITY;

-- lingo_sessions — 본인 행만 SELECT.
DROP POLICY IF EXISTS lingo_sessions_select_own ON public.lingo_sessions;
CREATE POLICY lingo_sessions_select_own
  ON public.lingo_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- lingo_messages — 예외 2: 본인 소유 세션에 속한 메시지만 SELECT (EXISTS 검사).
DROP POLICY IF EXISTS lingo_messages_select_own_session ON public.lingo_messages;
CREATE POLICY lingo_messages_select_own_session
  ON public.lingo_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lingo_sessions s
      WHERE s.id = lingo_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

-- lingo_user_state — 본인 행만 SELECT.
DROP POLICY IF EXISTS lingo_user_state_select_own ON public.lingo_user_state;
CREATE POLICY lingo_user_state_select_own
  ON public.lingo_user_state
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- lingo_user_facts — 본인 행만 SELECT + 예외 1: 본인 DELETE 허용(자기 기억 삭제권).
DROP POLICY IF EXISTS lingo_user_facts_select_own ON public.lingo_user_facts;
CREATE POLICY lingo_user_facts_select_own
  ON public.lingo_user_facts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS lingo_user_facts_delete_own ON public.lingo_user_facts;
CREATE POLICY lingo_user_facts_delete_own
  ON public.lingo_user_facts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- GRANT — authenticated 는 SELECT 만(facts 는 +DELETE). 쓰기는 service_role 단일 경로.
REVOKE ALL ON public.lingo_sessions   FROM PUBLIC;
REVOKE ALL ON public.lingo_sessions   FROM anon;
REVOKE ALL ON public.lingo_messages   FROM PUBLIC;
REVOKE ALL ON public.lingo_messages   FROM anon;
REVOKE ALL ON public.lingo_user_state FROM PUBLIC;
REVOKE ALL ON public.lingo_user_state FROM anon;
REVOKE ALL ON public.lingo_user_facts FROM PUBLIC;
REVOKE ALL ON public.lingo_user_facts FROM anon;

GRANT SELECT ON public.lingo_sessions   TO authenticated;
GRANT SELECT ON public.lingo_messages   TO authenticated;
GRANT SELECT ON public.lingo_user_state TO authenticated;
GRANT SELECT, DELETE ON public.lingo_user_facts TO authenticated;

GRANT ALL ON public.lingo_sessions   TO service_role;
GRANT ALL ON public.lingo_messages   TO service_role;
GRANT ALL ON public.lingo_user_state TO service_role;
GRANT ALL ON public.lingo_user_facts TO service_role;


-- ─────────────────────────────────────────────────────────────────────────
-- 검증 (SQL Editor)
-- ─────────────────────────────────────────────────────────────────────────
-- 1) 테이블/RLS:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname LIKE 'lingo_%';                          -- 4행 전부 true
-- 2) 정책 개수:
--   SELECT polrelid::regclass, polname, polcmd FROM pg_policy
--   WHERE polrelid::regclass::text LIKE '%lingo_%';        -- select 4 + delete 1
-- 3) 본인 행만 보이는지(유저 컨텍스트 시뮬레이션 — ai_feedback_cache.sql 검증 블록 동일):
--   SELECT set_config('request.jwt.claims', json_build_object('sub','<USER_UUID>')::text, true);
--   SET ROLE authenticated;
--   SELECT * FROM public.lingo_sessions;                   -- 본인 행만
--   RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────
-- 롤백 (역순 — messages 가 sessions FK 참조라 먼저 drop)
-- ─────────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.lingo_user_facts;
-- DROP TABLE IF EXISTS public.lingo_user_state;
-- DROP TABLE IF EXISTS public.lingo_messages;
-- DROP TABLE IF EXISTS public.lingo_sessions;
