-- v7.9 — get_drop_for_edit (리뉴얼 에디터 로더, 부작용 없는 owner-scoped read)
--
-- 목적: update_drop(v7.8)과 짝. 메이커가 자기 드롭의 라이트 텍스트 2종을
--   편집 화면에 불러오기 위한 순수 읽기 RPC.
--   · curator_message → share_events
--   · curator_note    → info_drops
--
-- ⚠️ 부작용 금지: get_drop_detail 과 달리 increment_share_view 등 조회수 증가
--    절대 호출하지 않는다. 편집 진입마다 view 인플레 방지 — SELECT 만.
--
-- 권한 모델 — update_drop / create_drop_v2 와 동일:
--   · SECURITY DEFINER + search_path=public,pg_catalog
--   · auth.uid() 로 본인 소유(share_uuid → info_drop.owner_user_id) 재검증
--     (share_events 는 authenticated SELECT REVOKE 되어 있어 DEFINER 경유 필수)
--   · GRANT EXECUTE ... TO authenticated (CREATE OR REPLACE 시 grant 유실 대비 포함)
--
-- ⚠️ 적용 안 함 — SQL 명세 파일. SQL Editor 또는
--   node scripts/apply-migration.mjs v7.9_get_drop_for_edit supabase/migrations/v7.9_get_drop_for_edit.sql
--
-- 컬럼(확정): share_events = share_uuid·info_drop_id·sender_user_id·curator_message
--            info_drops   = id·owner_user_id·curator_note
--
-- 보존: 기존 함수(create_drop_v2·update_drop·get_drop_detail 등)·정책·기존
--       마이그레이션 무변경. 신규 테이블/enum/컬럼 0. surgical 신규 함수 1개만.

CREATE OR REPLACE FUNCTION public.get_drop_for_edit(p_share_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result jsonb;
BEGIN
  -- 1) 인증
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  -- 2) 본인 소유 드롭 1행 (share_uuid → info_drop, owner = 본인). 부작용 없음.
  SELECT jsonb_build_object(
    'info_drop_id',    d.id,
    'share_uuid',      se.share_uuid,
    'curator_message', se.curator_message,
    'curator_note',    d.curator_note
  )
  INTO v_result
  FROM public.share_events se
  JOIN public.info_drops d ON d.id = se.info_drop_id
  WHERE se.share_uuid = p_share_uuid
    AND d.owner_user_id = v_uid;

  -- 3) 미존재/비소유
  IF v_result IS NULL THEN
    RAISE EXCEPTION '드롭을 찾을 수 없거나 권한이 없습니다';
  END IF;

  -- 4) 반환
  RETURN v_result;
END;
$function$;

-- 권한 — update_drop 과 동일하게 authenticated 전용.
GRANT EXECUTE ON FUNCTION public.get_drop_for_edit(uuid) TO authenticated;
