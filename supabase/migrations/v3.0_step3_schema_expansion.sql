-- v3.0 Step 3 — schema 확장 (Section 1-8)
--
-- 결정 락 2-1 (B안): intent_types.purpose 로 9 intent → 5 목적 매핑.
-- 결정 락 2-2 (C안): info_drops.reservation_data jsonb (Phase 1 예약 캘린더).
-- 절대 금지 §3 (Duke 2026-05-20 정정): 기존 테이블 대체 신규 X (drops/drop_blocks/booking_links).
--   1:N·검색·집계가 진짜 필요한 보조 정규화 테이블은 정공법 허용 — Section 3-7이 그 대상.
--
-- Step 2 진단 반영 (2026-05-20):
--   intent_types 9행 / info_drops 25행 / content_sources 11행.
--   purpose·reservation_data 부재 확인. content_sources 는 충분 (ALTER 불필요).
--   이벤트 추적: 기존 lifecycle_events 활용, events 신규 X (Section 6).
--
-- 적용: node scripts/apply-migration.mjs v3_0_step3_schema_expansion <path>

-- ============================================================
-- Section 1 — intent_types.purpose (5 목적 매핑)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'drop_purpose') THEN
    CREATE TYPE public.drop_purpose AS ENUM ('정보', '쿠폰', '예약', '구매', '상담');
  END IF;
END $$;

ALTER TABLE public.intent_types
  ADD COLUMN IF NOT EXISTS purpose public.drop_purpose;

-- 9 intent → 5 목적 (Duke 확정 2026-05-20)
UPDATE public.intent_types SET purpose = '정보' WHERE key IN ('info', 'discussion', 'custom', 'campaign');
UPDATE public.intent_types SET purpose = '쿠폰' WHERE key = 'coupon';
UPDATE public.intent_types SET purpose = '예약' WHERE key IN ('reservation', 'ticket');
UPDATE public.intent_types SET purpose = '구매' WHERE key = 'commerce';
UPDATE public.intent_types SET purpose = '상담' WHERE key = 'lead';

ALTER TABLE public.intent_types
  ALTER COLUMN purpose SET NOT NULL;

-- ============================================================
-- Section 2 — info_drops 확장
-- ============================================================

ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS purpose public.drop_purpose;
ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS ai_key_points jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS reservation_data jsonb;

COMMENT ON COLUMN public.info_drops.purpose IS
  '5목적 (UX). intent_id → intent_types.purpose 를 trg_sync_info_drop_purpose 트리거로 동기화.';
COMMENT ON COLUMN public.info_drops.ai_summary IS
  'AI가 생성한 영상 요약. 받은 사람 화면(기획 §12)에 노출.';
COMMENT ON COLUMN public.info_drops.ai_key_points IS
  'AI 핵심 포인트. jsonb 배열.';
COMMENT ON COLUMN public.info_drops.reservation_data IS
  'Phase 1 예약 캘린더 데이터: { checkin, checkout, nights, adults, children, pets, external_links[] }. 자체 예약 = Phase 2.';

-- 기존 25행 backfill
UPDATE public.info_drops d
SET purpose = it.purpose
FROM public.intent_types it
WHERE d.intent_id = it.id AND d.purpose IS NULL;

-- intent_id 변경 시 purpose 동기화
CREATE OR REPLACE FUNCTION public.sync_info_drop_purpose()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  SELECT purpose INTO NEW.purpose FROM public.intent_types WHERE id = NEW.intent_id;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_info_drop_purpose ON public.info_drops;
CREATE TRIGGER trg_sync_info_drop_purpose
  BEFORE INSERT OR UPDATE OF intent_id ON public.info_drops
  FOR EACH ROW EXECUTE FUNCTION public.sync_info_drop_purpose();

ALTER TABLE public.info_drops
  ALTER COLUMN purpose SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_info_drops_purpose ON public.info_drops (purpose);

