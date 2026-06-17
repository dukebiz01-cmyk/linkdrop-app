-- get_creator_performance(p_period) — 크리에이터(=info_drops.owner) 성과 집계 (READ-ONLY)
--
-- 목적: 스튜디오 AI 피드백(Edge/Sonnet)의 입력이 될 단일 jsonb 성과 객체.
--   집계 전용. 쓰기/DDL 0. 기존 테이블·RPC(get_user_stats 등) 무수정. 신규 함수만 추가.
--
-- 보안:
--   - SECURITY DEFINER + 모든 집계를 info_drops.owner_user_id = auth.uid() 로 강제 스코프.
--   - user_id 파라미터 없음 — 내부 auth.uid() 만 사용(남의 성과 조회 원천 차단).
--   - auth.uid() NULL(미인증/SQL Editor 직접 실행)이면 AUTH_REQUIRED 예외.
--
-- 함정 반영(READ 확인 — src/integrations/supabase/types.ts):
--   - conversion_events.info_drop_id 는 NULLABLE → 드롭 귀속 = COALESCE(ce.info_drop_id, se.info_drop_id).
--     (ce.share_event_id 는 NOT NULL → share_events se → se.info_drop_id 폴백이 항상 존재.)
--   - 공유/시간대/채널 = share_events 실제 행 집계(역정규화 share_count/conversion_count 미사용).
--   - 기간 필터 기준 = share_events.created_at (전환도 그 전환의 share 시각 기준으로 기간/시간대 귀속).
--   - 시간대(hour)는 KST(Asia/Seoul) 기준 — created_at 은 timestamptz, DB 세션 TZ(UTC)로 EXTRACT 하면
--     한국 발송 시간대가 어긋나므로 'Asia/Seoul' 로 변환 후 hour 추출.
--   - 숫자 반올림 없음(raw 반환) — 표시 반올림은 Edge/프론트 책임.

