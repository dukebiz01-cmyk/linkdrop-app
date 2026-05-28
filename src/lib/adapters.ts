// v3 어댑터 — RPC/API 응답(snake_case·중첩) → v0 컴포넌트 props(camelCase·평탄).
//
// API Route는 RPC jsonb를 변환 없이 pass-through하므로, 라우트 loader가 이 순수
// 함수들로 v0 컴포넌트 props 형태로 변환한다. 순수 함수 — 테스트 가능.

import type { InfoDropPageProps } from "@/components/info-drop-page";
import type { PriceOfferRow } from "@/components/ai-price-comparison-card";
import type { DropViewVariant } from "@/lib/mock-data";

const PROD_BASE = "https://app.drop.how";

/** get_drop_detail RPC 출력 형태 (v3.5 — maker/store 포함, v5.2 — share_code). */
export type DropDetailRpc = {
  share_uuid: string;
  share_code: string | null;
  curator_message: string | null;
  created_at: string | null;
  drop: {
    id: string;
    purpose: string | null;
    ai_summary: string | null;
    ai_key_points: unknown;
    reservation_data: unknown;
  };
  intent: { key: string | null; name: string | null; purpose: string | null };
  source: {
    title: string | null;
    thumbnail_url: string | null;
    source_url: string | null;
    author_name: string | null;
    provider: string | null;
    duration_sec: number | null;
  };
  maker: { display_name: string | null; avatar_url: string | null } | null;
  store: {
    name: string | null;
    kind: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    phone: string | null;
    reservation_url: string | null;
  } | null;
  ctas: unknown[];
  blocks: unknown[];
  products: Array<{
    id: string;
    product_name_guess: string | null;
    brand_guess: string | null;
    confidence: string;
    offers: Array<{
      seller_name: string;
      seller_country: string;
      platform: string | null;
      product_url: string | null;
      price: number | null;
      currency: string;
      estimated_total_price: number | null;
    }>;
  }>;
};

const PURPOSE_TO_VARIANT: Record<string, DropViewVariant> = {
  정보: "info",
  쿠폰: "coupon",
  예약: "reservation",
  구매: "purchase",
  상담: "lead",
};

const COMPONENT_INTENTS = ["coupon", "reservation", "commerce", "info", "ticket", "lead"] as const;
type ComponentIntent = (typeof COMPONENT_INTENTS)[number];

function narrowIntent(key: string | null): ComponentIntent {
  return key && (COMPONENT_INTENTS as readonly string[]).includes(key)
    ? (key as ComponentIntent)
    : "info";
}

function providerLabel(p: string | null): "YouTube" | "Instagram" {
  return p === "instagram" ? "Instagram" : "YouTube";
}

function droppedAgo(iso: string | null): string {
  if (!iso) return "방금 전";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  if (d === 1) return "어제";
  if (d < 7) return `${d}일 전`;
  return `${Math.round(d / 7)}주 전`;
}

function won(n: number | null | undefined): string {
  return n != null ? `${Math.round(n).toLocaleString("ko-KR")}원` : "가격 미정";
}

function toKeyPoints(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function toPriceOffers(
  offers: DropDetailRpc["products"][number]["offers"],
): PriceOfferRow[] {
  let minTotal = Infinity;
  for (const o of offers) {
    const t = o.estimated_total_price ?? o.price;
    if (t != null && t < minTotal) minTotal = t;
  }
  return offers.map((o, i) => {
    const total = o.estimated_total_price ?? o.price;
    return {
      id: `offer-${i}`,
      sellerName: o.seller_name,
      platform: o.platform ?? o.seller_name,
      priceLabel: won(o.price),
      totalLabel: won(total),
      productUrl: o.product_url ?? "#",
      isBest: total != null && total === minTotal,
    };
  });
}

/** get_drop_detail RPC 출력 → InfoDropPage props. */
export function infoDropAdapter(d: DropDetailRpc): InfoDropPageProps {
  const product = d.products?.[0];
  return {
    videoThumbnailUrl: d.source.thumbnail_url ?? "",
    videoDurationSec: d.source.duration_sec ?? 0,
    videoSourceLabel: providerLabel(d.source.provider),
    officialStatus: "user_shared",
    dropId: d.drop.id,
    maker: {
      name: d.maker?.display_name?.trim() || "익명",
      avatarUrl: d.maker?.avatar_url ?? undefined,
      droppedAgo: droppedAgo(d.created_at),
    },
    makerMessage: d.curator_message ?? undefined,
    title: d.source.title ?? "",
    description: d.drop.ai_summary ?? d.curator_message ?? "",
    intent: narrowIntent(d.intent?.key ?? null),
    variant: d.drop.purpose ? PURPOSE_TO_VARIANT[d.drop.purpose] : undefined,
    productName: product?.product_name_guess ?? undefined,
    brandGuess: product?.brand_guess ?? undefined,
    priceOffers: product ? toPriceOffers(product.offers) : undefined,
    local: {
      name: d.store?.name ?? "",
      category: d.store?.kind ?? "공유된 정보",
      distance: "",
      address: d.store?.address ?? "",
      statusLabel: "",
    },
    creator: {
      channelName: d.source.author_name ?? "원본 영상",
      channelUrl: d.source.source_url ?? "#",
    },
    aiSummary: d.drop.ai_summary ?? undefined,
    keyPoints: toKeyPoints(d.drop.ai_key_points),
    // share_code(6자) 있으면 drop.how/{code} 단축 URL, 없으면 긴 URL fallback.
    // apex(drop.how) 하드코딩 — origin은 app.drop.how가 되어 단축 도메인을 못 거침.
    shareUrl: d.share_code
      ? `https://drop.how/${d.share_code}`
      : `${PROD_BASE}/d/${d.share_uuid}`,
  };
}
