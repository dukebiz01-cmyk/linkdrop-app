-- 20260623_biz_verify_foundation — 사장님·셀러 AI 등록 공통 토대
--
-- 목표: 국세청 진위확인 + 사업자등록증 OCR 흐름에 필요한 partners 컬럼과
--   비공개 서류 버킷을 additive 로 마련. 기존 행/로직/정책 전부 불변.
--
-- 멱등: ADD COLUMN IF NOT EXISTS / ON CONFLICT DO NOTHING / DROP POLICY IF EXISTS
--   선행 → 재적용 무해.

-- 1) partners 신규 컬럼 (전부 nullable, additive — 기존 행/로직 불변)
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS rep_name text;            -- 대표자명 (국세청 validate p_nm)
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS open_date date;           -- 개업일 (validate start_dt → YYYYMMDD 변환해 호출)
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS business_doc_path text;   -- 사업자등록증 이미지 (비공개 버킷 객체 경로, 공개 URL 아님)
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS nts_verified_at timestamptz; -- 국세청 진위확인 통과 시각

-- 2) 비공개 서류 버킷 (민감정보 → public=false. 공개읽기 금지)
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-docs', 'business-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 3) RLS: 본인 폴더({uid}/)만 (product-images own-folder 패턴 복제, 단 비공개)
DROP POLICY IF EXISTS "business_docs_insert_own" ON storage.objects;
CREATE POLICY "business_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "business_docs_select_own" ON storage.objects;
CREATE POLICY "business_docs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'business-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "business_docs_update_own" ON storage.objects;
CREATE POLICY "business_docs_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'business-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "business_docs_delete_own" ON storage.objects;
CREATE POLICY "business_docs_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'business-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
