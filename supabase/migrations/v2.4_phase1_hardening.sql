-- v2.4 Phase 1 Hardening (2026-05-16)
-- Companion to the Phase 1 security audit.
--
-- Changes:
--   1. reward_ledger: full append-only (any UPDATE blocked, TRUNCATE blocked, search_path fixed)
--   2. REVOKE EXECUTE on admin-only SECURITY DEFINER functions from anon
--   3. click_audit_logs: raw PII columns -> hash columns (0 rows, safe)
--   4. share_events: column-level grants hide ip_hash/device_hash/user_agent_hash/session_hash/fraud_* from anon+authenticated

BEGIN;

-- ---------- 1. reward_ledger full append-only ----------

CREATE OR REPLACE FUNCTION public.prevent_reward_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'reward_ledger is append-only (% blocked). Use INSERT with reversal_of for corrections.', TG_OP;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_reward_ledger_direct_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'reward_ledger is fully immutable. UPDATE blocked - insert a new row with reversal_of for corrections.';
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_ledger_no_truncate ON public.reward_ledger;
CREATE TRIGGER trg_reward_ledger_no_truncate
  BEFORE TRUNCATE ON public.reward_ledger
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_reward_ledger_mutation();

-- ---------- 2. REVOKE anon EXECUTE on admin-only SECURITY DEFINER functions ----------

REVOKE EXECUTE ON FUNCTION public.approve_partner(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_lifecycle_stage(uuid, text) FROM anon, PUBLIC;

-- ---------- 3. click_audit_logs: raw PII -> hash ----------
-- Table has 0 rows; safe drop+add. Code base does not reference these columns.

ALTER TABLE public.click_audit_logs
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS user_agent,
  DROP COLUMN IF EXISTS device_fingerprint,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text,
  ADD COLUMN IF NOT EXISTS device_hash text;

-- ---------- 4. share_events column-level grants ----------
-- Policy `shares_public_read_by_uuid` (USING true) is kept for chain visualization,
-- but PII hashes and fraud signals must not be readable by anon/authenticated.
-- PostgREST enforces column grants on top of RLS, so listed columns become invisible.

REVOKE SELECT ON public.share_events FROM anon, authenticated, PUBLIC;
GRANT SELECT (
  id, share_uuid, info_drop_id, campaign_id, sender_user_id, channel,
  curator_message, dub_link_id, dub_short_url,
  click_count, unique_clicker_count, conversion_count,
  created_at, expires_at,
  parent_share_event_id, chain_depth, reshared_from_claim_id, chain_origin_user_id
) ON public.share_events TO anon, authenticated;
-- ip_hash / device_hash / user_agent_hash / session_hash / fraud_risk_score / fraud_decision
-- are NOT granted -> only service_role and table owner can read them.

COMMIT;
