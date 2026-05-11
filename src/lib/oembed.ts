/**
 * 영상 URL 파싱 + oEmbed fetch.
 * YouTube: 공개 oEmbed (CORS 허용)
 * Instagram: 곧 지원 예정 (앱 검토 후)
 */

export type Provider = "youtube" | "instagram" | "manual";

export interface ParsedVideo {
  provider: Provider;
  canonicalUrl: string;
  sourceId: string;
}

export interface OEmbedResult {
  provider: Provider;
  canonicalUrl: string;
  sourceId: string;
  title: string;
  authorName: string | null;
  thumbnailUrl: string | null;
  embedHtml: string | null;
}

const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;
const IG_REGEX = /instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/;

export function parseVideoUrl(input: string): ParsedVideo | null {
  const url = input.trim();
  if (!url) return null;
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
  return null;
}

export async function fetchOEmbed(parsed: ParsedVideo): Promise<OEmbedResult> {
  if (parsed.provider === "youtube") {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`,
    );
    if (!res.ok) throw new Error("oembed_failed");
    const data = (await res.json()) as {
      title: string;
      author_name?: string;
      thumbnail_url?: string;
      html?: string;
    };
    return {
      provider: "youtube",
      canonicalUrl: parsed.canonicalUrl,
      sourceId: parsed.sourceId,
      title: data.title,
      authorName: data.author_name ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
      embedHtml: data.html ?? null,
    };
  }
  throw new Error("unsupported_provider");
}