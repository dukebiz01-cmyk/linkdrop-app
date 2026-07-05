-- ============================================================================
-- DB 스냅샷 (migrations 아님 — 기록용. supabase/migrations/ 에 넣지 말 것)
-- 2026-07-05 DR2-ⓐ: dropy_fixed(고정 Droppy) 소비 배선 — 피드 RPC·주문 스냅샷
-- ============================================================================
-- 적용 경로: scripts/apply-migration.mjs dr2a_dropy_fixed_consumers
--
-- 우선 규칙(3곳 공통 정본, 상세 adapters ⓑ는 별도):
--   fixed 유효 = 정수 AND > 0 AND ≤ price_krw(가격 있으면) → reward = fixed
--   무효/부재 → 기존 rate 경로(0 < rate ≤ 0.20 × price, price > 0)
--   둘 다 무효 → 미반환(피드) / NULL(스냅샷)
--   구현 노트: "정수" 판정은 ^[0-9]{1,9}$ 정규식 가드로 구현(스펙의 ::integer 직캐스트는
--   jsonb 오염값에서 피드 RPC 전체·주문 생성이 캐스트 예외로 죽는 경로라 NULL 흡수로 대체.
--   {1,9} 상한 = int4 오버플로 방어).
--
-- md5(pg_get_functiondef) 기록:
--   get_feed_dropy_reward 변경 전: 2a9892f78687079534ef8adf366a1ad7
--   get_feed_dropy_reward 변경 후: b456e9269ea2c725a18b570907cea124
--   create_preorder       변경 전: a22b2576426ec22fd98a1ecb408ed089
--   create_preorder       변경 후: ecf5509da401070593328ea7ae890464
--
-- 변경 요약:
--   get_feed_dropy_reward — LATERAL에 dropy_fixed 파싱 추가, reward 산출을
--     fixed-우선 CASE로 교체. 기존 필터(published·is_public·배열 상한 50·
--     primary product 판별) 무변경. rate 경로 산식 floor(rate×price) 동일.
--   create_preorder — v_dropy_fixed 파싱+유효 가드(>0 AND ≤ v_unit_price) 후
--     INSERT에 dropy_fixed_snapshot(3A-1 예약 컬럼, integer) 기록.
--     dropy_rate_snapshot 로직 1글자 무변경 — 둘 다 각자 박제(우선 판정은 소비 측 몫).
--     시그니처·그 외 로직 무변경.
--
-- 사후 검증 (2026-07-05):
--   GRANT 전후 diff 0:
--     get_feed_dropy_reward: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--     create_preorder:       {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--   SECURITY DEFINER / search_path 유지. 한글 무결성 OK(mojibake 없음).
--   회귀: dropy_fixed 없는 기존 드롭 83de8a6c-0522-499f-9642-3221eef7e786 실호출 →
--     dropy_reward = 3200 유지(rate 0.1 × 32,000, 변경 전 인라인 실측과 동일. 회귀 0).
--   fixed 경로는 ⓑ 폼 저장 후 실증(가상 호출 불가 — DB에 dropy_fixed 보유 드롭 아직 없음,
--     테스트값 임시 주입 안 함).
-- ============================================================================
-- 아래는 변경 후 실정의 (pg_get_functiondef 재확보본)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_feed_dropy_reward(p_drop_ids uuid[])
 RETURNS TABLE(info_drop_id uuid, dropy_reward integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  -- 표시용 계산만(분배 0): 1개 구매 기준 풀 총액.
  -- DR2-ⓐ 우선 규칙(정본): dropy_fixed 유효(정수 AND >0 AND ≤price_krw(가격 있으면)) → reward = fixed.
  --   무효/부재 → 기존 rate 경로 floor(dropy_rate * price_krw) (0<rate<=0.20, price>0).
  --   둘 다 무효 → 행 제외(미주입=미렌더 관례).
  --   fixed 파싱 = ^[0-9]{1,9}$ 정규식 가드(비정수·과대값 → 무효, 캐스트 예외 0).
  -- primary product 블록 판별 = create_preorder 동일(ref_drop_id 없는 것, created_at ASC LIMIT 1).
  -- 배열 상한 50(과대 배열 방어). 비공개/미게시 드롭 미반환(P7c 정합).
  SELECT d.id AS info_drop_id, r.reward AS dropy_reward
  FROM public.info_drops d
  CROSS JOIN LATERAL (
    SELECT NULLIF(b.block_data->>'dropy_rate','')::numeric AS rate,
           NULLIF(b.block_data->>'price_krw','')::integer  AS price,
           CASE WHEN (b.block_data->>'dropy_fixed') ~ '^[0-9]{1,9}$'
                THEN (b.block_data->>'dropy_fixed')::integer END AS fixed_parsed
    FROM public.component_blocks b
    WHERE b.info_drop_id = d.id
      AND b.block_kind = 'product'
      AND (b.block_data->>'ref_drop_id') IS NULL
    ORDER BY b.created_at ASC
    LIMIT 1
  ) p
  CROSS JOIN LATERAL (
    SELECT CASE
             WHEN p.fixed_parsed IS NOT NULL AND p.fixed_parsed > 0
                  AND (p.price IS NULL OR p.fixed_parsed <= p.price)
               THEN p.fixed_parsed
             WHEN p.rate IS NOT NULL AND p.rate > 0 AND p.rate <= 0.20
                  AND p.price IS NOT NULL AND p.price > 0
               THEN floor(p.rate * p.price)::int
           END AS reward
  ) r
  WHERE d.id IN (SELECT t.u FROM unnest(p_drop_ids) WITH ORDINALITY AS t(u, ord) WHERE t.ord <= 50)
    AND d.status = 'published'
    AND d.is_public = true
    AND r.reward IS NOT NULL;
$function$;

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
END; $function$;