-- ============================================================
-- Section 3 — drop_ctas (목적별 행동 버튼, 1 drop : N CTA)
-- ============================================================
-- booking_links 신규 X — 외부 예약 link도 cta_type='external_link'/'reservation_check'로 표현.

CREATE TABLE IF NOT EXISTS public.drop_ctas (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  drop_id uuid NOT NULL REFERENCES public.info_drops(id) ON DELETE CASCADE,
  cta_type text NOT NULL CHECK (cta_type IN (
    'location_view','phone_inquiry','reservation_check','product_view','price_check',
    'store_view','howto_view','general_inquiry','schedule_view','event_apply',
    'review_view','benefit_view','reserve_with_coupon','date_view','coupon_get',
    'directions','send_to_friend','baemin_order','consult_apply','video_watch',
    'share','external_link'
  )),
  label text NOT NULL,
  url text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drop_ctas_drop_id ON public.drop_ctas (drop_id);

COMMENT ON TABLE public.drop_ctas IS
  '목적별 행동 버튼. 1 info_drop : N CTA. 외부 예약 link 포함 (booking_links 대체 신규 아님).';

-- ============================================================
-- Section 4 — product_detections + product_offers (AI 상품/가격, 정공법 1:N)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_detections (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  drop_id uuid NOT NULL REFERENCES public.info_drops(id) ON DELETE CASCADE,
  product_name_guess text,
  brand_guess text,
  category text,
  evidence_text text,
  evidence_timestamp_sec integer,
  confidence text NOT NULL DEFAULT '확인 필요' CHECK (confidence IN ('높음','보통','확인 필요')),
  user_confirmed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_detections_drop_id ON public.product_detections (drop_id);

COMMENT ON TABLE public.product_detections IS
  'AI가 영상에서 추출한 상품 후보. 1 info_drop : N 상품.';

CREATE TABLE IF NOT EXISTS public.product_offers (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  detection_id uuid NOT NULL REFERENCES public.product_detections(id) ON DELETE CASCADE,
  seller_name text NOT NULL,
  seller_country text NOT NULL DEFAULT '국내' CHECK (seller_country IN ('국내','해외')),
  platform text,
  product_url text,
  price numeric,
  currency text NOT NULL DEFAULT 'KRW',
  shipping_fee numeric,
  estimated_tax numeric,
  estimated_total_price numeric,
  delivery_days_min integer,
  delivery_days_max integer,
  affiliate_tag text,
  last_checked_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','stale','unavailable')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_offers_detection_id ON public.product_offers (detection_id);

COMMENT ON TABLE public.product_offers IS
  '상품별 국내/해외 셀러 가격 비교. 1 product_detection : N 셀러 (jsonb 비효율 → 정규화).';

-- ============================================================
-- Section 5 — consultation_leads (상담 리드, phone_hash + RLS)
-- ============================================================
-- drop 삭제돼도 리드는 보존 (ON DELETE SET NULL).
-- phone(평문)은 매장 상담에 필수 — RLS로 매장 owner만 SELECT. phone_hash(SHA256)는 봇/중복 방지.

CREATE TABLE IF NOT EXISTS public.consultation_leads (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  drop_id uuid REFERENCES public.info_drops(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  lead_type text NOT NULL CHECK (lead_type IN (
    'reservation_inquiry','quote_inquiry','contact_inquiry','group_inquiry','visit_inquiry'
  )),
  name text NOT NULL,
  phone text NOT NULL,
  phone_hash text NOT NULL,
  message text,
  desired_date date,
  desired_time text,
  adults integer,
  children integer,
  budget_range text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new','confirmed','in_progress','quote_sent',
    'converted_reservation','converted_purchase','on_hold','closed'
  )),
  privacy_agreed boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consultation_leads_partner_id ON public.consultation_leads (partner_id);
CREATE INDEX IF NOT EXISTS idx_consultation_leads_drop_id ON public.consultation_leads (drop_id);
CREATE INDEX IF NOT EXISTS idx_consultation_leads_phone_hash ON public.consultation_leads (phone_hash);
CREATE INDEX IF NOT EXISTS idx_consultation_leads_status ON public.consultation_leads (status);

COMMENT ON TABLE public.consultation_leads IS
  '상담 리드. 무로그인 INSERT, 매장 owner만 SELECT/UPDATE (RLS). phone=평문(상담 필수), phone_hash=SHA256(봇/중복).';

-- ============================================================
-- Section 6 — visitors (무로그인 방문자) + lifecycle_events.visitor_id
-- ============================================================
-- events 신규 X — 기존 lifecycle_events(event_type text, context jsonb) 활용.
-- visitors 만 신규 (무로그인 anonymous_id 식별 — 기존 어디에도 없음).

CREATE TABLE IF NOT EXISTS public.visitors (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  anonymous_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visitors_user_id ON public.visitors (user_id);

COMMENT ON TABLE public.visitors IS
  '무로그인 방문자 식별 (anonymous_id). 로그인 시 user_id 연결.';

-- lifecycle_events.visitor_id — FK 정공법 (옵션 1, Duke 확정). visitor별 집계 JOIN.
ALTER TABLE public.lifecycle_events
  ADD COLUMN IF NOT EXISTS visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_visitor_id ON public.lifecycle_events (visitor_id);

-- ============================================================
-- Section 7 — ai_generations + consent_records + audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_generations (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  drop_id uuid REFERENCES public.info_drops(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.content_sources(id) ON DELETE SET NULL,
  generation_type text NOT NULL CHECK (generation_type IN (
    'summary','key_points','title','share_message',
    'product_detection','intent_suggestion','price_compare'
  )),
  model text,
  prompt text,
  response jsonb,
  tokens_used integer,
  cost_krw numeric,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','error','pending')),
  error_message text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_generations_drop_id ON public.ai_generations (drop_id);

COMMENT ON TABLE public.ai_generations IS
  'AI 생성 호출 이력 (요약·상품탐지 등). 비용/토큰 추적.';

CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  subject_type text NOT NULL CHECK (subject_type IN ('user','lead','visitor')),
  subject_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type IN (
    'privacy_collection','marketing','third_party_share'
  )),
  agreed boolean NOT NULL,
  policy_version text,
  ip_hash text,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_records_subject ON public.consent_records (subject_type, subject_id);

COMMENT ON TABLE public.consent_records IS
  '개인정보 동의 이력 (GDPR/개인정보보호법 대응). subject = user/lead/visitor 다형.';

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_hash text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_user_id);

COMMENT ON TABLE public.audit_logs IS
  '범용 감사 로그 (사용자/매장 정보 변경, Drop 생성·삭제, 권한 변경). click_audit_logs(클릭)·coupon_audit_logs(쿠폰)와 도메인 분리.';

-- ============================================================
-- Section 8 — RLS 정책
-- ============================================================

-- drop_ctas: 공개 SELECT (받은 사람 화면), 쓰기는 drop owner
ALTER TABLE public.drop_ctas ENABLE ROW LEVEL SECURITY;

CREATE POLICY drop_ctas_public_read ON public.drop_ctas
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY drop_ctas_owner_write ON public.drop_ctas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.info_drops d
                 WHERE d.id = drop_ctas.drop_id AND d.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.info_drops d
                 WHERE d.id = drop_ctas.drop_id AND d.owner_user_id = auth.uid()));

-- product_detections: 공개 SELECT, 쓰기는 drop owner
ALTER TABLE public.product_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_detections_public_read ON public.product_detections
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY product_detections_owner_write ON public.product_detections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.info_drops d
                 WHERE d.id = product_detections.drop_id AND d.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.info_drops d
                 WHERE d.id = product_detections.drop_id AND d.owner_user_id = auth.uid()));

