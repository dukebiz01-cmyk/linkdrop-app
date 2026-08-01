-- F6-4 S2 롤백 자산 — create_preorder v1 원문 (2026-08-02 pg_get_functiondef 실측 그대로).
-- 복원 절차: DROP FUNCTION public.create_preorder(uuid,integer,text,uuid,text,text,text,text,text);
--            아래 원문 실행 → GRANT EXECUTE ... TO authenticated 재부여.
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
    dropy_rate_snapshot, dropy_fixed_snapshot
  ) VALUES (
    p_drop_id, v_partner_id, v_share_event_id, p_visitor_id, v_uid,
    v_unit_price, p_quantity, v_total, v_harvest,
    'pending', 'unpaid', p_customer_message,
    v_dropy_rate, v_dropy_fixed
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $function$
