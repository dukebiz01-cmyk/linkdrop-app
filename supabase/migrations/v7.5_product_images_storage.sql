-- v7.5 — 상품 사진 업로드용 Supabase Storage 버킷 + RLS (S1)
--
-- 목표: 산지직송(커머스) 상품 사진을 저장할 공개 Storage 버킷과 RLS 정책 정의.
--   앱 코드/업로드 UI는 이 단계 범위 아님(다음 슬라이스).
--
-- 설계:
--   - 버킷: id/name = 'product-images', public = true
--       → og:image·카톡이 공개 URL(/storage/v1/object/public/...)로 가져가야 하므로 공개.
--   - 업로드 경로 규약: {user_id}/{파일명}  (예: 9f3.../product-1.jpg)
--       → RLS 가 첫 폴더 segment 를 auth.uid() 로 강제해 "자기 폴더에만 쓰기" 보장.
--   - storage.objects 의 RLS 는 기본 활성(Supabase 관리 테이블)이라 enable 불필요.
--   - 공개 읽기는 버킷 public=true 가 처리 → SELECT 정책 작성 안 함.
--   - 정책은 'product-images' 버킷으로 한정 → 다른 버킷 정책에 영향 0.
--
-- 멱등성: 버킷은 on conflict do nothing, 정책은 drop ... if exists 후 create.
--   재실행해도 안전.

-- (a) 버킷 생성 — 공개.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- (b) RLS 정책 — 'product-images' 버킷 한정, 자기 폴더({uid}/...)에만.
--     foldername(name)[1] = 경로의 첫 segment(= user_id 폴더).
--     auth.uid() 는 (select ...) 로 감싸 row 마다 재평가 안 되게(성능).

-- INSERT — authenticated 가 자기 폴더에만 업로드.
drop policy if exists product_images_insert_own_folder on storage.objects;
create policy product_images_insert_own_folder
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- UPDATE — 자기 폴더 사진 교체(메타/이동). using=대상 행, with check=변경 후 행 모두 검증.
drop policy if exists product_images_update_own_folder on storage.objects;
create policy product_images_update_own_folder
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- DELETE — 자기 폴더 사진 삭제.
drop policy if exists product_images_delete_own_folder on storage.objects;
create policy product_images_delete_own_folder
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
