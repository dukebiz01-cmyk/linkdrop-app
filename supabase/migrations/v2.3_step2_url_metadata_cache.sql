-- v2.3 step 2 — URL metadata cache
-- Purpose: server-side cache for /create flow URL previews.
-- Reads/writes go through edge function `extract-url-metadata` (service role).
-- Authenticated clients can read but never write.

create table if not exists public.url_metadata_cache (
  id              uuid primary key default extensions.uuid_generate_v4(),
  canonical_url   text not null,
  provider        public.source_provider not null,
  source_id       text,                    -- e.g. youtube video id, ig shortcode
  title           text,
  description     text,
  author_name     text,
  thumbnail_url   text,
  embed_html      text,
  duration_sec    integer,
  site_name       text,
  language        text,
  raw_meta        jsonb not null default '{}'::jsonb,
  extraction_method text not null default 'og_tags',  -- 'oembed' | 'og_tags' | 'manual'
  extraction_confidence numeric default 1.0,
  extraction_errors text[] default '{}'::text[],
  fetched_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  hit_count       integer not null default 0,
  last_accessed_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One row per canonical URL. Edge function normalizes before lookup/insert.
create unique index if not exists url_metadata_cache_canonical_url_uidx
  on public.url_metadata_cache (canonical_url);

create index if not exists url_metadata_cache_provider_idx
  on public.url_metadata_cache (provider);

create index if not exists url_metadata_cache_expires_at_idx
  on public.url_metadata_cache (expires_at);

-- Updated-at trigger
create or replace function public.tg_url_metadata_cache_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_url_metadata_cache_updated_at on public.url_metadata_cache;
create trigger trg_url_metadata_cache_updated_at
  before update on public.url_metadata_cache
  for each row execute function public.tg_url_metadata_cache_set_updated_at();

-- RLS: read for any authenticated user (preview in create flow);
-- writes only via service role (edge function bypasses RLS with service key).
alter table public.url_metadata_cache enable row level security;

drop policy if exists "url_metadata_cache: read for authenticated"
  on public.url_metadata_cache;
create policy "url_metadata_cache: read for authenticated"
  on public.url_metadata_cache
  for select
  to authenticated
  using (true);

-- No insert/update/delete policy => service role only.

-- Helper: get cached row if not expired (and bump hit_count + last_accessed_at).
create or replace function public.url_metadata_cache_get(p_canonical_url text)
returns public.url_metadata_cache
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.url_metadata_cache;
begin
  update public.url_metadata_cache
     set hit_count = hit_count + 1,
         last_accessed_at = now()
   where canonical_url = p_canonical_url
     and expires_at > now()
   returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.url_metadata_cache_get(text) from public;
grant execute on function public.url_metadata_cache_get(text) to authenticated, service_role;

comment on table public.url_metadata_cache is
  'Server-side cache for /create URL previews. Writes only via extract-url-metadata edge function (service role).';
comment on column public.url_metadata_cache.expires_at is
  'Provider-specific TTL: youtube oembed 7d, instagram og 1d, generic og 6h. Set by edge function.';
