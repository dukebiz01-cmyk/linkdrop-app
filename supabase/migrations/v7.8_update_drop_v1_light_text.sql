-- v7.8 — update_drop v1 (라이트 텍스트 수정 RPC)
--
-- 목적: 메이커가 기존 드롭의 "안전 텍스트" 2종만 수정.
--   · curator_message → share_events (공유 카드 큐레이터 메시지)
--   · curator_note    → info_drops  (메이커 노트)
--   구조류(purpose·intent·coupon·reservation·blocks)는 v1 범위 아님 → 건드리지 않음.
--
-- 권한 모델 — create_drop_v2 와 동일 패턴:
--   · SECURITY DEFINER + search_path=public,pg_catalog
--   · auth.uid() 로 본인 소유(share_uuid → info_drop.owner_user_id) 재검증
--   · GRANT EXECUTE ... TO authenticated (CREATE OR REPLACE 시 grant 유실 대비 포함)
--
-- ⚠️ 적용 안 함 — SQL 명세 파일. SQL Editor 또는
--   node scripts/apply-migration.mjs v7.8_update_drop_v1_light_text supabase/migrations/v7.8_update_drop_v1_light_text.sql
--
-- 컬럼 확인(마이그레이션/types.ts 기준):
--   share_events: share_uuid, info_drop_id, sender_user_id, curator_message  (전부 존재)
--   info_drops  : id, owner_user_id, curator_note, updated_at                (전부 존재 → updated_at 갱신 포함)
--
-- 보존: 기존 함수(create_drop_v2·set_drop_funnel_coupon 등)·정책(drops_owner_modify 등)
--       ·기존 마이그레이션 무변경. 신규 테이블/enum/컬럼 0. surgical 신규 함수 1개만.

CREATE OR REPLACE FUNCTION public.update_drop(
  p_share_uuid      uuid,
  p_curator_message text DEFAULT NULL::text,
  p_curator_note    text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_drop_id uuid;
BEGIN
  -- 1) 인증
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  -- 2) 본인 소유 드롭 확인 (share_uuid → info_drop, owner = 본인)
  SELECT se.info_drop_id INTO v_drop_id
  FROM public.share_events se
  JOIN public.info_drops d ON d.id = se.info_drop_id
  WHERE se.share_uuid = p_share_uuid
    AND d.owner_user_id = v_uid;

  IF v_drop_id IS NULL THEN
    RAISE EXCEPTION '드롭을 찾을 수 없거나 권한이 없습니다';
  END IF;

  -- 3) 둘 다 NULL = 변경 없음 (no-op)
  IF p_curator_message IS NULL AND p_curator_note IS NULL THEN
    RETURN jsonb_build_object('info_drop_id', v_drop_id, 'updated', false);
  END IF;

  -- 4) 큐레이터 메시지 (share_events) — 본인 share_event 만
  IF p_curator_message IS NOT NULL THEN
    UPDATE public.share_events
    SET curator_message = NULLIF(trim(p_curator_message), '')
    WHERE share_uuid = p_share_uuid
      AND sender_user_id = v_uid;
  END IF;

  -- 5) 큐레이터 노트 (info_drops) — updated_at 동시 갱신
  IF p_curator_note IS NOT NULL THEN
    UPDATE public.info_drops
    SET curator_note = NULLIF(trim(p_curator_note), ''),
        updated_at   = now()
    WHERE id = v_drop_id
      AND owner_user_id = v_uid;
  END IF;

  -- 6) curator_message 만 수정된 경우(노트 미변경)에도 info_drops.updated_at 갱신
  --    → "수정이 하나라도 있으면 updated_at=now()" 충족.
  IF p_curator_note IS NULL AND p_curator_message IS NOT NULL THEN
    UPDATE public.info_drops
    SET updated_at = now()
    WHERE id = v_drop_id
      AND owner_user_id = v_uid;
  END IF;

  -- 7) 반환
  RETURN jsonb_build_object('info_drop_id', v_drop_id, 'updated', true);
END;
$function$;

-- 권한 — create_drop_v2 와 동일하게 authenticated 전용.
GRANT EXECUTE ON FUNCTION public.update_drop(uuid, text, text) TO authenticated;