CREATE OR REPLACE FUNCTION public.get_creator_performance(p_period text DEFAULT '30d')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_since timestamptz;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  -- 기간 경계. 'all' → NULL(필터 없음). 미지정/오타 → 30d 폴백.
  v_since := CASE p_period
    WHEN '7d'  THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    WHEN 'all' THEN NULL
    ELSE now() - interval '30 days'
  END;

  WITH
  -- 1) 소유 드롭(스코프의 뿌리). 이후 모든 집계는 이 집합에 JOIN 되어 owner=auth.uid() 강제.
  my_drops AS (
    SELECT d.id, d.purpose, d.published_at, d.created_at
    FROM info_drops d
    WHERE d.owner_user_id = v_uid
  ),
  -- 2) 기간 내 공유(실제 share_events 행). 시간대/채널 차원 분해의 원천.
  my_shares AS (
    SELECT
      se.id                                                           AS share_id,
      se.info_drop_id                                                 AS drop_id,
      se.channel                                                      AS channel,
      COALESCE(se.click_count, 0)                                     AS click_count,
      EXTRACT(HOUR FROM (se.created_at AT TIME ZONE 'Asia/Seoul'))::int AS send_hour
    FROM share_events se
    JOIN my_drops d ON d.id = se.info_drop_id
    WHERE v_since IS NULL OR se.created_at >= v_since
  ),
  -- 3) 기간 내 전환. 드롭 귀속 = COALESCE(ce.info_drop_id, se.info_drop_id) (nullable 폴백).
  --    기간/시간대는 그 전환의 share(se.created_at) 기준.
  my_conversions AS (
    SELECT
      ce.id                                                           AS conversion_id,
      COALESCE(ce.info_drop_id, se.info_drop_id)                      AS drop_id,
      ce.conversion_type                                              AS conversion_type,
      COALESCE(ce.gross_amount_krw, 0)                                AS gross_krw,
      se.channel                                                      AS channel,
      EXTRACT(HOUR FROM (se.created_at AT TIME ZONE 'Asia/Seoul'))::int AS send_hour
    FROM conversion_events ce
    JOIN share_events se ON se.id = ce.share_event_id
    JOIN my_drops d      ON d.id = COALESCE(ce.info_drop_id, se.info_drop_id)
    WHERE v_since IS NULL OR se.created_at >= v_since
  ),
  -- 4) 이 크리에이터 몫 보상. rl → ce → 드롭(owner=uid) + party_user_id=uid + 유효 상태만.
  my_rewards AS (
    SELECT
      COALESCE(ce.info_drop_id, se.info_drop_id) AS drop_id,
      rl.amount_krw                              AS amount_krw
    FROM reward_ledger rl
    JOIN conversion_events ce ON ce.id = rl.conversion_event_id
    JOIN share_events se      ON se.id = ce.share_event_id
    JOIN my_drops d           ON d.id = COALESCE(ce.info_drop_id, se.info_drop_id)
    WHERE rl.party_user_id = v_uid
      AND rl.ledger_status NOT IN ('reversed', 'cancelled')
      AND (v_since IS NULL OR se.created_at >= v_since)
  ),
  -- 5) 드롭별 롤업
  shares_by_drop AS (
    SELECT drop_id, COUNT(*)::int AS shares
    FROM my_shares GROUP BY drop_id
  ),
  conv_by_drop AS (
    SELECT drop_id,
           COUNT(DISTINCT conversion_id)::int AS conversions,
           SUM(gross_krw)::bigint             AS gross_krw
    FROM my_conversions GROUP BY drop_id
  ),
  reward_by_drop AS (
    SELECT drop_id, SUM(amount_krw)::bigint AS reward_krw
    FROM my_rewards GROUP BY drop_id
  ),
  -- 드롭별 최다 공유 채널 / 최다 공유 시간대(동률이면 안정적 tie-break).
  top_channel_by_drop AS (
    SELECT DISTINCT ON (drop_id) drop_id, channel
    FROM (SELECT drop_id, channel, COUNT(*) AS c FROM my_shares GROUP BY drop_id, channel) t
    ORDER BY drop_id, c DESC, channel
  ),
  top_hour_by_drop AS (
    SELECT DISTINCT ON (drop_id) drop_id, send_hour
    FROM (
      SELECT drop_id, send_hour, COUNT(*) AS c
      FROM my_shares WHERE send_hour IS NOT NULL
      GROUP BY drop_id, send_hour
    ) t
    ORDER BY drop_id, c DESC, send_hour
  ),
  -- 6) per_drop — 기간 내 활동(공유>0 또는 전환>0)이 있는 드롭만. 전환율 desc 정렬은 최종 agg 에서.
  per_drop_rows AS (
    SELECT
      d.id                                  AS drop_id,
      d.purpose::text                       AS purpose,
      d.published_at                        AS published_at,
      COALESCE(s.shares, 0)                 AS shares,
      COALESCE(c.conversions, 0)            AS conversions,
      CASE WHEN COALESCE(s.shares, 0) > 0
           THEN COALESCE(c.conversions, 0)::numeric / s.shares
           ELSE NULL END                    AS conversion_rate,
      COALESCE(c.gross_krw, 0)              AS gross_krw,
      COALESCE(r.reward_krw, 0)             AS reward_krw,
      tc.channel::text                      AS top_channel,
      th.send_hour                          AS top_send_hour
    FROM my_drops d
    LEFT JOIN shares_by_drop      s  ON s.drop_id  = d.id
    LEFT JOIN conv_by_drop        c  ON c.drop_id  = d.id
    LEFT JOIN reward_by_drop      r  ON r.drop_id  = d.id
    LEFT JOIN top_channel_by_drop tc ON tc.drop_id = d.id
    LEFT JOIN top_hour_by_drop    th ON th.drop_id = d.id
    WHERE COALESCE(s.shares, 0) > 0 OR COALESCE(c.conversions, 0) > 0
  ),
  -- 7) 차원 분해
  dim_hour AS (
    SELECT
      h.send_hour AS hour,
      COALESCE(sh.shares, 0)      AS shares,
      COALESCE(cv.conversions, 0) AS conversions,
      CASE WHEN COALESCE(sh.shares, 0) > 0
           THEN COALESCE(cv.conversions, 0)::numeric / sh.shares
           ELSE NULL END          AS conversion_rate
    FROM (
      SELECT send_hour FROM my_shares      WHERE send_hour IS NOT NULL
      UNION
      SELECT send_hour FROM my_conversions WHERE send_hour IS NOT NULL
    ) h
    LEFT JOIN (SELECT send_hour, COUNT(*) AS shares FROM my_shares WHERE send_hour IS NOT NULL GROUP BY send_hour) sh
      ON sh.send_hour = h.send_hour
    LEFT JOIN (SELECT send_hour, COUNT(DISTINCT conversion_id) AS conversions FROM my_conversions WHERE send_hour IS NOT NULL GROUP BY send_hour) cv
      ON cv.send_hour = h.send_hour
  ),
  dim_channel AS (
    SELECT
      ch.channel::text AS channel,
      COALESCE(sh.shares, 0)      AS shares,
      COALESCE(cv.conversions, 0) AS conversions,
      CASE WHEN COALESCE(sh.shares, 0) > 0
           THEN COALESCE(cv.conversions, 0)::numeric / sh.shares
           ELSE NULL END          AS conversion_rate
    FROM (
      SELECT channel FROM my_shares
      UNION
      SELECT channel FROM my_conversions
    ) ch
    LEFT JOIN (SELECT channel, COUNT(*) AS shares FROM my_shares GROUP BY channel) sh
      ON sh.channel = ch.channel
    LEFT JOIN (SELECT channel, COUNT(DISTINCT conversion_id) AS conversions FROM my_conversions GROUP BY channel) cv
      ON cv.channel = ch.channel
  ),
  -- by_purpose 는 per_drop_rows(활동 드롭) 롤업 — drops=활동 드롭 수, 나머지는 합.
  dim_purpose AS (
    SELECT
      purpose,
      COUNT(*)::int           AS drops,
      SUM(shares)::bigint     AS shares,
      SUM(conversions)::bigint AS conversions,
      CASE WHEN SUM(shares) > 0
           THEN SUM(conversions)::numeric / SUM(shares)
           ELSE NULL END      AS conversion_rate,
      SUM(gross_krw)::bigint  AS gross_krw
    FROM per_drop_rows
    GROUP BY purpose
  ),
  dim_ctype AS (
    SELECT
      conversion_type::text              AS conversion_type,
      COUNT(DISTINCT conversion_id)::int AS count,
      SUM(gross_krw)::bigint             AS gross_krw
    FROM my_conversions
    GROUP BY conversion_type
  ),
  -- 8) 총계
  totals AS (
    SELECT
      (SELECT COUNT(*) FROM per_drop_rows)                       AS drops,
      (SELECT COUNT(*) FROM my_shares)                           AS shares,
      (SELECT COUNT(DISTINCT conversion_id) FROM my_conversions) AS conversions,
      (SELECT COALESCE(SUM(gross_krw), 0) FROM my_conversions)   AS gross_krw,
      (SELECT COALESCE(SUM(amount_krw), 0) FROM my_rewards)      AS reward_krw
  )
  SELECT jsonb_build_object(
    'period', p_period,
    'totals', jsonb_build_object(
      'drops',           t.drops,
      'shares',          t.shares,
      'conversions',     t.conversions,
      'conversion_rate', CASE WHEN t.shares > 0 THEN t.conversions::numeric / t.shares ELSE NULL END,
      'gross_krw',       t.gross_krw,
      'reward_krw',      t.reward_krw
    ),
    'per_drop', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'drop_id',         drop_id,
        'purpose',         purpose,
        'published_at',    published_at,
        'shares',          shares,
        'conversions',     conversions,
        'conversion_rate', conversion_rate,
        'gross_krw',       gross_krw,
        'reward_krw',      reward_krw,
        'top_channel',     top_channel,
        'top_send_hour',   top_send_hour
      ) ORDER BY conversion_rate DESC NULLS LAST, conversions DESC)
      FROM per_drop_rows
    ), '[]'::jsonb),
    'dimensions', jsonb_build_object(
      'by_send_hour', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'hour', hour, 'shares', shares, 'conversions', conversions, 'conversion_rate', conversion_rate
        ) ORDER BY hour)
        FROM dim_hour
      ), '[]'::jsonb),
      'by_channel', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'channel', channel, 'shares', shares, 'conversions', conversions, 'conversion_rate', conversion_rate
        ) ORDER BY shares DESC)
        FROM dim_channel
      ), '[]'::jsonb),
      'by_purpose', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'purpose', purpose, 'drops', drops, 'shares', shares, 'conversions', conversions,
          'conversion_rate', conversion_rate, 'gross_krw', gross_krw
        ) ORDER BY conversions DESC)
        FROM dim_purpose
      ), '[]'::jsonb),
      'by_conversion_type', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'conversion_type', conversion_type, 'count', count, 'gross_krw', gross_krw
        ) ORDER BY count DESC)
        FROM dim_ctype
      ), '[]'::jsonb),
      'funnel', jsonb_build_object(
        'shares',      (SELECT COUNT(*) FROM my_shares),
        'clicks',      (SELECT COALESCE(SUM(click_count), 0) FROM my_shares),
        'conversions', (SELECT COUNT(DISTINCT conversion_id) FROM my_conversions)
      )
    ),
    'data_sufficiency', jsonb_build_object(
      'drop_count', t.drops,
      'level', CASE
        WHEN t.drops < 3  THEN 'insufficient'
        WHEN t.drops <= 7 THEN 'tentative'
        ELSE 'confident'
      END
    )
  )
  INTO v_result
  FROM totals t;

  RETURN v_result;
