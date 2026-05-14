-- =====================================================================
-- LinkDrop Master Schema v2.2 — STEP 2 of 2 (본체)
-- v3.0 Drop Audience Engine의 8가지 핵심을 v2.1 위에 안전 이식
-- 
-- STEP 1 (enum)이 먼저 commit돼야 함.
-- 
-- 8가지 이식 항목:
--   1. drop_intents 정책 마스터 (19종 코드 + 정책)
--   2. drop_share_contexts 확장 (intent_code, cta_variant, template_id, sender_note, trust_hint_score)
--   3. drop_sender_reputation (trust score)
--   4. drop_event_fraud_signals (강화된 fraud)
--   5. drop_forks (fork/remix)
--   6. reward_ledger.idempotency_key (강화)
--   7. ld_create_share_edge_v3 RPC (원자적 share + context)
--   8. lifecycle_stage 확장 (remix_curator, trusted_advocate)
-- =====================================================================

BEGIN;

-- 마이그레이션 기록
INSERT INTO schema_migrations (version, notes) 
VALUES ('v2.2', 'v3 핵심 이식: drop_intents + sender_reputation + fraud_signals + drop_forks + idempotency + atomic RPC')
ON CONFLICT (version) DO NOTHING;


-- =====================================================================
-- §1. drop_intents 정책 마스터 (19종)
-- =====================================================================

CREATE TABLE IF NOT EXISTS drop_intents (
  code                  TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  category              intent_category NOT NULL,
  description           TEXT,
  default_cta_label     TEXT NOT NULL,
  allowed_reward_types  TEXT[] NOT NULL DEFAULT ARRAY['point'],
  -- store_benefit, points, cash, coupon, reserve
  max_chain_depth       INT NOT NULL DEFAULT 3 CHECK (max_chain_depth BETWEEN 0 AND 5),
  fraud_sensitivity     fraud_sensitivity_level NOT NULL DEFAULT 'medium',
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INT NOT NULL DEFAULT 100,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drop_intents_active ON drop_intents(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_drop_intents_category ON drop_intents(category, active);

ALTER TABLE drop_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drop_intents_public_read ON drop_intents;
CREATE POLICY drop_intents_public_read ON drop_intents FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS drop_intents_admin_write ON drop_intents;
CREATE POLICY drop_intents_admin_write ON drop_intents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND 'admin'::user_role = ANY(active_roles)
    )
  );

