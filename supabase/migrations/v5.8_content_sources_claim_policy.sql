-- v5.8 — content_sources UPDATE 정책: claim / un-claim 허용
--
-- 배경:
--   extract-meta 캐싱으로 content_sources 에 이미 행이 있지만
--   registered_by_user_id = NULL 인 경우, 사용자가 탐색 [등록] 클릭 시
--   INSERT 가 UNIQUE(provider, source_id) 충돌 → graceful skip → claim 안 됨.
--
-- 수정:
--   UPDATE 정책을 "본인 행" 외에 "미소유(NULL) 행"도 허용. UPSERT 의 UPDATE
--   분기로 캐싱본의 registered_by_user_id 를 본인 uid 로 박을 수 있게 함.
--   타인 소유 행은 그대로 차단.
--
-- 데모 한계:
--   다중 사용자가 같은 영상을 각자 컬렉션에 담는 정식 모델은 join 테이블 분리.
--   현재는 데모 단계 "1 source = 1 claimer" 모델.

DROP POLICY IF EXISTS sources_self_modify ON public.content_sources;

CREATE POLICY sources_self_modify ON public.content_sources
  FOR UPDATE
  TO anon, authenticated
  USING (auth.uid() = registered_by_user_id OR registered_by_user_id IS NULL)
  WITH CHECK (registered_by_user_id = auth.uid() OR registered_by_user_id IS NULL);
