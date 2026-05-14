-- =====================================================================
-- LinkDrop v2.2 Security Hotfix
-- Addresses Supabase advisor findings after v2.2_step2:
--   1. ERROR rls_disabled_in_public on public.schema_migrations
--   2. WARN function_search_path_mutable on the 4 v2.2 functions
--   3. WARN auth_rls_initplan on the 4 intents-family policies
--      (wrap auth.uid() so it's evaluated once per query, not per row)
-- =====================================================================

BEGIN;

-- (1) Enable RLS on schema_migrations. No policy = service_role only,
--     which is the intended access pattern for a migration log.
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- (2) Pin search_path on v2.2 SECURITY DEFINER functions.
--     Prevents schema-injection where a malicious search_path entry
--     could shadow public.* objects with attacker-controlled ones.
ALTER FUNCTION public.distribute_rewards_safe(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.ld_create_share_edge_v3(
    uuid, uuid, share_channel, uuid, uuid,
    text, text, share_emotion, numeric,
    text, text, text, integer, share_relationship,
    text, text, text, text
  )
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.ld_rebuild_sender_reputation_v3(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_lifecycle_stage(uuid, text)
  SET search_path = public, pg_catalog;

-- (3) Rewrite the 4 intents-family policies to wrap auth.uid() in a
--     subselect. Postgres caches the subselect result for the whole
--     query, instead of re-invoking auth.uid() per row.
DROP POLICY IF EXISTS intents_admin_write ON public.intents;
CREATE POLICY intents_admin_write ON public.intents
  FOR ALL TO authenticated
  USING      (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS intent_templates_admin_write ON public.intent_templates;
CREATE POLICY intent_templates_admin_write ON public.intent_templates
  FOR ALL TO authenticated
  USING      (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS intent_rules_admin_all ON public.intent_rules;
CREATE POLICY intent_rules_admin_all ON public.intent_rules
  FOR ALL TO authenticated
  USING      (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS intent_automation_presets_admin_all ON public.intent_automation_presets;
CREATE POLICY intent_automation_presets_admin_all ON public.intent_automation_presets
  FOR ALL TO authenticated
  USING      (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

NOTIFY pgrst, 'reload schema';

COMMIT;
