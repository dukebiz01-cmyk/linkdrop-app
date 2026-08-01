-- v7.12 — F6-4 S2: create_preorder v2 (배송지 4인자·배송형 게이트 — 하위호환 확장)
--
-- 사전 검증 (실 DB 2026-08-02):
--   • v1 원문 보관 = supabase/rollback/create_preorder_v1_original.sql (복원 절차 동봉).
--   • 인자 "추가"는 CREATE OR REPLACE 로는 신규 오버로드가 되어 v1 이 잔존(PostgREST
--     rpc 호출 모호 300 함정) → DROP 후 CREATE (v7.1 관례 동형).
--   • 신규 CREATE 라 GRANT 자동 승계 없음 — 말미 명시(교체 후 재확인 함정 락).
--   • 트리거(preorder_to_conversion_after_fulfill)·status 전이 의미 무접촉.
--
-- 배송형 판정(근거 실측): 스튜디오 COURIERS(CardStudioPage49:429) = 택배사 5종 + "직접 전달".
--   ship_method = '직접 전달' = 픽업·직접배달형 → 게이트 면제(F5-8 축 존중).
--   그 외(택배사 또는 미지정 — 현행 등록 폼은 택배 전제) = 배송형 → 수취인 3필드 필수.
--
-- 변경 요지 (v1 대비):
--   1) 인자 4개 추가: p_receiver_name·p_receiver_phone·p_shipping_address·
--      p_shipping_address_detail (전부 DEFAULT NULL — 기존 5인자 호출 하위호환).
--   2) 배송형 게이트 1블록 삽입(상품 블록 판독 직후).
--   3) INSERT 에 4컬럼 동봉(NULLIF(trim) 정규화).
--   그 외 로직(auth 강제·advisory lock·120초 중복 흡수·재고 합산·스냅샷) 원문 그대로.
--
-- ROLLBACK (수동):
--   DROP FUNCTION IF EXISTS public.create_preorder(uuid,integer,text,uuid,text,text,text,text,text);
--   → supabase/rollback/create_preorder_v1_original.sql 실행
--   → GRANT EXECUTE ON FUNCTION public.create_preorder(uuid,integer,text,uuid,text) TO authenticated;
--   (배송지 컬럼은 v7.11 — 잔존 무해)

BEGIN;

DROP FUNCTION IF EXISTS public.create_preorder(uuid, integer, text, uuid, text);

CREATE FUNCTION public.create_preorder(
  p_drop_id uuid,
  p_quantity integer,
  p_share_uuid text DEFAULT NULL::text,
  p_visitor_id uuid DEFAULT NULL::uuid,
  p_customer_message text DEFAULT NULL::text,
  p_receiver_name text DEFAULT NULL::text,
  p_receiver_phone text DEFAULT NULL::text,
  p_shipping_address text DEFAULT NULL::text,
  p_shipping_address_detail text DEFAULT NULL::text
)
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
  v_dropy_fixed integer; -- DR2-ⓐ: 생성 시점 dropy_fixed 스냅샷
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
  -- F6-4 S2 — 배송형 게이트: '직접 전달'(픽업·직접배달)만 면제, 그 외 = 수취인 3필드 필수.
  IF COALESCE(v_block ->> 'ship_method', '') <> '직접 전달' THEN
    IF COALESCE(trim(p_receiver_name), '') = ''
       OR COALESCE(trim(p_receiver_phone), '') = ''
       OR COALESCE(trim(p_shipping_address), '') = '' THEN
      RAISE EXCEPTION '배송 정보(받는 분·연락처·주소)를 입력해 주세요';
    END IF;
  END IF;
  v_unit_price  := NULLIF(v_block ->> 'price_krw', '')::integer;
  v_stock_limit := NULLIF(v_block ->> 'stock_limit', '')::integer;
  v_harvest     := NULLIF(v_block ->> 'harvest_date', '')::date;
  -- 3A-1: 주문 생성 시점 dropy_rate 박제(가격 박제 unit_price_krw 와 대칭).
  --   유효 범위(0~0.20) 밖 = NULL 처리(오염값 방어 — 스냅샷은 유효 범위만).
  v_dropy_rate  := NULLIF(v_block ->> 'dropy_rate', '')::numeric;
  IF v_dropy_rate IS NOT NULL AND (v_dropy_rate < 0 OR v_dropy_rate > 0.20) THEN
    v_dropy_rate := NULL;
  END IF;
  -- DR2-ⓐ: dropy_fixed 도 각자 박제(우선 판정은 소비 측 몫, 스냅샷은 사실 박제).
  --   유효 = 정수 AND >0 AND ≤ v_unit_price(가격 있으면) — 정본 우선규칙과 동일 가드.
  --   정규식 파싱(^[0-9]{1,9}$): 비정수 오염값이 주문 생성을 예외로 죽이지 않게 NULL 흡수.
  v_dropy_fixed := CASE WHEN (v_block ->> 'dropy_fixed') ~ '^[0-9]{1,9}$'
                        THEN (v_block ->> 'dropy_fixed')::integer END;
  IF v_dropy_fixed IS NOT NULL
     AND (v_dropy_fixed <= 0 OR (v_unit_price IS NOT NULL AND v_dropy_fixed > v_unit_price)) THEN
    v_dropy_fixed := NULL;
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
    dropy_rate_snapshot, dropy_fixed_snapshot,
    receiver_name, receiver_phone, shipping_address, shipping_address_detail
  ) VALUES (
    p_drop_id, v_partner_id, v_share_event_id, p_visitor_id, v_uid,
    v_unit_price, p_quantity, v_total, v_harvest,
    'pending', 'unpaid', p_customer_message,
    v_dropy_rate, v_dropy_fixed,
    NULLIF(trim(p_receiver_name), ''), NULLIF(trim(p_receiver_phone), ''),
    NULLIF(trim(p_shipping_address), ''), NULLIF(trim(p_shipping_address_detail), '')
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;

-- ⚠️ DROP 후 신규 CREATE 라 grant 자동 승계 없음 — 명시 필수(교체 후 재확인 함정).
GRANT EXECUTE ON FUNCTION
  public.create_preorder(uuid, integer, text, uuid, text, text, text, text, text)
  TO authenticated;

COMMIT;
