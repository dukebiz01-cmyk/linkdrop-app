-- v8.9 — W5c: 모일수록 할인(gb) DB·정산 층 (Duke 승인 명세 + 마감 표식 A안)
--   · 신설 RPC 2종: get_groupbuy_status(공개 조회) / finalize_groupbuy(파트너 마감·소급 확정)
--   · fulfill_preorder v3: gb 드롭은 마감(finalize) 전 이행(fulfill) 차단 — gross 스냅샷 지뢰 방어
--     (trigger_preorder_to_conversion_v1 이 fulfill 시점 NEW.total_krw 로 전환·원장을 발행하고
--      distribute_rewards_safe 는 멱등 EXCEPTION 이라 사후 정정 불가 — W5c 사전 READ 지뢰 #1).
--   · gb 정본 위치 = component_blocks(block_kind='product', ref_drop_id 없음).block_data —
--     v8.8 update_drop p_block_patch 관례 실측 동형(선정 기준·`||` 병합·updated_at 동시 갱신).
--     ※ 명세의 "info_drops.block_data"는 실측상 component_blocks 가 정본이라 동형 관례로 대체(보고 명시).
--   · 마감 표식(A안·additive): block_data.gb_finalized_at / gb_final_price — 미기록 = 미마감.
--   · 전부 DROP IF EXISTS 후 CREATE(CREATE OR REPLACE 금지 — 오버로드 함정 관례) + 말미 REVOKE/GRANT.
--   · 롤백: supabase/rollback/w5c_rollback.sql (fulfill v2 원문 = rollback/fulfill_preorder_v2_original.sql)
--   ⚠️ 이 파일은 초안 — DB 적용은 Duke 승인·실행 절차(scripts/apply-migration.mjs) 별도.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- (a) get_groupbuy_status — 공개 집계 조회(개인정보 반환 0: 수량 합계·마감 표식만)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_groupbuy_status(uuid);

CREATE FUNCTION public.get_groupbuy_status(p_drop_id uuid)
RETURNS TABLE(current_qty int, max_qty int, finalized boolean, final_price int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_bd jsonb;
BEGIN
  -- 메인 product 블록 선정 = v8.8/create_preorder/buildCommerce 동일 기준.
  SELECT cb.block_data INTO v_bd
  FROM public.component_blocks cb
  WHERE cb.info_drop_id = p_drop_id
    AND cb.block_kind = 'product'
    AND cb.block_data->>'ref_drop_id' IS NULL
  LIMIT 1;

  RETURN QUERY
  SELECT
    -- current = 유효 주문 합(취소 제외) — create_preorder 재고검사와 동일 상태 집합.
    COALESCE((SELECT SUM(po.quantity)::int FROM public.preorders po
              WHERE po.drop_id = p_drop_id
                AND po.status IN ('pending','confirmed','fulfilled')), 0),
    -- max = 역대 최대 도달(전 상태 — cancelled 포함): 마개 3 정본("참여 취소가 나와도 이미 내려간
    --   가격은 유지됩니다")의 산정식 — 도달가 판정은 이 값 기준(finalize ④ 동일식).
    COALESCE((SELECT SUM(po.quantity)::int FROM public.preorders po
              WHERE po.drop_id = p_drop_id), 0),
    (v_bd ? 'gb_finalized_at'),
    NULLIF(v_bd->>'gb_final_price', '')::int;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_groupbuy_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_groupbuy_status(uuid) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- (b) finalize_groupbuy — 파트너 마감·소급 확정 (gb 드롭 한정 소급 정산 예외 · 기승인)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.finalize_groupbuy(uuid);

CREATE FUNCTION public.finalize_groupbuy(p_drop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid         uuid := auth.uid();
  v_bd          jsonb;
  v_base        int;
  v_min_qty     int;
  v_max_qty     int;
  v_final_price int;
  v_mode        text;
  v_updated     int := 0;
BEGIN
  -- 오너 검증 — v8.8 update_drop 동형(auth.uid → info_drops 소유).
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.info_drops d
    WHERE d.id = p_drop_id AND d.owner_user_id = v_uid
  ) THEN
    RAISE EXCEPTION '드롭을 찾을 수 없거나 권한이 없습니다';
  END IF;

  -- ① 동시성 — create_preorder 와 동일 락 키(hashtext(drop_id)): 마감 중 신규 주문과 직렬화
  --    (사전 READ 지뢰 #3 방어 — 신규 락 공간 발명 0).
  PERFORM pg_advisory_xact_lock(hashtext(p_drop_id::text));

  SELECT cb.block_data INTO v_bd
  FROM public.component_blocks cb
  WHERE cb.info_drop_id = p_drop_id
    AND cb.block_kind = 'product'
    AND cb.block_data->>'ref_drop_id' IS NULL
  LIMIT 1;

  -- ② 멱등 — 기마감이면 기존 결과 무해 반환(재분배·재소급 없음).
  IF v_bd ? 'gb_finalized_at' THEN
    RETURN jsonb_build_object(
      'already', true,
      'final_price', NULLIF(v_bd->>'gb_final_price', '')::int,
      'updated_count', 0,
      'mode', 'already'
    );
  END IF;

  -- ③ gb 드롭 검증.
  IF v_bd IS NULL OR (v_bd->>'gb_enabled') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION '모일수록 할인이 열려 있지 않은 드롭입니다';
  END IF;

  v_base    := NULLIF(v_bd->>'price_krw', '')::int;
  v_min_qty := COALESCE(NULLIF(v_bd->>'gb_min_qty', '')::int, 0);
  IF v_base IS NULL OR v_base <= 0 THEN
    RAISE EXCEPTION '기본가가 설정되지 않은 상품입니다';
  END IF;

  -- ④ 역대 최대 도달(전 상태 SUM — 마개 3 정본: 취소 미차감)로 최저 도달 단계가 판정.
  SELECT COALESCE(SUM(po.quantity)::int, 0) INTO v_max_qty
  FROM public.preorders po
  WHERE po.drop_id = p_drop_id;

  SELECT MIN(NULLIF(t->>'price', '')::int) INTO v_final_price
  FROM jsonb_array_elements(COALESCE(v_bd->'gb_tiers', '[]'::jsonb)) AS t
  WHERE NULLIF(t->>'qty', '')::int <= v_max_qty;

  IF v_max_qty >= v_min_qty AND v_final_price IS NOT NULL THEN
    v_mode := CASE WHEN v_final_price < v_base THEN 'discount' ELSE 'base' END;
    -- ⑤ 소급 확정 — pending·confirmed 만(기지급 fulfilled·취소 cancelled 제외 — 사전 READ 지뢰 #4).
    --    status 무접촉 = trigger_preorder_to_conversion_v1(UPDATE OF status) 무발화 확정(지뢰 #2 근거).
    IF v_final_price < v_base THEN
      UPDATE public.preorders po
      SET unit_price_krw = v_final_price,
          total_krw      = v_final_price * po.quantity,
          updated_at     = now()
      WHERE po.drop_id = p_drop_id
        AND po.status IN ('pending','confirmed');
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    END IF;
  ELSE
    -- ⑥ 미달 — gb_fail_mode 분기. 'cancel' 의 status='cancelled' 전이는 트리거 WHEN(new='fulfilled')
    --    미충족이라 전환·원장 무발화(무해 — 사전 READ 실측 근거).
    v_final_price := v_base;
    IF (v_bd->>'gb_fail_mode') = 'cancel' THEN
      v_mode := 'cancel';
      UPDATE public.preorders po
      SET status     = 'cancelled',
          updated_at = now()
      WHERE po.drop_id = p_drop_id
        AND po.status IN ('pending','confirmed');
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSE
      v_mode := 'base'; -- 'base'(또는 미지정 폴백) = 가격 무변.
    END IF;
  END IF;

  -- ⑦ 마감 표식(A안 · additive — v8.8 `||` 병합 관례 동형 · 메인 product 블록만).
  UPDATE public.component_blocks cb
  SET block_data = cb.block_data || jsonb_build_object(
        'gb_finalized_at', now(),
        'gb_final_price', v_final_price
      ),
      updated_at = now()
  WHERE cb.info_drop_id = p_drop_id
    AND cb.block_kind = 'product'
    AND cb.block_data->>'ref_drop_id' IS NULL;

  UPDATE public.info_drops SET updated_at = now() WHERE id = p_drop_id;

  RETURN jsonb_build_object(
    'already', false,
    'final_price', v_final_price,
    'updated_count', v_updated,
    'mode', v_mode,
    'max_qty', v_max_qty
  );
END;
$function$;

-- ⑧ 권한 — 파트너 전용(v8.8 관례 동형).
REVOKE ALL ON FUNCTION public.finalize_groupbuy(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_groupbuy(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- (c) fulfill_preorder v3 — 원문(rollback/fulfill_preorder_v2_original.sql) + gb 마감 전 이행 차단 1조건
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fulfill_preorder(uuid);

CREATE FUNCTION public.fulfill_preorder(p_preorder_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE v_owner uuid; v_status text; v_drop_id uuid; v_bd jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요해요.'; END IF;
  -- v3 — drop_id 동반 조회(원문 SELECT 확장 — 그 외 로직 원문 무변).
  SELECT pt.owner_user_id, po.status, po.drop_id INTO v_owner, v_status, v_drop_id
    FROM preorders po JOIN partners pt ON pt.id = po.partner_id
   WHERE po.id = p_preorder_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '주문을 찾을 수 없어요.'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION '권한이 없어요.'; END IF;
  IF v_status <> 'confirmed' THEN RAISE EXCEPTION '확정된 주문만 이행 처리할 수 있어요.'; END IF;
  -- W5c — gb 드롭 = 마감(finalize) 전 이행 차단: fulfill 시점 트리거가 total_krw 를 gross 로
  --   스냅샷하므로(사전 READ 지뢰 #1) 소급 확정 전 이행은 구가격 원장을 남긴다 — 구조적 차단.
  SELECT cb.block_data INTO v_bd
  FROM public.component_blocks cb
  WHERE cb.info_drop_id = v_drop_id
    AND cb.block_kind = 'product'
    AND cb.block_data->>'ref_drop_id' IS NULL
  LIMIT 1;
  IF (v_bd->>'gb_enabled') = 'true' AND NOT (v_bd ? 'gb_finalized_at') THEN
    RAISE EXCEPTION '공동구매는 마감 후에 이행 처리할 수 있어요.';
  END IF;
  UPDATE preorders SET status='fulfilled', fulfilled_at=now(), updated_at=now()
   WHERE id = p_preorder_id;
END;
$function$;

-- 기존 GRANT 수준 복원(확보 시점 실측 = PUBLIC EXECUTE — 조이기는 파킹, W5c 범위 밖).
GRANT EXECUTE ON FUNCTION public.fulfill_preorder(uuid) TO PUBLIC;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- 검증 SELECT 3종 (적용 후 Duke 실행용 — 전부 read-only)
-- ─────────────────────────────────────────────────────────────
-- 1) 함수 존재 확인:
--    SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
--     AND proname IN ('get_groupbuy_status','finalize_groupbuy','fulfill_preorder');
-- 2) GRANT 확인(routine_privileges):
--    SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges
--     WHERE routine_schema='public'
--       AND routine_name IN ('get_groupbuy_status','finalize_groupbuy','fulfill_preorder')
--     ORDER BY routine_name, grantee;
--    -- 기대: get_groupbuy_status = anon+authenticated / finalize_groupbuy = authenticated /
--    --       fulfill_preorder = PUBLIC(현행 복원)
-- 3) (테스트) 상태 조회 호출 예시 — gb 드롭 id 하나로:
--    SELECT * FROM public.get_groupbuy_status('<gb-drop-uuid>');
--    -- 기대: current_qty/max_qty 집계 · finalized=false · final_price=null (마감 전)
