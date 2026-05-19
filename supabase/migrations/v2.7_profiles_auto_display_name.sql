-- v2.7 auto-populate profiles.display_name + avatar_url from auth metadata
--
-- Problem: PR #20 added public_profiles view, but every existing profiles row
-- has display_name = NULL → /d page and KakaoTalk share cards still show "익명"
-- across the board. Manual /me/profile editing is on a separate track; we want
-- the common case (signup) to fill display_name automatically.
--
-- Solution (DB-only, no app code change):
-- 1. Extend handle_new_user() trigger so each new auth.users row also writes
--    display_name and avatar_url into profiles.
-- 2. display_name fallback chain (first non-null/non-empty wins):
--      a) raw_user_meta_data->>'full_name'   — Google, GitHub, Apple
--      b) raw_user_meta_data->>'name'        — generic alternative key
--      c) raw_user_meta_data->>'nickname'    — Kakao
--      d) split_part(email, '@', 1)          — email local-part
--      e) literal '사용자'                    — last-resort fallback
-- 3. avatar_url fallback chain:
--      a) raw_user_meta_data->>'avatar_url'  — Google, Kakao both use this
--      b) raw_user_meta_data->>'picture'     — Google sometimes
--      else NULL.
-- 4. Backfill: re-apply the same chains to existing profiles rows whose
--    display_name (or avatar_url) is NULL.
--
-- Trigger function retains its existing role-assignment behavior
-- ('catcher' primary, ['catcher']::user_role[] active) so PR #20 / earlier
-- semantics are unaffected.

-- Helper: compute display_name from auth metadata + email.
CREATE OR REPLACE FUNCTION public.compute_display_name_from_auth(
  meta jsonb,
  email_in text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(meta->>'full_name', ''),
    NULLIF(meta->>'name', ''),
    NULLIF(meta->>'nickname', ''),
    NULLIF(split_part(COALESCE(email_in, ''), '@', 1), ''),
    '사용자'
  );
$$;

COMMENT ON FUNCTION public.compute_display_name_from_auth(jsonb, text) IS
  'Derive a non-null display_name from auth.users.raw_user_meta_data with email-local-part fallback. Used by handle_new_user trigger and v2.7 backfill.';

-- Helper: compute avatar_url from auth metadata (nullable).
CREATE OR REPLACE FUNCTION public.compute_avatar_url_from_auth(
  meta jsonb
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(meta->>'avatar_url', ''),
    NULLIF(meta->>'picture', '')
  );
$$;

COMMENT ON FUNCTION public.compute_avatar_url_from_auth(jsonb) IS
  'Derive avatar_url from auth.users.raw_user_meta_data (NULL when no provider photo present).';

-- Extend the existing on_auth_user_created trigger function.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, primary_role, active_roles)
  VALUES (
    NEW.id,
    public.compute_display_name_from_auth(NEW.raw_user_meta_data, NEW.email),
    public.compute_avatar_url_from_auth(NEW.raw_user_meta_data),
    'catcher',
    ARRAY['catcher']::user_role[]
  );
  RETURN NEW;
END;
$function$;

-- Backfill existing rows where display_name or avatar_url is NULL.
-- Idempotent: COALESCE preserves any value already set manually.
UPDATE public.profiles p
SET
  display_name = COALESCE(
    p.display_name,
    public.compute_display_name_from_auth(u.raw_user_meta_data, u.email)
  ),
  avatar_url = COALESCE(
    p.avatar_url,
    public.compute_avatar_url_from_auth(u.raw_user_meta_data)
  )
FROM auth.users u
WHERE u.id = p.id
  AND (p.display_name IS NULL OR p.avatar_url IS NULL);
