# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **bun** (`bun.lock` is checked in). Scripts:

- `bun run dev` — Vite dev server (TanStack Start). The Lovable Vite preset auto-detects sandbox port/host.
- `bun run build` — production build (Vite + Cloudflare Workers via `@cloudflare/vite-plugin`).
- `bun run build:dev` — build in development mode.
- `bun run preview` — serve the built output.
- `bun run lint` — ESLint over the repo.
- `bun run format` — Prettier write.

There is no test runner configured.

Required env vars (see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Server-only code additionally reads `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` from `process.env` (Workers) / `Deno.env` (Edge Functions). **V2 key migration (2026-05-16)**: legacy `VITE_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are deprecated and no longer read by any code path. Set the V2 publishable / secret keys (`sb_publishable_*` / `sb_secret_*`) in Cloudflare Workers Secrets and Supabase Edge Function Secrets respectively.

## Architecture

**Stack**: TanStack Start (SSR) + TanStack Router file-based routing + React 19 + TanStack Query + Supabase + Tailwind v4 + shadcn/ui, deployed to Cloudflare Workers via Wrangler. UI is Korean.

### Vite + Cloudflare entry

`vite.config.ts` uses `@lovable.dev/vite-tanstack-config` — this preset already wires `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, `cloudflare`, dev-only `componentTagger`, VITE_* env injection, the `@/*` alias, React/TanStack dedupe, and sandbox detection. **Do not re-add these plugins manually** — duplicates will break the build.

`src/server.ts` is the Cloudflare Worker entry (also referenced by `wrangler.jsonc`). It wraps `@tanstack/react-start/server-entry` and does two things you must preserve:

1. Catches thrown errors and renders the branded HTML in `src/lib/error-page.ts`.
2. Detects h3-swallowed SSR errors. When a `<route>.tsx` throws during SSR, h3 turns it into a 500 with body `{"unhandled":true,"message":"HTTPError"}` — `try/catch` alone never sees it. `normalizeCatastrophicSsrResponse` parses that exact shape and replaces the response. The original `Error` is recovered out-of-band via `src/lib/error-capture.ts`, which listens to `error` / `unhandledrejection` on `globalThis` with a 5s TTL.

`src/start.ts` registers an additional request middleware that converts non-HTTP throws into the same branded 500.

### Routing and auth gates

File-based routing under `src/routes/`; `routeTree.gen.ts` is auto-generated (do not edit). Path alias `@/*` → `src/*`.

Three protected layouts gate everything beyond the landing/login pages — each runs auth checks in `beforeLoad` using the browser Supabase client:

- `_user.tsx` — requires a session, else redirect to `/login`.
- `_partner.tsx` — requires session + `is_active_partner_owner` RPC. The `partner.register` child is explicitly whitelisted so non-owners can sign up.
- `_admin.tsx` — requires session + `has_role(staff)` OR `has_role(admin)` RPC.

All three short-circuit when `isSupabaseConfigured` is false so the app still renders during local setup. The file-route conventions are `_segment.tsx` (layout) + `_segment/*.tsx` (children), and children use flat dotted names like `partner.billing.tsx`.

### Supabase clients — cookie-shared session, two-environment dispatch

The browser/server split uses **`@supabase/ssr`** (not raw `@supabase/supabase-js`) so SSR route guards and the browser see the same session via `document.cookie`. The earlier localStorage-based client caused `_user`/`_partner`/`_admin` `beforeLoad` guards to miss the session on full-page navigations right after login and bounce users back to `/login`.

- `src/lib/supabase.ts` — browser client (`createBrowserClient`), lazy singleton, reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Import as `import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"` and call `getSupabase()` (don't grab the client at module top — env may not be set).
- `src/lib/supabase-server.server.ts` — server client (`createServerClient`), bridges TanStack Start's `getCookies` / `setCookie` from `@tanstack/react-start/server` into Supabase's cookie adapter. The `.server.ts` suffix makes Vite strip it from the client bundle.
- `src/lib/auth-context.ts` — `getAuthClient()` uses `createIsomorphicFn` from `@tanstack/react-start` to return the right client per environment. The start-compiler-plugin (`handleCreateIsomorphicFn.ts`) erases the opposite branch at build time, so the dynamic `import("./supabase-server.server")` never reaches the client bundle. **Use this in route `beforeLoad`** — do not import `supabase-server.server.ts` directly from anywhere that runs on the client (it triggers `@tanstack/react-start/server` import-protection). The earlier `typeof window` guard pattern was insufficient; `createIsomorphicFn` is the only correct dispatch.

There is also a second parallel scaffolding under `src/integrations/supabase/*` (leftover from Lovable Cloud activation, see commits `affb623` "Cloud 활성화" and `d4eff94` "Raw supabase 클라이언트 적용"). Currently **not imported by any app code** but V2-updated 2026-05-16 and kept for future use:
- `client.ts` — proxy-wrapped browser client (duplicate of `@/lib/supabase`, kept only so `bunx supabase gen types` regeneration target stays stable).
- `client.server.ts` — `supabaseAdmin` with `SUPABASE_SECRET_KEY`, bypasses RLS, server-only.
- `auth-middleware.ts` — `requireSupabaseAuth` for TanStack Start server functions; extracts the Bearer token, validates via `auth.getClaims` with `SUPABASE_PUBLISHABLE_KEY`, and forwards it so RLS applies.

When picking a client: route loaders / `beforeLoad` → `getAuthClient()`. Client components → `getSupabase()`. New server functions that need user-scoped RLS → `requireSupabaseAuth`. Server-side admin tasks → `supabaseAdmin`. Never expose `supabaseAdmin` to client code.

### Create flow (`/create`)

`src/routes/_user/create.tsx` is the central composition page. The model lives in `src/lib/create-flow/types.ts`:

- `BlockDraft` / `BlockKind` — a draft "drop" is an ordered list of typed blocks; locked blocks are intent-required and cannot be deleted or reordered out.
- `intent_types` rows from the DB drive `default_required_blocks` (locked), `allowed_blocks` (whitelist for adding), and `requires_disclosure`. The `FALLBACK_*` maps in `types.ts` are mirrors used when the DB row is missing fields — keep them in sync if the schema changes.
- Drag-and-drop ordering uses `@dnd-kit/sortable` (`SortableBlock` in `src/components/create/BlockEditor.tsx`).
- Video metadata is enriched via `src/lib/oembed.ts` (YouTube oEmbed only today; Instagram is parsed but the fetch throws `unsupported_provider`).

### Design system — strict

`src/styles.css` documents 13 design axioms enforced by convention. Important constraints when generating UI:

- **Spacing**: only 8pt grid steps (`4/8/12/16/24/32/48`). No `p-2.5`, `gap-13`, etc.
- **Radius**: only `lg` (8px) and `2xl` (16px) in app code. `sm`/`md`/`xl`/`3xl` exist as aliases solely so shadcn primitives don't break — don't introduce them in feature code.
- **Colors**: V4 slate tokens (`text-strong` #0F172A, `muted` #64748B, `subtle` #94A3B8, `surface` #F1F5F9, `border` #E8EDF3) + blue `accent` #2563EB + `intent-*` tints (strip/chip only). Component raw hex (`#0F172A`, `#2563EB`, etc.) is allowed for V4 rollout.
- **Font weight**: only `medium`/`semibold`/`bold`/`extrabold`.
- **Korean**: `tracking-ko` (-0.02em) is the global letter-spacing; copy is Korean throughout.
- **Shadow**: card/chip/button elevation allowed (see `styles.css` shadow tokens). `shadow-soft` for modals/dropdowns.
- **Hover**: border change / `-translate-y-0.5` / scale + shadow elevation allowed.
- **Touch targets**: buttons use `min-h-[44px] min-w-[44px]`.
- **Empty states**: list pages should render `<EmptyState />` rather than nothing.
- **Error copy**: use `ErrorMessage` + `friendlyErrors` for the standard Korean tone.

shadcn config is in `components.json` (style: `new-york`, base: `slate`). User-facing components live in `src/components/`; shadcn primitives in `src/components/ui/`.

### ESLint guard

`eslint.config.js` bans imports from `server-only` (Next.js package). For server-only modules either use `.server.ts` suffix (Vite strips them from the client bundle) or `@tanstack/react-start/server-only`.

## Database / migrations

- `supabase/config.toml` holds the project ref (`xukxtzjfqfwalqpmfidb`). `supabase/migrations/` contains numbered SQL migrations; current head is `v2.4_phase1_hardening.sql`. The Drop Audience Engine schema (introduced at `v2.2_step2.sql`) is the core model: `drop_intents` catalog (19 codes — the canonical intent list lives in `drop_intents.code`, not `intent_types.key`), `drop_sender_reputation`, `drop_event_fraud_signals`, `drop_forks`, `reward_ledger.idempotency_key`, and the RPCs `ld_create_share_edge_v3` / `ld_rebuild_sender_reputation_v3` / `distribute_rewards_safe`. The `v2.3_step*` series added the coupon-security tightening, `url_metadata_cache`, the YouTube category → intent map + seeds, the `suggest_intent_for_url` RPC, and `timelink` (timestamped video link) support. `v2.4_phase1_hardening.sql` is the most recent hardening pass.
- Schema is large and evolves outside the app code. To inspect it, use the Supabase MCP server (`.mcp.json` is gitignored, configures `@supabase/mcp-server-supabase`). MCP tools cover `list_tables`, `execute_sql`, `apply_migration`, `get_advisors`, etc. Run `get_advisors` periodically; it flags missing RLS and similar.
- **To write migrations**, use `node scripts/apply-migration.mjs <migration_name> <path_to_sql>`. The committed `.mcp.json` keeps `--read-only` on for safety, so `apply_migration` is blocked by default. The script invokes the MCP stdio entrypoint directly without `--read-only`, reading the token/project-ref from `.mcp.json` so secrets aren't duplicated. Edit `.mcp.json` to drop `--read-only` only if you need many writes in a row, then restore it.

## Working with Supabase on Windows (this dev machine)

Three traps that have bitten before — work around them, don't rediscover them:

- **`npx` is broken on this profile.** The username `THE E&M` contains a space and `&`; `npx`'s cache path resolves through `cmd.exe` and the path gets shredded (`THE E&` is parsed as a command separator). `.mcp.json` therefore invokes `node` against the globally installed entrypoint (`%APPDATA%\npm\node_modules\@supabase\mcp-server-supabase\dist\transports\stdio.js`) rather than `npx ... @supabase/mcp-server-supabase`. If you add another MCP server, do the same.
- **PowerShell pipes drop non-ASCII.** `... | & node ...` encodes the pipe with `$OutputEncoding` (ASCII by default on Windows PowerShell 5.1), so Korean text in SQL gets silently replaced with `?` before reaching the server. Symptom: migrations "succeed" but `드롭` becomes `??`. Fix: launch node via `System.Diagnostics.Process` and write raw UTF-8 bytes to `StandardInput.BaseStream` (`PowerShell 5.1` lacks `StandardInputEncoding`, so byte-level writes are the only reliable path). Verify with `encode(convert_to(col, 'UTF8'), 'hex')` and a `position('?' in col) > 0` sentinel after any migration that includes Korean strings.
- **`apply_migration` in `--read-only` mode** is blocked. The committed `.mcp.json` keeps `--read-only` for safety; for one-off writes, invoke the MCP server stdio directly without the flag instead of editing the config and restarting.

## Other notes

- **Deployment target is Cloudflare Workers only.** A Vercel project existed briefly and was deleted 2026-05-17 — the `@cloudflare/vite-plugin` output format is unservable by Vercel. Don't reintroduce Vercel config or assume Vercel-specific runtime APIs.
- `.lovable/plan.md` describes an aspirational migration off TanStack Start to a plain Vite SPA. That migration **did not happen** — the current code is still on TanStack Start. Treat the file as historical context, not as a spec to follow.
- Recent commits suggest the team works in short batches with terse messages ("Changes"); larger commits use Korean summaries.
