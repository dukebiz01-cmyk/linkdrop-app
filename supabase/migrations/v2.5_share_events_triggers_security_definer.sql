-- v2.5 share_events triggers → SECURITY DEFINER
--
-- Issue: share_events INSERT fires AFTER trigger that INSERTs into
-- drop_share_edges. drop_share_edges has RLS enabled with only a SELECT
-- policy (share_edges_public_read) — no INSERT policy. trigger_share_
-- event_edge_v21 runs as the invoking user (prosecdef=false), so it
-- lacks INSERT permission on drop_share_edges → trigger fails → share_
-- events INSERT rolls back → client sees 403 / "new row violates row-
-- level security policy for table drop_share_edges".
--
-- Fix: mark both v21 trigger functions as SECURITY DEFINER so they run
-- with the function owner's (postgres) privileges, bypassing RLS for
-- the internal cascade INSERTs. Function bodies only read/derive from
-- NEW.* fields and parent share_events rows (no external input), so
-- this is safe per security review.
--
-- Chain trigger (BEFORE INSERT) also marked SECURITY DEFINER for
-- consistency — currently works without it because shares_public_read_
-- by_uuid policy allows SELECT, but if that policy ever tightens, the
-- chain trigger would break for inherited share_events SELECTs.

ALTER FUNCTION public.trigger_share_event_edge_v21() SECURITY DEFINER;
ALTER FUNCTION public.trigger_share_event_chain_v21() SECURITY DEFINER;
