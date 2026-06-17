-- ai_feedback_config — generate-feedback Edge 의 튜닝 파라미터(관리자 편집용)
--
-- 목적: 모델/토큰/캐시 TTL/충분성 임계치/톤 지침 등 "안전하지 않은" 튜닝값을 코드에서 빼서 DB 로.
--   → 추후 관리자 패널에서 재배포 없이 편집. 단일 활성 행 운용(시드 1행).
--   ⚠️ 안전 코어(가짜 숫자 금지·없는 비교 금지 등)는 절대 여기 넣지 않는다 — Edge 하드코딩(편집 불가).
--      이 테이블의 coaching_prompt 는 톤·구체성·data_sufficiency 표현 지침만.
--
-- 보안: RLS 활성 + 정책 0 → authenticated/anon 전면 접근 거부(프롬프트 노출 방지).
--   Edge 는 service_role 로 읽음(RLS 우회). 관리자 쓰기는 추후 패널(지금은 SQL Editor=service_role 로 편집).
--   신규 테이블만 추가 — 기존 테이블/함수/Edge 무수정.

CREATE TABLE IF NOT EXISTS public.ai_feedback_config (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  config     jsonb       NOT NULL,
  enabled    boolean     NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid        REFERENCES public.profiles(id)
);

-- RLS — 정책을 하나도 만들지 않음 → authenticated/anon 은 SELECT/INSERT/UPDATE/DELETE 전부 차단.
--   (RLS 활성 + 정책 부재 = 기본 deny. service_role 은 RLS 우회.)
ALTER TABLE public.ai_feedback_config ENABLE ROW LEVEL SECURITY;

-- GRANT — anon/authenticated 권한 회수(정책 부재와 이중 차단). service_role 만 전체.
REVOKE ALL ON public.ai_feedback_config FROM PUBLIC;
REVOKE ALL ON public.ai_feedback_config FROM anon;
REVOKE ALL ON public.ai_feedback_config FROM authenticated;
GRANT ALL ON public.ai_feedback_config TO service_role;

-- 시드 — 단일 활성 행. 이미 행이 있으면 재실행해도 중복 삽입 안 함(idempotent).
INSERT INTO public.ai_feedback_config (config, enabled)
SELECT
  $json${
    "model": "claude-sonnet-4-6",
    "max_tokens": 900,
    "cache_ttl_hours": 6,
    "sufficiency": { "tentative_min": 3, "confident_min": 8 },
    "default_period": "30d",
    "coaching_prompt": "톤: 친근하고 명료한 한국어로, 과장과 이모지 없이 쓴다. data_sufficiency.level 이 tentative 면 '~하는 경향이 보여요'처럼 완화해서 말하고, confident 면 '~배'처럼 단정해도 된다. 각 insight 는 근거 숫자 명시 + 짧은 해석 + 구체적인 다음 액션으로 구성하고, '좋은 콘텐츠를 만드세요' 같은 일반론은 쓰지 않는다. recommendations 는 데이터에서 실제로 드러난 패턴만 2~3개 제시한다.",
    "few_shot": []
  }$json$::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.ai_feedback_config);


-- ─────────────────────────────────────────────────────────────────────────
-- 검증 (SQL Editor — service_role 컨텍스트)
-- ─────────────────────────────────────────────────────────────────────────
-- 1) 시드 1행 + config 키 확인:
--   SELECT count(*) FROM public.ai_feedback_config;                      -- 1
--   SELECT enabled,
--          config->>'model'                AS model,                     -- claude-sonnet-4-6
--          (config->>'max_tokens')::int    AS max_tokens,                -- 900
--          config->'sufficiency'           AS sufficiency,               -- {"tentative_min":3,"confident_min":8}
--          jsonb_typeof(config->'few_shot') AS few_shot_type             -- array
--   FROM public.ai_feedback_config;
--
-- 2) RLS 가 일반 유저 접근 차단하는지(정책 부재 → 0행/거부):
--   SELECT relrowsecurity FROM pg_class WHERE relname='ai_feedback_config';            -- true
--   SELECT count(*) FROM pg_policy WHERE polrelid='public.ai_feedback_config'::regclass; -- 0
--   -- authenticated 시뮬레이션 → 정책 없어 0행 반환(차단):
--   SELECT set_config('request.jwt.claims', json_build_object('sub','<ANY_USER_UUID>')::text, true);
--   SET ROLE authenticated;
--   SELECT count(*) FROM public.ai_feedback_config;   -- 0 (RLS deny)
--   RESET ROLE;
--
-- ─────────────────────────────────────────────────────────────────────────
-- 참고 — 추후 admin-write RLS 용 관리자 식별 경로 (이번엔 정책 미추가):
--   • public.profiles.active_roles  (user_role[] 배열, 값에 'admin'/'staff' 포함)
--   • public.has_role(_role text, _user_id uuid) RETURNS boolean  (RPC; _admin 레이아웃 게이트에서 사용)
--   패널 단계에서 예: CREATE POLICY ... FOR ALL TO authenticated
--     USING (public.has_role('admin', auth.uid())) WITH CHECK (public.has_role('admin', auth.uid()));
