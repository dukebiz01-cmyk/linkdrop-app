-- ============================================================================
-- BADGE-ⓐ 스냅샷 (2026-07-05) — get_feed_dropy_reward 배치 RPC 신설
-- ⚠️ migrations 아님 — 재적용 금지. linked 프로젝트(xukxtzjfqfwalqpmfidb)에
--    supabase db query --linked 로 적용 완료된 상태의 기록 박제본.
--
-- 목적: 피드 타일 Droppy 예상 보상액("◆+N") 표시용 배치 계산(피드당 1회).
--   분배 아님 — reward_ledger·distribute_rewards_safe·conversion_events 무접촉.
--   패턴 = get_feed_remaining_stock(v8.2) 복제: LANGUAGE sql STABLE SECURITY DEFINER,
--   search_path 'public','pg_catalog', published+is_public 필터, primary product 블록 판별.
--
-- GRANT 실측(사후): anon / authenticated / postgres / service_role : EXECUTE
--   (REVOKE ALL FROM public 후 명시 부여 — get_feed_remaining_stock 실측 구성과 동일)
--
-- 검증 결과 (2026-07-05):
--   호출: get_feed_dropy_reward(ARRAY[83de8a6c…, 11c9e6cb…, ad77d0b2…(rate 없음)])
--   - 83de8a6c-0522-499f-9642-3221eef7e786: rate 0.10 × price 32,000 → dropy_reward 3200 ✓ (기대값 일치)
--   - 11c9e6cb-035b-42e7-94b7-cb74974f81cc: rate 0.08 × price 19,900 이지만 is_public=false
--       → 행 미반환 ✓ (비공개 필터 P7c 정합 — 지시서의 2560 기대값은 price 가정 상이,
--          실데이터 기준 가상값은 1592이며 비공개라 어차피 미반환이 정답)
--   - ad77d0b2-36d5-4343-962a-1d980b0fa2a6 (published·public·rate 없음): 행 미반환 ✓
--   - anon 실증: publishable key REST POST /rest/v1/rpc/get_feed_dropy_reward → 200,
--       [{"info_drop_id":"83de8a6c…","dropy_reward":3200}] ✓
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_feed_dropy_reward(p_drop_ids uuid[])
 RETURNS TABLE(info_drop_id uuid, dropy_reward integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  -- 표시용 계산만(분배 0): 1개 구매 기준 풀 총액 = floor(dropy_rate * price_krw).
  -- primary product 블록 판별 = create_preorder 동일(ref_drop_id 없는 것, created_at ASC LIMIT 1).
  -- 유효 가드: rate NULL/<=0/>0.20, price NULL/<=0 → 행 제외(미주입=미렌더 관례).
  -- 배열 상한 50(과대 배열 방어). 비공개/미게시 드롭 미반환(P7c 정합).
  SELECT d.id AS info_drop_id, r.reward AS dropy_reward
  FROM public.info_drops d
  CROSS JOIN LATERAL (
    SELECT floor(
             NULLIF(b.block_data->>'dropy_rate','')::numeric
             * NULLIF(b.block_data->>'price_krw','')::integer
           )::int AS reward,
           NULLIF(b.block_data->>'dropy_rate','')::numeric AS rate,
           NULLIF(b.block_data->>'price_krw','')::integer AS price
    FROM public.component_blocks b
    WHERE b.info_drop_id = d.id
      AND b.block_kind = 'product'
      AND (b.block_data->>'ref_drop_id') IS NULL
    ORDER BY b.created_at ASC
    LIMIT 1
  ) r
  WHERE d.id IN (SELECT t.u FROM unnest(p_drop_ids) WITH ORDINALITY AS t(u, ord) WHERE t.ord <= 50)
    AND d.status = 'published'
    AND d.is_public = true
    AND r.rate IS NOT NULL AND r.rate > 0 AND r.rate <= 0.20
    AND r.price IS NOT NULL AND r.price > 0;
$function$;

REVOKE ALL ON FUNCTION public.get_feed_dropy_reward(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_feed_dropy_reward(uuid[]) TO anon, authenticated, service_role;
