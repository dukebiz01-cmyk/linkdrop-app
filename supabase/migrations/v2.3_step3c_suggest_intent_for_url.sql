-- v2.3 step 3 [C] — suggest_intent_for_url RPC
--
-- Pure mapping function: given a URL (and optionally a resolved YouTube
-- categoryId from the caller), return an ordered list of suggested intent
-- codes from public.drop_intents, by joining against
-- public.youtube_category_intent_map.
--
-- Why caller-supplied category_id (not auto-resolved here):
--   The v2.3 step 2 url_metadata_cache stores oEmbed-only metadata, which
--   does NOT include snippet.categoryId. Resolving the categoryId requires
--   a YouTube Data API v3 videos.list call, which we keep out of Postgres
--   (no http extension dependency, no API-key handling in DB). The client
--   SDK (step [D]) is responsible for resolving categoryId before calling
--   this RPC, and may cache the resolution. Callers that don't have a
--   categoryId pass null — the RPC falls back to the "Other" sentinel for
--   YouTube hosts and "catch-all" for everything else.
--
-- Host detection (case-insensitive, leading www. stripped):
--   youtu.be, youtube.com, *.youtube.com  ⇒ provider = youtube
--   anything else                          ⇒ provider = unknown
--
-- Custom buckets (-10 Food & Drink, -11 Shopping) are only reachable by
-- explicit p_category_id pass-through; this RPC does NOT do heuristic
-- host/title inference for them. Heuristic inference lives in the SDK
-- where the metadata is richer and can be tuned without DDL.
--
-- Return shape (table) — forward-compatible: adding fields later won't
-- break callers that only select intent_code/rank.
--   intent_code            text    — the drop_intents.code suggestion
--   rank                   integer — 1-based position within the array
--   source                 text    — 'category_map' | 'sentinel_other' | 'sentinel_catchall'
--   matched_category_id    integer — the row in youtube_category_intent_map that produced this set
--   matched_category_name  text    — its name (for debugging / UX)

create or replace function public.suggest_intent_for_url(
  p_url text,
  p_category_id integer default null
)
returns table(
  intent_code           text,
  rank                  integer,
  source                text,
  matched_category_id   integer,
  matched_category_name text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_host        text;
  v_is_youtube  boolean := false;
  v_resolved    integer;
  v_source      text;
  v_row         public.youtube_category_intent_map%rowtype;
begin
  -- Parse host: lowercase, strip scheme + path/query/fragment, strip leading www.
  v_host := lower(coalesce(substring(p_url from '^https?://([^/?:#]+)'), ''));
  v_host := regexp_replace(v_host, '^www\.', '');

  v_is_youtube :=
    v_host = 'youtu.be'
    or v_host = 'youtube.com'
    or v_host like '%.youtube.com';

  -- Resolve which category_id row to pull from the map.
  if p_category_id is not null then
    v_resolved := p_category_id;
    v_source   := 'category_map';
  elsif v_is_youtube then
    v_resolved := -1;   -- Other sentinel (youtube but unknown category)
    v_source   := 'sentinel_other';
  else
    v_resolved := -2;   -- catch-all sentinel (non-youtube)
    v_source   := 'sentinel_catchall';
  end if;

  select * into v_row
    from public.youtube_category_intent_map
   where category_id = v_resolved
     and is_active   = true;

  -- Caller passed an unknown category_id — fall through to provider sentinel.
  if not found and p_category_id is not null then
    v_resolved := case when v_is_youtube then -1 else -2 end;
    v_source   := case when v_is_youtube then 'sentinel_other' else 'sentinel_catchall' end;
    select * into v_row
      from public.youtube_category_intent_map
     where category_id = v_resolved
       and is_active   = true;
  end if;

  if not found then
    -- Sentinels missing entirely; return empty (caller should not assume non-empty).
    return;
  end if;

  return query
    select
      t.c::text                                as intent_code,
      t.r::integer                             as rank,
      v_source                                 as source,
      v_row.category_id                        as matched_category_id,
      v_row.category_name                      as matched_category_name
    from unnest(v_row.intent_codes) with ordinality as t(c, r);
end;
$$;

-- Grants: authenticated users only. anon should not see intent suggestions.
revoke all on function public.suggest_intent_for_url(text, integer) from public;
revoke all on function public.suggest_intent_for_url(text, integer) from anon;
grant execute on function public.suggest_intent_for_url(text, integer) to authenticated;

comment on function public.suggest_intent_for_url(text, integer) is
  'Suggest ordered drop_intents.code values for a URL. p_category_id is the resolved YouTube videoCategoryId (caller-supplied; client SDK handles Data API lookup). Returns rows from youtube_category_intent_map, falling back to sentinels (-1 Other for youtube, -2 catch-all otherwise) when category is null or unknown.';
