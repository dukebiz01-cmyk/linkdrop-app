-- v2.3 step 4 — TimeLink: per-block video time range
--
-- Adds optional start/end seconds to component_blocks so a single video block
-- can pin a time window inside the source video (e.g. play 02:00–03:00).
-- The URL helpers in src/lib/time-link.ts encode/decode these values into
-- youtube.com/watch?...&t=Ns (start only) or youtube.com/embed/...?start=&end=
-- (start + end) URLs.
--
-- Allowed shapes per block (enforced by check constraint):
--   (NULL, NULL)         — no time window
--   (start, NULL)        — start-only ("jump to N seconds")
--   (start, end)  w/ end > start — bounded window
--   (NULL, end)          — REJECTED (end without start is meaningless here)

alter table public.component_blocks
  add column if not exists video_start_seconds integer,
  add column if not exists video_end_seconds   integer;

-- Drop a previous incarnation if re-running.
alter table public.component_blocks
  drop constraint if exists check_video_time_range;

alter table public.component_blocks
  add constraint check_video_time_range
  check (
    (video_start_seconds is null and video_end_seconds is null)
    or (video_start_seconds is not null and video_end_seconds is null)
    or (video_start_seconds is not null and video_end_seconds is not null
        and video_end_seconds > video_start_seconds)
  );

comment on column public.component_blocks.video_start_seconds is
  'Optional start offset in whole seconds for a video block. Encoded into ?t=Ns (watch URL) or ?start=N (embed URL). Paired with video_end_seconds; end-only is rejected by check_video_time_range.';
comment on column public.component_blocks.video_end_seconds is
  'Optional end offset in whole seconds for a video block. Only meaningful in embed URL form (?end=N); the watch URL drops it. Must be > video_start_seconds.';
