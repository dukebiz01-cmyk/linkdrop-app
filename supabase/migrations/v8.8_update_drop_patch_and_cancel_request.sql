-- v8.8 — ST2b-3 서버 수술 3종 (43창 승인 · READ 판정 기반)
--   (a) update_drop: p_block_patch jsonb 인자 additive — {sale_start, sale_end} 2키
--       화이트리스트만 메인 product 블록(block_data)에 병합, 그 외 키 silent strip.
--       기존 2필드(curator_message/note) 동작 무변경(p_block_patch NULL = 현행 동일).
--       ⚠️ 3-인자 함수에 DEFAULT 인자 추가 = 오버로드 공존 → PostgREST ambiguous 위험
--          → 기존 3-인자 DROP 후 4-인자 재생성(정의 전승 = DB 실측 전문, v7.8 동일).
--       + REVOKE PUBLIC → GRANT authenticated (v7.8 잔존 PUBLIC EXECUTE 봉합).
--   (b) preorders.cancel_requested_at timestamptz NULL — 셀프 취소 "요청 표식"(Duke 락 ⓐ:
--       구매자는 요청만, 실행은 파트너 cancel_preorder). CHECK/status 상태머신 무접촉 —
--       전환 트리거(preorder_to_conversion_after_fulfill: UPDATE OF status·fulfilled 한정)
--       간섭 0 (READ 실증).
--   (c) request_preorder_cancel(p_preorder_id, p_reason DEFAULT NULL) SECURITY DEFINER —
--       catcher 본인 검증 + pending/confirmed 만 + 멱등(이미 요청 = 무해 반환).
--       RLS 판정 근거: preorders UPDATE 정책은 owner 전용이라 구매자 직접 쓰기 불가 → RPC.
--   (d) get_my_preorders / get_partner_preorders 반환에 cancel_requested_at(+my 쪽
--       customer_message) 추가 — RETURNS TABLE 변경은 CREATE OR REPLACE 불가 → DROP 후
--       재생성(본문 = DB 실측 전문 전승, 신규 컬럼만 추가).
--   (e) drop_alerts.drop_id FK → info_drops(id) ON DELETE CASCADE (고아 행 실측 0건 —
--       방어적 선행 정리 포함).
--   금지 확인: CHECK 제약 무접촉 · 트리거 무접촉 · 기존 status 값 무접촉.

-- ─────────────────────────────────────────────────────────────
-- (a) update_drop — 3-인자 DROP → 4-인자 재생성
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.update_drop(uuid, text, text);

