-- v5.0.1 — track_short_link_click 의 ambiguous column reference 보정
-- WHY: v5.0 의 함수에서 RETURNS TABLE(share_event_id uuid, ...) 의 output column 명이
--      click_audit_logs.share_event_id 컬럼과 충돌해 PL/pgSQL 이 ambiguous reference
--      에러 발생. PostgREST 호출 시 400 반환. 본문의 EXISTS 서브쿼리에 테이블 prefix
--      명시로 해결. 함수 시그니처/리턴 형식 무변경.

CREATE OR REPLACE FUNCTION public.track_short_link_click(
  p_share_code text,
  p_ip_hash text DEFAULT NULL,
  p_user_agent_hash text DEFAULT NULL,
  p_device_hash text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(share_event_id uuid, was_counted boolean, suspicion_score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share_event_id uuid;
  v_last_click_ms bigint;
  v_suspicion numeric := 0.0;
  v_reasons text[] := '{}';
  v_is_suspicious boolean := false;
  v_was_counted boolean := true;
BEGIN
  -- 1. share_event_id 조회 (없으면 종료)
  SELECT id INTO v_share_event_id
  FROM share_events
  WHERE share_code = p_share_code
  LIMIT 1;

  IF v_share_event_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. 직전 클릭 시간 차 — 테이블 prefix 명시로 RETURNS TABLE 컬럼 충돌 회피
  IF p_ip_hash IS NOT NULL THEN
    SELECT EXTRACT(EPOCH FROM (now() - MAX(cal.created_at))) * 1000
      INTO v_last_click_ms
      FROM click_audit_logs cal
      WHERE cal.share_event_id = v_share_event_id
        AND cal.ip_hash = p_ip_hash;
  END IF;

  -- 3. fraud 휴리스틱
  IF v_last_click_ms IS NOT NULL AND v_last_click_ms < 2000 THEN
    v_suspicion := v_suspicion + 0.6;
    v_reasons := v_reasons || 'rapid_repeat_click';
  END IF;
  IF p_user_agent_hash IS NULL THEN
    v_suspicion := v_suspicion + 0.2;
    v_reasons := v_reasons || 'no_user_agent';
  END IF;
  v_is_suspicious := v_suspicion >= 0.5;
  v_was_counted := NOT v_is_suspicious;

  -- 4. click_audit_logs INSERT
  INSERT INTO click_audit_logs (
    share_event_id, user_id,
    time_since_last_click_ms, suspicion_score, is_suspicious, suspicion_reasons, was_counted,
    ip_hash, user_agent_hash, device_hash, metadata
  )
  VALUES (
    v_share_event_id, p_user_id,
    v_last_click_ms, v_suspicion, v_is_suspicious, v_reasons, v_was_counted,
    p_ip_hash, p_user_agent_hash, p_device_hash, p_metadata
  );

  -- 5. share_events.click_count 증분 (was_counted 일 때만)
  IF v_was_counted THEN
    UPDATE share_events
    SET click_count = COALESCE(click_count, 0) + 1
    WHERE id = v_share_event_id;
  END IF;

  RETURN QUERY SELECT v_share_event_id, v_was_counted, v_suspicion;
END;
$$;
