// extract-meta — 영상 URL → content_sources 메타데이터 (AI 없음, oEmbed 무료)
//
// POST { url } → { source_id, title, thumbnail_url, author_name, duration_sec,
//                   provider, raw_meta, cached }
//
// Step 6 명세 §1 기준. 명세의 컬럼명(url/normalized_url)이 아니라 실제 v3.0
// content_sources schema(source_url/canonical_url)를 따른다 (A안).
// quota 게이트 없음 — AI 호출이 아니므로 (명세 §0.3).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

// SSRF 가드: youtube/instagram URL 패턴에 매칭되지 않으면 detectProvider 가 null →
// 외부 fetch 는 오직 youtube.com oEmbed 엔드포인트로만 나간다.
const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;
const IG_REGEX = /instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;

type Provider = "youtube" | "instagram";

function detectProvider(
  url: string,
): { provider: Provider; canonicalUrl: string; sourceId: string } | null {
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
  return null; // 미지원 플랫폼 (SSRF 가드: 그 외 URL 은 전부 차단)
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchYouTubeOembed(canonicalUrl: string): Promise<{
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string;
}> {
  const oembedUrl =
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(oembedUrl, {
      signal: ac.signal,
      redirect: "follow",
      headers: { "User-Agent": "LinkdropBot/1.0 (+https://drop.how; metadata)" },
    });
    if (!res.ok) throw new Error(`oembed_http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  const raw = body?.url?.trim();
  if (!raw) {
    return jsonResponse({ error: "INVALID_URL", message: "영상 링크가 필요해요." }, 400);
  }

  const detected = detectProvider(raw);
  if (!detected) {
    return jsonResponse(
      {
        error: "INVALID_URL",
        message: "YouTube 또는 Instagram 영상 링크만 지원해요.",
      },
      400,
    );
  }
  const { provider, canonicalUrl, sourceId } = detected;

  // 1) content_sources 캐시 조회 (canonical_url 기준)
  const { data: existing } = await supabase
    .from("content_sources")
    .select("id, title, thumbnail_url, author_name, duration_sec, provider, raw_meta")
    .eq("canonical_url", canonicalUrl)
    .maybeSingle();

  if (existing) {
    return jsonResponse({
      source_id: existing.id,
      title: existing.title,
      thumbnail_url: existing.thumbnail_url,
      author_name: existing.author_name,
      duration_sec: existing.duration_sec,
      provider: existing.provider,
      raw_meta: existing.raw_meta,
      cached: true,
    });
  }

  // 2) oEmbed — youtube 만. instagram 은 Phase 1 제한(공식 oEmbed 토큰 필요) → 최소 정보로 진행.
  let title: string | null = null;
  let thumbnailUrl: string | null = null;
  let authorName: string | null = null;
  let embedHtml: string | null = null;
  let rawMeta: Record<string, unknown> = {};
  const errors: string[] = [];

  if (provider === "youtube") {
    try {
      const o = await fetchYouTubeOembed(canonicalUrl);
      title = o.title ?? null;
      authorName = o.author_name ?? null;
      thumbnailUrl = o.thumbnail_url ?? null;
      embedHtml = o.html ?? null;
      rawMeta = o as Record<string, unknown>;
    } catch (e) {
      errors.push(String((e as Error).message ?? e));
    }
  }

  // youtube oEmbed 가 실패하면(비공개/삭제 영상) 저장하지 않고 에러 반환.
  if (provider === "youtube" && !title) {
    return jsonResponse(
      {
        error: "OEMBED_FAILED",
        message: "영상 정보를 가져오지 못했어요. 링크를 확인해 주세요.",
        detail: errors,
      },
      502,
    );
  }

  // 3) content_sources INSERT — source_mode/rights_status 는 default 사용.
  const { data: inserted, error: insErr } = await supabase
    .from("content_sources")
    .insert({
      provider,
      source_url: raw,
      canonical_url: canonicalUrl,
      source_id: sourceId,
      title,
      thumbnail_url: thumbnailUrl,
      author_name: authorName,
      duration_sec: null, // oEmbed 미제공 — Phase 2 YouTube Data API
      embed_html: embedHtml,
      raw_meta: rawMeta,
      extraction_method: "oembed",
      extraction_confidence: title ? 1.0 : 0.3,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return jsonResponse(
      { error: "DB_ERROR", message: insErr?.message ?? "저장에 실패했어요." },
      500,
    );
  }

  return jsonResponse({
    source_id: inserted.id,
    title,
    thumbnail_url: thumbnailUrl,
    author_name: authorName,
    duration_sec: null,
    provider,
    raw_meta: rawMeta,
    cached: false,
  });
});
