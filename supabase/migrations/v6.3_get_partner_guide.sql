-- v6.3 — get_partner_guide(p_partner_id, p_range_days, p_save) RETURNS jsonb
--
-- 규칙 엔진(engine='rule')이 깊이 4축으로 진단. AI 레이어가 나중에 engine='ai' 로
-- 교체할 자리. 호출 시 guide_history 스냅샷 + 직전 이력과 before/after 비교(A-1).
--
-- 숫자는 get_partner_results 재사용 (단일 진실원천).

CREATE OR REPLACE FUNCTION public.get_partner_guide(
  p_partner_id uuid,
  p_range_days int DEFAULT 30,
  p_save boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_owner uuid;
  v_results jsonb;
  v_m jsonb;
  v_diagnosis jsonb := '[]'::jsonb;
  v_prescriptions jsonb := '[]'::jsonb;
  v_strengths jsonb := '[]'::jsonb;
  v_prev public.guide_history%ROWTYPE;
  v_comparison jsonb := 'null'::jsonb;
  v_clicks int; v_shares int; v_reshares int;
  v_resv_click int; v_confirmed int;
  v_claimed int; v_redeemed int; v_unique int;
  v_naver int; v_settlements int;
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.partners WHERE id = p_partner_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED_FOR_PARTNER';
  END IF;

  v_results := public.get_partner_results(p_partner_id, p_range_days);
  v_m := v_results->'metrics';

  v_clicks      := COALESCE((v_m->>'clicks')::int, 0);
  v_shares      := COALESCE((v_m->>'shares')::int, 0);
  v_reshares    := COALESCE((v_m->>'reshares')::int, 0);
  v_resv_click  := COALESCE((v_m->>'internal_reservation_clicks')::int, 0);
  v_confirmed   := COALESCE((v_m->>'reservations_confirmed')::int, 0);
  v_claimed     := COALESCE((v_m->>'coupon_claimed')::int, 0);
  v_redeemed    := COALESCE((v_m->>'coupon_redeemed')::int, 0);
  v_unique      := COALESCE((v_m->>'unique_visitors')::int, 0);
  v_naver       := COALESCE((v_m->>'naver_handoff')::int, 0);
  v_settlements := COALESCE((v_m->>'settlements')::int, 0);

  -- ============ 규칙 엔진 (12 시나리오) ============

  -- S8: 데이터 없음 graceful
  IF v_clicks=0 AND v_shares=0 AND v_claimed=0 AND v_confirmed=0 THEN
    v_diagnosis := jsonb_build_array(jsonb_build_object(
      'axis','data', 'severity','info',
      'title','아직 데이터가 모이는 중이에요',
      'detail','카드를 공유하면 조회·예약·쿠폰 성과가 쌓입니다.'
    ));
    v_prescriptions := jsonb_build_array(jsonb_build_object(
      'priority',1,
      'action','카드를 단골방·지인에게 공유해 첫 데이터를 모아보세요',
      'expected', null
    ));
  ELSE
    -- S1 쿠폰 사용률↓
    IF v_claimed > 0 AND (v_redeemed::numeric / v_claimed) < 0.5 THEN
      v_diagnosis := v_diagnosis || jsonb_build_array(jsonb_build_object(
        'axis','conversion', 'severity','high',
        'title', format('쿠폰을 %s명이 받았는데 %s명만 썼어요 (%s%%)',
                  v_claimed, v_redeemed,
                  ROUND((v_redeemed::numeric/v_claimed)*100)),
        'detail','받은 쿠폰을 잊은 분이 많아요.'
      ));
      v_prescriptions := v_prescriptions || jsonb_build_array(jsonb_build_object(
        'priority', (v_claimed - v_redeemed),
        'action','① 사용 기한을 7일로 줄여보세요 ② 발급 다음 날 ''쿠폰 잊지 마세요'' 카톡을 보내보세요',
        'expected','사용률이 오를 여지가 있어요'
      ));
    END IF;

    -- S2 조회↑ 예약클릭↓
    IF v_clicks > 30 AND (v_resv_click::numeric / NULLIF(v_clicks,0)) < 0.1 THEN
      v_diagnosis := v_diagnosis || jsonb_build_array(jsonb_build_object(
        'axis','action', 'severity','medium',
        'title','카드를 본 사람이 예약으로 덜 이어지고 있어요',
        'detail', format('조회 %s회 중 예약 클릭 %s회', v_clicks, v_resv_click)
      ));
      v_prescriptions := v_prescriptions || jsonb_build_array(jsonb_build_object(
        'priority', GREATEST((v_clicks/10 - v_resv_click), 0),
        'action','① 예약 버튼을 더 눈에 띄게 ② ''이번 주말 한정'' 같은 긴급성을 더해보세요',
        'expected','예약 클릭이 늘 여지가 있어요'
      ));
    END IF;

    -- S3 네이버 핸드오프 발생
    IF v_naver > 0 THEN
      v_diagnosis := v_diagnosis || jsonb_build_array(jsonb_build_object(
        'axis','handoff', 'severity','low',
        'title','네이버 예약으로 넘어간 분들이 있어요',
        'detail', format('네이버 예약 클릭 %s회 (확정은 네이버에서 별도 집계)', v_naver)
      ));
      v_prescriptions := v_prescriptions || jsonb_build_array(jsonb_build_object(
        'priority', 1,
        'action','카드에 ''전화 문의''도 함께 노출해 이탈을 줄여보세요',
        'expected', null
      ));
    END IF;

    -- S4 / S6 확산 약함
    IF v_clicks > 20 AND v_shares < (v_clicks * 0.1) THEN
      v_diagnosis := v_diagnosis || jsonb_build_array(jsonb_build_object(
        'axis','spread', 'severity','medium',
        'title','공유가 더 일어날 여지가 있어요',
        'detail', format('조회 %s회 대비 공유 %s회', v_clicks, v_shares)
      ));
      v_prescriptions := v_prescriptions || jsonb_build_array(jsonb_build_object(
        'priority', 2,
        'action','단골에게 ''좋으면 공유해 주세요'' 문구를 더해보세요',
        'expected', null
      ));
    END IF;

    -- S5 클릭 후 확정 0
    IF v_resv_click > 0 AND v_confirmed = 0 THEN
      v_diagnosis := v_diagnosis || jsonb_build_array(jsonb_build_object(
        'axis','conversion', 'severity','high',
        'title','예약 클릭은 있는데 확정이 0건이에요',
        'detail','문의가 확정으로 이어지지 않고 있어요.'
      ));
      v_prescriptions := v_prescriptions || jsonb_build_array(jsonb_build_object(
        'priority', v_resv_click + 5,
        'action','예약 문의에 빠르게 응답해 확정으로 연결해보세요',
        'expected','확정 전환이 오를 여지가 있어요'
      ));
    END IF;

    -- S9 혜택 미설정
    IF v_claimed = 0 AND v_clicks > 20 THEN
      v_diagnosis := v_diagnosis || jsonb_build_array(jsonb_build_object(
        'axis','offer', 'severity','medium',
        'title','쿠폰을 받은 분이 아직 없어요',
        'detail', format('조회는 %s회인데 쿠폰 발급 0건', v_clicks)
      ));
      v_prescriptions := v_prescriptions || jsonb_build_array(jsonb_build_object(
        'priority', 2,
        'action','쿠폰을 만들거나, 있다면 더 눈에 띄게 노출해보세요',
        'expected', null
      ));
    END IF;

    -- 강점 S10/S11/S12
    IF v_unique > 0 AND (v_clicks::numeric / NULLIF(v_unique,0)) > 3 THEN
      v_strengths := v_strengths || jsonb_build_array(jsonb_build_object(
        'title','관심이 높아요 👍',
        'detail','한 분이 여러 번 카드를 보고 있어요.'
      ));
    END IF;
    IF v_settlements > 0 THEN
      v_strengths := v_strengths || jsonb_build_array(jsonb_build_object(
        'title','실제 수익 전환이 일어나고 있어요 👍',
        'detail', format('정산 %s건 발생', v_settlements)
      ));
    END IF;
    IF v_confirmed > 10 THEN
      v_strengths := v_strengths || jsonb_build_array(jsonb_build_object(
        'title','예약이 잘 되고 있어요 👍',
        'detail', format('확정 %s건', v_confirmed)
      ));
    END IF;
  END IF;

  -- ============ 추적 비교 (A-1) ============
  SELECT * INTO v_prev FROM public.guide_history
  WHERE partner_id = p_partner_id
  ORDER BY snapshot_at DESC LIMIT 1;

  IF v_prev.id IS NOT NULL THEN
    v_comparison := jsonb_build_object(
      'previous_at', v_prev.snapshot_at,
      'previous_metrics', v_prev.metrics_snapshot,
      'current_metrics', v_m,
      'note','이전 진단 이후 변화'
    );
  END IF;

  -- ============ 이력 저장 (p_save) ============
  IF p_save THEN
    INSERT INTO public.guide_history(
      partner_id, owner_user_id, range_days,
      metrics_snapshot, diagnosis, prescriptions, strengths, engine
    ) VALUES (
      p_partner_id, v_owner, p_range_days,
      v_m, v_diagnosis, v_prescriptions, v_strengths, 'rule'
    );
  END IF;

  RETURN jsonb_build_object(
    'partner_id', p_partner_id,
    'range_days', p_range_days,
    'metrics', v_m,
    'conversion_rates', v_results->'conversion_rates',
    'diagnosis', v_diagnosis,
    'prescriptions', v_prescriptions,
    'strengths', v_strengths,
    'comparison', v_comparison,
    'engine', 'rule'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_guide(uuid, int, boolean) TO authenticated;