-- 19종 시드
INSERT INTO drop_intents (code, name, category, description, default_cta_label, allowed_reward_types, max_chain_depth, fraud_sensitivity, sort_order) VALUES
  ('coupon',       '쿠폰 사용',    'local_commerce'::intent_category, '쿠폰 저장/사용 유도',          '쿠폰 받기',     ARRAY['coupon','points','store_benefit'],   3, 'high'::fraud_sensitivity_level,   10),
  ('reservation',  '예약 유도',    'local_commerce'::intent_category, '예약 클릭/완료 유도',           '예약하기',     ARRAY['coupon','points','store_benefit'],   3, 'high'::fraud_sensitivity_level,   20),
  ('local_visit',  '로컬 방문',    'local_commerce'::intent_category, '오프라인 방문 유도',           '방문 혜택 보기', ARRAY['coupon','points','store_benefit'],   3, 'high'::fraud_sensitivity_level,   30),
  ('promotion',    '프로모션',     'commerce'::intent_category,       '혜택/행사 안내',               '혜택 보기',     ARRAY['coupon','points','store_benefit'],   3, 'high'::fraud_sensitivity_level,   40),
  ('shopping',     '쇼핑',         'commerce'::intent_category,       '상품 클릭/구매 유도',          '상품 보기',     ARRAY['points','store_benefit','cash'],     2, 'high'::fraud_sensitivity_level,   50),
  ('purchase',     '구매',         'commerce'::intent_category,       '구매 완료 유도',               '구매하기',     ARRAY['points','store_benefit','cash'],     2, 'high'::fraud_sensitivity_level,   60),
  ('gift',         '선물',         'commerce'::intent_category,       '선물/추천 공유',               '선물하기',     ARRAY['coupon','points'],                  2, 'medium'::fraud_sensitivity_level, 70),
  ('lead',         '문의/리드',     'commerce'::intent_category,       '문의/상담 리드 유도',          '문의하기',     ARRAY['coupon','points'],                  2, 'medium'::fraud_sensitivity_level, 80),
  ('event',        '이벤트',       'community'::intent_category,      '이벤트 참여 유도',             '참여하기',     ARRAY['coupon','points'],                  3, 'medium'::fraud_sensitivity_level, 90),
  ('recruit',      '모집',         'community'::intent_category,      '모집/신청',                    '신청하기',     ARRAY['points'],                           2, 'medium'::fraud_sensitivity_level, 100),
  ('community',    '커뮤니티',     'community'::intent_category,      '커뮤니티 공유',                '함께 보기',     ARRAY['points'],                           3, 'low'::fraud_sensitivity_level,    110),
  ('support',      '응원',         'community'::intent_category,      '응원/지지 전파',                '응원하기',     ARRAY['points'],                           2, 'medium'::fraud_sensitivity_level, 120),
  ('politics',     '정치/공익',     'public'::intent_category,         '정치·공익성 메시지',           '내용 보기',     ARRAY['points'],                           1, 'high'::fraud_sensitivity_level,   130),
  ('news',         '소식',         'content'::intent_category,        '소식/정보 전달',                '자세히 보기',   ARRAY['points'],                           3, 'low'::fraud_sensitivity_level,    140),
  ('review',       '리뷰',         'content'::intent_category,        '후기/리뷰 기반 전파',           '리뷰 보기',     ARRAY['coupon','points'],                  3, 'medium'::fraud_sensitivity_level, 150),
  ('content',      '콘텐츠',       'content'::intent_category,        '콘텐츠 소비',                  '보기',         ARRAY['points'],                           3, 'low'::fraud_sensitivity_level,    160),
  ('viral',        '바이럴',       'content'::intent_category,        '재전송/확산',                  '공유하기',     ARRAY['points'],                           3, 'medium'::fraud_sensitivity_level, 170),
  ('share',        '일반 공유',    'content'::intent_category,        '일반 공유',                     '공유하기',     ARRAY['points'],                           3, 'low'::fraud_sensitivity_level,    180),
  ('custom',       '사용자 정의',  'custom'::intent_category,         '사용자가 직접 정의',           '확인하기',     ARRAY['coupon','points'],                  2, 'medium'::fraud_sensitivity_level, 190)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  default_cta_label = EXCLUDED.default_cta_label,
  allowed_reward_types = EXCLUDED.allowed_reward_types,
  max_chain_depth = EXCLUDED.max_chain_depth,
  fraud_sensitivity = EXCLUDED.fraud_sensitivity,
  updated_at = NOW();


-- v2.1 intents 테이블과 매핑 (intent_types → drop_intents.code)
ALTER TABLE intents ADD COLUMN IF NOT EXISTS drop_intent_code TEXT REFERENCES drop_intents(code);

-- 기존 v2.1 intents의 매핑 (intent_types.key가 drop_intents.code와 동일하면 자동 매핑)
UPDATE intents i
SET drop_intent_code = it.key
FROM intent_types it
WHERE i.intent_type_id = it.id
  AND it.key IN (SELECT code FROM drop_intents)
  AND i.drop_intent_code IS NULL;


-- =====================================================================
-- §2. drop_share_contexts 확장
-- =====================================================================

ALTER TABLE drop_share_contexts
  ADD COLUMN IF NOT EXISTS intent_code TEXT REFERENCES drop_intents(code),
  ADD COLUMN IF NOT EXISTS cta_variant TEXT,
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_note TEXT,
  ADD COLUMN IF NOT EXISTS trust_hint_score INT NOT NULL DEFAULT 0 CHECK (trust_hint_score BETWEEN 0 AND 100);