END;
$function$;

-- GRANT 재실행 — CREATE OR REPLACE 가 기존 권한을 드롭하므로 반드시 다시 부여.
REVOKE ALL ON FUNCTION public.get_creator_performance(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_creator_performance(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_creator_performance(text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 검증 쿼리 (실행 후 구조/누출 점검)
-- ─────────────────────────────────────────────────────────────────────────
--
-- ⚠️ Supabase SQL Editor 는 service_role 로 실행 → auth.uid() = NULL → AUTH_REQUIRED 발생이 정상.
--    실제 유저 컨텍스트 검증은 (a) 앱에서 supabase.rpc('get_creator_performance', { p_period:'30d' })
--    호출(유저 JWT), 또는 (b) 아래처럼 SQL Editor 에서 JWT claims 를 강제 주입해 시뮬레이션.
--
-- (b) 특정 owner 로 시뮬레이션 — auth.uid() 가 set_config 의 sub 를 읽음:
--   SELECT set_config('request.jwt.claims',
--                     json_build_object('sub', '<OWNER_USER_UUID>')::text, true);
--   SELECT public.get_creator_performance('30d');
--   SELECT public.get_creator_performance('7d');
--   SELECT public.get_creator_performance('all');
--
-- 구조 확인 — 최상위 키가 전부 있는지:
--   SELECT set_config('request.jwt.claims', json_build_object('sub','<OWNER_USER_UUID>')::text, true);
--   SELECT public.get_creator_performance('30d') ? 'totals'
--        AND public.get_creator_performance('30d') ? 'per_drop'
--        AND public.get_creator_performance('30d') ? 'dimensions'
--        AND public.get_creator_performance('30d') ? 'data_sufficiency' AS has_all_top_keys;
--
-- 누출 점검 1 — totals.drops 가 그 유저의 활동 드롭 수와 일치하는지 교차검증(직접 집계와 비교):
--   SELECT set_config('request.jwt.claims', json_build_object('sub','<OWNER_USER_UUID>')::text, true);
--   WITH expect AS (
--     SELECT COUNT(*) AS n FROM info_drops d
--     WHERE d.owner_user_id = '<OWNER_USER_UUID>'::uuid
--       AND EXISTS (SELECT 1 FROM share_events se WHERE se.info_drop_id = d.id
--                   AND se.created_at >= now() - interval '30 days')
--   )
--   SELECT (public.get_creator_performance('30d')->'totals'->>'drops')::int AS fn_drops,
--          (SELECT n FROM expect) AS direct_count_lower_bound;  -- 전환만 있는 드롭 포함 시 fn_drops ≥ lower bound
--
-- 누출 점검 2 — 다른 유저로 바꾸면 결과가 완전히 달라지고(겹치는 drop_id 없어야 함),
--               per_drop 의 drop_id 들이 전부 그 유저 소유인지 확인:
--   SELECT set_config('request.jwt.claims', json_build_object('sub','<OTHER_USER_UUID>')::text, true);
--   WITH r AS (SELECT public.get_creator_performance('all') AS j)
--   SELECT NOT EXISTS (
--     SELECT 1
--     FROM jsonb_array_elements((SELECT j FROM r)->'per_drop') e
--     JOIN info_drops d ON d.id = (e->>'drop_id')::uuid
--     WHERE d.owner_user_id <> '<OTHER_USER_UUID>'::uuid
--   ) AS no_foreign_drops;   -- true 면 누출 없음
--
-- 미인증 차단 — claims 초기화 후 호출하면 AUTH_REQUIRED:
--   SELECT set_config('request.jwt.claims', NULL, true);
--   SELECT public.get_creator_performance('30d');  -- → ERROR: AUTH_REQUIRED
