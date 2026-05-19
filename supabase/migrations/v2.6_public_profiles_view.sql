-- v2.6 public_profiles view — safe identity projection for anonymous viewers
--
-- Problem: /d/{share_uuid} runs anonymously (KakaoTalk share recipients are not
-- logged in). It needs the maker's display_name + avatar_url to render the
-- curator card. profiles RLS exposes only the caller's own row
-- (profiles_self_read: auth.uid() = id), so anon currently sees nothing → the
-- UI falls back to "익명".
--
-- Solution: a thin read-only view that projects exactly three columns
-- (id, display_name, avatar_url). PII fields (phone verification, consent
-- timestamps, role flags) are *not* in the view. The view intentionally runs
-- with definer semantics (security_invoker omitted = default off), so the view
-- owner's privileges bypass the strict profiles_self_read policy — but only
-- through this column-limited projection. Direct SELECT on public.profiles
-- continues to enforce RLS unchanged.

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, display_name, avatar_url
FROM public.profiles;

COMMENT ON VIEW public.public_profiles IS
  'Safe-to-expose profile fields (id, display_name, avatar_url) for anonymous /d share viewers. PII columns intentionally omitted.';

GRANT SELECT ON public.public_profiles TO anon, authenticated;
