-- ============================================================================
-- DB 스냅샷 (migrations 아님 — 기록용. supabase/migrations/ 에 넣지 말 것)
-- 2026-07-05 SELF-FIX: 쿠폰 전환 트리거 창작자 self-share 미발행 (정본 §4-1)
-- ============================================================================
-- 대상: public.trigger_redemption_to_conversion_v21()
--   바인딩: redemption_to_conversion_after_insert
--           AFTER INSERT ON public.coupon_redemptions FOR EACH ROW (변경 전후 동일)
-- 적용 경로: scripts/apply-migration.mjs selffix_trigger_v21_selfshare_null
--
-- md5(pg_get_functiondef) 기록:
--   trigger_redemption_to_conversion_v21 변경 전: b53475cf75d32b79e4d207683d9a0d6a
--   trigger_redemption_to_conversion_v21 변경 후: c4b7a35410a48b4655e84645bdf045e8
--   distribute_rewards_safe 변경 전/후 동일:     ca897fc05f296ff54cd467511bccb2a7 (무접촉 실증)
--
-- 변경 diff = 추가 5줄뿐 (그 외 CRLF 포함 바이트 동일):
--   +  v_creator         UUID;                                   (DECLARE)
--   +  -- SELF-FIX: 창작자 self-share 미발행(정본 §4-1). NULL=기존 no-user 관례로 무지급 기록.
--   +  v_creator := (SELECT owner_user_id FROM public.info_drops WHERE id = v_share_event.info_drop_id);
--   +  IF v_direct_advocate = v_creator THEN v_direct_advocate := NULL; END IF;
--   +  IF v_chain_origin  = v_creator THEN v_chain_origin  := NULL; END IF;
--   위치: v_chain_path 세팅 직후 → conversion_events INSERT의
--   direct_advocate_user_id/chain_origin_user_id 에 NULL 박제.
--   distribute_rewards_safe 는 이 두 컬럼만 지급 대상으로 읽으므로(chain_path 미사용)
--   party_user_id=NULL + idempotency 'no-user' 관례로 무지급 기록이 자연 성립.
--   chain_path 배열은 감사 목적으로 원본 체인 보존.
--
-- 사후 검증 (2026-07-05):
--   트리거 바인딩 전후 diff 0 (pg_get_triggerdef 동일)
--   proacl 전후 동일: {=X/postgres,postgres=X/postgres,anon=X/postgres,
--                      authenticated=X/postgres,service_role=X/postgres}
--   SECURITY DEFINER / owner postgres / search_path 유지
--   한글 무결성: position('창작자')>0, SELF-FIX 주석 내 '?' 없음 (mojibake 없음)
--
-- 원장 오염 감사 (변경 전 유입분, READ only — 정리는 별도 결정):
--   reward_ledger 中 party∈(chain_advocate,chain_origin) AND party_user_id = 해당 드롭 owner_user_id
--   → 4행, 전부 동일 유저 5274ab26-d611-4a1e-82ac-edf1103c7c5c / 드롭 1efc3dd9-46ee-47a7-993b-58c0137a0615
--     conversion 4d6cbf8a-7fad-4f1e-8904-f7e0a700bfa0: chain_advocate 225.00 + chain_origin  75.00
--     conversion 821118d5-f17a-43fd-a1fc-986bfa7e712d: chain_advocate 2250.00 + chain_origin 750.00
--   합계 ₩3,300 / ledger_status 전부 'pending' (지급 전 단계에서 포착)
-- ============================================================================
-- 아래는 변경 후 실정의 (pg_get_functiondef 재확보본)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_redemption_to_conversion_v21()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_claim           coupon_claims%ROWTYPE;
  v_share_event     share_events%ROWTYPE;
  v_chain_path      UUID[];
  v_direct_advocate UUID;
  v_chain_origin    UUID;
  v_conversion_id   UUID;
  v_gross           NUMERIC(14,2);
  v_creator         UUID;
BEGIN
  SELECT * INTO v_claim FROM coupon_claims WHERE id = NEW.coupon_claim_id;

  IF v_claim.share_event_id IS NOT NULL THEN
    SELECT * INTO v_share_event FROM share_events WHERE id = v_claim.share_event_id;

    v_direct_advocate := v_share_event.sender_user_id;
    v_chain_origin    := COALESCE(v_share_event.chain_origin_user_id, v_share_event.sender_user_id);
    v_chain_path      := ARRAY[v_chain_origin, v_direct_advocate];

    -- SELF-FIX: 창작자 self-share 미발행(정본 §4-1). NULL=기존 no-user 관례로 무지급 기록.
    v_creator := (SELECT owner_user_id FROM public.info_drops WHERE id = v_share_event.info_drop_id);
    IF v_direct_advocate = v_creator THEN v_direct_advocate := NULL; END IF;
    IF v_chain_origin  = v_creator THEN v_chain_origin  := NULL; END IF;

    v_gross := COALESCE(NEW.redeem_amount_krw, 0);

    INSERT INTO conversion_events (
      share_event_id, conversion_type, source_id,
      gross_amount_krw,
      chain_path, chain_depth,
      direct_advocate_user_id, chain_origin_user_id,
      occurred_at
    ) VALUES (
      v_claim.share_event_id, 'coupon_use'::conversion_type, NEW.id,
      v_gross,
      v_chain_path, COALESCE(v_share_event.chain_depth, 0),
      v_direct_advocate, v_chain_origin,
      NEW.redeemed_at
    )
    ON CONFLICT (source_id) WHERE conversion_type = 'coupon_use' DO NOTHING
    RETURNING id INTO v_conversion_id;

    IF v_conversion_id IS NOT NULL AND v_gross > 0 THEN
      PERFORM distribute_rewards_safe(v_conversion_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
