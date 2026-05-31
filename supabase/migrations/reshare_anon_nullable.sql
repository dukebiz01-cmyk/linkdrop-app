-- BOOST1-RESHARE — 무로그인 재공유 + share_code 자동 생성 + 권한
-- 진단(verify-reshare-anon-safety) 옵션(a) nullable 채택. STEP 0 게이트 통과:
--   - share_events 트리거 chain_v21/edge_v21 NULL 안전 (재공유 origin은 부모에서 받음)
--   - distribute_rewards_safe NULL graceful (v_recipient_uid NULL이면 그대로 INSERT, idempotency COALESCE)
--   - share_events.chain_origin_user_id 이미 nullable
-- 작업: (1) 컬럼 NOT NULL 해제 3개(이미 nullable 1개 제외) + (2) RPC DROP+CREATE + (3) GRANT EXECUTE
-- 보존: 트리거 chain_v21/edge_v21 본문, gen_share_code, 옛 데이터, 보상 분배 함수, 다른 모든 것
-- 롤백: Downloads/BOOST1-RESHARE-ROLLBACK-ld_create_share_edge_v3.sql

-- ─────────────────────────────────────────────────────────
-- STEP 1-1) 컬럼 NOT NULL 해제 (메타데이터만, 빠름)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.share_events     ALTER COLUMN sender_user_id        DROP NOT NULL;
ALTER TABLE public.share_events     ALTER COLUMN chain_origin_user_id  DROP NOT NULL;  -- 이미 nullable, no-op 안전
ALTER TABLE public.drop_share_edges ALTER COLUMN child_user_id         DROP NOT NULL;
ALTER TABLE public.drop_share_edges ALTER COLUMN chain_origin_user_id  DROP NOT NULL;

-- ─────────────────────────────────────────────────────────
-- STEP 1-2) ld_create_share_edge_v3 본문 완성 (DROP+CREATE — 반환타입 변경)
--   - p_sender_user_id DEFAULT NULL (무로그인 허용)
--   - share_code := gen_share_code() (DB 헬퍼)
--   - sender NULL이면 sharer_type='anonymous', 아니면 'regular'
--   - RETURNS TABLE에 share_code text 추가
--   - 나머지 본문(트리거 위임·chain·context) 보존
-- ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.ld_create_share_edge_v3(
  uuid, uuid, share_channel, uuid, uuid, text, text,
  share_emotion, numeric, text, text, text, integer,
  share_relationship, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.ld_create_share_edge_v3(
  p_info_drop_id uuid,
  p_sender_user_id uuid DEFAULT NULL,                            -- 무로그인 허용
  p_channel share_channel DEFAULT 'kakao'::share_channel,
  p_parent_share_event_id uuid DEFAULT NULL::uuid,
  p_reshared_from_claim_id uuid DEFAULT NULL::uuid,
  p_intent_code text DEFAULT NULL::text,
  p_custom_message text DEFAULT NULL::text,
  p_emotion share_emotion DEFAULT NULL::share_emotion,
  p_urgency_score numeric DEFAULT NULL::numeric,
  p_cta_variant text DEFAULT NULL::text,
  p_template_id text DEFAULT NULL::text,
  p_sender_note text DEFAULT NULL::text,
  p_trust_hint_score integer DEFAULT 0,
  p_relationship_hint share_relationship DEFAULT NULL::share_relationship,
  p_ip_hash text DEFAULT NULL::text,
  p_device_hash text DEFAULT NULL::text,
  p_user_agent_hash text DEFAULT NULL::text,
  p_session_hash text DEFAULT NULL::text
)
RETURNS TABLE(
  share_event_id uuid,
  share_uuid uuid,
  share_code text,                                                -- 신규: 클라가 새 단축링크 조립
  chain_depth integer,
  chain_origin_user_id uuid,
  share_context_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_share_event_id    UUID;
  v_share_uuid        UUID := uuid_generate_v4();
  v_share_code        TEXT := public.gen_share_code();             -- 신규: DB 헬퍼로 자동 생성
  v_chain_depth       INT;
  v_chain_origin      UUID;
  v_context_id        UUID;
  v_has_context       BOOLEAN;
  v_intent_id_uuid    UUID;
  v_sharer_type       TEXT;
BEGIN
  -- intent_code → UUID
  IF p_intent_code IS NOT NULL THEN
    SELECT i.id INTO v_intent_id_uuid
    FROM intents i
    WHERE i.drop_intent_code = p_intent_code AND i.is_active = TRUE
    LIMIT 1;
  END IF;

  -- sender NULL이면 anonymous, 아니면 regular (enum: anonymous/owner/staff/regular/influencer/qr/ad/other)
  v_sharer_type := CASE WHEN p_sender_user_id IS NULL THEN 'anonymous' ELSE 'regular' END;

  -- share_events INSERT
  -- 트리거가 chain_depth, chain_origin_user_id, drop_share_edges 자동 처리
  INSERT INTO share_events (
    share_uuid, share_code,                                        -- 신규: share_code 채움
    info_drop_id, sender_user_id, channel,
    parent_share_event_id, reshared_from_claim_id,
    ip_hash, device_hash, user_agent_hash, session_hash,
    sharer_type                                                    -- 신규: anonymous/regular
  ) VALUES (
    v_share_uuid, v_share_code,
    p_info_drop_id, p_sender_user_id, p_channel,
    p_parent_share_event_id, p_reshared_from_claim_id,
    p_ip_hash, p_device_hash, p_user_agent_hash, p_session_hash,
    v_sharer_type
  )
  RETURNING id, chain_depth, chain_origin_user_id
  INTO v_share_event_id, v_chain_depth, v_chain_origin;

  -- context 정보가 있으면 drop_share_contexts INSERT
  v_has_context := (
    p_custom_message IS NOT NULL
    OR p_emotion IS NOT NULL
    OR p_urgency_score IS NOT NULL
    OR p_cta_variant IS NOT NULL
    OR p_template_id IS NOT NULL
    OR p_sender_note IS NOT NULL
    OR p_trust_hint_score > 0
    OR p_intent_code IS NOT NULL
  );

  IF v_has_context THEN
    INSERT INTO drop_share_contexts (
      share_event_id, sender_user_id,
      primary_intent_id, intent_code,
      custom_message, emotion, urgency_score, relationship_hint,
      cta_variant, template_id, sender_note, trust_hint_score
    ) VALUES (
      v_share_event_id, p_sender_user_id,
      v_intent_id_uuid, p_intent_code,
      p_custom_message, p_emotion, p_urgency_score, p_relationship_hint,
      p_cta_variant, p_template_id, p_sender_note, p_trust_hint_score
    )
    RETURNING id INTO v_context_id;
  END IF;

  -- 반환
  share_event_id        := v_share_event_id;
  share_uuid            := v_share_uuid;
  share_code            := v_share_code;
  chain_depth           := v_chain_depth;
  chain_origin_user_id  := v_chain_origin;
  share_context_id      := v_context_id;
  RETURN NEXT;
END;
$function$;

-- ─────────────────────────────────────────────────────────
-- STEP 1-3) 권한 (DROP+CREATE 후 필수)
-- ─────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.ld_create_share_edge_v3(
  uuid, uuid, share_channel, uuid, uuid, text, text,
  share_emotion, numeric, text, text, text, integer,
  share_relationship, text, text, text, text
) TO PUBLIC;
