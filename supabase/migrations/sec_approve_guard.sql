-- SEC-APPROVE-FIX — approve_partner 에 admin 가드 추가 (자가승인 구멍 차단)
-- 원인: SECURITY DEFINER 인데 호출자 권한 체크 0 → 누구나 임의 partner 자가승인 가능.
-- 결정: LANGUAGE sql → plpgsql 전환 + has_role(auth.uid(),'admin') 가드.
-- has_role 메커니즘: profiles.active_roles 배열에 'admin' 포함 여부 (확인 완료).
-- UPDATE 로직 100% 보존, SECURITY DEFINER 유지.
-- 롤백: Downloads/SEC-APPROVE-ROLLBACK-approve_partner.sql

CREATE OR REPLACE FUNCTION public.approve_partner(p_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  UPDATE partners
  SET verification_status = 'approved',
      updated_at = now()
  WHERE id = p_partner_id;
END;
$$;
