-- v2.3 step 3 [B] — Seed 19 rows into youtube_category_intent_map.
--
-- 15 YouTube standard categories (videoCategories.list, region=KR, assignable=true)
-- + 2 sentinel rows + 2 LinkDrop-specific custom buckets.
--
-- Negative category_id is a sentinel convention:
--   -1  = "Other"                 — unmapped YouTube category fallback
--   -2  = "catch-all"             — absolute fallback when no category can be inferred
--   -10 = "Food & Drink (custom)" — LinkDrop bucket (not a YT category); inferred from OG/description
--   -11 = "Shopping (custom)"     — LinkDrop bucket (not a YT category); inferred from OG/description
--
-- intent_codes is an ordered text[]: primary first, then fallbacks. Values are
-- drop_intents.code (not intent_types.key). The DO-block at the bottom validates
-- that every code in every row exists in drop_intents.code (rolls back on orphan).
--
-- ✅ = code mapping confirmed by Duke. Other rows are proposed; correct in place
-- before applying if needed.

insert into public.youtube_category_intent_map (category_id, category_name, intent_codes, notes) values
  -- ── YouTube videoCategories.list (region=KR, assignable=true) ───────────────────────────
  (   1, 'Film & Animation',      array['content','share'],               null),                                              -- proposed
  (   2, 'Autos & Vehicles',      array['content','review'],              null),                                              -- proposed
  (  10, 'Music',                 array['share','content'],               null),                                              -- proposed (highly shareable)
  (  15, 'Pets & Animals',        array['share','content'],               null),                                              -- proposed (viral)
  (  17, 'Sports',                array['content','share'],               null),                                              -- proposed (highlights)
  (  19, 'Travel & Events',       array['event','local_visit','content'], null),                                              -- proposed
  (  20, 'Gaming',                array['content','community'],           null),                                              -- proposed (creator-following)
  (  22, 'People & Blogs',        array['share','content'],               null),                                              -- ✅ Duke confirmed
  (  23, 'Comedy',                array['share','content'],               null),                                              -- proposed (viral)
  (  24, 'Entertainment',         array['share','content'],               null),                                              -- proposed (viral)
  (  25, 'News & Politics',       array['news','politics'],               null),                                              -- proposed
  (  26, 'Howto & Style',         array['content','review'],              null),                                              -- proposed
  (  27, 'Education',             array['content','review'],              null),                                              -- proposed
  (  28, 'Science & Technology',  array['content','review'],              null),                                              -- proposed
  (  29, 'Nonprofits & Activism', array['community','support'],           null),                                              -- proposed
  -- ── Sentinels (RPC fallbacks) ──────────────────────────────────────────────────────────
  (  -1, 'Other',                 array['share','content'],               'sentinel: unmapped YouTube category'),             -- ✅ Duke confirmed
  (  -2, 'catch-all',             array['share','content'],               'sentinel: absolute fallback (no category/domain)'),-- ✅ Duke confirmed
  -- ── Custom LinkDrop buckets (inferred via OG meta / Data API description) ──────────────
  ( -10, 'Food & Drink (custom)', array['coupon','reservation'],          'custom: inferred via OG/description; not a YT category'), -- ✅ Duke confirmed
  ( -11, 'Shopping (custom)',     array['shopping','purchase'],           'custom: inferred via OG/description; not a YT category')  -- ✅ Duke confirmed
on conflict (category_id) do nothing;

-- Validation: every code in every row must exist in drop_intents.code.
-- Raises an exception (rolls back the seed) if any orphan code is found.
do $$
declare
  bad_codes text[];
begin
  select array_agg(distinct c)
    into bad_codes
    from public.youtube_category_intent_map m,
         unnest(m.intent_codes) c
   where c not in (select code from public.drop_intents);
  if bad_codes is not null then
    raise exception 'youtube_category_intent_map references codes not in drop_intents: %', bad_codes;
  end if;
end;
$$;
