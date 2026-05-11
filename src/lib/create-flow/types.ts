import type { OEmbedResult } from "@/lib/oembed";

export const BLOCK_KINDS = [
  "video",
  "text",
  "coupon",
  "map",
  "link",
  "image",
  "cta",
  "poll",
  "similar",
] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

export interface BlockDraft {
  /** Local id (uuid-like) before persistence. */
  id: string;
  kind: BlockKind;
  /** Locked by intent default — cannot delete or reorder out. */
  isLocked: boolean;
  /** Free-form data per kind. Keep small + serializable. */
  data: Record<string, unknown>;
  /** DB id once persisted. */
  remoteId?: string;
}

export interface DraftDoc {
  contentSourceId: string | null;
  oembed: OEmbedResult | null;
  intentId: string | null;
  intentKey: string | null;
  partnerId: string | null;
  hasAdDisclosure: boolean;
  infoDropId: string | null;
  blocks: BlockDraft[];
}

export const KIND_LABEL: Record<BlockKind, string> = {
  video: "영상",
  text: "텍스트 메모",
  coupon: "쿠폰",
  map: "지도",
  link: "링크",
  image: "이미지",
  cta: "버튼",
  poll: "투표",
  similar: "비슷한 카드 (준비 중)",
};

/** intent.key → 기본 필수 블록(잠김) 순서. 백엔드 intent_types.default_required_blocks에서 받아오면 우선. */
export const FALLBACK_REQUIRED_BY_INTENT: Record<string, BlockKind[]> = {
  info: ["video", "text"],
  discussion: ["video", "text", "poll"],
  coupon: ["video", "text", "coupon"],
  reservation: ["video", "text", "cta"],
  commerce: ["video", "text", "link"],
  ticket: ["video", "text", "cta"],
  lead: ["video", "text", "cta"],
  campaign: ["video", "text"],
  custom: ["video", "text"],
};

/** intent.key → 추가 가능한 블록 화이트리스트(intent_types.allowed_blocks). */
export const FALLBACK_ALLOWED_BY_INTENT: Record<string, BlockKind[]> = {
  info: ["video", "text", "image", "link", "map"],
  discussion: ["video", "text", "image", "link", "poll"],
  coupon: ["video", "text", "image", "map", "coupon", "link"],
  reservation: ["video", "text", "image", "map", "cta", "link"],
  commerce: ["video", "text", "image", "link", "cta"],
  ticket: ["video", "text", "image", "map", "cta"],
  lead: ["video", "text", "image", "cta"],
  campaign: ["video", "text", "image", "link"],
  custom: ["video", "text", "image", "link", "map", "cta", "poll"],
};

/** intent.key → 광고 표기 의무. coupon/reservation/commerce/ticket/lead = 보상 가능 → 의무 ON. */
export const REQUIRES_DISCLOSURE: Record<string, boolean> = {
  info: false,
  discussion: false,
  coupon: true,
  reservation: true,
  commerce: true,
  ticket: true,
  lead: true,
  campaign: true,
  custom: false,
};

export function newId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyData(kind: BlockKind): Record<string, unknown> {
  switch (kind) {
    case "text":
      return { body: "" };
    case "coupon":
      return { title: "", discount: "", expires_at: null };
    case "map":
      return { name: "", address: "", lat: null, lng: null };
    case "link":
      return { url: "", label: "" };
    case "image":
      return { url: "", caption: "" };
    case "cta":
      return { label: "", url: "" };
    case "poll":
      return { question: "", options: ["", ""] };
    case "similar":
      return {};
    case "video":
    default:
      return {};
  }
}