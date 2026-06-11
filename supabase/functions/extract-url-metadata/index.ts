// extract-url-metadata
// POST /functions/v1/extract-url-metadata { url: string }
// Returns provider-tagged metadata for a URL, using Postgres cache (url_metadata_cache).
//
// Adapters:
//   - YouTube → oEmbed (no API key, CORS-friendly, 7d TTL)
//   - Instagram → OG tags (public posts only, 1d TTL)
//   - other → generic OG/Twitter card scraping (6h TTL)
//
// Auth: requires JWT (verify_jwt = true). User identity not used; gate exists to prevent
// abuse of outbound fetcher.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Provider = "youtube" | "instagram" | "tiktok" | "naver_clip" | "manual";

interface ExtractResult {
  provider: Provider;
  canonicalUrl: string;
  sourceId: string | null;
  title: string | null;
  description: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
  embedHtml: string | null;
  durationSec: number | null;
  siteName: string | null;
  language: string | null;
  rawMeta: Record<string, unknown>;
  extractionMethod: "oembed" | "og_tags" | "manual";
  extractionConfidence: number;
  extractionErrors: string[];
  cached: boolean;
  fetchedAt: string;
  expiresAt: string;
  /** Arch A 커머스: persist_source=true 시 생성/조회된 content_sources.id(uuid). 그 외 null. */
  source_id?: string | null;
}

const TTL = {
  youtube: 7 * 24 * 60, // minutes
  instagram: 24 * 60,
  tiktok: 24 * 60,
  naver_clip: 12 * 60,
  manual: 6 * 60,
} as const;

const FETCH_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_500_000; // 1.5MB
const USER_AGENT =
  "LinkdropBot/1.0 (+https://linkdrop.app; metadata-preview)";

const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;
const IG_REGEX =
  /instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;
const TIKTOK_REGEX =
  /tiktok\.com\/(?:@[^/]+\/video\/(\d+)|v\/(\d+))/;
const NAVER_CLIP_REGEX =
  /tv\.naver\.com\/v\/(\d+)|naver\.me\/([A-Za-z0-9]+)/;

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local
  /^::1$/,
  /^fc[0-9a-f]{2}:/i, // ULA
  /^fe80:/i, // link-local v6
  /^0\./,
  /\.internal$/i,
  /\.local$/i,
];

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return PRIVATE_HOST_PATTERNS.some((p) => p.test(h));
}

function detectProvider(url: string): {
  provider: Provider;
  canonicalUrl: string;
  sourceId: string | null;
} {
  const yt = url.match(YT_REGEX);
  if (yt) {
    return {
      provider: "youtube",
      sourceId: yt[1],
      canonicalUrl: `https://www.youtube.com/watch?v=${yt[1]}`,
    };
  }
  const ig = url.match(IG_REGEX);
  if (ig) {
    return {
      provider: "instagram",
      sourceId: ig[1],
      canonicalUrl: `https://www.instagram.com/p/${ig[1]}/`,
    };
  }
  const tt = url.match(TIKTOK_REGEX);
  if (tt) {
    const id = tt[1] ?? tt[2];
    return {
      provider: "tiktok",
      sourceId: id ?? null,
      canonicalUrl: id ? `https://www.tiktok.com/@x/video/${id}` : url,
    };
  }
  const naver = url.match(NAVER_CLIP_REGEX);
  if (naver) {
    return {
      provider: "naver_clip",
      sourceId: naver[1] ?? naver[2] ?? null,
      canonicalUrl: naver[1]
        ? `https://tv.naver.com/v/${naver[1]}`
        : url,
    };
  }
  // generic: keep as-is but strip common tracking params
  return { provider: "manual", sourceId: null, canonicalUrl: stripTracking(url) };
}

