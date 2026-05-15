// Client SDK for the extract-url-metadata edge function.
// Use this from /create flow (or anywhere) to get cached, server-side URL previews.

import { getSupabase } from "@/lib/supabase";
import { friendlyErrors } from "@/components/ErrorMessage";

export type UrlMetadataProvider =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "naver_clip"
  | "manual";

export type UrlMetadataExtractionMethod = "oembed" | "og_tags" | "manual";

export interface UrlMetadata {
  provider: UrlMetadataProvider;
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
  extractionMethod: UrlMetadataExtractionMethod;
  extractionConfidence: number;
  extractionErrors: string[];
  cached: boolean;
  fetchedAt: string;
  expiresAt: string;
}

export class UrlMetadataError extends Error {
  code: string;
  friendly: string;
  status?: number;
  constructor(code: string, friendly: string, status?: number) {
    super(`url_metadata:${code}`);
    this.name = "UrlMetadataError";
    this.code = code;
    this.friendly = friendly;
    this.status = status;
  }
}

function mapErrorCode(code: string): string {
  switch (code) {
    case "url_required":
    case "invalid_url":
    case "unsupported_scheme":
      return friendlyErrors.validation;
    case "blocked_private_host":
      return "내부 주소는 미리보기를 만들 수 없어요.";
    case "method_not_allowed":
    case "invalid_json":
      return friendlyErrors.unknown;
    case "server_not_configured":
    case "cache_write_failed":
      return friendlyErrors.serverError;
    default:
      return friendlyErrors.unknown;
  }
}

/**
 * Calls the extract-url-metadata edge function. Throws `UrlMetadataError` on failure.
 * Always returns a result — even when extraction fails partially, the cache row is
 * still populated with whatever was retrievable, plus `extractionErrors`.
 */
export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new UrlMetadataError("url_required", friendlyErrors.validation);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke<
    UrlMetadata | { error: string; detail?: string }
  >("extract-url-metadata", { body: { url: trimmed } });

  if (error) {
    // supabase-js wraps non-2xx as FunctionsHttpError with a Response on .context
    const status =
      (error as { context?: { status?: number } }).context?.status ?? 0;
    // try to read the error body
    let code = "unknown";
    try {
      const body = await (
        error as { context?: { response?: Response } }
      ).context?.response?.clone().json();
      if (body && typeof body.error === "string") code = body.error;
    } catch {
      // ignore parse failures
    }
    throw new UrlMetadataError(code, mapErrorCode(code), status);
  }

  if (!data || typeof data !== "object") {
    throw new UrlMetadataError("empty_response", friendlyErrors.unknown);
  }
  if ("error" in data && typeof data.error === "string") {
    throw new UrlMetadataError(data.error, mapErrorCode(data.error));
  }

  return data as UrlMetadata;
}