-- product_offers: 공개 SELECT, 쓰기는 detection → drop owner (2-hop)
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_offers_public_read ON public.product_offers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY product_offers_owner_write ON public.product_offers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.product_detections pd
                 JOIN public.info_drops d ON d.id = pd.drop_id
                 WHERE pd.id = product_offers.detection_id AND d.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_detections pd
                 JOIN public.info_drops d ON d.id = pd.drop_id
                 WHERE pd.id = product_offers.detection_id AND d.owner_user_id = auth.uid()));

-- consultation_leads: 무로그인 INSERT, 매장 owner만 SELECT/UPDATE (PII 보호)
ALTER TABLE public.consultation_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultation_leads_anon_insert ON public.consultation_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY consultation_leads_partner_select ON public.consultation_leads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partners p
                 WHERE p.id = consultation_leads.partner_id AND p.owner_user_id = auth.uid()));

CREATE POLICY consultation_leads_partner_update ON public.consultation_leads
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partners p
                 WHERE p.id = consultation_leads.partner_id AND p.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.partners p
                 WHERE p.id = consultation_leads.partner_id AND p.owner_user_id = auth.uid()));

-- visitors: 무로그인 INSERT (방문자 자동 생성), SELECT/UPDATE 는 본인 user 연결 건만
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY visitors_anon_insert ON public.visitors
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY visitors_self_select ON public.visitors
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY visitors_self_update ON public.visitors
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

