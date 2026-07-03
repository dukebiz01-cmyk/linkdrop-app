# DB 실정의 스냅샷(형상관리용). migrations 아님 — 재적용 금지
CREATE OR REPLACE FUNCTION public.grant_cash_charge(p_user uuid, p_amount integer, p_mcht_trd_no text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF p_user IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_mcht_trd_no IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGS';
  END IF;

  INSERT INTO public.cash_wallets (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.cash_wallets WHERE user_id = p_user FOR UPDATE;

  BEGIN
    INSERT INTO public.cash_ledger (user_id, entry_type, paid_delta, ref_mcht_trd_no)
    VALUES (p_user, 'charge', p_amount, p_mcht_trd_no);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;

  UPDATE public.cash_wallets
  SET paid_balance = paid_balance + p_amount, updated_at = now()
  WHERE user_id = p_user;
END;
$function$

