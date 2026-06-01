-- v6.2 — get_partner_results(p_partner_id, p_range_days) RETURNS jsonb
--
-- 매장 전체 카드를 묶은 순수 지표 + 전환율. get_drop_results 패턴 (DEFINER +
-- search_path 명시 + jsonb 반환) 그대로 + 매장 N드롭 합산 + owner 검증.
--
-- 컬럼명 조정 (사전검증 + Duke 승인):
--   • v_unique: click_audit_logs.info_drop_id 컬럼 없음 → share_event_id IN
--     (SELECT id FROM share_events WHERE info_drop_id = ANY(...)) 경유 (get_drop_results
--     hour_buckets/unique_visitors_estimate 블록과 동일 패턴).
--   • drop_share_edges.info_drop_id 존재 확인 → 스펙 그대로.

CREATE OR REPLACE FUNCTION public.get_partner_results(
  p_partner_id uuid,
  p_range_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_owner uuid;
  v_since timestamptz := now() - (p_range_days || ' days')::interval;
  v_drop_ids uuid[];
  v_clicks int;
  v_unique int;
  v_shares int;
  v_reshares int;
  v_phone int;
  v_naver_handoff int;
  v_internal_resv_click int;
  v_resv_confirmed int;
  v_coupon_claimed int;
  v_coupon_redeemed int;
  v_settlements int;
  v_result jsonb;
BEGIN
  -- owner 검증 (DEFINER → RLS 우회 → 직접 검증 필수).
  SELECT owner_user_id INTO v_owner FROM public.partners WHERE id = p_partner_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED_FOR_PARTNER';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_drop_ids
  FROM public.info_drops WHERE partner_id = p_partner_id;

  -- 조회수 = share_events.click_count 합산
  SELECT COALESCE(sum(se.click_count), 0) INTO v_clicks
  FROM public.share_events se
  WHERE se.info_drop_id = ANY(v_drop_ids)
    AND se.created_at >= v_since;

  -- 고유 방문자 = click_audit_logs.ip_hash DISTINCT (share_event_id 경유)
  SELECT COUNT(DISTINCT cal.ip_hash) INTO v_unique
  FROM public.click_audit_logs cal
  WHERE cal.share_event_id IN (
    SELECT se.id FROM public.share_events se WHERE se.info_drop_id = ANY(v_drop_ids)
  )
    AND cal.created_at >= v_since
    AND cal.ip_hash IS NOT NULL;

  -- lifecycle_events 분포
  SELECT
    COUNT(*) FILTER (WHERE le.event_type = 'share_click'),
    COUNT(*) FILTER (WHERE le.event_type = 'phone_click'),
    COUNT(*) FILTER (WHERE le.event_type IN ('naver_booking_click','naver_booking_returned')),
    COUNT(*) FILTER (WHERE le.event_type = 'reservation_click')
  INTO v_shares, v_phone, v_naver_handoff, v_internal_resv_click
  FROM public.lifecycle_events le
  WHERE le.info_drop_id = ANY(v_drop_ids)
    AND le.created_at >= v_since;

  -- 재공유 체인 = drop_share_edges (info_drop_id 컬럼 존재 확인됨)
  SELECT COUNT(*) INTO v_reshares
  FROM public.drop_share_edges dse
  WHERE dse.info_drop_id = ANY(v_drop_ids)
    AND dse.created_at >= v_since;

  -- 예약 확정 (직접 정산)
  SELECT COUNT(*) INTO v_resv_confirmed
  FROM public.reservations r
  WHERE r.partner_id = p_partner_id
    AND r.status = 'confirmed'
    AND r.created_at >= v_since;

  -- 쿠폰 발급 (이 매장 쿠폰의 claims)
  SELECT COUNT(*) INTO v_coupon_claimed
  FROM public.coupon_claims cc
  JOIN public.coupons c ON c.id = cc.coupon_id
  WHERE c.partner_id = p_partner_id
    AND cc.issued_at >= v_since;

  -- 쿠폰 사용 (coupon_redemptions.partner_id 직접)
  SELECT COUNT(*) INTO v_coupon_redeemed
  FROM public.coupon_redemptions cr
  WHERE cr.partner_id = p_partner_id
    AND cr.redeemed_at >= v_since;

  -- 정산 건수
  SELECT COUNT(*) INTO v_settlements
  FROM public.conversion_events ce
  WHERE ce.info_drop_id = ANY(v_drop_ids)
    AND ce.occurred_at >= v_since
    AND ce.is_settled = true;

  v_result := jsonb_build_object(
    'partner_id', p_partner_id,
    'range_days', p_range_days,
    'drop_count', COALESCE(array_length(v_drop_ids, 1), 0),
    'metrics', jsonb_build_object(
      'clicks', v_clicks,
      'unique_visitors', v_unique,
      'shares', v_shares,
      'reshares', v_reshares,
      'phone_clicks', v_phone,
      'naver_handoff', v_naver_handoff,
      'internal_reservation_clicks', v_internal_resv_click,
      'reservations_confirmed', v_resv_confirmed,
      'coupon_claimed', v_coupon_claimed,
      'coupon_redeemed', v_coupon_redeemed,
      'settlements', v_settlements
    ),
    'conversion_rates', jsonb_build_object(
      'click_to_reservation_click',
        ROUND( (v_internal_resv_click::numeric / NULLIF(v_clicks,0)) * 100, 1),
      'claim_to_redeem',
        ROUND( (v_coupon_redeemed::numeric / NULLIF(v_coupon_claimed,0)) * 100, 1),
      'naver_handoff_return_rate', NULL
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_results(uuid, int) TO authenticated;
