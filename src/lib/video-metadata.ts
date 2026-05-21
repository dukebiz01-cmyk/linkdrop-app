/**
 * /create Step 1 — 영상 URL 파싱 + 메타데이터 수집 (Phase 1)
 * YouTube: oEmbed 시도 → 실패 시 hqdefault 썸네일 fallback
 * Instagram: Phase 1 fallback only (자동 썸네일은 Phase 2)
 */

export type VideoPlatform = "youtube" | "instagram" | "unknown";

export type VideoMetadataFetchedBy =
  | "youtube_oembed"
  | "youtube_fallback"
  | "instagram_fallback"
  | "manual_fallback";

export type VideoMetadata = {
  platform: VideoPlatform;
  sourceUrl: string;
  videoId?: string;
  title: string;
  authorName?: string;
  thumbnailUrl?: string;
  providerUrl?: string;
  fetchedBy: VideoMetadataFetchedBy;
};

export type ParsedVideoUrl = {
  platform: "youtube" | "instagram";
  sourceUrl: string;
  videoId: string;
  oembedUrl: string;
};

const YOUTUBE_PATTERNS: { re: RegExp; buildCanonical: (id: string) => string }[] = [
  {
    re: /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{6,})/i,
    buildCanonical: (id) => `https://www.youtube.com/watch?v=${id}`,
  },
  {
    re: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:[^#\s]*&)?v=([A-Za-z0-9_-]{6,})/i,
    buildCanonical: (id) => `https://www.youtube.com/watch?v=${id}`,
  },
  {
    re: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i,
    buildCanonical: (id) => `https://www.youtube.com/watch?v=${id}`,
  },
];

const INSTAGRAM_RE =
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i;

function normalizeInputUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseVideoUrl(url: string): ParsedVideoUrl | null {
  const normalized = normalizeInputUrl(url);
  if (!normalized) return null;

  for (const { re, buildCanonical } of YOUTUBE_PATTERNS) {
    const match = normalized.match(re);
    const id = match?.[1];
    if (id) {
      return {
        platform: "youtube",
        sourceUrl: normalized,
        videoId: id,
        oembedUrl: buildCanonical(id),
      };
    }
  }

  const ig = normalized.match(INSTAGRAM_RE);
  const igId = ig?.[1];
  if (igId) {
    return {
      platform: "instagram",
      sourceUrl: normalized,
      videoId: igId,
      oembedUrl: normalized,
    };
  }

  return null;
}

function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

async function fetchYoutubeOEmbed(oembedUrl: string): Promise<{
  title: string;
  authorName?: string;
  thumbnailUrl?: string;
  providerUrl?: string;
} | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(oembedUrl)}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
      provider_url?: string;
    };
    if (!data.title) return null;
    return {
      title: data.title,
      authorName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
      providerUrl: data.provider_url,
    };
  } catch {
    return null;
  }
}

function youtubeFallback(parsed: ParsedVideoUrl): VideoMetadata {
  return {
    platform: "youtube",
    sourceUrl: parsed.sourceUrl,
    videoId: parsed.videoId,
    title: "YouTube 영상",
    authorName: "YouTube",
    thumbnailUrl: youtubeThumbnailUrl(parsed.videoId),
    providerUrl: parsed.oembedUrl,
    fetchedBy: "youtube_fallback",
  };
}

function instagramFallback(parsed: ParsedVideoUrl): VideoMetadata {
  // TODO(Phase 2): Instagram oEmbed / Edge Function으로 썸네일·제목 자동 수집
  return {
    platform: "instagram",
    sourceUrl: parsed.sourceUrl,
    videoId: parsed.videoId,
    title: "Instagram Reel",
    authorName: "Instagram",
    thumbnailUrl: undefined,
    providerUrl: parsed.sourceUrl,
    fetchedBy: "instagram_fallback",
  };
}

export async function fetchVideoMetadata(url: string): Promise<VideoMetadata> {
  const parsed = parseVideoUrl(url);
  if (!parsed) {
    return {
      platform: "unknown",
      sourceUrl: normalizeInputUrl(url) || url.trim(),
      title: "영상 링크",
      fetchedBy: "manual_fallback",
    };
  }

  if (parsed.platform === "youtube") {
    const oembed = await fetchYoutubeOEmbed(parsed.oembedUrl);
    if (oembed) {
      return {
        platform: "youtube",
        sourceUrl: parsed.sourceUrl,
        videoId: parsed.videoId,
        title: oembed.title,
        authorName: oembed.authorName,
        thumbnailUrl: oembed.thumbnailUrl ?? youtubeThumbnailUrl(parsed.videoId),
        providerUrl: oembed.providerUrl ?? parsed.oembedUrl,
        fetchedBy: "youtube_oembed",
      };
    }
    return youtubeFallback(parsed);
  }

  return instagramFallback(parsed);
}
