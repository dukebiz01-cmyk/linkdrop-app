-- v3.1 Step 4 — RPC 함수 + 트리거 (11 객체 + 보조 테이블 1)
--
-- Step 3(v3.0) schema 위에 올라가는 백엔드 로직.
-- 11 객체: helper 1 + 트리거 2 + RPC 8.  + 보조 테이블 ai_usage_quotas 1.
--
-- 사전 진단 (2026-05-20):
--   - 함수명 충돌 0. 신규 8테이블 anon/auth table GRANT 자동 부여됨.
--   - updated_at 컬럼: drop_ctas / consultation_leads → 트리거 2.
--   - update_updated_at() 표준 트리거 함수 재사용.
--   - lifecycle_events.user_id NOT NULL, 0행. update_lifecycle_stage 무영향 → nullable 완화 안전.
--   - drop_campaigns.partner_id → partners FK (consultation_leads partner 보완).
--   - component_blocks.block_kind enum = block_kind. block_data/block_config jsonb NOT NULL default '{}'.
--   - share_events: share_uuid/channel('kakao')/chain_depth/fraud_* 전부 default → INSERT 시 3컬럼만.
--
-- create_drop_v2 는 기존 create.tsx handlePublish 의 분리 INSERT(info_drops→component_blocks
--   →status update→share_events)를 단일 트랜잭션 RPC로 통합 — 부분실패 제거.
--
-- 적용: node scripts/apply-migration.mjs v3_1_step4_rpc_functions <path>

-- ============================================================
-- Section 0 — lifecycle_events 무로그인 대응 (확정 1)
-- ============================================================

ALTER TABLE public.lifecycle_events
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.lifecycle_events
  DROP CONSTRAINT IF EXISTS lifecycle_events_actor_present;
ALTER TABLE public.lifecycle_events
  ADD CONSTRAINT lifecycle_events_actor_present
  CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL);

