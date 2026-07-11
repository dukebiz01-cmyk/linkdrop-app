-- v8.6 — ai_generations.generation_type CHECK 확장: + 'lingo_chat' (T6b)
--
-- 배경: lingo-chat Edge 는 generation_type CHECK 미확장(DDL 0) 시절 promo-copy 선례를
--   승계해 기존 값 'share_message' 를 재사용하고 response.kind('lingo_chat' /
--   'lingo_fact_extract')로만 식별해 왔다. 본 마이그레이션으로 'lingo_chat' 을 정식
--   허용값에 추가하고, Edge 호출부 상수를 'lingo_chat' 으로 교체한다(코드 T6b 동시 반영).
--
-- 실측 근거:
--   - CHECK 원본: v3.0_step3_schema_expansion.sql:232 — 인라인 CHECK(무명 → 기본 이름
--     ai_generations_generation_type_check). 이후 마이그레이션에서 재정의 이력 없음
--     (v3.3 은 status CHECK 만 보정, generation_type 은 "보정 안 함" 명시).
--   - 기존 허용값 7종(전부 승계 — 누락 금지):
--     'summary','key_points','title','share_message',
--     'product_detection','intent_suggestion','price_compare'
--   - record_ai_generation RPC(v3.1_step4_rpc_functions.sql:287)는 내부 타입 검증 없이
--     INSERT 만 수행(CHECK 가 유일한 검증) → 함수 재정의 불요 = GRANT 승계 이슈 없음.

ALTER TABLE public.ai_generations
  DROP CONSTRAINT IF EXISTS ai_generations_generation_type_check;
ALTER TABLE public.ai_generations
  ADD CONSTRAINT ai_generations_generation_type_check
  CHECK (generation_type IN (
    'summary','key_points','title','share_message',
    'product_detection','intent_suggestion','price_compare',
    'lingo_chat'
  ));

-- ============================================================
-- 검증 쿼리 (적용 후 제약 정의 확인)
-- ============================================================
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.ai_generations'::regclass
--    AND conname = 'ai_generations_generation_type_check';
-- → CHECK 정의에 'lingo_chat' 포함 + 기존 7종 전부 존재해야 함.
--
-- (선택) 기존 행 위반 없음 확인:
-- SELECT count(*) FROM public.ai_generations
--  WHERE generation_type NOT IN (
--    'summary','key_points','title','share_message',
--    'product_detection','intent_suggestion','price_compare','lingo_chat');
-- → 0 이어야 함.

-- ============================================================
-- 롤백 SQL (v3.0 원본 정의로 복귀 — 'lingo_chat' 행이 이미 쌓였으면
--   해당 행 정리 전에는 ADD 가 실패하므로 주의)
-- ============================================================
-- ALTER TABLE public.ai_generations
--   DROP CONSTRAINT IF EXISTS ai_generations_generation_type_check;
-- ALTER TABLE public.ai_generations
--   ADD CONSTRAINT ai_generations_generation_type_check
--   CHECK (generation_type IN (
--     'summary','key_points','title','share_message',
--     'product_detection','intent_suggestion','price_compare'
--   ));
