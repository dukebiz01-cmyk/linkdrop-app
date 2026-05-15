/**
 * Client SDK for the suggest_intent_for_url RPC (v2.3 step 3).
 *
 * Maps a URL → ordered drop_intents.code suggestions by joining against
 * youtube_category_intent_map in Postgres. For YouTube URLs the SDK first
 * tries to resolve snippet.categoryId via YouTube Data API v3
 * (videos.list?part=snippet) — that lookup is NOT done in Postgres because
 * it requires an API key and outbound HTTP. Resolutions are cached
 * in-memory by videoId for the lifetime of the page.
 *
 * If VITE_YOUTUBE_API_KEY is unset, the SDK skips Data API and passes
 * categoryId=null; the RPC then returns the "Other" sentinel for YouTube
 * hosts and "catch-all" for everything else.
 *
 * Custom buckets (-10 Food & Drink, -11 Shopping) are NOT inferred here;
 * callers that want to force one pass `categoryId: -10` etc. directly.
 */

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type IntentSuggestionSource = "category_map" | "sentinel_other" | "sentinel_catchall";

export interface IntentSuggestion {
  intentCode: string;
  rank: number;
  source: IntentSuggestionSource;
  matchedCategoryId: number | null;
  matchedCategoryName: string | null;
}

export interface SuggestIntentOptions {
  /**
   * Override the resolved YouTube category. When provided the SDK skips
   * Data API resolution entirely. Use this to force a custom bucket
   * (e.g. -10 Food & Drink) or to pass through a categoryId you already
   * resolved upstream.
   */
  categoryId?: number | null;
  /**
   * Skip the YouTube Data API resolution even if VITE_YOUTUBE_API_KEY is
   * configured. Useful for low-signal URLs (e.g. when bandwidth is more
   * important than precision).
   */
  skipYouTubeResolution?: boolean;
  /** Cancel both the Data API call and the RPC. */
  signal?: AbortSignal;
}

export class IntentSuggestionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "IntentSuggestionError";
    this.code = code;
  }
}

/* ------------------------------- Regex ----------------------------------- */

const YT_VIDEO_ID_RE =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;

const YT_HOST_RE = /(?:^|\.)youtube\.com$|^youtu\.be$/i;

function extractYouTubeId(url: string): string | null {
  const m = url.match(YT_VIDEO_ID_RE);
  return m ? m[1] : null;
}

function isYouTubeHost(url: string): boolean {
  try {
    const u = new URL(url);
    return YT_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

/* --------------------------- Category resolution ------------------------- */

const categoryCache = new Map<string, number | null>();

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

async function resolveYouTubeCategory(
  videoId: string,
  signal?: AbortSignal,
): Promise<number | null> {
  if (categoryCache.has(videoId)) {
    return categoryCache.get(videoId) ?? null;
  }
  if (!YT_API_KEY) {
    categoryCache.set(videoId, null);
    return null;
  }
  const endpoint =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=snippet&id=${encodeURIComponent(videoId)}` +
    `&key=${encodeURIComponent(YT_API_KEY)}`;
  try {
    const res = await fetch(endpoint, { signal });
    if (!res.ok) {
      categoryCache.set(videoId, null);
      return null;
    }
    const body = (await res.json()) as {
      items?: Array<{ snippet?: { categoryId?: string } }>;
    };
    const raw = body.items?.[0]?.snippet?.categoryId;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    const value = Number.isFinite(parsed) ? parsed : null;
    categoryCache.set(videoId, value);
    return value;
  } catch {
    // Network/abort/parse failure — degrade to sentinel rather than throw.
    return null;
  }
}

/* ------------------------------ Public API ------------------------------- */

interface RpcRow {
  intent_code: string;
  rank: number;
  source: IntentSuggestionSource;
  matched_category_id: number | null;
  matched_category_name: string | null;
}

/**
 * Returns ordered intent code suggestions for `url`. Empty array means the
 * RPC produced no rows (e.g. sentinel rows missing) — callers should treat
 * it as "no suggestion" rather than an error.
 */
export async function suggestIntentForUrl(
  url: string,
  options: SuggestIntentOptions = {},
): Promise<IntentSuggestion[]> {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new IntentSuggestionError("url_required", "URL이 비어 있어요.");
  }
  if (!isSupabaseConfigured) {
    throw new IntentSuggestionError(
      "supabase_not_configured",
      "Supabase 환경변수가 설정되지 않았어요.",
    );
  }

  let categoryId: number | null = options.categoryId ?? null;
  if (categoryId === null && !options.skipYouTubeResolution && isYouTubeHost(trimmed)) {
    const videoId = extractYouTubeId(trimmed);
    if (videoId) {
      categoryId = await resolveYouTubeCategory(videoId, options.signal);
    }
  }

  if (options.signal?.aborted) {
    throw new IntentSuggestionError("aborted", "요청이 취소되었어요.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("suggest_intent_for_url", {
    p_url: trimmed,
    p_category_id: categoryId,
  });

  if (error) {
    throw new IntentSuggestionError("rpc_failed", error.message ?? "추천을 가져오지 못했어요.");
  }

  const rows = (data ?? []) as RpcRow[];
  return rows
    .map((r) => ({
      intentCode: r.intent_code,
      rank: r.rank,
      source: r.source,
      matchedCategoryId: r.matched_category_id,
      matchedCategoryName: r.matched_category_name,
    }))
    .sort((a, b) => a.rank - b.rank);
}

/** Test seam: clear the in-memory videoId → categoryId cache. */
export function __clearIntentSuggestionCache(): void {
  categoryCache.clear();
}
