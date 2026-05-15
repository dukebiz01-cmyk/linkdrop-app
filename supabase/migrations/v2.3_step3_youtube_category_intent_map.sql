-- v2.3 step 3 [A] — YouTube category → intent codes map (empty seed)
-- Lookup table used by suggest_intent_for_url RPC.
-- "Other" / unmapped categories are handled at RPC layer (not stored here).
--
-- intent_codes is an ordered array (primary first, then fallbacks). We keep it
-- as text[] rather than FK'ing to drop_intents(code) because the taxonomy here
-- evolves (curator-controlled) separately from the canonical intent registry.

create table if not exists public.youtube_category_intent_map (
  category_id   integer primary key,
  category_name text    not null,
  intent_codes  text[]  not null,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint youtube_category_intent_map_codes_not_empty
    check (array_length(intent_codes, 1) >= 1),
  constraint youtube_category_intent_map_name_not_blank
    check (length(trim(category_name)) > 0)
);

create index if not exists youtube_category_intent_map_active_idx
  on public.youtube_category_intent_map (is_active)
  where is_active = true;

-- updated_at trigger
create or replace function public.tg_youtube_category_intent_map_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_youtube_category_intent_map_updated_at
  on public.youtube_category_intent_map;
create trigger trg_youtube_category_intent_map_updated_at
  before update on public.youtube_category_intent_map
  for each row execute function public.tg_youtube_category_intent_map_set_updated_at();

-- RLS: anyone signed in can read; writes only via service role (seed migration / admin).
alter table public.youtube_category_intent_map enable row level security;

drop policy if exists "youtube_category_intent_map: read for authenticated"
  on public.youtube_category_intent_map;
create policy "youtube_category_intent_map: read for authenticated"
  on public.youtube_category_intent_map
  for select
  to authenticated
  using (is_active = true);

comment on table public.youtube_category_intent_map is
  'Curated mapping from YouTube category ID (snippet.categoryId from YouTube Data API v3) to ordered list of drop_intents.code. Sentinel rows (negative category_id) cover Other/catch-all and LinkDrop-specific custom buckets not present in the YouTube taxonomy.';
comment on column public.youtube_category_intent_map.intent_codes is
  'Ordered text[]: primary intent first, then fallbacks. Matches drop_intents(code) but not FK-enforced.';
