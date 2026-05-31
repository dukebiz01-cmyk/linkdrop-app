// discover-content — YouTube 전용 영상 후보 검색.
//
// POST { keyword: string }
// → { candidates: NormalizedCandidate[], stats, errors, cached }
//
// §0 준수:
//   - 공식 API 만 (YouTube Data API v3). 스크래핑 X.
//   - 후보 반환만. content_sources 자동 등록 X (UI 에서 [등록] 클릭).
//   - 키는 Deno.env.get 으로만. 코드 리터럴 X.
//   - 인스타/틱톡/네이버클립 자동 검색 X (URL 직접 입력 경로로 분리).
//
// 검색어 보강은 /api/discover (TanStack 서버) 에서 처리하고 Edge 는 받은
// keyword 를 그대로 YouTube search.list 에 전달.
//
// 캐시: 인스턴스 메모리 LRU 30분 TTL — 같은 키워드 반복이 quota 안 까먹게.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";

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

type NormalizedCandidate = {
  provider: "youtube";
  source_url: string;
  source_id: string;
  canonical_url: string;
  title: string | null;
  thumbnail_url: string | null;
  author_name: string | null;
  duration_sec: number | null;
  raw_meta: Record<string, unknown>;
};

type Stats = { yt: number; kept: number };

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<
  string,
  { at: number; data: { candidates: NormalizedCandidate[]; stats: Stats } }
>();

function cacheKey(keyword: string): string {
  return keyword.trim().toLowerCase();
}

// ============================================================
// YouTube Data API v3 search.list
// ============================================================
async function searchYouTube(keyword: string): Promise<NormalizedCandidate[]> {
  if (!YOUTUBE_API_KEY) return [];
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
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
      publishedAt?: string;
    };
  }>;
  const out: NormalizedCandidate[] = [];
  for (const it of items) {
    const vid = it.id?.videoId;
    if (!vid) continue;
    const sn = it.snippet ?? {};
    const thumb =
      sn.thumbnails?.high?.url ??
      sn.thumbnails?.medium?.url ??
      sn.thumbnails?.default?.url ??
      null;
    out.push({
      provider: "youtube",
      source_url: `https://www.youtube.com/watch?v=${vid}`,
      source_id: vid,
      canonical_url: `https://www.youtube.com/watch?v=${vid}`,
      title: sn.title ?? null,
      thumbnail_url: thumb,
      author_name: sn.channelTitle ?? null,
      duration_sec: null, // videos.list 보강은 등록 시점에 (1 unit). 검색 단계 생략.
      raw_meta: {
        description: sn.description ?? "",
        publishedAt: sn.publishedAt ?? null,
      },
    });
  }
  return out;
}

// ============================================================
// 룰 기반 매칭 — keyword 토큰 중 하나라도 title/description/author 에 포함
// ============================================================
function matchesKeyword(c: NormalizedCandidate, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  const tokens = k.split(/\s+/).filter(Boolean);
  const haystack = [c.title ?? "", String(c.raw_meta.description ?? ""), c.author_name ?? ""]
    .join(" ")
    .toLowerCase();
  return tokens.some((t) => haystack.includes(t));
}

// ============================================================
// Main
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { keyword?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  const keyword = (body.keyword ?? "").trim();
  if (!keyword) return jsonResponse({ error: "MISSING_KEYWORD" }, 400);
  if (keyword.length > 120) return jsonResponse({ error: "KEYWORD_TOO_LONG" }, 400);

  const cKey = cacheKey(keyword);
  const hit = cache.get(cKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return jsonResponse({ ...hit.data, cached: true, errors: {} });
  }

  const errors: Record<string, string> = {};
  let ytItems: NormalizedCandidate[] = [];
  try {
    ytItems = await searchYouTube(keyword);
  } catch (e) {
    errors.youtube = String((e as Error)?.message ?? e);
  }

  const kept = ytItems.filter((c) => matchesKeyword(c, keyword));
  const stats: Stats = { yt: ytItems.length, kept: kept.length };
  const payload = { candidates: kept, stats };
  cache.set(cKey, { at: Date.now(), data: payload });
  return jsonResponse({ ...payload, errors, cached: false });
});
