// discover-content — 멀티소스 영상/콘텐츠 후보 검색 (어댑터 구조).
//
// POST { keyword: string }
// → { candidates: ResponseCandidate[], stats, errors, cached }
//
// G1: YouTube 하드코딩 → SearchAdapter 어댑터 구조 전환 + Naver(뉴스/블로그) 어댑터 추가.
//   - 활성 어댑터 [youtube, naver_news, naver_blog] 병렬(Promise.allSettled) → interleave merge.
//   - 어댑터별 실패/키없음 = graceful(빈 배열, 전체 안 죽임).
//   - 키는 Deno.env.get 으로만(코드 리터럴 X).
//   - 가져오기/정규화(content_sources)는 클라이언트가 처리. 여기선 후보 반환만.
//   - G2(Naver 가져오기·/d 렌더)·G3(AI 랭킹)은 범위 밖 — merge = 단순 라운드로빈.

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

// ============================================================
// 어댑터 정규화 타입 (provider 무관 공통 후보)
// ============================================================
interface NormalizedCandidate {
  provider: string; // 'youtube' | 'naver_news' | 'naver_blog'
  source_id: string; // 안정적 id (YouTube=videoId, Naver=link)
  canonical_url: string;
  title: string; // HTML 태그 strip
  thumbnail_url: string | null;
  author_name: string | null;
  published_at: string | null;
  snippet: string | null;
}

interface SearchAdapter {
  provider: string;
  canSearch: boolean;
  search(query: string): Promise<NormalizedCandidate[]>;
}

// 클라이언트(DiscoverSection)가 기대하는 응답 후보 — 기존 YouTube 후보와 100% 호환.
//   source_url/duration_sec/raw_meta 는 정규화 후보에서 파생(YouTube 가져오기 회귀 0).
interface ResponseCandidate {
  provider: string;
  source_url: string;
  source_id: string;
  canonical_url: string;
  title: string | null;
  thumbnail_url: string | null;
  author_name: string | null;
  duration_sec: number | null;
  raw_meta: Record<string, unknown>;
  published_at: string | null;
  snippet: string | null;
}

type Stats = { yt: number; kept: number };

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ============================================================
// 룰 기반 매칭 — keyword 토큰 중 하나라도 title/snippet/author 에 포함 (YouTube 보존)
// ============================================================
function matchesKeyword(c: NormalizedCandidate, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  const tokens = k.split(/\s+/).filter(Boolean);
  const haystack = [c.title ?? "", c.snippet ?? "", c.author_name ?? ""].join(" ").toLowerCase();
  return tokens.some((t) => haystack.includes(t));
}

// ============================================================
// YouTube 어댑터 — 기존 search.list 래핑(동작·결과 동일). 키워드 필터 보존.
// ============================================================
async function youtubeSearch(keyword: string): Promise<NormalizedCandidate[]> {
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
      sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null;
    out.push({
      provider: "youtube",
      source_id: vid,
      canonical_url: `https://www.youtube.com/watch?v=${vid}`,
      title: sn.title ?? "",
      thumbnail_url: thumb,
      author_name: sn.channelTitle ?? null,
      published_at: sn.publishedAt ?? null,
      snippet: sn.description ?? "",
    });
  }
  // 기존 동작 보존 — 키워드 토큰 매칭으로 필터.
  return out.filter((c) => matchesKeyword(c, keyword));
}

// ============================================================
// Naver 어댑터 — 뉴스/블로그 검색 (썸네일 없음 → null). 키 없으면 skip.
// ============================================================
async function naverSearch(type: "news" | "blog", keyword: string): Promise<NormalizedCandidate[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  const url = new URL(`https://openapi.naver.com/v1/search/${type}.json`);
  url.searchParams.set("query", keyword);
  url.searchParams.set("sort", "sim");
  url.searchParams.set("display", "10");
  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NAVER_${type.toUpperCase()}_FAILED status=${res.status} body=${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const items = (json.items ?? []) as Array<{
    title?: string;
    link?: string;
    description?: string;
    bloggername?: string;
    pubDate?: string;
    postdate?: string;
  }>;
  const provider = type === "news" ? "naver_news" : "naver_blog";
  const out: NormalizedCandidate[] = [];
  for (const it of items) {
    if (!it.link) continue;
    out.push({
      provider,
      source_id: it.link,
      canonical_url: it.link,
      title: stripHtml(it.title ?? ""),
      thumbnail_url: null,
      author_name: type === "blog" ? (it.bloggername ?? null) : null,
      published_at: (type === "blog" ? it.postdate : it.pubDate) ?? null,
      snippet: stripHtml(it.description ?? ""),
    });
  }
  return out;
}

const ADAPTERS: SearchAdapter[] = [
  { provider: "youtube", canSearch: true, search: (q) => youtubeSearch(q) },
  { provider: "naver_news", canSearch: true, search: (q) => naverSearch("news", q) },
  { provider: "naver_blog", canSearch: true, search: (q) => naverSearch("blog", q) },
];

// 소스별 라운드로빈 interleave (G1 — AI 랭킹 아님).
function interleave(lists: NormalizedCandidate[][]): NormalizedCandidate[] {
  const out: NormalizedCandidate[] = [];
  const max = lists.reduce((m, l) => Math.max(m, l.length), 0);
  for (let i = 0; i < max; i++) {
    for (const l of lists) {
      if (i < l.length) out.push(l[i]);
    }
  }
  return out;
}

// 정규화 후보 → 응답 후보 (YouTube 후보를 기존과 동일하게 재현).
function toResponseCandidate(c: NormalizedCandidate): ResponseCandidate {
  return {
    provider: c.provider,
    source_url: c.canonical_url,
    source_id: c.source_id,
    canonical_url: c.canonical_url,
    title: c.title,
    thumbnail_url: c.thumbnail_url,
    author_name: c.author_name,
    duration_sec: null,
    raw_meta: { description: c.snippet ?? "", publishedAt: c.published_at ?? null },
    published_at: c.published_at,
    snippet: c.snippet,
  };
}

// ============================================================
// 캐시 — 인스턴스 메모리 LRU 30분 TTL (병합 결과 기준).
// ============================================================
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<
  string,
  { at: number; data: { candidates: ResponseCandidate[]; stats: Stats } }
>();

function cacheKey(keyword: string): string {
  return keyword.trim().toLowerCase();
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

  // 어댑터 병렬 실행 — 실패는 해당 provider 빈 배열 + errors 로 graceful.
  const settled = await Promise.allSettled(ADAPTERS.map((a) => a.search(keyword)));
  const errors: Record<string, string> = {};
  const perProvider: NormalizedCandidate[][] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const reason = r.reason;
    errors[ADAPTERS[i].provider] = String(reason?.message ?? reason);
    console.warn(`[discover] ${ADAPTERS[i].provider} 실패(skip):`, reason);
    return [];
  });

  const merged = interleave(perProvider);
  const candidates = merged.map(toResponseCandidate);
  const stats: Stats = { yt: perProvider[0]?.length ?? 0, kept: candidates.length };
  const payload = { candidates, stats };
  cache.set(cKey, { at: Date.now(), data: payload });
  return jsonResponse({ ...payload, errors, cached: false });
});
