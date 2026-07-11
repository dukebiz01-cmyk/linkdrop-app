/**
 * Cloudflare Worker 단축 링크 핸들러 (B0b Phase 3).
 *
 * drop.how/{6자base62} → resolve_short_link RPC → 302 → app.drop.how/d/{share_uuid}.
 * 비동기로 track_short_link_click 호출 (응답 latency 영향 0, ctx.waitUntil 사용).
 *
 * `.server.ts` 접미사 — Vite 가 클라이언트 번들에서 제거.
 * Cloudflare Worker runtime 전용. env는 build-time inline (VITE_* import.meta.env).
 */

const SHORT_CODE_RE = /^[0-9A-Za-z]{6}$/;
// {slug}-{code} 신형식(Phase 1) — slug 는 하이픈 허용이므로 "마지막 하이픈 뒤 6자 = 코드".
//   코드 문자셋(base62)에 하이픈이 없어 분리가 항상 유일. slug부는 해석에 미사용
//   (장식·신뢰 목적 — 검증 생략, resolve 는 코드로만).
const SLUG_CODE_RE = /^[a-z0-9-]+-[0-9A-Za-z]{6}$/;
const APP_HOST = "app.drop.how";

type WaitUntilCtx = { waitUntil?: (p: Promise<unknown>) => void } | unknown;

type ResolveRow = {
  share_uuid: string;
  info_drop_id: string;
  expires_at: string | null;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fallbackToApp(): Response {
  return Response.redirect(`https://${APP_HOST}/`, 302);
}

// S2c — 매장 slug 폴백 조회(코드 미스일 때만 호출 — 코드 우선, 기존 6자 링크 불파손).
//   raw PostgREST + publishable key(기존 resolve_short_link 패턴 동일). RLS partners_public_read
//   (approved 만 public SELECT)가 비승인 매장을 자동 배제 — 추가 필터 불요.
//   실패(형식·env 부재·조회오류·미존재)는 전부 null → 호출측 기존 fallbackToApp 유지.
const PARTNER_SLUG_RE = /^[a-z0-9-]{2,40}$/;

async function resolvePartnerSlug(raw: string): Promise<string | null> {
  const s = raw.toLowerCase();
  if (!PARTNER_SLUG_RE.test(s)) return null;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/partners?select=slug&slug=eq.${encodeURIComponent(s)}&limit=1`,
      { headers: { apikey: supabaseKey, authorization: `Bearer ${supabaseKey}` } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length > 0 ? s : null;
  } catch {
    return null;
  }
}

export async function handleShortLink(request: Request, ctx: WaitUntilCtx): Promise<Response> {
  const url = new URL(request.url);

  // 루트 `/` 또는 빈 path → app으로
  if (url.pathname === "/" || url.pathname === "") {
    return fallbackToApp();
  }

  // 첫 segment 만 처리 — drop.how/abc123 · drop.how/{slug}-abc123 · drop.how/{slug}
  const firstSeg = url.pathname.slice(1).split("/")[0];

  // 파싱 순서(Phase 1): ① 6자 단독 코드(기존) → ② {slug}-{code} 신형식(마지막 하이픈
  //   뒤 6자 추출) → ③ 매장 slug 폴백(기존 S2c) → ④ 홈. 기존 두 경로 동작 불변.
  let shareCode: string | null = null;
  if (SHORT_CODE_RE.test(firstSeg)) {
    shareCode = firstSeg; // ① 기존 6자 단독 코드.
  } else if (SLUG_CODE_RE.test(firstSeg)) {
    shareCode = firstSeg.slice(-6); // ② 신형식 — 코드에 하이픈 없음이 보장돼 뒤 6자가 곧 코드.
  }

  // ③ 코드 형식 전무 — 매장 slug 시도 후 ④ 홈으로.
  // S2c — 하이픈 포함(신형식 불일치)·2~5자·7~40자 slug 는 전부 이 지점(실패 A)으로 온다.
  if (!shareCode) {
    const slug = await resolvePartnerSlug(firstSeg);
    if (slug) {
      // click 추적 없음 — 매장 페이지 방문은 공유 체인 아님(추적은 공유 코드 전용).
      return Response.redirect(`https://${APP_HOST}/alliance/${slug}`, 302);
    }
    return fallbackToApp();
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !supabaseKey) {
    // 환경 변수 부재 — Worker config 오류. 운영 추적 가능하도록 로그만.
    console.error("[short-link] missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
    return fallbackToApp();
  }

  // resolve_short_link RPC
  let resolveRows: ResolveRow[] = [];
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_short_link`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        authorization: `Bearer ${supabaseKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_share_code: shareCode }),
    });
    if (!res.ok) {
      console.warn(`[short-link] resolve_short_link returned ${res.status}`);
      return fallbackToApp();
    }
    resolveRows = (await res.json()) as ResolveRow[];
  } catch (err) {
    console.error("[short-link] resolve_short_link fetch failed", err);
    return fallbackToApp();
  }

  if (!Array.isArray(resolveRows) || resolveRows.length === 0) {
    // 미존재 또는 만료된 코드 → S2c: 전체 세그먼트로 slug 폴백(실패 B — 코드 우선 순서 유지) → 홈.
    //   전체 세그먼트 기준인 이유: 6자 순수 영숫자 slug(기존)뿐 아니라, 신형식처럼 보이는
    //   기존 매장 slug(예: noeul-coffee — 끝 6자가 영숫자)도 여기서 복구돼야 함(하위호환).
    const slug = await resolvePartnerSlug(firstSeg);
    if (slug) {
      return Response.redirect(`https://${APP_HOST}/alliance/${slug}`, 302);
    }
    return fallbackToApp();
  }

  const { share_uuid } = resolveRows[0];

  // 비동기 클릭 추적 — 응답 블로킹 없이 fire-and-forget
  // SHA-256 해시는 응답에 영향 없도록 ctx.waitUntil 내부에서 수행
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const referer = request.headers.get("referer") ?? "";

  const trackPromise = (async () => {
    try {
      const ipHash = ip ? await sha256Hex(ip) : null;
      const uaHash = ua ? await sha256Hex(ua) : null;
      const metadata: Record<string, unknown> = {};
      if (referer) metadata.referer = referer.slice(0, 256);
      await fetch(`${supabaseUrl}/rest/v1/rpc/track_short_link_click`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          authorization: `Bearer ${supabaseKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_share_code: shareCode,
          p_ip_hash: ipHash,
          p_user_agent_hash: uaHash,
          p_metadata: metadata,
        }),
      });
    } catch (err) {
      console.error("[short-link] track_short_link_click failed", err);
    }
  })();

  const ctxWithWait = ctx as { waitUntil?: (p: Promise<unknown>) => void };
  if (typeof ctxWithWait.waitUntil === "function") {
    ctxWithWait.waitUntil(trackPromise);
  }

  return Response.redirect(`https://${APP_HOST}/d/${share_uuid}`, 302);
}

/** drop.how apex 호스트인지 판정. host header 또는 URL hostname 사용. */
export function isShortLinkHost(request: Request): boolean {
  const url = new URL(request.url);
  return url.hostname === "drop.how";
}
