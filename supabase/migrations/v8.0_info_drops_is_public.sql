-- v8.0 — 공개/비공개 게이트 Stage 1: info_drops.is_public + create_drop_v2 확장
--
-- 목적: 카드 공개여부 컬럼 추가. 공개(true)만 탐색 피드 노출, 비공개(false)는 제외.
--   백필 = A안(기존 전부 비공개) → DEFAULT false 가 처리하므로 UPDATE 불필요.
--
-- 본문 보존 원칙: create_drop_v2 는 v7.4(현재 head) 정의를 100% 복사.
--   is_public 만 2곳 추가:
--     (a) 시그니처 끝에 p_is_public boolean DEFAULT false
--     (b) info_drops INSERT 컬럼 리스트 + VALUES 에 is_public = p_is_public
--   그 외(partner 조회, v7.4 비사업자 purpose 게이트, component_blocks/share_events
--   INSERT, 반환값)는 일절 변경 금지.
--
-- ⚠️ 오버로딩 함정: DEFAULT 만 추가하면 6/7-인자 오버로딩 → "function is not unique".
--   반드시 6-인자 DROP 후 7-인자 CREATE.
-- GRANT: authenticated 만. anon 금지.

-- 1. 컬럼 추가 (비공개 기본)
ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 2. 기존 6-인자 함수 제거 (오버로딩 회피)
DROP FUNCTION IF EXISTS public.create_drop_v2(uuid, uuid, jsonb, text, uuid, text);

-- 3. 7-인자 함수 생성 (v7.4 본문 + p_is_public)
CREATE OR REPLACE FUNCTION public.create_drop_v2(p_intent_id uuid, p_source_id uuid, p_blocks jsonb DEFAULT '[]'::jsonb, p_curator_message text DEFAULT NULL::text, p_campaign_id uuid DEFAULT NULL::uuid, p_share_code text DEFAULT NULL::text, p_is_public boolean DEFAULT false)
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
  v_partner_id uuid;
  v_purpose    text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  -- v6.1: owner 의 승인된 partner 자동 매핑 (1 owner = 1 approved partner 가정).
  -- 조회 0건이면 v_partner_id 는 NULL 유지 → 기존 동작 그대로 (회귀 0).
  SELECT id INTO v_partner_id
  FROM public.partners
  WHERE owner_user_id = v_uid
    AND verification_status = 'approved'
  LIMIT 1;

  -- v7.4: 비사업자 purpose 게이트 — approved partner 없는 유저는 '정보' 목적만.
  --   p_intent_id 의 purpose 를 조회해 '정보' 가 아니고 partner 도 없으면 거부.
  IF v_partner_id IS NULL THEN
    SELECT purpose INTO v_purpose
    FROM public.intent_types
    WHERE id = p_intent_id;

    -- '정보' = info 목적. drop_purpose 5→3 enum 마이그레이션 시 함께 갱신.
    IF v_purpose IS DISTINCT FROM '정보' THEN
      RAISE EXCEPTION '비사업자는 정보 목적 카드만 생성할 수 있습니다 (%)', COALESCE(v_purpose, '알수없음')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- info_drops (purpose 는 trg_sync_info_drop_purpose 가 intent_id 로 채움)
  -- v8.0: is_public 추가 (그 외 컬럼·순서 v7.4 동일).
  INSERT INTO public.info_drops (owner_user_id, intent_id, source_id, campaign_id, status, partner_id, is_public)
  VALUES (v_uid, p_intent_id, p_source_id, p_campaign_id, 'published', v_partner_id, p_is_public)
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

-- 4. GRANT 재부여 — 7-인자 시그니처. authenticated 만 (anon 금지).
GRANT EXECUTE ON FUNCTION public.create_drop_v2(uuid, uuid, jsonb, text, uuid, text, boolean) TO authenticated;

-- ============================================
-- 검증 (SQL Editor 실행 후 확인용)
-- ============================================
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'info_drops' AND column_name = 'is_public';

SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'create_drop_v2';
