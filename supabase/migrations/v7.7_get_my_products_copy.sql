-- v7.7 — get_my_products(): 나-1 상품 카피(headline/selling_points) 반환 추가
--
-- 목적: 상품-스코프 AI 카피를 picker(관련상품/홍보카드) · 카피 편집 프리필에 노출.
-- 저장처: 상품 메인 product 블록(self, ref_drop_id 없음) block_data — 이미 LEFT JOIN 된 pb.
--   headline       = pb.block_data->>'headline' (text)
--   selling_points = pb.block_data->'selling_points' (jsonb 배열)
--
-- 변경: RETURNS TABLE 에 headline text, selling_points jsonb 2컬럼 추가 + SELECT 확장.
--   기존 컬럼/필터/정렬/보안(SECURITY DEFINER + auth.uid() owner-scope) 무변경.
--   ⚠️ CREATE OR REPLACE 후 GRANT/REVOKE 가 드롭되므로 재실행(맨 아래).
-- DDL = 0 (테이블 변경 없음, 함수 replace 1개). block_kind enum · create_drop_v2 무변경.

CREATE OR REPLACE FUNCTION public.get_my_products()
RETURNS TABLE (
  drop_id        uuid,
  share_code     text,
  share_uuid     uuid,
  name           text,
  price_krw      numeric,
  image_url      text,
  is_active      boolean,
  headline       text,
  selling_points jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  RETURN QUERY
  SELECT
    d.id AS drop_id,
    sev.share_code,
    sev.share_uuid,
    COALESCE(
      NULLIF(btrim(cs.title), ''),
      NULLIF(btrim(pb.block_data->>'name'), '')
    ) AS name,
    COALESCE(
      cs.price_krw,
      NULLIF(pb.block_data->>'price_krw', '')::numeric
    ) AS price_krw,
    cs.thumbnail_url AS image_url,
    (d.status = 'published') AS is_active,
    -- 나-1 — 메인 product 블록 block_data 의 카피.
    NULLIF(btrim(pb.block_data->>'headline'), '') AS headline,
    CASE
      WHEN jsonb_typeof(pb.block_data->'selling_points') = 'array'
        THEN pb.block_data->'selling_points'
      ELSE NULL
    END AS selling_points
  FROM public.info_drops d
  JOIN public.content_sources cs ON cs.id = d.source_id
  LEFT JOIN LATERAL (
    SELECT se.share_code, se.share_uuid
    FROM public.share_events se
    WHERE se.info_drop_id = d.id
    ORDER BY se.created_at ASC
    LIMIT 1
  ) sev ON true
  -- 가격/이름/카피 fallback 경로: 첫 product 블록의 block_data
  LEFT JOIN LATERAL (
    SELECT cb.block_data
    FROM public.component_blocks cb
    WHERE cb.info_drop_id = d.id
      AND cb.block_kind = 'product'
    ORDER BY cb.position ASC
    LIMIT 1
  ) pb ON true
  WHERE d.owner_user_id = v_uid
    AND d.purpose = '구매'
    AND cs.source_url LIKE 'https://app.drop.how/p/%'
  ORDER BY d.created_at DESC;
END;
$function$;

-- GRANT 재실행 — CREATE OR REPLACE 가 기존 권한을 드롭하므로 v7.6 과 동일하게 재부여.
REVOKE ALL ON FUNCTION public.get_my_products() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_products() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_products() TO authenticated;
