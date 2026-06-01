-- v6.1 — guide_history (진단·처방 이력 스냅샷)
--
-- 추적 루프(A-1): 처방 시점 지표 + 진단 + 처방 저장 → 다음 호출 시 before/after 비교.
-- owner 격리 = info_drops 직접 패턴 (auth.uid()=owner_user_id).
-- engine 필드 = 'rule' 기본 (AI 레이어가 나중에 'ai'로 교체할 자리).

CREATE TABLE IF NOT EXISTS public.guide_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  owner_user_id    uuid NOT NULL,
  snapshot_at      timestamptz NOT NULL DEFAULT now(),
  range_days       int NOT NULL DEFAULT 30,
  metrics_snapshot jsonb NOT NULL,
  diagnosis        jsonb NOT NULL DEFAULT '[]'::jsonb,
  prescriptions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths        jsonb NOT NULL DEFAULT '[]'::jsonb,
  engine           text NOT NULL DEFAULT 'rule',
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.guide_history IS
  '⑥ 가이드 진단/처방 이력 스냅샷 (추적 루프 A-1). engine: rule|ai.';

CREATE INDEX IF NOT EXISTS idx_guide_history_partner
  ON public.guide_history (partner_id, snapshot_at DESC);

ALTER TABLE public.guide_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guide_history_owner_all ON public.guide_history;
CREATE POLICY guide_history_owner_all ON public.guide_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
