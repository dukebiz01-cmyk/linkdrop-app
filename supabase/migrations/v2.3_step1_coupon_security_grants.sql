-- v2.3 step 1 grants fix — explicit REVOKE from anon/authenticated.
--
-- REVOKE ... FROM PUBLIC in the previous migration was insufficient
-- because Supabase auto-grants EXECUTE to the anon/authenticated roles
-- on newly created public functions. We have to revoke from those
-- roles explicitly.

-- generate_claim_code_v2: internal helper only. Anyone calling this
-- directly via /rest/v1/rpc/... could pre-seed claim codes. Lock it
-- down so only the function owner (postgres, used by SECURITY DEFINER
-- callers like claim_coupon) can execute it.
REVOKE EXECUTE ON FUNCTION public.generate_claim_code_v2(int)
  FROM anon, authenticated, public;

-- redeem_coupon_v2: must NOT be callable by the anon role. Signed-in
-- partner staff are the only intended callers; the function does its
-- own staff authorization check (Step 5) as a second line of defense.
REVOKE EXECUTE ON FUNCTION public.redeem_coupon_v2(text, uuid, numeric, inet, text)
  FROM anon, public;

-- Reaffirm the authenticated grant (idempotent; safe if already present).
GRANT EXECUTE ON FUNCTION public.redeem_coupon_v2(text, uuid, numeric, inet, text)
  TO authenticated;
