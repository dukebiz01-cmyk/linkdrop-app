// discover-content — 매장 키워드 → 외부 영상 후보 (Phase 2a)
//
// POST { keyword: string, platforms?: ('youtube'|'instagram'|'tiktok'|'naver_clip')[] }
// → { candidates: NormalizedCandidate[], stats: { yt, naver_total, naver_filtered, kept }, errors }
//
// §0 준수:
//   - 공식 API 만 (YouTube Data API v3, Naver Search API). 스크래핑 X.
//   - 후보 반환만. content_sources 자동 등록 X (사장님이 [등록] 클릭해야 INSERT).
//   - 키는 Deno.env.get 으로만. 코드 리터럴 X.
//
// 캐시: 인스턴스 메모리 LRU (수명 동안). 일일 쓰로틀은 /api/discover route 에서.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";
const NAVER_CLIENT_ID = Deno.env.get("NAVER_CLIENT_ID") ?? "";
const NAVER_CLIENT_SECRET = Deno.env.get("NAVER_CLIENT_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

type Provider = "youtube" | "instagram" | "tiktok" | "naver_clip";

type NormalizedCandidate = {
  provider: Provider;
  source_url: string;
  source_id: string | null;
  canonical_url: string;
  title: string | null;
  thumbnail_url: string | null;
  author_name: string | null;
  duration_sec: number | null;
  raw_meta: Record<string, unknown>;
};

// 결과 캐시 (인스턴스 메모리). TTL 30 분. 같은 키워드 반복이 quota 안 까먹게.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; data: { candidates: NormalizedCandidate[]; stats: Stats } }>();

type Stats = { yt: number; naver_total: number; naver_filtered: number; kept: number };

function cacheKey(keyword: string, platforms: string[]): string {
  return `${platforms.slice().sort().join(",")}|${keyword.trim().toLowerCase()}`;
}

// ============================================================
// HTML 엔티티 (Naver title 에 <b>키워드</b>, &quot; 등 섞여 옴)
// ============================================================
function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ============================================================
// YouTube Data API v3 search.list
// ============================================================
async function searchYouTube(keyword: string): Promise<{ items: NormalizedCandidate[]; raw_count: number }> {
  if (!YOUTUBE_API_KEY) return { items: [], raw_count: 0 };
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", keyword);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "8");
  url.searchParams.set("regionCode", "KR");
  url.searchParams.set("relevanceLanguage", "ko");
  url.searchParams.set("key", YOUTUBE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YOUTUBE_SEARCH_FAILED status=${res.status} body=${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const items = (json.items ?? []) as Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
      publishedAt?: string;
    };
  }>;
  const out: NormalizedCandidate[] = [];
  for (const it of items) {
    const vid = it.id?.videoId;
    if (!vid) continue;
    const sn = it.snippet ?? {};
    const thumb = sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null;
    out.push({
      provider: "youtube",
      source_url: `https://www.youtube.com/watch?v=${vid}`,
      source_id: vid,
      canonical_url: `https://www.youtube.com/watch?v=${vid}`,
      title: sn.title ?? null,
      thumbnail_url: thumb,
      author_name: sn.channelTitle ?? null,
      duration_sec: null, // videos.list 보강은 등록 시점에 (1 unit). 검색 단계엔 생략.
      raw_meta: {
        description: sn.description ?? "",
        publishedAt: sn.publishedAt ?? null,
      },
    });
  }
  return { items: out, raw_count: items.length };
}

// ============================================================
// Naver Search webkr → instagram/tiktok/naver_clip 도메인 필터
// ============================================================
const INSTAGRAM_REGEX = /instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i;
const TIKTOK_REGEX = /tiktok\.com\/(?:@[^/]+\/video\/(\d+)|v\/(\d+))/i;
// 네이버 클립 (TV/블로그 영상은 제외 — 클립 도메인만)
const NAVER_CLIP_REGEX = /(?:clip\.naver\.com\/clips\/(\d+)|tv\.naver\.com\/v\/(\d+))/i;

function detectFromLink(
  link: string,
): { provider: Provider; source_id: string; canonical_url: string } | null {
  const ig = link.match(INSTAGRAM_REGEX);
  if (ig) {
    return {
      provider: "instagram",
      source_id: ig[1],
      canonical_url: `https://www.instagram.com/p/${ig[1]}/`,
    };
  }
  const tt = link.match(TIKTOK_REGEX);
  if (tt) {
    const id = tt[1] ?? tt[2] ?? "";
    return { provider: "tiktok", source_id: id, canonical_url: link };
  }
  const nc = link.match(NAVER_CLIP_REGEX);
  if (nc) {
    const id = nc[1] ?? nc[2] ?? "";
    return { provider: "naver_clip", source_id: id, canonical_url: link };
  }
  return null;
}

async function searchNaverWeb(keyword: string): Promise<{
  raw_count: number;
  items: NormalizedCandidate[];
}> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return { raw_count: 0, items: [] };
  const url = new URL("https://openapi.naver.com/v1/search/webkr.json");
  url.searchParams.set("query", keyword);
  url.searchParams.set("display", "30"); // 충분히 받고 클라이언트 필터
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "sim");
  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NAVER_SEARCH_FAILED status=${res.status} body=${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const items = (json.items ?? []) as Array<{ title: string; link: string; description: string }>;

  const out: NormalizedCandidate[] = [];
  const seen = new Set<string>();
  for (const r of items) {
    const detected = detectFromLink(r.link);
    if (!detected) continue;
    const dedupeKey = `${detected.provider}|${detected.source_id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      provider: detected.provider,
      source_url: r.link,
      source_id: detected.source_id || null,
      canonical_url: detected.canonical_url,
      title: stripHtml(r.title),
      thumbnail_url: null, // Naver webkr 은 썸네일 미제공
      author_name: null,
      duration_sec: null,
      raw_meta: {
        description: stripHtml(r.description),
        naver_link: r.link,
      },
    });
  }
  return { raw_count: items.length, items: out };
}

// ============================================================
// 룰 기반 매칭 — keyword 가 title/description 에 포함되는가
// ============================================================
function matchesKeyword(c: NormalizedCandidate, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  const tokens = k.split(/\s+/).filter(Boolean);
  const haystack = [
    c.title ?? "",
    String(c.raw_meta.description ?? ""),
    c.author_name ?? "",
  ]
    .join(" ")
    .toLowerCase();
  // 토큰 중 하나라도 포함되면 통과 (느슨한 OR). 명백한 비매칭만 제외.
  return tokens.some((t) => haystack.includes(t));
}

// ============================================================
// Main
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { keyword?: string; platforms?: string[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  const keyword = (body.keyword ?? "").trim();
  if (!keyword) return jsonResponse({ error: "MISSING_KEYWORD" }, 400);
  if (keyword.length > 80) return jsonResponse({ error: "KEYWORD_TOO_LONG" }, 400);

  const allPlatforms: Provider[] = ["youtube", "instagram", "tiktok", "naver_clip"];
  const platforms = Array.isArray(body.platforms) && body.platforms.length > 0
    ? (body.platforms.filter((p) => allPlatforms.includes(p as Provider)) as Provider[])
    : allPlatforms;

  // 캐시 hit
  const cKey = cacheKey(keyword, platforms);
  const hit = cache.get(cKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return jsonResponse({ ...hit.data, cached: true });
  }

  const errors: Record<string, string> = {};
  let ytItems: NormalizedCandidate[] = [];
  let ytRaw = 0;
  let naverItems: NormalizedCandidate[] = [];
  let naverRaw = 0;

  const wantYt = platforms.includes("youtube");
  const wantNaver = platforms.some((p) => p === "instagram" || p === "tiktok" || p === "naver_clip");

  const [ytRes, naverRes] = await Promise.allSettled([
    wantYt ? searchYouTube(keyword) : Promise.resolve({ items: [], raw_count: 0 }),
    wantNaver ? searchNaverWeb(keyword) : Promise.resolve({ items: [], raw_count: 0 }),
  ]);

  if (ytRes.status === "fulfilled") {
    ytItems = ytRes.value.items;
    ytRaw = ytRes.value.raw_count;
  } else {
    errors.youtube = String((ytRes.reason as Error)?.message ?? ytRes.reason);
  }
  if (naverRes.status === "fulfilled") {
    naverItems = naverRes.value.items;
    naverRaw = naverRes.value.raw_count;
  } else {
    errors.naver = String((naverRes.reason as Error)?.message ?? naverRes.reason);
  }

  // 플랫폼 필터 (Naver 결과 중 platforms 에 포함된 것만)
  const naverKept = naverItems.filter((c) => platforms.includes(c.provider));

  // 룰 기반 매칭
  const all = [...ytItems, ...naverKept].filter((c) => matchesKeyword(c, keyword));

  const stats: Stats = {
    yt: ytItems.length,
    naver_total: naverRaw,
    naver_filtered: naverKept.length,
    kept: all.length,
  };

  const payload = { candidates: all, stats, errors };
  cache.set(cKey, { at: Date.now(), data: payload });
  return jsonResponse({ ...payload, cached: false });
});
