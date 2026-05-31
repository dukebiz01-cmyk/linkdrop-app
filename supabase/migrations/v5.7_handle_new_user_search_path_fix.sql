-- v5.7 — handle_new_user search_path 누락 fix
--
-- 증상: 신규 회원가입 전체 차단 (production 카카오 콜백 + admin.createUser).
-- 로그: ERROR: type "user_role[]" does not exist (SQLSTATE 42704)
-- 원인: handle_new_user 가 SECURITY DEFINER + search_path 미지정 →
--       'user_role[]' 캐스팅이 함수 owner 의 search_path 만 보고 → 못 찾음.
-- 수정:
--   1) SET search_path TO 'public', 'pg_catalog' 추가
--   2) 'catcher'::user_role / user_role[] → public.user_role 명시
-- 부수: 회원가입(카카오 OAuth + admin) 정상화. 다른 호출처 없음.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, primary_role, active_roles)
  VALUES (
    NEW.id,
    public.compute_display_name_from_auth(NEW.raw_user_meta_data, NEW.email),
    public.compute_avatar_url_from_auth(NEW.raw_user_meta_data),
    'catcher'::public.user_role,
    ARRAY['catcher']::public.user_role[]
  );
  RETURN NEW;
END;
$function$;