-- ============================================================
-- 보조 테이블 — ai_usage_quotas (check_ai_quota 용)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_quotas (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id      uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL DEFAULT current_date,
  used_count   integer NOT NULL DEFAULT 0,
  daily_limit  integer NOT NULL DEFAULT 50,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_quotas IS
  '사용자별 일일 AI 사용량 quota. period_start 가 지나면 used_count 리셋 (check_ai_quota).';

ALTER TABLE public.ai_usage_quotas ENABLE ROW LEVEL SECURITY;

-- 본인 quota 만 조회. 쓰기는 SECURITY DEFINER RPC 전용 (정책 없음).
CREATE POLICY ai_usage_quotas_self_read ON public.ai_usage_quotas
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 객체 1 (helper) — hash_phone
-- ============================================================

CREATE OR REPLACE FUNCTION public.hash_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(extensions.digest(p_phone, 'sha256'), 'hex');
$$;

COMMENT ON FUNCTION public.hash_phone(text) IS
  '전화번호 SHA256 해시 (봇/중복 방지). 평문은 consultation_leads.phone 에 별도 저장.';

-- ============================================================
-- 객체 2-3 (트리거) — updated_at 자동 갱신 (update_updated_at 재사용)
-- ============================================================

DROP TRIGGER IF EXISTS trg_drop_ctas_updated_at ON public.drop_ctas;
CREATE TRIGGER trg_drop_ctas_updated_at
  BEFORE UPDATE ON public.drop_ctas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_consultation_leads_updated_at ON public.consultation_leads;
CREATE TRIGGER trg_consultation_leads_updated_at
  BEFORE UPDATE ON public.consultation_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 객체 4 (RPC) — submit_consultation_lead (무로그인 상담 신청)
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_consultation_lead(
  p_drop_id        uuid,
  p_lead_type      text,
  p_name           text,
  p_phone          text,
  p_privacy_agreed boolean,
  p_message        text DEFAULT NULL,
  p_desired_date   date DEFAULT NULL,
  p_desired_time   text DEFAULT NULL,
  p_adults         integer DEFAULT NULL,
  p_children       integer DEFAULT NULL,
  p_budget_range   text DEFAULT NULL,
  p_partner_id     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_partner_id uuid;
  v_lead_id    uuid;
BEGIN
  IF NOT p_privacy_agreed THEN
    RAISE EXCEPTION '개인정보 수집 동의가 필요합니다';
  END IF;

  v_partner_id := p_partner_id;
  IF v_partner_id IS NULL AND p_drop_id IS NOT NULL THEN
    SELECT dc.partner_id INTO v_partner_id
    FROM public.info_drops d
    LEFT JOIN public.drop_campaigns dc ON dc.id = d.campaign_id
    WHERE d.id = p_drop_id;
  END IF;

  INSERT INTO public.consultation_leads (
    drop_id, partner_id, lead_type, name, phone, phone_hash,
    message, desired_date, desired_time, adults, children, budget_range, privacy_agreed
  ) VALUES (
    p_drop_id, v_partner_id, p_lead_type, p_name, p_phone, public.hash_phone(p_phone),
    p_message, p_desired_date, p_desired_time, p_adults, p_children, p_budget_range, true
  )
  RETURNING id INTO v_lead_id;

  INSERT INTO public.consent_records (subject_type, subject_id, consent_type, agreed)
  VALUES ('lead', v_lead_id, 'privacy_collection', true);

  RETURN v_lead_id;
END;
$$;

COMMENT ON FUNCTION public.submit_consultation_lead IS
  '무로그인 상담 신청. phone_hash + partner 보완(campaign 경유) + consent_records 기록.';

-- ============================================================
-- 객체 5 (RPC) — upsert_visitor
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_visitor(
  p_anonymous_id text,
  p_metadata     jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.visitors (anonymous_id, metadata, last_seen_at)
  VALUES (p_anonymous_id, p_metadata, now())
  ON CONFLICT (anonymous_id) DO UPDATE
    SET last_seen_at = now(),
        metadata     = public.visitors.metadata || EXCLUDED.metadata
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_visitor IS
  '무로그인 방문자 upsert. anonymous_id 충돌 시 last_seen_at 갱신 + metadata 병합.';

-- ============================================================
-- 객체 6 (RPC) — track_drop_event
-- ============================================================

CREATE OR REPLACE FUNCTION public.track_drop_event(
  p_event_type   text,
  p_info_drop_id uuid DEFAULT NULL,
  p_anonymous_id text DEFAULT NULL,
  p_context      jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_visitor_id uuid;
  v_event_id   uuid;
BEGIN
  IF p_anonymous_id IS NOT NULL THEN
    v_visitor_id := public.upsert_visitor(p_anonymous_id);
  END IF;

  IF v_user_id IS NULL AND v_visitor_id IS NULL THEN
    RAISE EXCEPTION 'user_id(로그인) 또는 anonymous_id 중 하나는 필요합니다';
  END IF;

  INSERT INTO public.lifecycle_events (user_id, visitor_id, event_type, info_drop_id, context)
  VALUES (v_user_id, v_visitor_id, p_event_type, p_info_drop_id, p_context)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.track_drop_event IS
  '이벤트 추적. 무로그인은 anonymous_id → visitors → lifecycle_events.visitor_id.';

-- ============================================================
-- 객체 7 (RPC) — get_drop_detail (받은 사람 화면 일괄 조회, 무로그인)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_drop_detail(p_share_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'share_uuid',      se.share_uuid,
    'curator_message', se.curator_message,
    'created_at',      se.created_at,
    'drop', jsonb_build_object(
      'id', d.id, 'purpose', d.purpose::text,
      'ai_summary', d.ai_summary, 'ai_key_points', d.ai_key_points,
      'reservation_data', d.reservation_data
    ),
    'intent', jsonb_build_object('key', it.key, 'name', it.name, 'purpose', it.purpose::text),
    'source', jsonb_build_object(
      'title', cs.title, 'thumbnail_url', cs.thumbnail_url, 'source_url', cs.source_url,
      'author_name', cs.author_name, 'provider', cs.provider::text, 'duration_sec', cs.duration_sec
    ),
    'ctas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cta_type', c.cta_type, 'label', c.label, 'url', c.url,
        'is_primary', c.is_primary, 'sort_order', c.sort_order
      ) ORDER BY c.sort_order)
      FROM public.drop_ctas c WHERE c.drop_id = d.id
    ), '[]'::jsonb),
    'blocks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'block_kind', b.block_kind, 'block_data', b.block_data,
        'block_config', b.block_config, 'position', b.position,
        'video_start_seconds', b.video_start_seconds, 'video_end_seconds', b.video_end_seconds
      ) ORDER BY b.position)
      FROM public.component_blocks b WHERE b.info_drop_id = d.id
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pd.id, 'product_name_guess', pd.product_name_guess,
        'brand_guess', pd.brand_guess, 'confidence', pd.confidence,
        'offers', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'seller_name', po.seller_name, 'seller_country', po.seller_country,
            'platform', po.platform, 'product_url', po.product_url,
            'price', po.price, 'currency', po.currency,
            'estimated_total_price', po.estimated_total_price
          ))
          FROM public.product_offers po WHERE po.detection_id = pd.id
        ), '[]'::jsonb)
      ) ORDER BY pd.sort_order)
      FROM public.product_detections pd WHERE pd.drop_id = d.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.share_events se
  JOIN public.info_drops d        ON d.id = se.info_drop_id
  LEFT JOIN public.intent_types it    ON it.id = d.intent_id
  LEFT JOIN public.content_sources cs ON cs.id = d.source_id
  WHERE se.share_uuid = p_share_uuid;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_drop_detail IS
  '받은 사람 화면(무로그인) 일괄 조회: drop + intent + source + ctas + blocks + products/offers.';

