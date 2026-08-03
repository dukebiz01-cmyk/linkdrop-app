-- fulfill_preorder v2 원문 백업 (W5c 착수 전 확보 — v7.12 rollback 동봉 관례 승계)
--   확보일: 2026-08-03 (라이브 pg_get_functiondef 읽기 전용 조회)
--   GRANT 현황(확보 시점): PUBLIC:EXECUTE — v3 교체 시 동일 수준 복원(조이기는 파킹, W5c 범위 밖).
--   용도: w5c_rollback.sql 이 이 원문을 재적용한다. 이 파일 자체는 실행용 원문 사본.

CREATE OR REPLACE FUNCTION public.fulfill_preorder(p_preorder_id uuid)
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
