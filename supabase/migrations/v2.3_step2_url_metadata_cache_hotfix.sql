-- v2.3 step 2 hotfix — address advisors:
--   1) set search_path on the updated_at trigger function
--   2) explicitly revoke execute on url_metadata_cache_get from anon
--      (authenticated/service_role still allowed; this matches our edge function intent)

create or replace function public.tg_url_metadata_cache_set_updated_at()
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

revoke execute on function public.url_metadata_cache_get(text) from anon;
