-- ============================================
-- v5.1 — create_drop_v2: p_share_code 파라미터 추가
--
-- 목적: 핸들러가 gen_share_code()로 미리 생성한 6자 코드를
--       share_events.share_code 컬럼에 INSERT 시점에 채워 넣을 수 있도록
--       RPC 시그니처를 확장한다.
--
-- 패턴: DROP + CREATE (DEFAULT NULL 추가만 하면 5/6-인자 오버로딩 발생 →
--       PostgreSQL "function is not unique" 에러로 Drop 생성 전체 깨짐).
--
-- 본문 보존 원칙: 작업 2(pg_get_functiondef) dump와 한 글자도 다르지 않다.
--                 share_code 관련 2곳만 변경:
--                 (a) 시그니처 끝에 p_share_code TEXT DEFAULT NULL
--                 (b) share_events INSERT 컬럼/VALUES에 share_code = p_share_code
--
-- 의존성: 작업 2.5 확인 — 다른 RPC/트리거에서 호출 0건, application 1곳뿐.
-- 롤백: 파일 하단 주석의 원본 정의로 복원.
-- ============================================

-- 1. 기존 함수 제거 (정확한 시그니처 — 작업 2 pg_get_function_identity_arguments)
DROP FUNCTION IF EXISTS public.create_drop_v2(
  p_intent_id uuid,
  p_source_id uuid,
  p_blocks jsonb,
  p_curator_message text,
  p_campaign_id uuid
);

-- 2. 새 함수 생성 (p_share_code 추가)
CREATE OR REPLACE FUNCTION public.create_drop_v2(
  p_intent_id uuid,
  p_source_id uuid,
  p_blocks jsonb DEFAULT '[]'::jsonb,
  p_curator_message text DEFAULT NULL::text,
  p_campaign_id uuid DEFAULT NULL::uuid,
  p_share_code text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_drop_id    uuid;
  v_share_uuid uuid;
  v_msg        text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  -- info_drops (purpose 는 trg_sync_info_drop_purpose 가 intent_id 로 채움)
  INSERT INTO public.info_drops (owner_user_id, intent_id, source_id, campaign_id, status)
  VALUES (v_uid, p_intent_id, p_source_id, p_campaign_id, 'published')
  RETURNING id INTO v_drop_id;

  -- component_blocks (블록 배열)
  INSERT INTO public.component_blocks (
    info_drop_id, block_kind, block_data, block_config, position, is_locked,
    video_start_seconds, video_end_seconds
  )
  SELECT
    v_drop_id,
    (elem->>'block_kind')::public.block_kind,
    COALESCE(elem->'block_data', '{}'::jsonb),
    COALESCE(elem->'block_config', '{}'::jsonb),
    COALESCE((elem->>'position')::integer, (ord - 1)),
    COALESCE((elem->>'is_locked')::boolean, false),
    NULLIF(elem->>'video_start_seconds', '')::integer,
    NULLIF(elem->>'video_end_seconds', '')::integer
  FROM jsonb_array_elements(p_blocks) WITH ORDINALITY AS t(elem, ord);

  -- share_events (share_uuid/channel 등 default)
  v_msg := NULLIF(trim(COALESCE(p_curator_message, '')), '');
  INSERT INTO public.share_events (info_drop_id, sender_user_id, curator_message, share_code)
  VALUES (v_drop_id, v_uid, v_msg, p_share_code)
  RETURNING share_uuid INTO v_share_uuid;

  RETURN jsonb_build_object('info_drop_id', v_drop_id, 'share_uuid', v_share_uuid);
END;
$function$;

-- ============================================
-- 롤백용 원본 정의 (v5.1 이전 상태)
-- ============================================
-- DROP FUNCTION IF EXISTS public.create_drop_v2(
--   p_intent_id uuid, p_source_id uuid, p_blocks jsonb,
--   p_curator_message text, p_campaign_id uuid, p_share_code text
-- );
--
-- CREATE OR REPLACE FUNCTION public.create_drop_v2(
--   p_intent_id uuid, p_source_id uuid,
--   p_blocks jsonb DEFAULT '[]'::jsonb,
--   p_curator_message text DEFAULT NULL::text,
--   p_campaign_id uuid DEFAULT NULL::uuid
-- )
--  RETURNS jsonb
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'pg_catalog'
-- AS $function$
-- DECLARE
--   v_uid        uuid := auth.uid();
--   v_drop_id    uuid;
--   v_share_uuid uuid;
--   v_msg        text;
-- BEGIN
--   IF v_uid IS NULL THEN
--     RAISE EXCEPTION '로그인이 필요합니다';
--   END IF;
--   INSERT INTO public.info_drops (owner_user_id, intent_id, source_id, campaign_id, status)
--   VALUES (v_uid, p_intent_id, p_source_id, p_campaign_id, 'published')
--   RETURNING id INTO v_drop_id;
--   INSERT INTO public.component_blocks (
--     info_drop_id, block_kind, block_data, block_config, position, is_locked,
--     video_start_seconds, video_end_seconds
--   )
--   SELECT v_drop_id,
--     (elem->>'block_kind')::public.block_kind,
--     COALESCE(elem->'block_data', '{}'::jsonb),
--     COALESCE(elem->'block_config', '{}'::jsonb),
--     COALESCE((elem->>'position')::integer, (ord - 1)),
--     COALESCE((elem->>'is_locked')::boolean, false),
--     NULLIF(elem->>'video_start_seconds', '')::integer,
--     NULLIF(elem->>'video_end_seconds', '')::integer
--   FROM jsonb_array_elements(p_blocks) WITH ORDINALITY AS t(elem, ord);
--   v_msg := NULLIF(trim(COALESCE(p_curator_message, '')), '');
--   INSERT INTO public.share_events (info_drop_id, sender_user_id, curator_message)
--   VALUES (v_drop_id, v_uid, v_msg)
--   RETURNING share_uuid INTO v_share_uuid;
--   RETURN jsonb_build_object('info_drop_id', v_drop_id, 'share_uuid', v_share_uuid);
-- END;
-- $function$;
