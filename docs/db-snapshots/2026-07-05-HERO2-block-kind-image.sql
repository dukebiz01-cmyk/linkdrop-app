-- HERO-2 block_kind enum 확장 박제 (migrations 아님 · 재적용 금지)
-- 2026-07-05 · 커밋 5ab5f86 동반 · 적용 완료(hero2_block_kind_image)
ALTER TYPE block_kind ADD VALUE IF NOT EXISTS 'image';
-- 근거: 대표 이미지의 드롭 고유 저장 자리 = component_blocks(image 블록).
--       content_sources.thumbnail은 canonical 공유 행이라 직접 오염 금지(타 드롭 전파).
-- create_drop_v2 무수정((elem->>'block_kind')::block_kind 캐스트 통과)·GRANT 무관(enum).
