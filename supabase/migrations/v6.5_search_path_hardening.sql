-- v6.5 — A6 search_path 하드닝 (SECURITY DEFINER 6개)
--
-- 본문·로직 무수정. ALTER FUNCTION ... SET search_path 메타데이터만.
-- handle_new_user(v5.7) / v6.x 패턴과 일관 (public, pg_catalog).
--
-- 시그니처 확정 (사전 READ):
--   has_role(_user_id uuid, _role text)
--   increment_share_view(p_share_event_id uuid)
--   is_partner_staff(_user_id uuid, _partner_id uuid)
--   trigger_redemption_to_conversion_v21()   -- 인자 0
--   trigger_share_event_chain_v21()          -- 인자 0
--   trigger_share_event_edge_v21()           -- 인자 0
--
-- ⚠️ 정산 트리거 3개 포함 — 본문 무수정 메타데이터만 변경. split 로직·트리거 동작
--    그대로. handle_new_user 같은 search_path 하이재킹/타입 미해석 결함 예방.

ALTER FUNCTION public.has_role(uuid, text)
  SET search_path TO 'public', 'pg_catalog';

ALTER FUNCTION public.increment_share_view(uuid)
  SET search_path TO 'public', 'pg_catalog';

ALTER FUNCTION public.is_partner_staff(uuid, uuid)
  SET search_path TO 'public', 'pg_catalog';

ALTER FUNCTION public.trigger_redemption_to_conversion_v21()
  SET search_path TO 'public', 'pg_catalog';

ALTER FUNCTION public.trigger_share_event_chain_v21()
  SET search_path TO 'public', 'pg_catalog';

ALTER FUNCTION public.trigger_share_event_edge_v21()
  SET search_path TO 'public', 'pg_catalog';
