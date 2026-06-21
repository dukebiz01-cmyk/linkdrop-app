-- 20260622_onboarding_flag.sql
-- 게이트인트로(신규 1회)용: profiles 온보딩 플래그 + 멱등 set RPC.
-- 보존: 기존 profiles 컬럼/데이터/트리거(handle_new_user)/다른 RPC 전부 불변. 다른 테이블 금지.

-- 1) 컬럼 추가 (nullable, DEFAULT 없음 — 신규 유저는 NULL 이어야 인트로 노출)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- 2) 기존 유저 backfill (이미 가입한 사람은 인트로 스킵)
UPDATE public.profiles SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL;

-- 3) 멱등 set RPC (본인만, SECURITY DEFINER 로 RLS 우회 + 덮어쓰기 방지)
CREATE OR REPLACE FUNCTION public.mark_onboarding_complete()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.profiles
  SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
  WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.mark_onboarding_complete() TO authenticated;
