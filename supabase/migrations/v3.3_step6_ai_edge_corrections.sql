-- v3.3 Step 6 보정 — AI Edge Function 지원
--
-- Step 6 명세(docs/v3-step6-ai-edge-functions-spec.md)가 v3.0/v3.1 실제 schema 와
-- 불일치하여, A안(Edge Function 을 실제 schema 에 맞춤)을 위한 최소 보정.
--
-- 보정 2건만:
--   (1) ai_generations.status 에 'cache_hit' 추가 — 명세 §0.4 캐시 hit 기록용.
--   (2) product_detections.ai_generation_id — detect-product 가 생성 이력을 연결.
--
-- generation_type 은 보정 안 함 — 명세의 'purpose_suggestion' 은 기존 'intent_suggestion'
--   으로 매핑(suggest-purpose 가 generation_type='intent_suggestion' 으로 기록).
-- cost 는 cost_krw 유지 — USD 컬럼 추가 없음 (Edge Function 내부에서 USD→KRW 환산).

-- (1) status CHECK 에 'cache_hit' 추가
ALTER TABLE public.ai_generations
  DROP CONSTRAINT IF EXISTS ai_generations_status_check;
ALTER TABLE public.ai_generations
  ADD CONSTRAINT ai_generations_status_check
  CHECK (status IN ('success', 'error', 'pending', 'cache_hit'));

-- (2) product_detections.ai_generation_id — 생성 이력 연결 (nullable)
ALTER TABLE public.product_detections
  ADD COLUMN IF NOT EXISTS ai_generation_id uuid
  REFERENCES public.ai_generations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_detections_ai_generation_id
  ON public.product_detections (ai_generation_id);

COMMENT ON COLUMN public.product_detections.ai_generation_id IS
  'detect-product Edge Function 이 이 탐지를 만든 ai_generations 행. NULL = 수동 입력.';

-- 검증 (적용 후):
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname='ai_generations_status_check';
--   기대: ... status IN ('success','error','pending','cache_hit') ...
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='product_detections' AND column_name='ai_generation_id';
--   기대: 1행.