function stripTracking(input: string): string {
  try {
    const u = new URL(input);
    const drop = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "igshid",
      "ref",
      "ref_src",
    ];
    drop.forEach((k) => u.searchParams.delete(k));
    u.hash = "";
    // normalize: drop trailing slash except root
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    return u.toString();
  } catch {
    return input;
  }
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`unsupported_scheme:${u.protocol}`);
  }
  if (isPrivateHost(u.hostname)) {
    throw new Error(`blocked_private_host:${u.hostname}`);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ac.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        ...(init?.headers ?? {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function readBounded(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let total = 0;
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel("size_limit");
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

// ---------- adapters ----------

async function fetchYouTube(canonicalUrl: string): Promise<Partial<ExtractResult>> {
  const oembedUrl =
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
  const res = await safeFetch(oembedUrl);
  if (!res.ok) throw new Error(`oembed_http_${res.status}`);
  const data = await res.json() as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
    html?: string;
  };
  return {
    title: data.title ?? null,
    authorName: data.author_name ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    embedHtml: data.html ?? null,
    siteName: "YouTube",
    extractionMethod: "oembed",
    extractionConfidence: 1.0,
    rawMeta: data as Record<string, unknown>,
  };
}

const META_RE =
  /<meta\s+[^>]*?(?:property|name)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*)["'][^>]*>/gi;
const META_RE_REV =
  /<meta\s+[^>]*?content\s*=\s*["']([^"']*)["'][^>]*?(?:property|name)\s*=\s*["']([^"']+)["'][^>]*>/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const LANG_RE = /<html[^>]*\slang\s*=\s*["']([^"']+)["']/i;

function parseOg(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const re of [META_RE, META_RE_REV]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const [, a, b] = m;
      const key = re === META_RE ? a : b;
      const val = re === META_RE ? b : a;
      const lk = key.toLowerCase();
      if (
        lk.startsWith("og:") ||
        lk.startsWith("twitter:") ||
        lk === "description" ||
        lk === "author"
      ) {
        // first occurrence wins
        if (!(lk in out)) out[lk] = decodeHtml(val);
      }
    }
  }
  const t = html.match(TITLE_RE);
  if (t && !out["og:title"]) out["title"] = decodeHtml(t[1].trim());
  const lang = html.match(LANG_RE);
  if (lang) out["html:lang"] = lang[1];
  return out;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

async function fetchOgAdapter(
  canonicalUrl: string,
  provider: Provider,
): Promise<Partial<ExtractResult>> {
  const res = await safeFetch(canonicalUrl);
  if (!res.ok) throw new Error(`og_http_${res.status}`);
  const html = await readBounded(res);
  const og = parseOg(html);
  const title =
    og["og:title"] ?? og["twitter:title"] ?? og["title"] ?? null;
  const description =
    og["og:description"] ?? og["twitter:description"] ?? og["description"] ?? null;
  const image =
    og["og:image"] ?? og["og:image:secure_url"] ?? og["twitter:image"] ?? null;
  const siteName = og["og:site_name"] ?? null;
  const author = og["article:author"] ?? og["author"] ?? null;
  const language = og["og:locale"] ?? og["html:lang"] ?? null;

  const errors: string[] = [];
  if (!title) errors.push("missing_title");
  if (!image) errors.push("missing_image");

  return {
    title,
    description,
    authorName: author,
    thumbnailUrl: image,
    embedHtml: null,
    siteName,
    language,
    extractionMethod: "og_tags",
    extractionConfidence: title ? (image ? 0.9 : 0.6) : 0.3,
    extractionErrors: errors,
    rawMeta: og,
  };
}

// ---------- content_sources persistence (Arch A: 커머스 source) ----------
// persist_source=true 일 때 OG 결과를 content_sources 에 UPSERT 하고 content_sources.id(uuid)
// 를 반환한다. extract-meta 의 반환 계약(JSON source_id = content_sources.id uuid)과 동일하게
// 맞춰 /api/drops → create_drop_v2(p_source_id uuid) 가 그대로 동작한다.
// ⚠️ 컬럼 source_id(text)는 플랫폼 id(비영상 manual 은 null) — 반환하는 source_id(uuid)와 다름.
// ⚠️ rights_status 는 set 하지 않음 → default('unclaimed'). INSERT 는 service-role 클라(supa, RLS 우회).
// supabase-js upsert 는 payload 컬럼 전체를 ON CONFLICT 시 UPDATE 한다(미포함 컬럼은 보존).
async function persistContentSource(
  supa: ReturnType<typeof createClient>,
  args: {
    provider: string;
    rawUrl: string;
    canonicalUrl: string;
    platformSourceId: string | null;
    title: string | null;
    thumbnailUrl: string | null;
    rawMeta: Record<string, unknown>;
    extractionConfidence: number;
    priceKrw: number | null;
    category: string | null;
  },
): Promise<string | null> {
  const { data, error } = await supa
    .from("content_sources")
    .upsert(
      {
        provider: args.provider,
        source_url: args.rawUrl,
        canonical_url: args.canonicalUrl,
        source_id: args.platformSourceId,
        title: args.title,
        thumbnail_url: args.thumbnailUrl,
        raw_meta: args.rawMeta,
        extraction_method: "og_tags",
        extraction_confidence: args.extractionConfidence,
        price_krw: args.priceKrw,
        price_currency: "KRW",
        category: args.category,
        source_mode: "creator_registered",
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "provider,canonical_url" },
    )
    .select("id")
    .single();
  if (error || !data) {
    console.error("persist_source(content_sources) failed:", error?.message ?? "no row");
    return null;
  }
  return (data as { id: string }).id;
}

// ---------- main handler ----------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let body: {
    url?: string;
    persist_source?: boolean;
    price_krw?: number | null;
    category?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const raw = body?.url?.trim();
  if (!raw) return jsonResponse({ error: "url_required" }, 400);

  // Arch A 커머스 옵션 — 미전달이면 기존 동작과 100% 동일(persist 안 함).
  const persistSource = body?.persist_source === true;
  const priceKrw = typeof body?.price_krw === "number" ? body.price_krw : null;
  const category =
    typeof body?.category === "string" && body.category.trim() ? body.category.trim() : null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return jsonResponse({ error: "invalid_url" }, 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return jsonResponse({ error: "unsupported_scheme" }, 400);
  }
  if (isPrivateHost(parsed.hostname)) {
    return jsonResponse({ error: "blocked_private_host" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // V2 SUPABASE_SECRET_KEY preferred; fall back to legacy SERVICE_ROLE_KEY
  // (Supabase auto-injects the legacy var even after V2 transition).
  const secretKey =
    Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey) {
    return jsonResponse({ error: "server_not_configured" }, 500);
  }
  const supa = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { provider, canonicalUrl, sourceId } = detectProvider(raw);

  // 1) cache lookup (bumps hit_count + last_accessed_at if valid)
  const { data: cacheRow } = await supa.rpc("url_metadata_cache_get", {
    p_canonical_url: canonicalUrl,
  });
  if (cacheRow && cacheRow.id) {
    // Arch A: 캐시 히트라도 persist_source 면 content_sources 에 (재)연결해 source_id(uuid) 확보.
    let persistedSourceId: string | null = null;
    if (persistSource && (cacheRow.title || cacheRow.thumbnail_url)) {
      persistedSourceId = await persistContentSource(supa, {
        provider: cacheRow.provider,
        rawUrl: raw,
        canonicalUrl: cacheRow.canonical_url,
        platformSourceId: cacheRow.source_id,
        title: cacheRow.title,
        thumbnailUrl: cacheRow.thumbnail_url,
        rawMeta: cacheRow.raw_meta ?? {},
        extractionConfidence: Number(cacheRow.extraction_confidence ?? 1.0),
        priceKrw,
        category,
      });
    }
    return jsonResponse({
      provider: cacheRow.provider,
      canonicalUrl: cacheRow.canonical_url,
      sourceId: cacheRow.source_id,
      title: cacheRow.title,
      description: cacheRow.description,
      authorName: cacheRow.author_name,
      thumbnailUrl: cacheRow.thumbnail_url,
      embedHtml: cacheRow.embed_html,
      durationSec: cacheRow.duration_sec,
      siteName: cacheRow.site_name,
      language: cacheRow.language,
      rawMeta: cacheRow.raw_meta,
      extractionMethod: cacheRow.extraction_method,
      extractionConfidence: Number(cacheRow.extraction_confidence ?? 1.0),
      extractionErrors: cacheRow.extraction_errors ?? [],
      cached: true,
      fetchedAt: cacheRow.fetched_at,
      expiresAt: cacheRow.expires_at,
      source_id: persistedSourceId,
    } satisfies ExtractResult);
  }

  // 2) fetch fresh
  let partial: Partial<ExtractResult> = {};
  const errors: string[] = [];
  try {
    if (provider === "youtube") {
      partial = await fetchYouTube(canonicalUrl);
    } else {
      partial = await fetchOgAdapter(canonicalUrl, provider);
    }
  } catch (e) {
    errors.push(String((e as Error).message ?? e));
    // For YouTube, fall back to OG so we still get *something*
    if (provider === "youtube") {
      try {
        partial = await fetchOgAdapter(canonicalUrl, provider);
      } catch (e2) {
        errors.push(String((e2 as Error).message ?? e2));
      }
    }
  }

  const ttlMin = TTL[provider];
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + ttlMin * 60_000);

  const row = {
    canonical_url: canonicalUrl,
    provider,
    source_id: sourceId,
    title: partial.title ?? null,
    description: partial.description ?? null,
    author_name: partial.authorName ?? null,
    thumbnail_url: partial.thumbnailUrl ?? null,
    embed_html: partial.embedHtml ?? null,
    duration_sec: partial.durationSec ?? null,
    site_name: partial.siteName ?? null,
    language: partial.language ?? null,
    raw_meta: partial.rawMeta ?? {},
    extraction_method: partial.extractionMethod ?? "og_tags",
    extraction_confidence: partial.extractionConfidence ?? 0,
    extraction_errors: [...errors, ...(partial.extractionErrors ?? [])],
    fetched_at: fetchedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  // 3) upsert by canonical_url
  const { error: upsertErr } = await supa
    .from("url_metadata_cache")
    .upsert(row, { onConflict: "canonical_url" });

  if (upsertErr) {
    return jsonResponse(
      {
        error: "cache_write_failed",
        detail: upsertErr.message,
        partial: row,
      },
      500,
    );
  }

  // Arch A: persist_source 면 OG 결과를 content_sources 에 UPSERT 하고 id(uuid) 확보.
  let persistedSourceId: string | null = null;
  if (persistSource && (row.title || row.thumbnail_url)) {
    persistedSourceId = await persistContentSource(supa, {
      provider,
      rawUrl: raw,
      canonicalUrl,
      platformSourceId: sourceId,
      title: row.title,
      thumbnailUrl: row.thumbnail_url,
      rawMeta: row.raw_meta,
      extractionConfidence: row.extraction_confidence,
      priceKrw,
      category,
    });
  }

  return jsonResponse({
    provider,
    canonicalUrl,
    sourceId,
    title: row.title,
    description: row.description,
    authorName: row.author_name,
    thumbnailUrl: row.thumbnail_url,
    embedHtml: row.embed_html,
    durationSec: row.duration_sec,
    siteName: row.site_name,
    language: row.language,
    rawMeta: row.raw_meta,
    extractionMethod: row.extraction_method as "oembed" | "og_tags" | "manual",
    extractionConfidence: row.extraction_confidence,
    extractionErrors: row.extraction_errors,
    cached: false,
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
    source_id: persistedSourceId,
  } satisfies ExtractResult);
});
