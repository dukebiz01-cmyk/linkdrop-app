-- v3.1.1 Step 4 hotfix — 함수 EXECUTE 권한 강화
--
-- 문제: PostgreSQL 은 함수 생성 시 PUBLIC 에 EXECUTE 를 자동 부여한다.
--   v3.1 에서 authenticated 전용 의도였던 4개 함수에 GRANT TO authenticated 만 하고
--   REVOKE FROM PUBLIC 을 빠뜨려, PUBLIC 상속으로 anon 도 EXECUTE 권한을 가졌다.
--   특히 record_ai_generation 은 auth 체크가 없어 anon 의 임의 INSERT 노출이 실질 위험.
--
-- 수정: 4개 함수에서 PUBLIC EXECUTE 회수 + authenticated 명시 GRANT 재확인.
--   anon+authenticated 의도인 5개 함수(hash_phone/submit_consultation_lead/
--   upsert_visitor/track_drop_event/get_drop_detail)는 PUBLIC 노출이 의도와 일치 → 미변경.

REVOKE EXECUTE ON FUNCTION public.create_drop_v2(uuid,uuid,jsonb,text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_drop_results(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_ai_quota(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_ai_generation(text,uuid,uuid,uuid,text,text,jsonb,integer,numeric,text,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_drop_v2(uuid,uuid,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_drop_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_generation(text,uuid,uuid,uuid,text,text,jsonb,integer,numeric,text,text) TO authenticated;

-- 검증 (적용 후):
-- SELECT
--   has_function_privilege('anon','public.create_drop_v2(uuid,uuid,jsonb,text,uuid)','EXECUTE')        AS anon_create,
--   has_function_privilege('anon','public.get_drop_results(uuid)','EXECUTE')                            AS anon_results,
--   has_function_privilege('anon','public.check_ai_quota(uuid)','EXECUTE')                              AS anon_quota,
--   has_function_privilege('anon','public.record_ai_generation(text,uuid,uuid,uuid,text,text,jsonb,integer,numeric,text,text)','EXECUTE') AS anon_aigen,
--   has_function_privilege('authenticated','public.create_drop_v2(uuid,uuid,jsonb,text,uuid)','EXECUTE') AS auth_create,
--   has_function_privilege('anon','public.get_drop_detail(uuid)','EXECUTE')                             AS anon_detail;
-- 기대: anon_create/results/quota/aigen = false, auth_create = true, anon_detail = true.
