-- # DB 실정의 스냅샷(형상관리용). migrations 아님 — 재적용 금지.
-- # 원본 마이그레이션 = v8.2_get_feed_remaining_stock.sql (Phase 1-B-2).
-- # 캡처: 2026-07-04 · pg_get_functiondef · md5(def)=8bc56be3de84c35f92ae09ad2580f931

CREATE OR REPLACE FUNCTION public.get_feed_remaining_stock(p_drop_ids uuid[])
 RETURNS TABLE(drop_id uuid, remaining_stock integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