-- ============================================================
-- 객체 8 (RPC) — record_ai_generation (+ ai_usage_quotas 증가)
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_ai_generation(
  p_generation_type text,
  p_user_id         uuid DEFAULT NULL,
  p_drop_id         uuid DEFAULT NULL,
  p_source_id       uuid DEFAULT NULL,
  p_model           text DEFAULT NULL,
  p_prompt          text DEFAULT NULL,
  p_response        jsonb DEFAULT NULL,
  p_tokens_used     integer DEFAULT NULL,
  p_cost_krw        numeric DEFAULT NULL,
  p_status          text DEFAULT 'success',
  p_error_message   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ai_generations (
    generation_type, drop_id, source_id, model, prompt, response,
    tokens_used, cost_krw, status, error_message
  ) VALUES (
    p_generation_type, p_drop_id, p_source_id, p_model, p_prompt, p_response,
    p_tokens_used, p_cost_krw, p_status, p_error_message
  )
  RETURNING id INTO v_id;

  -- 성공 호출이면 해당 사용자 일일 quota 증가 (period 넘었으면 리셋)
  IF p_status = 'success' AND p_user_id IS NOT NULL THEN
    INSERT INTO public.ai_usage_quotas (user_id, used_count, period_start)
    VALUES (p_user_id, 1, current_date)
    ON CONFLICT (user_id) DO UPDATE SET
      used_count = CASE WHEN public.ai_usage_quotas.period_start < current_date
                        THEN 1 ELSE public.ai_usage_quotas.used_count + 1 END,
      period_start = current_date,
      updated_at = now();
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_ai_generation IS
  'AI 생성 이력 기록 (Edge Function 용). status=success 시 ai_usage_quotas 증가.';

-- ============================================================
-- 객체 9 (RPC) — create_drop_v2 (영상 → Drop 생성, 단일 트랜잭션)
-- ============================================================
-- 기존 create.tsx handlePublish 의 분리 INSERT 를 원자적 RPC로 통합.

CREATE OR REPLACE FUNCTION public.create_drop_v2(
  p_intent_id       uuid,
  p_source_id       uuid,
  p_blocks          jsonb DEFAULT '[]'::jsonb,
  p_curator_message text DEFAULT NULL,
  p_campaign_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
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
  INSERT INTO public.share_events (info_drop_id, sender_user_id, curator_message)
  VALUES (v_drop_id, v_uid, v_msg)
  RETURNING share_uuid INTO v_share_uuid;

  RETURN jsonb_build_object('info_drop_id', v_drop_id, 'share_uuid', v_share_uuid);
END;
$$;

COMMENT ON FUNCTION public.create_drop_v2 IS
  '영상→Drop 생성 단일 트랜잭션: info_drops + component_blocks + share_events. 부분실패 제거.';

-- ============================================================
-- 객체 10 (RPC) — get_drop_results (결과 집계)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_drop_results(p_share_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'share_uuid',           se.share_uuid,
    'click_count',          se.click_count,
    'unique_clicker_count', se.unique_clicker_count,
    'conversion_count',     se.conversion_count,
    'drop', jsonb_build_object(
      'id',               d.id,
      'view_count',       d.view_count,
      'share_count',      d.share_count,
      'conversion_count', d.conversion_count
    ),
    'events', COALESCE((
      SELECT jsonb_object_agg(ev.event_type, ev.cnt)
      FROM (
        SELECT event_type, count(*) AS cnt
        FROM public.lifecycle_events
        WHERE info_drop_id = d.id
        GROUP BY event_type
      ) ev
    ), '{}'::jsonb)
  )
  INTO v_result
  FROM public.share_events se
  JOIN public.info_drops d ON d.id = se.info_drop_id
  WHERE se.share_uuid = p_share_uuid;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_drop_results IS
  '결과 집계: share_events 카운터 + info_drops 카운터 + lifecycle_events 이벤트별 카운트.';

-- ============================================================
-- 객체 11 (RPC) — check_ai_quota (AI 사용량 quota)
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_ai_quota(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_row public.ai_usage_quotas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'user 식별이 필요합니다';
  END IF;

  SELECT * INTO v_row FROM public.ai_usage_quotas WHERE user_id = v_uid;
  IF NOT FOUND THEN
    INSERT INTO public.ai_usage_quotas (user_id) VALUES (v_uid)
    RETURNING * INTO v_row;
  ELSIF v_row.period_start < current_date THEN
    UPDATE public.ai_usage_quotas
    SET used_count = 0, period_start = current_date, updated_at = now()
    WHERE user_id = v_uid
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'allowed',     v_row.used_count < v_row.daily_limit,
    'used',        v_row.used_count,
    'daily_limit', v_row.daily_limit,
    'remaining',   greatest(0, v_row.daily_limit - v_row.used_count)
  );
END;
$$;

COMMENT ON FUNCTION public.check_ai_quota IS
  '일일 AI 사용량 quota 체크. period 경과 시 used_count 리셋. 순수 체크 — 증가는 record_ai_generation.';

-- ============================================================
-- GRANT — anon vs authenticated
-- ============================================================

GRANT EXECUTE ON FUNCTION public.hash_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_consultation_lead(uuid,text,text,text,boolean,text,date,text,integer,integer,text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_visitor(text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_drop_event(text,uuid,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_drop_detail(uuid) TO anon, authenticated;
-- 아래 4개는 로그인/백엔드 전용 → authenticated 만
GRANT EXECUTE ON FUNCTION public.record_ai_generation(text,uuid,uuid,uuid,text,text,jsonb,integer,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_drop_v2(uuid,uuid,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_drop_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_quota(uuid) TO authenticated;

-- audit_logs 방어적 잠금 — RLS(정책 0)로도 막히나 table 권한도 회수.
REVOKE ALL ON public.audit_logs FROM anon, authenticated;

-- ============================================================
-- 검증 query (적용 후 수동 실행)
-- ============================================================
-- [객체] SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--          WHERE n.nspname='public' AND proname IN
--          ('hash_phone','submit_consultation_lead','upsert_visitor','track_drop_event',
--           'get_drop_detail','record_ai_generation','create_drop_v2','get_drop_results','check_ai_quota')
--          ORDER BY proname;   기대: 9행.
-- [트리거] SELECT count(*) FROM pg_trigger
--          WHERE tgrelid IN ('public.drop_ctas'::regclass,'public.consultation_leads'::regclass)
--            AND NOT tgisinternal;   기대: 2.
-- [테이블] SELECT to_regclass('public.ai_usage_quotas');   기대: 비-NULL.
-- [확정1] SELECT is_nullable FROM information_schema.columns
--          WHERE table_name='lifecycle_events' AND column_name='user_id';   기대: YES.
-- [GRANT] SELECT has_function_privilege('anon','public.get_drop_detail(uuid)','EXECUTE') AS a,
--                has_function_privilege('anon','public.create_drop_v2(uuid,uuid,jsonb,text,uuid)','EXECUTE') AS b;
--          기대: a=true, b=false.
-- [스모크] SELECT public.hash_phone('01012345678');   기대: 64자 hex.
