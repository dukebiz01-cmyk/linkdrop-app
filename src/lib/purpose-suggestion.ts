/**
 * Home UX — 영상 메타 기반 목적 추천 (얇은 helper)
 * API 실패 시 local rule fallback; 사용자 흐름을 막지 않음.
 */

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

const PURPOSE_KO_TO_ID: Record<string, HomePurpose> = {
  정보: "info",
  info: "info",
  쿠폰: "coupon",
  coupon: "coupon",
  예약: "reservation",
  reservation: "reservation",
  구매: "purchase",
  purchase: "purchase",
  commerce: "purchase",
  상담: "lead",
  lead: "lead",
};

function mapApiPurpose(raw: string): HomePurpose | null {
  const key = raw.trim().toLowerCase();
  return PURPOSE_KO_TO_ID[raw.trim()] ?? PURPOSE_KO_TO_ID[key] ?? null;
}

function buildCorpus(input: SuggestPurposeInput): string {
  const { metadata, url } = input;
  return `${metadata.title} ${metadata.authorName ?? ""} ${url}`.toLowerCase();
}

function hasWord(corpus: string, ...words: string[]): boolean {
  return words.some((w) => corpus.includes(w.toLowerCase()));
}

/** 키워드 우선순위: 구체적(lead) → coupon → purchase → reservation → info */
export function suggestPurposeLocalRule(input: SuggestPurposeInput): PurposeSuggestion {
  const corpus = buildCorpus(input);

  if (
    hasWord(
      corpus,
      "상담",
      "문의",
      "견적",
      "신청",
      "예약문의",
      "전화",
      "contact",
      "consult",
    )
  ) {
    return {
      purpose: "lead",
      confidence: "medium",
      reason: "문의·상담 키워드가 있어 상담 목적에 적합합니다.",
      source: "local_rule",
    };
  }

  if (
    hasWord(corpus, "할인", "쿠폰", "이벤트", "혜택", "무료", "증정", "coupon", "sale", "promo")
  ) {
    return {
      purpose: "coupon",
      confidence: "high",
      reason: "할인·혜택 키워드가 있어 쿠폰 목적에 적합합니다.",
      source: "local_rule",
    };
  }

  if (
    hasWord(
      corpus,
      "가격",
      "구매",
      "상품",
      "리뷰",
      "언박싱",
      "비교",
      "최저가",
      "unbox",
      "review",
      "price",
      "buy",
    )
  ) {
    return {
      purpose: "purchase",
      confidence: "medium",
      reason: "상품·가격 키워드가 있어 구매 목적에 적합합니다.",
      source: "local_rule",
    };
  }

  if (
    hasWord(
      corpus,
      "캠핑",
      "숙소",
      "펜션",
      "예약",
      "날짜",
      "객실",
      "사이트",
      "호텔",
      "장소",
      "camp",
      "resort",
      "stay",
    )
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

async function trySuggestPurposeApi(
  input: SuggestPurposeInput,
): Promise<PurposeSuggestion | null> {
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
        author_name: input.metadata.authorName,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      purpose?: string;
      confidence?: string;
      reasoning?: string;
      reason?: string;
    };

    const purpose = data.purpose ? mapApiPurpose(data.purpose) : null;
    if (!purpose) return null;

    const confidenceRaw = (data.confidence ?? "medium").toLowerCase();
    const confidence: SuggestionConfidence =
      confidenceRaw === "high" || confidenceRaw === "low" ? confidenceRaw : "medium";

    return {
      purpose,
      confidence,
      reason: data.reasoning ?? data.reason ?? "AI가 이 목적을 추천했어요.",
      source: "api",
    };
  } catch {
    return null;
  }
}

/**
 * Home용 목적 추천. API(있을 때) → local rule → info fallback.
 * null을 반환하지 않습니다 (항상 추천 객체).
 */
export async function suggestPurpose(input: SuggestPurposeInput): Promise<PurposeSuggestion> {
  const api = await trySuggestPurposeApi(input);
  if (api) return api;
  return suggestPurposeLocalRule(input);
}