CREATE FUNCTION public.update_drop(
  p_share_uuid      uuid,
  p_curator_message text  DEFAULT NULL::text,
  p_curator_note    text  DEFAULT NULL::text,
  p_block_patch     jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_drop_id uuid;
  v_patch   jsonb;
  v_patched boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT se.info_drop_id INTO v_drop_id
  FROM public.share_events se
  JOIN public.info_drops d ON d.id = se.info_drop_id
  WHERE se.share_uuid = p_share_uuid
    AND d.owner_user_id = v_uid;

  IF v_drop_id IS NULL THEN
    RAISE EXCEPTION '드롭을 찾을 수 없거나 권한이 없습니다';
  END IF;

  -- v8.8 (a) — 2키 화이트리스트 병합(그 외 silent strip). 메인 product 블록만
  --   (ref_drop_id 없는 블록 = adapters buildCommerce 소비 지점과 동일 선정 기준).
  IF p_block_patch IS NOT NULL THEN
    v_patch := jsonb_strip_nulls(jsonb_build_object(
      'sale_start', p_block_patch->'sale_start',
      'sale_end',   p_block_patch->'sale_end'
    ));
    IF v_patch <> '{}'::jsonb THEN
      UPDATE public.component_blocks cb
      SET block_data = cb.block_data || v_patch,
          updated_at = now()
      WHERE cb.info_drop_id = v_drop_id
        AND cb.block_kind = 'product'
        AND cb.block_data->>'ref_drop_id' IS NULL;
      v_patched := true;
    END IF;
  END IF;

  IF p_curator_message IS NULL AND p_curator_note IS NULL AND NOT v_patched THEN
    RETURN jsonb_build_object('info_drop_id', v_drop_id, 'updated', false);
  END IF;

  IF p_curator_message IS NOT NULL THEN
    UPDATE public.share_events
    SET curator_message = NULLIF(trim(p_curator_message), '')
    WHERE share_uuid = p_share_uuid
      AND sender_user_id = v_uid;
  END IF;

  IF p_curator_note IS NOT NULL THEN
    UPDATE public.info_drops
    SET curator_note = NULLIF(trim(p_curator_note), ''),
        updated_at   = now()
    WHERE id = v_drop_id
      AND owner_user_id = v_uid;
  END IF;

  IF p_curator_note IS NULL AND (p_curator_message IS NOT NULL OR v_patched) THEN
    UPDATE public.info_drops
    SET updated_at = now()
    WHERE id = v_drop_id
      AND owner_user_id = v_uid;
  END IF;

  RETURN jsonb_build_object('info_drop_id', v_drop_id, 'updated', true, 'patched', v_patched);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_drop(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_drop(uuid, text, text, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- (b) preorders.cancel_requested_at — additive nullable (상태머신 무접촉)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.preorders ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;

-- ─────────────────────────────────────────────────────────────
-- (c) request_preorder_cancel — catcher 요청 표식 전용 RPC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_preorder_cancel(
  p_preorder_id uuid,
  p_reason      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_status text;
  v_req    timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요해요.';
  END IF;

  SELECT po.status, po.cancel_requested_at INTO v_status, v_req
  FROM public.preorders po
  WHERE po.id = p_preorder_id AND po.catcher_user_id = v_uid
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION '주문을 찾을 수 없거나 권한이 없어요.';
  END IF;

  -- 멱등 — 이미 요청됨 = 에러 아닌 무해 반환.
  IF v_req IS NOT NULL THEN
    RETURN jsonb_build_object('requested', true, 'already', true);
  END IF;

  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION '진행 중인 주문만 취소를 요청할 수 있어요.';
  END IF;

  -- status 무접촉(전환 트리거 간섭 0) — 요청 표식 + 사유(선택)만.
  UPDATE public.preorders
  SET cancel_requested_at = now(),
      customer_message    = COALESCE(NULLIF(trim(p_reason), ''), customer_message),
      updated_at          = now()
  WHERE id = p_preorder_id;

  RETURN jsonb_build_object('requested', true, 'already', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_preorder_cancel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_preorder_cancel(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- (d) 조회 RPC 2종 — RETURNS TABLE 확장(DROP 후 재생성 · 본문 전승 + 신규 컬럼)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_my_preorders();

CREATE FUNCTION public.get_my_preorders()
RETURNS TABLE(
  preorder_id uuid, status text, payment_status text, created_at timestamptz,
  product_name text, partner_name text, partner_phone text, harvest_date text,
  quantity integer, unit_price_krw integer, total_krw integer, partner_message text,
  cancel_requested_at timestamptz, customer_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요해요.'; END IF;
  RETURN QUERY
  SELECT
    po.id::uuid,
    po.status::text,
    po.payment_status::text,
    po.created_at::timestamptz,
    COALESCE(
      (SELECT cb.block_data->>'name' FROM component_blocks cb
        WHERE cb.info_drop_id = po.drop_id AND cb.block_kind = 'product'
          AND cb.block_data->>'ref_drop_id' IS NULL
        ORDER BY cb.created_at ASC LIMIT 1),
      '상품')::text,
    COALESCE(pt.display_name, '판매자')::text,
    pt.contact_phone::text,
    po.harvest_date::text,
    po.quantity::integer,
    po.unit_price_krw::integer,
    po.total_krw::integer,
    po.partner_message::text,
    po.cancel_requested_at::timestamptz,
    po.customer_message::text
  FROM preorders po
  LEFT JOIN partners pt ON pt.id = po.partner_id
  WHERE po.catcher_user_id = auth.uid()
  ORDER BY po.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_preorders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_preorders() TO authenticated;

DROP FUNCTION IF EXISTS public.get_partner_preorders(uuid);

CREATE FUNCTION public.get_partner_preorders(p_partner_id uuid)
RETURNS TABLE(
  preorder_id uuid, status text, payment_status text, created_at timestamptz,
  product_name text, harvest_date text, quantity integer, unit_price_krw integer,
  total_krw integer, customer_name text, customer_message text,
  cancel_requested_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요해요.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM partners pt WHERE pt.id = p_partner_id AND pt.owner_user_id = auth.uid()) THEN
    RAISE EXCEPTION '권한이 없어요.'; END IF;
  RETURN QUERY
  SELECT
    po.id::uuid, po.status::text, po.payment_status::text, po.created_at::timestamptz,
    COALESCE(
      (SELECT cb.block_data->>'name' FROM component_blocks cb
        WHERE cb.info_drop_id = po.drop_id AND cb.block_kind = 'product'
          AND cb.block_data->>'ref_drop_id' IS NULL
        ORDER BY cb.created_at ASC LIMIT 1),
      '상품')::text,
    po.harvest_date::text, po.quantity::integer, po.unit_price_krw::integer, po.total_krw::integer,
    COALESCE(pr.display_name, pr.username, '익명')::text,
    po.customer_message::text,
    po.cancel_requested_at::timestamptz
  FROM preorders po
  LEFT JOIN profiles pr ON pr.id = po.catcher_user_id
  WHERE po.partner_id = p_partner_id
  ORDER BY po.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_partner_preorders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_preorders(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- (e) drop_alerts.drop_id FK 봉합 — 방어적 고아 정리(실측 0건) + CASCADE
-- ─────────────────────────────────────────────────────────────
DELETE FROM public.drop_alerts da
WHERE NOT EXISTS (SELECT 1 FROM public.info_drops d WHERE d.id = da.drop_id);

ALTER TABLE public.drop_alerts
  ADD CONSTRAINT drop_alerts_drop_id_fkey
  FOREIGN KEY (drop_id) REFERENCES public.info_drops(id) ON DELETE CASCADE;

-- ═════════════════════════════════════════════════════════════
-- 롤백 SQL 전문 (필요 시 그대로 실행)
-- ═════════════════════════════════════════════════════════════
-- ALTER TABLE public.drop_alerts DROP CONSTRAINT IF EXISTS drop_alerts_drop_id_fkey;
-- DROP FUNCTION IF EXISTS public.request_preorder_cancel(uuid, text);
-- ALTER TABLE public.preorders DROP COLUMN IF EXISTS cancel_requested_at;
--   -- (컬럼 DROP 전 조회 RPC 2종을 먼저 이전 정의로 복원할 것 — 아래)
-- DROP FUNCTION IF EXISTS public.update_drop(uuid, text, text, jsonb);
-- DROP FUNCTION IF EXISTS public.get_my_preorders();
-- DROP FUNCTION IF EXISTS public.get_partner_preorders(uuid);
--   -- 이후 v7.8_update_drop_v1_light_text.sql 의 update_drop(uuid,text,text) 원문과
--   -- 본 파일 (d) 절 본문에서 신규 2컬럼(cancel_requested_at·my쪽 customer_message)을
--   -- 제거한 정의(= DB 실측 전승 원문)로 재생성 + 각 GRANT EXECUTE TO authenticated 재부여.
