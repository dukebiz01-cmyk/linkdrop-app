-- v4.1 — TO public → TO anon, authenticated 일괄 보정 (Critical 15건)
-- WHY: Supabase RLS 에서 TO public 은 anon role 에 적용되지 않음 (S-3 abuse_reports
--      사고에서 확인). S-4 진단의 Critical 분류 INSERT/UPDATE/DELETE/ALL 정책 15건
--      일괄 정리. USING / WITH CHECK 절은 보존, TO 절만 변경.

-- 1. component_blocks.blocks_owner_modify (ALL)
DROP POLICY IF EXISTS "blocks_owner_modify" ON component_blocks;
CREATE POLICY "blocks_owner_modify"
  ON component_blocks
  FOR ALL
  TO anon, authenticated
  USING (EXISTS (SELECT 1
    FROM info_drops
    WHERE info_drops.id = component_blocks.info_drop_id
      AND auth.uid() = info_drops.owner_user_id));

-- 2. content_sources.sources_authenticated_insert (INSERT)
DROP POLICY IF EXISTS "sources_authenticated_insert" ON content_sources;
CREATE POLICY "sources_authenticated_insert"
  ON content_sources
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. content_sources.sources_self_modify (UPDATE)
DROP POLICY IF EXISTS "sources_self_modify" ON content_sources;
CREATE POLICY "sources_self_modify"
  ON content_sources
  FOR UPDATE
  TO anon, authenticated
  USING (auth.uid() = registered_by_user_id);

-- 4. coupons.coupons_partner_all (ALL)
DROP POLICY IF EXISTS "coupons_partner_all" ON coupons;
CREATE POLICY "coupons_partner_all"
  ON coupons
  FOR ALL
  TO anon, authenticated
  USING (auth.uid() IN (SELECT partners.owner_user_id
    FROM partners
    WHERE partners.id = coupons.partner_id));

-- 5. drop_campaigns.campaigns_partner_all (ALL)
DROP POLICY IF EXISTS "campaigns_partner_all" ON drop_campaigns;
CREATE POLICY "campaigns_partner_all"
  ON drop_campaigns
  FOR ALL
  TO anon, authenticated
  USING (
    (auth.uid() IN (SELECT partners.owner_user_id
      FROM partners
      WHERE partners.id = drop_campaigns.partner_id))
    OR (auth.uid() = creator_user_id)
  );

-- 6. drop_forks.drop_forks_own_write (ALL)
DROP POLICY IF EXISTS "drop_forks_own_write" ON drop_forks;
CREATE POLICY "drop_forks_own_write"
  ON drop_forks
  FOR ALL
  TO anon, authenticated
  USING (auth.uid() = forked_by_user_id);

-- 7. drop_intents.drop_intents_admin_write (ALL)
DROP POLICY IF EXISTS "drop_intents_admin_write" ON drop_intents;
CREATE POLICY "drop_intents_admin_write"
  ON drop_intents
  FOR ALL
  TO anon, authenticated
  USING (EXISTS (SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND 'admin'::user_role = ANY (profiles.active_roles)));

-- 8. info_drops.drops_owner_delete (DELETE)
DROP POLICY IF EXISTS "drops_owner_delete" ON info_drops;
CREATE POLICY "drops_owner_delete"
  ON info_drops
  FOR DELETE
  TO anon, authenticated
  USING (auth.uid() = owner_user_id);

-- 9. info_drops.drops_owner_insert (INSERT)
DROP POLICY IF EXISTS "drops_owner_insert" ON info_drops;
CREATE POLICY "drops_owner_insert"
  ON info_drops
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (auth.uid() = owner_user_id);

-- 10. info_drops.drops_owner_modify (UPDATE)
DROP POLICY IF EXISTS "drops_owner_modify" ON info_drops;
CREATE POLICY "drops_owner_modify"
  ON info_drops
  FOR UPDATE
  TO anon, authenticated
  USING (auth.uid() = owner_user_id);

-- 11. partner_staff.staff_partner_owner_manage (ALL)
DROP POLICY IF EXISTS "staff_partner_owner_manage" ON partner_staff;
CREATE POLICY "staff_partner_owner_manage"
  ON partner_staff
  FOR ALL
  TO anon, authenticated
  USING (auth.uid() IN (SELECT partners.owner_user_id
    FROM partners
    WHERE partners.id = partner_staff.partner_id));

-- 12. partners.partners_owner_all (ALL)
DROP POLICY IF EXISTS "partners_owner_all" ON partners;
CREATE POLICY "partners_owner_all"
  ON partners
  FOR ALL
  TO anon, authenticated
  USING (auth.uid() = owner_user_id);

-- 13. profiles.profiles_self_update (UPDATE)
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update"
  ON profiles
  FOR UPDATE
  TO anon, authenticated
  USING (auth.uid() = id);

-- 14. share_events.shares_sender_insert (INSERT)
DROP POLICY IF EXISTS "shares_sender_insert" ON share_events;
CREATE POLICY "shares_sender_insert"
  ON share_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (auth.uid() = sender_user_id);

-- 15. user_private_profiles.private_self_only (ALL)
DROP POLICY IF EXISTS "private_self_only" ON user_private_profiles;
CREATE POLICY "private_self_only"
  ON user_private_profiles
  FOR ALL
  TO anon, authenticated
  USING (auth.uid() = user_id);
