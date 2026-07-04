-- v8.2 — get_feed_remaining_stock(p_drop_ids uuid[]) 배치 파생 (Phase 1-B-2)
--
-- 목적: 피드(홈·탐색) 타일 재고 주입용 배치 1회 호출 — 1-C-2 RLS STOP 해소.
--   preorders RLS(SELECT = catcher 본인·매장 owner 한정) 탓에 열람자 세션으로는 합산이
--   0행이 되어 재고 과대 표시(L4 위반) → SECURITY DEFINER 로 서버측 정확 파생만 노출.
--
-- 정의식 = 1-B(get_drop_detail.remaining_stock)와 동일:
--   메인 product 블록(create_preorder 동일 선정: block_kind='product' + ref_drop_id 없음 +
--   created_at ASC LIMIT 1)의 stock_limit − SUM(preorders.quantity, status IN
--   ('pending','confirmed','fulfilled')). stock_limit 없음/블록 없음 = null.
--
-- 안전 수칙:
--   · SECURITY DEFINER + search_path 고정 · 입력 = uuid[] 단일 파라미터.
--   · published + is_public 드랍 한정(비공개 드랍 재고 노출 방지 — 미충족 id 는 행 자체 미반환).
--   · 읽기 전용(쓰기·트리거·차감 컬럼 없음 — 1-B 와 동일 구조).
--   · GRANT EXECUTE anon/authenticated(피드 공개 열람 대상).

CREATE OR REPLACE FUNCTION public.get_feed_remaining_stock(p_drop_ids uuid[])
RETURNS TABLE (drop_id uuid, remaining_stock int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT d.id AS drop_id,
    (
      SELECT NULLIF(b.block_data->>'stock_limit', '')::int
             - COALESCE((
                 SELECT SUM(po.quantity)::int
                 FROM public.preorders po
                 WHERE po.drop_id = d.id
                   AND po.status IN ('pending','confirmed','fulfilled')
               ), 0)
      FROM public.component_blocks b
      WHERE b.info_drop_id = d.id
        AND b.block_kind = 'product'
        AND (b.block_data->>'ref_drop_id') IS NULL
        AND NULLIF(b.block_data->>'stock_limit', '') IS NOT NULL
      ORDER BY b.created_at ASC
      LIMIT 1
    ) AS remaining_stock
  FROM public.info_drops d
  WHERE d.id = ANY(p_drop_ids)
    AND d.status = 'published'
    AND d.is_public = true;
$$;

REVOKE ALL ON FUNCTION public.get_feed_remaining_stock(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_feed_remaining_stock(uuid[]) TO anon, authenticated;
