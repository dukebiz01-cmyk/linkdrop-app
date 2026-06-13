-- v7.6 — get_my_products(): ③ 카드 담기 picker 용 "내 상품" 목록 RPC
--
-- 목적: 자체업로드(구매 드롭) 상품을 카드로 담을 때 목록 소스. 호출자 본인 것만 반환.
--
-- 본인만 보장(최우선): SECURITY DEFINER 로 RLS 를 우회하지만 WHERE owner_user_id = auth.uid()
--   로 호출자 소유만 반환. auth.uid() IS NULL(비로그인) 이면 즉시 예외 → 타인/익명 노출 0.
--   (get_my_drops 와 동일 owner-scope 패턴.)
--
-- 자체업로드 식별 = content_sources.source_url 이 합성 prefix 'https://app.drop.how/p/' 로 시작
--   (외부 스크랩 구매상품은 실제 외부 URL → 제외). /partner/products 와 동일 정책.
--
-- 반환 컬럼 출처:
--   drop_id    = info_drops.id
--   share_code = 첫 share_event(created_at ASC, 메이커 원본)의 share_events.share_code  (외부 단축링크용)
--   share_uuid = 같은 첫 share_event 의 share_events.share_uuid  (/d/{share_uuid} 인앱 이동용)
--   name       = content_sources.title (없으면 product 블록 block_data->>'name')
--   price_krw  = content_sources.price_krw (없으면 product 블록 block_data->>'price_krw')
--   image_url  = content_sources.thumbnail_url
--   is_active  = (info_drops.status = 'published')  -- 자체업로드는 published 로 생성
--
-- 정책: status 필터 없이 전부 반환하고 is_active 플래그로 구분(/partner/products 와 동일).
--   정렬 = created_at DESC(최신순).
--
-- 제약: 신규 함수 1개만 추가. 기존 함수/테이블/RLS/트리거/스키마 변경 0.

CREATE OR REPLACE FUNCTION public.get_my_products()
RETURNS TABLE (
  drop_id    uuid,
  share_code text,
  share_uuid uuid,
  name       text,
  price_krw  numeric,
  image_url  text,
  is_active  boolean
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
    (d.status = 'published') AS is_active
  FROM public.info_drops d
  JOIN public.content_sources cs ON cs.id = d.source_id
  -- 첫 share_event(created_at ASC, 메이커 원본): share_code(외부 단축링크) + share_uuid(/d 인앱 이동)
  LEFT JOIN LATERAL (
    SELECT se.share_code, se.share_uuid
    FROM public.share_events se
    WHERE se.info_drop_id = d.id
    ORDER BY se.created_at ASC
    LIMIT 1
  ) sev ON true
  -- 가격/이름 fallback 경로: 첫 product 블록의 block_data
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

-- GRANT — authenticated 만. anon 금지.
--   ⚠️ Supabase default privileges 가 새 함수에 anon EXECUTE 를 자동 부여하므로
--   REVOKE FROM PUBLIC 만으론 anon 직접 grant 가 남는다 → anon 도 명시적 REVOKE.
--   (auth.uid() 가드가 이미 데이터 노출을 막지만, 권한도 차단해 이중 안전.)
REVOKE ALL ON FUNCTION public.get_my_products() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_products() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_products() TO authenticated;
