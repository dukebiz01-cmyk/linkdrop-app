-- v3.1.2 Step 4 hotfix 수정 — v3.1.1 무효 보정
--
-- v3.1.1 은 REVOKE EXECUTE ... FROM PUBLIC 을 시도했으나 무효였다.
-- proacl 진단 결과: Supabase 는 신규 함수에 ALTER DEFAULT PRIVILEGES 로
--   anon / authenticated / service_role 롤에 EXECUTE 를 *직접* 부여한다.
--   PUBLIC ACL 항목은 애초에 없으므로 FROM PUBLIC 회수는 효과가 없었다.
--
-- 정답: authenticated 전용 4개 함수에서 anon 롤의 EXECUTE 를 직접 회수.
--   authenticated / service_role GRANT 는 유지.

REVOKE EXECUTE ON FUNCTION public.create_drop_v2(uuid,uuid,jsonb,text,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_drop_results(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_ai_quota(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_ai_generation(text,uuid,uuid,uuid,text,text,jsonb,integer,numeric,text,text) FROM anon;

-- 검증 (적용 후):
-- SELECT
--   has_function_privilege('anon','public.create_drop_v2(uuid,uuid,jsonb,text,uuid)','EXECUTE')        AS anon_create,
--   has_function_privilege('anon','public.get_drop_results(uuid)','EXECUTE')                           AS anon_results,
--   has_function_privilege('anon','public.check_ai_quota(uuid)','EXECUTE')                             AS anon_quota,
--   has_function_privilege('anon','public.record_ai_generation(text,uuid,uuid,uuid,text,text,jsonb,integer,numeric,text,text)','EXECUTE') AS anon_aigen,
--   has_function_privilege('authenticated','public.create_drop_v2(uuid,uuid,jsonb,text,uuid)','EXECUTE') AS auth_create,
--   has_function_privilege('anon','public.get_drop_detail(uuid)','EXECUTE')                            AS anon_detail;
-- 기대: anon_create/results/quota/aigen = false, auth_create = true, anon_detail = true.
