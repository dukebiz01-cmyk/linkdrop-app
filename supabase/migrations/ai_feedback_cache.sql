-- ai_feedback_cache — generate-feedback(Sonnet) 결과 6h 캐시 테이블
--
-- 목적: (user_id, period) 단위로 생성된 성과 피드백 payload 를 캐시해 Sonnet 반복 호출 비용 통제.
--   Edge(generate-feedback)가 service role 로 upsert(RLS 우회), user_id 는 호출자 uid 로 못박음.
--   유저는 본인 행만 SELECT 가능(RLS). 신규 테이블만 추가 — 기존 테이블/함수 무수정.

CREATE TABLE IF NOT EXISTS public.ai_feedback_cache (
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period      text        NOT NULL CHECK (period IN ('7d', '30d', 'all')),
  payload     jsonb       NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)        -- upsert onConflict 키 + (user_id, period) 유일성
);

-- RLS — 본인 행만 SELECT. INSERT/UPDATE/DELETE 정책 없음 → authenticated 직접 쓰기 불가.
--   (Edge service role 은 RLS 우회하므로 upsert 가능. 쓰기는 Edge 단일 경로로만.)
ALTER TABLE public.ai_feedback_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_feedback_cache_select_own ON public.ai_feedback_cache;
CREATE POLICY ai_feedback_cache_select_own
  ON public.ai_feedback_cache
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- GRANT — authenticated 는 SELECT 만(쓰기는 RLS 로 차단). service_role 은 전체(upsert).
REVOKE ALL ON public.ai_feedback_cache FROM PUBLIC;
REVOKE ALL ON public.ai_feedback_cache FROM anon;
GRANT SELECT ON public.ai_feedback_cache TO authenticated;
GRANT ALL ON public.ai_feedback_cache TO service_role;


-- ─────────────────────────────────────────────────────────────────────────
-- 검증 (SQL Editor)
-- ─────────────────────────────────────────────────────────────────────────
-- 1) 테이블/PK/RLS 확인:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'ai_feedback_cache';            -- true
--   SELECT conname, contype FROM pg_constraint
--   WHERE conrelid = 'public.ai_feedback_cache'::regclass;                              -- p(PK) + c(period CHECK) + f(FK)
--   SELECT polname, polcmd FROM pg_policy WHERE polrelid='public.ai_feedback_cache'::regclass;  -- select 정책 1개
--
-- 2) 본인 행만 보이는지(유저 컨텍스트 시뮬레이션):
--   SELECT set_config('request.jwt.claims', json_build_object('sub','<USER_UUID>')::text, true);
--   SET ROLE authenticated;
--   SELECT * FROM public.ai_feedback_cache;   -- 본인 행만
--   RESET ROLE;
