-- ============================================================================
-- 3A-1 스냅샷 (2026-07-05) — preorders Droppy rate 구매 스냅샷
-- ⚠️ migrations 아님 — 재적용 금지. 이미 linked 프로젝트(xukxtzjfqfwalqpmfidb)에
--    supabase db query --linked 로 적용 완료된 상태의 기록 박제본.
--
-- 내용:
--   [A] preorders 확장 3컬럼 (dropy_rate_snapshot / dropy_fixed_snapshot 예약 / discount_krw 예약)
--   [B] create_preorder — 생성 시점 dropy_rate 박제(가격 박제 unit_price_krw 선례와 대칭).
--       분배 0·기록만. reward_ledger·distribute_rewards_safe·conversion_events 무접촉.
--
-- 변경 전 create_preorder md5: e7637a9414213273ff905b5ae11f5dd6
-- 변경 후 create_preorder md5: a22b2576426ec22fd98a1ecb408ed089
--
-- GRANT 실측 (사전 == 사후, diff 0 — CREATE OR REPLACE 로 보존 확인):
--   PUBLIC / anon / authenticated / postgres / service_role : EXECUTE
--
-- 사후 검증 (2026-07-05):
--   - 신규 3컬럼 존재(numeric/integer/integer) 확인.
--   - 함수 내 한글 메시지 무손상(position('로그인이 필요합니다') > 0 = true).
--   - preorders 기존 행 0건 → 신규 컬럼 NOT NULL 행 0(전부 NULL 시맨틱 충족).
--   - dropy_rate 보유 드롭(실주문 테스트용):
--       83de8a6c-0522-499f-9642-3221eef7e786 (rate 0.10)
--       11c9e6cb-035b-42e7-94b7-cb74974f81cc (rate 0.08)
-- ============================================================================

-- [A] 확장 컬럼 (멱등 가드)
ALTER TABLE public.preorders
  ADD COLUMN IF NOT EXISTS dropy_rate_snapshot numeric NULL,
  ADD COLUMN IF NOT EXISTS dropy_fixed_snapshot integer NULL,
  ADD COLUMN IF NOT EXISTS discount_krw integer NULL;

COMMENT ON COLUMN public.preorders.dropy_rate_snapshot IS '3-A: 주문 생성 시점 dropy_rate 박제(product jsonb, 0~0.20). 분배는 Phase 3.';
COMMENT ON COLUMN public.preorders.dropy_fixed_snapshot IS '3-A: DR-2 고정 Droppy 모드 예약 슬롯 — 현재 항상 NULL.';
COMMENT ON COLUMN public.preorders.discount_krw IS '3-A: ORD-1 쿠폰 즉시할인 예약 슬롯 — 현재 항상 NULL. 보상 풀 기준=할인 후 실결제액 대비.';

-- [B] 변경 후 create_preorder 실정의 (pg_get_functiondef 결과 그대로)
CREATE OR REPLACE FUNCTION public.create_preorder(p_drop_id uuid, p_quantity integer, p_share_uuid text DEFAULT NULL::text, p_visitor_id uuid DEFAULT NULL::uuid, p_customer_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_partner_id uuid; v_block jsonb;
  v_unit_price integer; v_stock_limit integer; v_harvest date;
  v_share_event_id uuid; v_ordered integer; v_existing_id uuid;
  v_total integer; v_id uuid;
  v_dropy_rate numeric; -- 3A-1: 생성 시점 Droppy rate 스냅샷
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION '수량은 1개 이상이어야 합니다'; END IF;
  SELECT partner_id INTO v_partner_id FROM public.info_drops WHERE id = p_drop_id;
  IF v_partner_id IS NULL THEN RAISE EXCEPTION 'Drop has no partner'; END IF;
  SELECT block_data INTO v_block
  FROM public.component_blocks
  WHERE info_drop_id = p_drop_id AND block_kind = 'product'
    AND (block_data ->> 'ref_drop_id') IS NULL
  ORDER BY created_at ASC LIMIT 1;
  IF v_block IS NULL THEN RAISE EXCEPTION '상품 정보를 찾을 수 없습니다'; END IF;
  v_unit_price  := NULLIF(v_block ->> 'price_krw', '')::integer;
  v_stock_limit := NULLIF(v_block ->> 'stock_limit', '')::integer;
  v_harvest     := NULLIF(v_block ->> 'harvest_date', '')::date;
  -- 3A-1: 주문 생성 시점 dropy_rate 박제(가격 박제 unit_price_krw 와 대칭).
  --   유효 범위(0~0.20) 밖 = NULL 처리(오염값 방어 — 스냅샷은 유효 범위만).
  v_dropy_rate  := NULLIF(v_block ->> 'dropy_rate', '')::numeric;
  IF v_dropy_rate IS NOT NULL AND (v_dropy_rate < 0 OR v_dropy_rate > 0.20) THEN
    v_dropy_rate := NULL;
  END IF;
  IF v_unit_price IS NULL THEN RAISE EXCEPTION '가격이 설정되지 않은 상품입니다'; END IF;
  IF p_share_uuid IS NOT NULL THEN
    SELECT id INTO v_share_event_id FROM public.share_events
    WHERE share_uuid::text = p_share_uuid;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_drop_id::text));
  SELECT id INTO v_existing_id FROM public.preorders
  WHERE drop_id = p_drop_id AND catcher_user_id = v_uid AND quantity = p_quantity
    AND status <> 'cancelled' AND created_at > now() - interval '120 seconds'
  ORDER BY created_at DESC LIMIT 1;
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
  IF v_stock_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_ordered FROM public.preorders
    WHERE drop_id = p_drop_id AND status IN ('pending','confirmed','fulfilled');
    IF v_ordered + p_quantity > v_stock_limit THEN
      RAISE EXCEPTION '한정 수량이 마감되었습니다 (남은 수량: %)', GREATEST(v_stock_limit - v_ordered, 0);
    END IF;
  END IF;
  v_total := v_unit_price * p_quantity;
  INSERT INTO public.preorders (
    drop_id, partner_id, share_event_id, visitor_id, catcher_user_id,
    unit_price_krw, quantity, total_krw, harvest_date,
    status, payment_status, customer_message,
    dropy_rate_snapshot
  ) VALUES (
    p_drop_id, v_partner_id, v_share_event_id, p_visitor_id, v_uid,
    v_unit_price, p_quantity, v_total, v_harvest,
    'pending', 'unpaid', p_customer_message,
    v_dropy_rate
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $function$
;
