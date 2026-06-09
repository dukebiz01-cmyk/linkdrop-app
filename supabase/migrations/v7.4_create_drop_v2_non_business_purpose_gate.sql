-- v7.4 — create_drop_v2 비사업자 purpose 검증 (정보만)
--
-- 배경: create_drop_v2 GRANT 가 authenticated 에 열려 있어 PostgREST
--   /rest/v1/rpc/create_drop_v2 로 앱 서버(/api/drops)를 우회한 직접 호출이 가능.
--   따라서 "비사업자(approved partner 없음)는 info(정보) 목적만 생성" 규칙은
--   RPC 본문 안에서 강제해야 우회 불가.
--
-- 규칙: v_partner_id IS NULL (approved partner 없음) AND 목적이 '정보' 아님
--       → RAISE EXCEPTION (쿠폰/예약/구매/상담 거부).
--
-- ⚠️ create_drop_v2 는 purpose 문자열이 아니라 p_intent_id(uuid) 를 받음.
--    목적 판정은 intent_types.purpose 를 p_intent_id 로 조회해 비교한다.
--
-- 본문 100% 보존 — v6.1 정의(인자·SECURITY DEFINER·search_path·partner 조회·
--   info_drops/component_blocks/share_events INSERT) 그대로, partner 조회 직후
--   INSERT 전에 검증 블록만 삽입.

CREATE OR REPLACE FUNCTION public.create_drop_v2(p_intent_id uuid, p_source_id uuid, p_blocks jsonb DEFAULT '[]'::jsonb, p_curator_message text DEFAULT NULL::text, p_campaign_id uuid DEFAULT NULL::uuid, p_share_code text DEFAULT NULL::text)
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
  INSERT INTO public.info_drops (owner_user_id, intent_id, source_id, campaign_id, status, partner_id)
  VALUES (v_uid, p_intent_id, p_source_id, p_campaign_id, 'published', v_partner_id)
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

-- GRANT 재확인 — authenticated 만. anon 에는 부여 금지.
GRANT EXECUTE ON FUNCTION public.create_drop_v2(uuid, uuid, jsonb, text, uuid, text) TO authenticated;
