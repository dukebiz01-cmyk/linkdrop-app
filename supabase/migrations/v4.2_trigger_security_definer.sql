-- v4.2 — INVOKER 트리거 2건 SECURITY DEFINER 격상
-- WHY: S-4 진단 발견 2-A. 두 함수가 다른 행을 SELECT 하므로 INVOKER 권한에서는
--      RLS 적용으로 silent failure 또는 false-positive 위험.
--   1) validate_reward_rule_sum: reward_rule_items (RLS 활성·정책 0건) 자기 합산.
--      service_role 외 경로에서 SUM=0 → 무조건 RAISE EXCEPTION 폭탄 잠재.
--   2) sync_info_drop_purpose: intent_types SELECT. 현재 production은 SECURITY
--      DEFINER RPC 경유라 안전하지만 직접 anon 경로 추가 시 NEW.purpose=NULL
--      silent data corruption 위험.
-- 함수 본문은 100% 보존, SECURITY DEFINER + SET search_path 만 추가.
-- 트리거 자체는 함수만 가리키므로 재등록 불필요.

CREATE OR REPLACE FUNCTION public.sync_info_drop_purpose()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  SELECT purpose INTO NEW.purpose FROM public.intent_types WHERE id = NEW.intent_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_reward_rule_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rule_id UUID;
  v_sum NUMERIC(10,4);
BEGIN
  v_rule_id := COALESCE(NEW.reward_rule_id, OLD.reward_rule_id);
  SELECT COALESCE(SUM(rate), 0) INTO v_sum
    FROM reward_rule_items WHERE reward_rule_id = v_rule_id;
  IF ABS(v_sum - 1.0) > 0.0001 THEN
    RAISE EXCEPTION 'reward_rule_items sum must equal 1.0 (current: %).', v_sum;
  END IF;
  RETURN NULL;
END;
$$;