-- ai_generations: drop owner 만 (anon 불가). drop_id NULL 인 호출은 service_role 전용.
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_generations_owner_read ON public.ai_generations
  FOR SELECT TO authenticated
  USING (drop_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.info_drops d
    WHERE d.id = ai_generations.drop_id AND d.owner_user_id = auth.uid()));

-- consent_records: 무로그인 INSERT (동의 시점 기록), SELECT 는 본인 user subject 만
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY consent_records_anon_insert ON public.consent_records
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY consent_records_self_select ON public.consent_records
  FOR SELECT TO authenticated
  USING (subject_type = 'user' AND subject_id = auth.uid());

-- audit_logs: RLS enable + 정책 0 → anon/authenticated 전면 차단.
--   INSERT 는 service_role(백엔드/트리거)만, 조회 admin UI 는 Phase 2 에서 정책 추가.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 검증 query (적용 후 수동 실행)
-- ============================================================
-- [S1] SELECT purpose, count(*), array_agg(key ORDER BY key)
--        FROM public.intent_types GROUP BY purpose ORDER BY purpose;
--      기대: 정보 4 / 쿠폰 1 / 예약 2 / 구매 1 / 상담 1, NULL 0.
-- [S2] SELECT count(*) FILTER (WHERE purpose IS NULL) AS null_purpose,
--             count(*) AS total FROM public.info_drops;
--      기대: null_purpose 0 / total 25.
-- [S3-7] SELECT table_name FROM information_schema.tables
--          WHERE table_schema='public'
--            AND table_name IN ('drop_ctas','product_detections','product_offers',
--              'consultation_leads','visitors','ai_generations','consent_records','audit_logs');
--        기대: 8행.
-- [S6] SELECT column_name FROM information_schema.columns
--        WHERE table_name='lifecycle_events' AND column_name='visitor_id';
--      기대: 1행.
-- [S8] SELECT tablename, count(*) FROM pg_policies
--        WHERE schemaname='public'
--          AND tablename IN ('drop_ctas','product_detections','product_offers',
--            'consultation_leads','visitors','ai_generations','consent_records','audit_logs')
--        GROUP BY tablename ORDER BY tablename;
--      기대: audit_logs 제외 7테이블 정책 보유, audit_logs 0 (잠금).
-- [한국어] SELECT position('?' in array_to_string(array_agg(purpose::text),''))
--            FROM public.intent_types;  기대: 0 (enum 한국어 깨짐 센티넬).
