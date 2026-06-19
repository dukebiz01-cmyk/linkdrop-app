create table if not exists public.price_cache (
  cache_key   text primary key,
  retail      jsonb,
  wholesale   jsonb,
  ref_date    date,
  fetched_at  timestamptz not null default now(),
  ttl_sec     int not null default 86400,
  source      text not null default 'KAMIS(aT)'
);
alter table public.price_cache enable row level security;
comment on table public.price_cache is '시세 캐시(KAMIS). get-price-band Edge Function 전용, 클라 직접 접근 금지(정책 0 = service_role만 우회).';
