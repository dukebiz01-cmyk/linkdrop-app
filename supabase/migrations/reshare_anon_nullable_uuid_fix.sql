-- BOOST1-RESHARE 패치 — uuid_generate_v4() (extensions) 대신 gen_random_uuid() (pg_catalog 빌트인) 사용
-- 사유: 직전 마이그 본문의 v_share_uuid := uuid_generate_v4() 가 search_path='public,pg_catalog'
--       에서 못 찾음(uuid_generate_v4는 extensions 스키마). 원본 RPC도 동일 문제였으나 호출 0회라
--       발견 안 됨. CREATE OR REPLACE 로 한 줄 패치 (반환 타입·시그니처 무변경).

CREATE OR REPLACE FUNCTION public.ld_create_share_edge_v3(
  p_info_drop_id uuid,
  p_sender_user_id uuid DEFAULT NULL,
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
  share_code text,
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
  v_share_uuid        UUID := gen_random_uuid();                   -- pg_catalog 빌트인 (search_path 안)
  v_share_code        TEXT := public.gen_share_code();
  v_chain_depth       INT;
  v_chain_origin      UUID;
  v_context_id        UUID;
  v_has_context       BOOLEAN;
  v_intent_id_uuid    UUID;
  v_sharer_type       TEXT;
BEGIN
  IF p_intent_code IS NOT NULL THEN
    SELECT i.id INTO v_intent_id_uuid
    FROM intents i
    WHERE i.drop_intent_code = p_intent_code AND i.is_active = TRUE
    LIMIT 1;
  END IF;

  v_sharer_type := CASE WHEN p_sender_user_id IS NULL THEN 'anonymous' ELSE 'regular' END;

  INSERT INTO share_events (
    share_uuid, share_code,
    info_drop_id, sender_user_id, channel,
    parent_share_event_id, reshared_from_claim_id,
    ip_hash, device_hash, user_agent_hash, session_hash,
    sharer_type
  ) VALUES (
    v_share_uuid, v_share_code,
    p_info_drop_id, p_sender_user_id, p_channel,
    p_parent_share_event_id, p_reshared_from_claim_id,
    p_ip_hash, p_device_hash, p_user_agent_hash, p_session_hash,
    v_sharer_type
  )
  RETURNING id, chain_depth, chain_origin_user_id
  INTO v_share_event_id, v_chain_depth, v_chain_origin;

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

  share_event_id        := v_share_event_id;
  share_uuid            := v_share_uuid;
  share_code            := v_share_code;
  chain_depth           := v_chain_depth;
  chain_origin_user_id  := v_chain_origin;
  share_context_id      := v_context_id;
  RETURN NEXT;
END;
$function$;
