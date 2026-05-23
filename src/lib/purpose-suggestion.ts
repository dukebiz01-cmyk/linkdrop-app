/**
 * Home UX — 목적 추천 + /create draft (sessionStorage)
 */

import type { DropPurpose } from "@/lib/types";
import type { VideoMetadata } from "@/lib/video-metadata";

export type HomePurpose = "info" | "coupon" | "reservation" | "purchase" | "lead";

export type SuggestionConfidence = "high" | "medium" | "low";

export type SuggestionSource = "api" | "local_rule" | "fallback";

export type PurposeSuggestion = {
  purpose: HomePurpose;
  confidence: SuggestionConfidence;
  reason: string;
  source: SuggestionSource;
};

export type SuggestPurposeInput = {
  metadata: VideoMetadata;
  url: string;
  sourceId?: string;
  platform?: string;
};

export const CREATE_DRAFT_STORAGE_KEY = "linkdrop:createDraft";
const DRAFT_TTL_MS = 10 * 60 * 1000;

export type CreateDraftPayload = {
  url: string;
  purpose: HomePurpose;
  suggestedPurpose?: HomePurpose;
  confidence?: SuggestionConfidence;
  platform?: string;
  source_id?: string;
  metadata?: VideoMetadata;
  savedAt: number;
};

const HOME_TO_WIZARD: Record<HomePurpose, DropPurpose> = {
  info: "정보",
  coupon: "쿠폰",
  reservation: "예약",
  purchase: "구매",
  lead: "상담",
};

const SLUG_ALIASES: Record<string, HomePurpose> = {
  info: "info",
  coupon: "coupon",
  reservation: "reservation",
  purchase: "purchase",
  commerce: "purchase",
  lead: "lead",
  정보: "info",
  쿠폰: "coupon",
  예약: "reservation",
  구매: "purchase",
  상담: "lead",
};

export function parseHomePurposeSlug(raw: string | undefined): HomePurpose | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return SLUG_ALIASES[key] ?? SLUG_ALIASES[raw.trim()] ?? null;
}

export function homePurposeToWizardPurpose(slug: HomePurpose): DropPurpose {
  return HOME_TO_WIZARD[slug];
}

export function parseWizardSuggestionConfidence(
  raw: string | undefined,
): SuggestionConfidence | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return null;
}

export function saveCreateDraft(payload: Omit<CreateDraftPayload, "savedAt">): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      CREATE_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...payload, savedAt: Date.now() }),
    );
  } catch {
    // quota / private mode
  }
}

export function readCreateDraft(): CreateDraftPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CREATE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreateDraftPayload;
    if (!parsed.url || !parsed.purpose || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      sessionStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCreateDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function buildCorpus(input: SuggestPurposeInput): string {
  return `${input.metadata.title} ${input.metadata.authorName ?? ""} ${input.url}`.toLowerCase();
}

function hasWord(corpus: string, ...words: string[]): boolean {
  return words.some((w) => corpus.includes(w.toLowerCase()));
}

export function suggestPurposeLocalRule(input: SuggestPurposeInput): PurposeSuggestion {
  const corpus = buildCorpus(input);

  if (
    hasWord(corpus, "상담", "문의", "견적", "신청", "예약문의", "전화", "contact", "consult")
  ) {
    return {
      purpose: "lead",
      confidence: "medium",
      reason: "문의·상담 키워드가 있어 상담 목적에 적합합니다.",
      source: "local_rule",
    };
  }
  if (hasWord(corpus, "할인", "쿠폰", "이벤트", "혜택", "무료", "증정", "coupon", "sale")) {
    return {
      purpose: "coupon",
      confidence: "high",
      reason: "할인·혜택 키워드가 있어 쿠폰 목적에 적합합니다.",
      source: "local_rule",
    };
  }
  if (hasWord(corpus, "가격", "구매", "상품", "리뷰", "언박싱", "비교", "최저가", "unbox", "buy")) {
    return {
      purpose: "purchase",
      confidence: "medium",
      reason: "상품·가격 키워드가 있어 구매 목적에 적합합니다.",
      source: "local_rule",
    };
  }
  if (
    hasWord(corpus, "캠핑", "숙소", "펜션", "예약", "날짜", "객실", "사이트", "호텔", "camp", "stay")
  ) {
    return {
      purpose: "reservation",
      confidence: "high",
      reason: "캠핑·숙소형 영상으로 예약 목적에 적합합니다.",
      source: "local_rule",
    };
  }

  return {
    purpose: "info",
    confidence: "low",
    reason: "일반 정보형 영상으로 정보 목적을 추천합니다.",
    source: "fallback",
  };
}

async function trySuggestPurposeApi(input: SuggestPurposeInput): Promise<PurposeSuggestion | null> {
  if (!input.sourceId) return null;
  try {
    const res = await fetch("/api/suggest-purpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: input.sourceId,
        url: input.url,
        title: input.metadata.title,
        platform: input.platform ?? input.metadata.platform,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      purpose?: string;
      confidence?: string;
      reasoning?: string;
    };
    const purpose = parseHomePurposeSlug(data.purpose);
    if (!purpose) return null;
    const confidence = parseWizardSuggestionConfidence(data.confidence) ?? "medium";
    return {
      purpose,
      confidence,
      reason: data.reasoning ?? "AI가 이 목적을 추천했어요.",
      source: "api",
    };
  } catch {
    return null;
  }
}

export async function suggestPurpose(input: SuggestPurposeInput): Promise<PurposeSuggestion> {
  const api = await trySuggestPurposeApi(input);
  if (api) return api;
  return suggestPurposeLocalRule(input);
}