-- 길이 제약
DO $$ BEGIN
  ALTER TABLE drop_share_contexts 
    ADD CONSTRAINT drop_share_contexts_custom_message_len 
    CHECK (custom_message IS NULL OR char_length(custom_message) <= 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drop_share_contexts 
    ADD CONSTRAINT drop_share_contexts_sender_note_len 
    CHECK (sender_note IS NULL OR char_length(sender_note) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_drop_share_contexts_intent_code ON drop_share_contexts(intent_code);


-- =====================================================================
-- §3. drop_sender_reputation (전송자 신뢰)
-- =====================================================================

CREATE TABLE IF NOT EXISTS drop_sender_reputation (
  sender_user_id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 누적 카운터
  total_sent                  INT NOT NULL DEFAULT 0,
  total_opened                INT NOT NULL DEFAULT 0,
  total_clicked               INT NOT NULL DEFAULT 0,
  total_converted             INT NOT NULL DEFAULT 0,
  total_reshared              INT NOT NULL DEFAULT 0,
  total_forked                INT NOT NULL DEFAULT 0,
  spam_report_count           INT NOT NULL DEFAULT 0,
  suspicious_event_count      INT NOT NULL DEFAULT 0,
  
  -- 평균 rate
  avg_open_rate               NUMERIC(8,4) NOT NULL DEFAULT 0,
  avg_click_rate              NUMERIC(8,4) NOT NULL DEFAULT 0,
  avg_conversion_rate         NUMERIC(8,4) NOT NULL DEFAULT 0,
  avg_reshare_rate            NUMERIC(8,4) NOT NULL DEFAULT 0,
  
  -- 신뢰 점수
  trust_score                 INT NOT NULL DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  status                      sender_reputation_status NOT NULL DEFAULT 'normal',
  
  last_calculated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculation_version         TEXT NOT NULL DEFAULT 'v2.2',
  
  metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sender_reputation_trust 
  ON drop_sender_reputation(trust_score DESC, total_converted DESC);

CREATE INDEX IF NOT EXISTS idx_sender_reputation_watch 
  ON drop_sender_reputation(status, suspicious_event_count DESC) 
  WHERE status <> 'normal';

ALTER TABLE drop_sender_reputation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sender_reputation_own_read ON drop_sender_reputation;
CREATE POLICY sender_reputation_own_read ON drop_sender_reputation FOR SELECT 
  USING (auth.uid() = sender_user_id);

DROP POLICY IF EXISTS sender_reputation_admin_read ON drop_sender_reputation;
CREATE POLICY sender_reputation_admin_read ON drop_sender_reputation FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND 'admin'::user_role = ANY(active_roles)
    )
  );


-- =====================================================================
-- §4. drop_event_fraud_signals (강화된 fraud)
-- =====================================================================

-- share_events에 fraud 컬럼 추가
ALTER TABLE share_events
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS device_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent_hash TEXT,
  ADD COLUMN IF NOT EXISTS session_hash TEXT,
  ADD COLUMN IF NOT EXISTS fraud_risk_score INT NOT NULL DEFAULT 0 CHECK (fraud_risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS fraud_decision fraud_decision_kind NOT NULL DEFAULT 'allow';

CREATE INDEX IF NOT EXISTS idx_share_events_device_recent 
  ON share_events(device_hash, created_at DESC) WHERE device_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_events_ip_recent 
  ON share_events(ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_events_fraud 
  ON share_events(fraud_decision, fraud_risk_score DESC) WHERE fraud_decision <> 'allow';


-- 상세 fraud 신호 테이블
CREATE TABLE IF NOT EXISTS drop_event_fraud_signals (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 참조
  share_event_id      UUID REFERENCES share_events(id) ON DELETE SET NULL,
  conversion_event_id UUID REFERENCES conversion_events(id) ON DELETE SET NULL,
  click_audit_log_id  UUID REFERENCES click_audit_logs(id) ON DELETE SET NULL,
  
  -- 환경
  sender_user_id      UUID REFERENCES profiles(id),
  receiver_user_id    UUID REFERENCES profiles(id),
  info_drop_id        UUID REFERENCES info_drops(id),
  
  -- 신호
  source              TEXT NOT NULL,
  -- 'click', 'redemption', 'reshare', 'manual_report'
  event_type          TEXT NOT NULL,
  ip_hash             TEXT,
  device_hash         TEXT,
  user_agent_hash     TEXT,
  session_hash        TEXT,
  
  -- 결정
  risk_score          INT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  decision            fraud_decision_kind NOT NULL,
  reasons             TEXT[] NOT NULL DEFAULT '{}',
  
  -- 사후 처리
  reviewed_at         TIMESTAMPTZ,
  reviewer_id         UUID REFERENCES profiles(id),
  resolution          TEXT CHECK (resolution IS NULL OR resolution IN ('confirmed_fraud', 'false_positive', 'ignored')),
  
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_signals_decision 
  ON drop_event_fraud_signals(decision, risk_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_sender 
  ON drop_event_fraud_signals(sender_user_id, decision, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_unreviewed 
  ON drop_event_fraud_signals(created_at DESC) WHERE reviewed_at IS NULL;

ALTER TABLE drop_event_fraud_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fraud_signals_admin_read ON drop_event_fraud_signals;
CREATE POLICY fraud_signals_admin_read ON drop_event_fraud_signals FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND 'admin'::user_role = ANY(active_roles)
    )
  );


-- =====================================================================
-- §5. drop_forks (Fork/Remix)
-- =====================================================================

CREATE TABLE IF NOT EXISTS drop_forks (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 부모/자식 Drop
  parent_drop_id        UUID NOT NULL REFERENCES info_drops(id) ON DELETE CASCADE,
  child_drop_id         UUID NOT NULL REFERENCES info_drops(id) ON DELETE CASCADE,
  forked_by_user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 변경 사유
  fork_reason           TEXT,
  intent_code           TEXT REFERENCES drop_intents(code),
  
  -- 변경 내용 (snapshot)
  custom_title          TEXT,
  custom_message        TEXT,
  cta_variant           TEXT,
  block_overrides       JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- 권한/credit
  preserves_creator_credit  BOOLEAN NOT NULL DEFAULT TRUE,
  preserves_origin_credit   BOOLEAN NOT NULL DEFAULT TRUE,
  origin_maker_user_id      UUID REFERENCES profiles(id),  -- 원본 Maker (체인 추적용)
  
  -- 상태
  status                fork_status_kind NOT NULL DEFAULT 'draft',
  
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT drop_forks_no_self_fork CHECK (parent_drop_id <> child_drop_id),
  CONSTRAINT drop_forks_custom_title_len CHECK (custom_title IS NULL OR char_length(custom_title) <= 120),
  CONSTRAINT drop_forks_custom_message_len CHECK (custom_message IS NULL OR char_length(custom_message) <= 300),
  UNIQUE (parent_drop_id, child_drop_id)
);

CREATE INDEX IF NOT EXISTS idx_drop_forks_parent ON drop_forks(parent_drop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drop_forks_forked_by ON drop_forks(forked_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drop_forks_status ON drop_forks(status) WHERE status IN ('draft', 'active');

ALTER TABLE drop_forks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drop_forks_own_read ON drop_forks;
CREATE POLICY drop_forks_own_read ON drop_forks FOR SELECT 
  USING (auth.uid() = forked_by_user_id);

DROP POLICY IF EXISTS drop_forks_public_read ON drop_forks;
CREATE POLICY drop_forks_public_read ON drop_forks FOR SELECT 
  USING (status = 'active');

DROP POLICY IF EXISTS drop_forks_own_write ON drop_forks;
CREATE POLICY drop_forks_own_write ON drop_forks FOR ALL 
  USING (auth.uid() = forked_by_user_id);


-- =====================================================================
-- §6. Reward Idempotency 강화
-- =====================================================================

ALTER TABLE reward_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 기존 행에 idempotency_key 채우기
UPDATE reward_ledger
SET idempotency_key = CONCAT_WS(':', 
    'reward', 
    conversion_event_id::TEXT, 
    party::TEXT,
    COALESCE(party_user_id::TEXT, 'no-user')
  )
WHERE idempotency_key IS NULL;

-- NOT NULL + UNIQUE
DO $$ BEGIN
  ALTER TABLE reward_ledger ALTER COLUMN idempotency_key SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_ledger_idempotency 
  ON reward_ledger(idempotency_key);


-- =====================================================================
-- §7. ld_create_share_edge_v3 RPC (원자적 share + context)
-- =====================================================================

CREATE OR REPLACE FUNCTION ld_create_share_edge_v3(
  p_info_drop_id        UUID,
  p_sender_user_id      UUID,
  p_channel             share_channel DEFAULT 'kakao',
  p_parent_share_event_id UUID DEFAULT NULL,
  p_reshared_from_claim_id UUID DEFAULT NULL,
  -- context 옵션 (모두 nullable)
  p_intent_code         TEXT DEFAULT NULL,
  p_custom_message      TEXT DEFAULT NULL,
  p_emotion             share_emotion DEFAULT NULL,
  p_urgency_score       NUMERIC DEFAULT NULL,
  p_cta_variant         TEXT DEFAULT NULL,
  p_template_id         TEXT DEFAULT NULL,
  p_sender_note         TEXT DEFAULT NULL,
  p_trust_hint_score    INT DEFAULT 0,
  p_relationship_hint   share_relationship DEFAULT NULL,
  -- fraud 옵션
  p_ip_hash             TEXT DEFAULT NULL,
  p_device_hash         TEXT DEFAULT NULL,
  p_user_agent_hash     TEXT DEFAULT NULL,
  p_session_hash        TEXT DEFAULT NULL
)
RETURNS TABLE (
  share_event_id        UUID,
  share_uuid            UUID,
  chain_depth           INT,
  chain_origin_user_id  UUID,
  share_context_id      UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_share_event_id    UUID;
  v_share_uuid        UUID := uuid_generate_v4();
  v_chain_depth       INT;
  v_chain_origin      UUID;
  v_context_id        UUID;
  v_has_context       BOOLEAN;
  v_intent_id_uuid    UUID;
BEGIN
  -- intent_code가 있으면 intents 테이블의 UUID 찾기
  IF p_intent_code IS NOT NULL THEN
    SELECT i.id INTO v_intent_id_uuid 
    FROM intents i 
    WHERE i.drop_intent_code = p_intent_code 
      AND i.is_active = TRUE
    LIMIT 1;
  END IF;

  -- share_events INSERT
  -- (트리거가 chain_depth, chain_origin_user_id, drop_share_edges 자동 처리)
  INSERT INTO share_events (
    share_uuid, info_drop_id, sender_user_id, channel,
    parent_share_event_id, reshared_from_claim_id,
    ip_hash, device_hash, user_agent_hash, session_hash
  ) VALUES (
    v_share_uuid, p_info_drop_id, p_sender_user_id, p_channel,
    p_parent_share_event_id, p_reshared_from_claim_id,
    p_ip_hash, p_device_hash, p_user_agent_hash, p_session_hash
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
  chain_depth           := v_chain_depth;
  chain_origin_user_id  := v_chain_origin;
  share_context_id      := v_context_id;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION ld_create_share_edge_v3 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ld_create_share_edge_v3 TO authenticated;


-- =====================================================================
-- §8. ld_rebuild_sender_reputation_v3 RPC
-- =====================================================================

CREATE OR REPLACE FUNCTION ld_rebuild_sender_reputation_v3(p_sender_user_id UUID)
RETURNS drop_sender_reputation
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sent          INT := 0;
  v_opened        INT := 0;
  v_clicked       INT := 0;
  v_converted     INT := 0;
  v_reshared      INT := 0;
  v_forked        INT := 0;
  v_spam          INT := 0;
  v_suspicious    INT := 0;
  v_open_rate     NUMERIC(8,4) := 0;
  v_click_rate    NUMERIC(8,4) := 0;
  v_conv_rate     NUMERIC(8,4) := 0;
  v_reshare_rate  NUMERIC(8,4) := 0;
  v_trust         INT := 50;
  v_status        sender_reputation_status := 'normal';
  v_row           drop_sender_reputation%ROWTYPE;
BEGIN
  -- 보낸 수 (share_events)
  SELECT COUNT(*) INTO v_sent
  FROM share_events
  WHERE sender_user_id = p_sender_user_id;

  -- 클릭 수 (share_events.click_count 합산)
  SELECT COALESCE(SUM(click_count), 0) INTO v_clicked
  FROM share_events
  WHERE sender_user_id = p_sender_user_id;
  
  -- 재공유 수 (parent_share_event_id가 있는 것)
  SELECT COUNT(*) INTO v_reshared
  FROM share_events
  WHERE sender_user_id = p_sender_user_id 
    AND parent_share_event_id IS NOT NULL;

  -- 전환 수 (해당 sender의 share에서 발생한 conversion)
  SELECT COUNT(*) INTO v_converted
  FROM conversion_events ce
  JOIN share_events se ON se.id = ce.share_event_id
  WHERE se.sender_user_id = p_sender_user_id;
  
  -- Fork 수
  SELECT COUNT(*) INTO v_forked
  FROM drop_forks
  WHERE forked_by_user_id = p_sender_user_id;
  
  -- 의심 신호
  SELECT COUNT(*) INTO v_suspicious
  FROM drop_event_fraud_signals
  WHERE sender_user_id = p_sender_user_id 
    AND decision IN ('review', 'block');

  -- spam_report_count는 별도 메커니즘 (Stage 2에서 채움)
  v_spam := 0;

  -- 비율 계산
  IF v_sent > 0 THEN
    v_click_rate    := ROUND(v_clicked::NUMERIC / v_sent, 4);
    v_conv_rate     := ROUND(v_converted::NUMERIC / v_sent, 4);
    v_reshare_rate  := ROUND(v_reshared::NUMERIC / v_sent, 4);
    -- v_opened는 별도 (page_view 이벤트가 있으면)
    v_open_rate := LEAST(v_click_rate * 1.5, 1.0);  -- 추정치
  END IF;

  -- Trust score 계산 (간단한 가중 평균)
  -- 기본 50 + 전환률 × 30 + 클릭률 × 10 + 재공유률 × 10 - 의심 × 5 - spam × 10
  v_trust := GREATEST(0, LEAST(100,
    50 
    + (v_conv_rate * 30)::INT
    + (v_click_rate * 10)::INT
    + (v_reshare_rate * 10)::INT
    - (v_suspicious * 5)
    - (v_spam * 10)
  ));

  -- Status 분류
  IF v_trust >= 80 AND v_suspicious = 0 AND v_spam = 0 THEN
    v_status := 'normal';  -- 사실상 trusted, lifecycle_stage에서 trusted_advocate 마킹
  ELSIF v_trust >= 50 THEN
    v_status := 'normal';
  ELSIF v_suspicious >= 3 OR v_spam >= 1 THEN
    v_status := 'watch';
  ELSIF v_suspicious >= 10 OR v_spam >= 5 THEN
    v_status := 'restricted';
  ELSE
    v_status := 'normal';
  END IF;

  -- UPSERT
  INSERT INTO drop_sender_reputation (
    sender_user_id, total_sent, total_opened, total_clicked, 
    total_converted, total_reshared, total_forked,
    spam_report_count, suspicious_event_count,
    avg_open_rate, avg_click_rate, avg_conversion_rate, avg_reshare_rate,
    trust_score, status, last_calculated_at
  ) VALUES (
    p_sender_user_id, v_sent, v_opened, v_clicked,
    v_converted, v_reshared, v_forked,
    v_spam, v_suspicious,
    v_open_rate, v_click_rate, v_conv_rate, v_reshare_rate,
    v_trust, v_status, NOW()
  )
  ON CONFLICT (sender_user_id) DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_opened = EXCLUDED.total_opened,
    total_clicked = EXCLUDED.total_clicked,
    total_converted = EXCLUDED.total_converted,
    total_reshared = EXCLUDED.total_reshared,
    total_forked = EXCLUDED.total_forked,
    spam_report_count = EXCLUDED.spam_report_count,
    suspicious_event_count = EXCLUDED.suspicious_event_count,
    avg_open_rate = EXCLUDED.avg_open_rate,
    avg_click_rate = EXCLUDED.avg_click_rate,
    avg_conversion_rate = EXCLUDED.avg_conversion_rate,
    avg_reshare_rate = EXCLUDED.avg_reshare_rate,
    trust_score = EXCLUDED.trust_score,
    status = EXCLUDED.status,
    last_calculated_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION ld_rebuild_sender_reputation_v3 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ld_rebuild_sender_reputation_v3 TO authenticated;


-- =====================================================================
-- §9. distribute_rewards_safe 갱신 (idempotency_key + intent별 reward type 제한)
-- =====================================================================

CREATE OR REPLACE FUNCTION distribute_rewards_safe(p_conversion_event_id UUID)
RETURNS TABLE (
  out_party        reward_party,
  out_amount_krw   NUMERIC,
  out_reward_form  reward_form,
  out_ledger_id    UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key       BIGINT;
  v_conversion     conversion_events%ROWTYPE;
  v_share_event    share_events%ROWTYPE;
  v_intent_code    TEXT;
  v_drop_intent    drop_intents%ROWTYPE;
  v_rule_id        UUID := '00000000-0000-0000-0000-000000000001';
  v_rule_item      reward_rule_items%ROWTYPE;
  v_amount         NUMERIC(14,2);
  v_recipient_uid  UUID;
  v_ledger_id      UUID;
  v_already_exists BOOLEAN;
  v_idempotency    TEXT;
  v_allowed_forms  TEXT[];
  v_resolved_form  reward_form;
BEGIN
  v_lock_key := hashtext(p_conversion_event_id::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- 멱등성 체크
  SELECT EXISTS (
    SELECT 1 FROM reward_ledger 
    WHERE conversion_event_id = p_conversion_event_id
  ) INTO v_already_exists;
  
  IF v_already_exists THEN
    RAISE EXCEPTION 'REWARDS_ALREADY_DISTRIBUTED for conversion %', p_conversion_event_id;
  END IF;
  
  SELECT * INTO v_conversion FROM conversion_events 
  WHERE id = p_conversion_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVERSION_EVENT_NOT_FOUND';
  END IF;
  
  IF v_conversion.gross_amount_krw IS NULL OR v_conversion.gross_amount_krw <= 0 THEN
    RAISE EXCEPTION 'INVALID_GROSS_AMOUNT';
  END IF;
  
  -- share_event에서 intent_code 추적 (drop_share_contexts 통해)
  SELECT * INTO v_share_event FROM share_events WHERE id = v_conversion.share_event_id;
  
  SELECT intent_code INTO v_intent_code 
  FROM drop_share_contexts 
  WHERE share_event_id = v_conversion.share_event_id;
  
  -- intent별 allowed_reward_types 가져오기
  IF v_intent_code IS NOT NULL THEN
    SELECT * INTO v_drop_intent FROM drop_intents WHERE code = v_intent_code;
    IF FOUND THEN
      v_allowed_forms := v_drop_intent.allowed_reward_types;
    END IF;
  END IF;
  
  -- 5-side 분배
  FOR v_rule_item IN 
    SELECT * FROM reward_rule_items 
    WHERE reward_rule_id = v_rule_id 
    ORDER BY 
      CASE party
        WHEN 'creator'::reward_party        THEN 1
        WHEN 'chain_advocate'::reward_party THEN 2
        WHEN 'chain_origin'::reward_party   THEN 3
        WHEN 'platform'::reward_party       THEN 4
        WHEN 'reserve'::reward_party        THEN 5
        WHEN 'dropper'::reward_party        THEN 99
      END
  LOOP
    v_amount := ROUND(v_conversion.gross_amount_krw * v_rule_item.rate, 2);
    
    v_recipient_uid := CASE v_rule_item.party
      WHEN 'creator'::reward_party        THEN NULL
      WHEN 'chain_advocate'::reward_party THEN v_conversion.direct_advocate_user_id
      WHEN 'chain_origin'::reward_party   THEN v_conversion.chain_origin_user_id
      WHEN 'platform'::reward_party       THEN NULL
      WHEN 'reserve'::reward_party        THEN NULL
      ELSE NULL
    END;
    
    -- intent 제약 적용: chain_advocate/chain_origin이 cash 받는 거 차단
    -- v3 정신: 일반 sender는 cash 차단
    v_resolved_form := v_rule_item.reward_form;
    
    IF v_allowed_forms IS NOT NULL THEN
      IF v_rule_item.party IN ('chain_advocate'::reward_party, 'chain_origin'::reward_party) 
         AND v_rule_item.reward_form = 'cash'::reward_form
         AND NOT ('cash' = ANY(v_allowed_forms)) THEN
        -- cash 차단 → store_benefit으로 fallback
        v_resolved_form := 'store_benefit'::reward_form;
      END IF;
    END IF;
    
    -- idempotency_key 생성
    v_idempotency := CONCAT_WS(':',
      'reward', p_conversion_event_id::TEXT, v_rule_item.party::TEXT,
      COALESCE(v_recipient_uid::TEXT, 'no-user')
    );
    
    INSERT INTO reward_ledger (
      conversion_event_id, rule_item_id,
      party, party_user_id,
      reward_form, amount_krw, rate_applied,
      ledger_status, idempotency_key, created_at
    ) VALUES (
      p_conversion_event_id, v_rule_item.id,
      v_rule_item.party, v_recipient_uid,
      v_resolved_form, v_amount, v_rule_item.rate,
      'pending'::ledger_status, v_idempotency, NOW()
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_ledger_id;
    
    out_party       := v_rule_item.party;
    out_amount_krw  := v_amount;
    out_reward_form := v_resolved_form;
    out_ledger_id   := v_ledger_id;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION distribute_rewards_safe FROM PUBLIC;
GRANT EXECUTE ON FUNCTION distribute_rewards_safe TO authenticated;


-- =====================================================================
-- §10. update_lifecycle_stage 갱신 (remix_curator, trusted_advocate)
-- =====================================================================

CREATE OR REPLACE FUNCTION update_lifecycle_stage(
  p_user_id   UUID,
  p_new_event TEXT
) RETURNS lifecycle_stage
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state user_lifecycle_state%ROWTYPE;
  v_new_stage     lifecycle_stage;
  v_trust_score   INT;
BEGIN
  SELECT * INTO v_current_state FROM user_lifecycle_state WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_lifecycle_state (user_id, current_stage)
    VALUES (p_user_id, 'new_receiver')
    RETURNING * INTO v_current_state;
  END IF;
  
  v_new_stage := v_current_state.current_stage;
  
  -- trust_score 확인 (trusted_advocate 마킹용)
  SELECT trust_score INTO v_trust_score 
  FROM drop_sender_reputation 
  WHERE sender_user_id = p_user_id;
  
  CASE p_new_event
    WHEN 'view' THEN
      IF v_current_state.current_stage = 'new_receiver' THEN
        v_new_stage := 'viewer';
      ELSIF v_current_state.current_stage = 'viewer' AND v_current_state.total_views >= 2 THEN
        v_new_stage := 'hot_viewer';
      END IF;
    WHEN 'cta_click' THEN v_new_stage := 'cta_clicker';
    WHEN 'coupon_claim' THEN v_new_stage := 'coupon_intent';
    WHEN 'redemption' THEN v_new_stage := 'buyer';
    WHEN 'share_create' THEN v_new_stage := 'sharer';
    WHEN 'reshare' THEN v_new_stage := 'resharer';
    WHEN 'fork_create' THEN v_new_stage := 'remix_curator';  -- v2.2 신규
    WHEN 'advocacy' THEN
      IF v_trust_score IS NOT NULL AND v_trust_score >= 80 THEN
        v_new_stage := 'trusted_advocate';  -- v2.2 신규
      ELSIF v_current_state.current_stage = 'resharer' THEN
        v_new_stage := 'chain_advocate';
      ELSE
        v_new_stage := 'advocate';
      END IF;
    WHEN 'lost_30_days' THEN v_new_stage := 'lost';
    WHEN 'returned' THEN v_new_stage := 'returned';
    ELSE NULL;
  END CASE;
  
  UPDATE user_lifecycle_state 
  SET 
    current_stage = v_new_stage,
    stage_entered_at = CASE WHEN current_stage <> v_new_stage THEN NOW() ELSE stage_entered_at END,
    last_active_at = NOW(),
    total_views = total_views + CASE WHEN p_new_event = 'view' THEN 1 ELSE 0 END,
    total_cta_clicks = total_cta_clicks + CASE WHEN p_new_event = 'cta_click' THEN 1 ELSE 0 END,
    total_coupons_received = total_coupons_received + CASE WHEN p_new_event = 'coupon_claim' THEN 1 ELSE 0 END,
    total_redemptions = total_redemptions + CASE WHEN p_new_event = 'redemption' THEN 1 ELSE 0 END,
    total_shares = total_shares + CASE WHEN p_new_event = 'share_create' THEN 1 ELSE 0 END,
    total_reshares = total_reshares + CASE WHEN p_new_event = 'reshare' THEN 1 ELSE 0 END,
    total_advocacy = total_advocacy + CASE WHEN p_new_event = 'advocacy' AND v_current_state.current_stage != 'resharer' THEN 1 ELSE 0 END,
    total_chain_advocacy = total_chain_advocacy + CASE WHEN p_new_event = 'advocacy' AND v_current_state.current_stage = 'resharer' THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO lifecycle_events (
    user_id, event_type, previous_stage, new_stage, created_at
  ) VALUES (
    p_user_id, p_new_event, v_current_state.current_stage, v_new_stage, NOW()
  );
  
  RETURN v_new_stage;
END;
$$;


-- =====================================================================
-- §11. updated_at 트리거 (드롭 인텐트, 포크)
-- =====================================================================

DROP TRIGGER IF EXISTS drop_intents_updated_at ON drop_intents;
CREATE TRIGGER drop_intents_updated_at
  BEFORE UPDATE ON drop_intents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS drop_forks_updated_at ON drop_forks;
CREATE TRIGGER drop_forks_updated_at
  BEFORE UPDATE ON drop_forks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS drop_sender_reputation_updated_at ON drop_sender_reputation;
CREATE TRIGGER drop_sender_reputation_updated_at
  BEFORE UPDATE ON drop_sender_reputation 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =====================================================================
-- §12. PostgREST schema reload
-- =====================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- v2.2 마이그레이션 완료
-- 
-- 신규 테이블 4개:
--   drop_intents (19종 정책 마스터)
--   drop_sender_reputation (trust score)
--   drop_event_fraud_signals (강화 fraud)
--   drop_forks (Fork/Remix)
-- 
-- 확장 테이블 3개:
--   drop_share_contexts (intent_code, cta_variant, template_id, sender_note, trust_hint_score)
--   share_events (ip_hash, device_hash, user_agent_hash, session_hash, fraud_risk_score, fraud_decision)
--   reward_ledger (idempotency_key UNIQUE)
--   intents (drop_intent_code 매핑)
-- 
-- 함수 3개:
--   ld_create_share_edge_v3 — 원자적 share + context INSERT
--   ld_rebuild_sender_reputation_v3 — trust score 계산
--   distribute_rewards_safe (갱신) — intent별 allowed_reward_types 적용 + idempotency
-- 
-- update_lifecycle_stage (갱신):
--   fork_create → remix_curator
--   advocacy + trust>=80 → trusted_advocate
-- 
-- enum 신규 (STEP 1에서):
--   fraud_decision_kind, sender_reputation_status, 
--   fork_status_kind, intent_category, fraud_sensitivity_level
--   lifecycle_stage += remix_curator, trusted_advocate
-- =====================================================================
