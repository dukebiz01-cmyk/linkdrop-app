# DB 실정의 스냅샷(형상관리용). migrations 아님 — 재적용 금지
CREATE OR REPLACE FUNCTION public.use_cash(p_sku text, p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_paid integer;
  v_bonus integer;
  v_from_bonus integer;
  v_from_paid integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;
  IF p_sku NOT IN ('boost','ai_pack','studio_premium') THEN
    RAISE EXCEPTION 'INVALID_SKU';
  END IF;

  INSERT INTO public.cash_wallets (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT paid_balance, bonus_balance INTO v_paid, v_bonus
  FROM public.cash_wallets WHERE user_id = v_uid FOR UPDATE;

  IF (v_paid + v_bonus) < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CASH';
  END IF;

  v_from_bonus := LEAST(v_bonus, p_amount);
  v_from_paid  := p_amount - v_from_bonus;

  UPDATE public.cash_wallets
  SET bonus_balance = bonus_balance - v_from_bonus,
      paid_balance  = paid_balance  - v_from_paid,
      updated_at = now()
  WHERE user_id = v_uid;

  INSERT INTO public.cash_ledger (user_id, entry_type, paid_delta, bonus_delta, sku)
  VALUES (v_uid, 'use', -v_from_paid, -v_from_bonus, p_sku);

  RETURN jsonb_build_object(
    'sku', p_sku, 'amount', p_amount,
    'from_bonus', v_from_bonus, 'from_paid', v_from_paid,
    'paid_balance', v_paid - v_from_paid,
    'bonus_balance', v_bonus - v_from_bonus
  );
END;
$function$

