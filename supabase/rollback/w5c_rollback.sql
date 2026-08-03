-- W5c 롤백 — v8.9_w5c_groupbuy.sql 역순 원복
--   ① 신설 RPC 2종 DROP ② fulfill_preorder v3 DROP 후 v2 원문 재적용
--     (원문 = rollback/fulfill_preorder_v2_original.sql — 아래에 동일 내용 인라인)
--   ③ GRANT 원복(확보 시점 실측: fulfill_preorder = PUBLIC EXECUTE)
--   ※ block_data 의 gb_finalized_at/gb_final_price 표식과 소급 UPDATE 된 preorders 금액은
--     데이터라 함수 롤백으로 원복되지 않음 — 필요 시 별도 데이터 정정(Duke 판정 사안).

BEGIN;

-- ① 신설 RPC 제거
DROP FUNCTION IF EXISTS public.get_groupbuy_status(uuid);
DROP FUNCTION IF EXISTS public.finalize_groupbuy(uuid);

-- ② fulfill_preorder v3 → v2 원문 재적용
DROP FUNCTION IF EXISTS public.fulfill_preorder(uuid);

CREATE FUNCTION public.fulfill_preorder(p_preorder_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE v_owner uuid; v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요해요.'; END IF;
  SELECT pt.owner_user_id, po.status INTO v_owner, v_status
    FROM preorders po JOIN partners pt ON pt.id = po.partner_id
   WHERE po.id = p_preorder_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '주문을 찾을 수 없어요.'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION '권한이 없어요.'; END IF;
  IF v_status <> 'confirmed' THEN RAISE EXCEPTION '확정된 주문만 이행 처리할 수 있어요.'; END IF;
  UPDATE preorders SET status='fulfilled', fulfilled_at=now(), updated_at=now()
   WHERE id = p_preorder_id;
END;
$function$;

-- ③ GRANT 원복(v2 확보 시점 현행 = PUBLIC EXECUTE)
GRANT EXECUTE ON FUNCTION public.fulfill_preorder(uuid) TO PUBLIC;

COMMIT;

-- 검증: SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
--        AND proname IN ('get_groupbuy_status','finalize_groupbuy');  -- 기대: 0행
