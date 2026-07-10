-- (a) 멱등용 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversion_sale_complete
  ON public.conversion_events (source_id)
  WHERE conversion_type = 'sale_complete';

-- (b) 트리거 함수 (v21 미러: SECURITY DEFINER / search_path = public, pg_catalog / ACL PUBLIC 유지)
CREATE OR REPLACE FUNCTION public.trigger_preorder_to_conversion_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_share_event     public.share_events%ROWTYPE;
  v_direct_advocate uuid;
  v_chain_origin    uuid;
  v_creator         uuid;
  v_chain_path      uuid[];
  v_gross           integer;
  v_conversion_id   uuid;
BEGIN
  IF NEW.share_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_share_event
  FROM public.share_events
  WHERE id = NEW.share_event_id;

  v_direct_advocate := v_share_event.sender_user_id;
  v_chain_origin    := COALESCE(v_share_event.chain_origin_user_id, v_share_event.sender_user_id);
  v_chain_path      := ARRAY[v_chain_origin, v_direct_advocate];

  v_creator := (SELECT owner_user_id FROM public.info_drops WHERE id = v_share_event.info_drop_id);
  IF v_direct_advocate = v_creator THEN v_direct_advocate := NULL; END IF;
  IF v_chain_origin    = v_creator THEN v_chain_origin    := NULL; END IF;

  v_gross := COALESCE(NEW.total_krw, 0);

  INSERT INTO public.conversion_events (
    share_event_id, conversion_type, source_id, gross_amount_krw,
    chain_path, chain_depth, direct_advocate_user_id, chain_origin_user_id,
    info_drop_id, occurred_at
  ) VALUES (
    NEW.share_event_id, 'sale_complete', NEW.id, v_gross,
    v_chain_path, COALESCE(v_share_event.chain_depth, 0),
    v_direct_advocate, v_chain_origin,
    v_share_event.info_drop_id, NEW.fulfilled_at
  )
  ON CONFLICT (source_id) WHERE conversion_type = 'sale_complete' DO NOTHING
  RETURNING id INTO v_conversion_id;

  IF v_conversion_id IS NOT NULL AND v_gross > 0 THEN
    PERFORM public.distribute_rewards_safe(v_conversion_id);
  END IF;

  RETURN NEW;
END;
$fn$;

-- (d) 트리거
CREATE TRIGGER preorder_to_conversion_after_fulfill
  AFTER UPDATE OF status ON public.preorders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'fulfilled')
  EXECUTE FUNCTION public.trigger_preorder_to_conversion_v1();
