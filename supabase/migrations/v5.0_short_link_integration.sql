-- v5.0 — 단축 링크 통합 (B0b Option D)
-- WHY: 메모리 #6 갱신 (Duke 2026-05-27) — 별도 short_links 테이블 미사용.
--      이미 존재하는 share_events.share_code 컬럼에 unique partial index + 6자 base62
--      생성 함수 + resolve/track RPC 도입. dub_short_url 6행 (Option C) 병존 유지.

-- 1. share_code unique partial index — 충돌 방지 (NULL 다수 허용)
CREATE UNIQUE INDEX IF NOT EXISTS ux_share_events_share_code
  ON share_events(share_code)
  WHERE share_code IS NOT NULL;

-- 2. 6자 base62 단축 코드 생성 함수
--    base62 alphabet: 0-9 + a-z + A-Z (62 chars), 6자리 = 56.8B 조합.
--    동시성 충돌 시 최대 5회 재시도. SECURITY DEFINER 로 share_events lookup 가능.
CREATE OR REPLACE FUNCTION public.gen_share_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  alphabet text := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  candidate text;
  attempt int := 0;
  i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * 62)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM share_events WHERE share_code = candidate) THEN
      RETURN candidate;
    END IF;
    attempt := attempt + 1;
    IF attempt >= 5 THEN
      RAISE EXCEPTION 'gen_share_code: failed to find unique code after % attempts', attempt;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.gen_share_code IS
  '6자 base62 단축 코드 생성 (메모리 #6). 충돌 시 최대 5회 재시도.';

-- 3. resolve_short_link RPC — 단축 코드 → share_uuid 매핑
--    사용처: Cloudflare Worker apex 라우트 (drop.how/{code})
--    SECURITY DEFINER + STABLE + 만료 필터.
CREATE OR REPLACE FUNCTION public.resolve_short_link(p_share_code text)
RETURNS TABLE(share_uuid uuid, info_drop_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  -- 6자 base62 형식 검증
  IF p_share_code IS NULL OR length(p_share_code) != 6 OR
     p_share_code !~ '^[0-9a-zA-Z]{6}$' THEN
    RETURN;  -- 빈 결과 → 404 처리는 caller 책임
  END IF;

  RETURN QUERY
    SELECT se.share_uuid, se.info_drop_id, se.expires_at
    FROM share_events se
    WHERE se.share_code = p_share_code
      AND (se.expires_at IS NULL OR se.expires_at > now())
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.resolve_short_link IS
  '단축 코드 → share_uuid 매핑 (drop.how apex 라우트용). 만료된 코드는 빈 결과.';

-- 4. track_short_link_click RPC — 클릭 추적 + fraud-aware 로그
--    사용처: Worker resolve 직후 비동기 호출
--    click_audit_logs INSERT + share_events.click_count 증분 (was_counted 분리)
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

  -- 2. 직전 클릭 시간 차 (같은 ip_hash + 같은 share_event)
  IF p_ip_hash IS NOT NULL THEN
    SELECT EXTRACT(EPOCH FROM (now() - MAX(created_at))) * 1000
      INTO v_last_click_ms
      FROM click_audit_logs
      WHERE share_event_id = v_share_event_id
        AND ip_hash = p_ip_hash;
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

  -- 4. click_audit_logs INSERT (모든 클릭 기록, was_counted 로 집계 분리)
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

COMMENT ON FUNCTION public.track_short_link_click IS
  '단축 링크 클릭 추적 + fraud 휴리스틱 + click_audit_logs INSERT (메모리 #6).';
