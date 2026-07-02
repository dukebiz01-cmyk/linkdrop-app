// v3 어댑터 — RPC/API 응답(snake_case·중첩) → v0 컴포넌트 props(camelCase·평탄).
//
// API Route는 RPC jsonb를 변환 없이 pass-through하므로, 라우트 loader가 이 순수
// 함수들로 v0 컴포넌트 props 형태로 변환한다. 순수 함수 — 테스트 가능.

import type { InfoDropPageProps } from "@/components/info-drop-page";
import type { PriceOfferRow } from "@/components/ai-price-comparison-card";
import type { DropViewVariant } from "@/lib/mock-data";
import type { CardBodyProps, VideoSlot } from "@/components/card/CardBody.types";
import type { ProductWidgetProps } from "@/components/card/ProductWidget";
import type { CouponPreviewCoupon } from "@/components/receiver/CouponPreview";
import type { DropPurpose } from "@/lib/types";
import { parseVideoUrl } from "@/lib/video-metadata";

const PROD_BASE = "https://app.drop.how";

// S2b — 자체업로드 상품 식별자. api/drops 자체업로드 분기가 source_url 을 이 prefix 의
//   합성 URL(app.drop.how/p/{uuid})로 박는다. 외부 스크랩 상품(provider=manual 이어도)은
//   실제 외부 URL 이라 이 prefix 와 절대 겹치지 않음 → 카드 CTA 분기의 안전한 식별자.
const SELF_UPLOAD_SOURCE_PREFIX = `${PROD_BASE}/p/`;

/** get_drop_detail RPC 출력 형태 (v3.5 — maker/store, v5.2 — share_code, v5.6 — coupon). */
export type DropDetailRpc = {
  share_uuid: string;
  share_code: string | null;
  curator_message: string | null;
  created_at: string | null;
  /** v5.6 H1-d — drop 의 partner active coupon (없으면 null). */
  coupon?: {
    id: string;
    title: string;
    conditions?: unknown;
    valid_from?: string | null;
    valid_until?: string | null;
    coupon_type?: string | null;
    gift_item?: string | null;
  } | null;
  drop: {
    id: string;
    purpose: string | null;
    ai_summary: string | null;
    ai_key_points: unknown;
    reservation_data: unknown;
    /** v7.1c — 매장별 캘린더 연동. 손님 화면이 partner_id 로 슬롯 조회. */
    partner_id?: string | null;
    /** v7.2 — 메이커가 고른 카드 배경색. NULL(옛 드롭) 가능. */
    card_color?: string | null;
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

function toPriceOffers(offers: DropDetailRpc["products"][number]["offers"]): PriceOfferRow[] {
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

/**
 * F2 커머스 — 구매 드롭의 단순 상품 카드 데이터.
 *   이미지/구매링크 = source(thumbnail_url/source_url), 가격/이름 = product 블록(block_data).
 *   get_drop_detail 이 source.price_krw 를 노출하지 않아 가격은 블록으로 운반한다.
 *   시세·쿠폰 없음(다음 슬라이스). 구매 목적이 아니면 undefined.
 */
function buildCommerce(d: DropDetailRpc): InfoDropPageProps["commerce"] {
  if (d.drop.purpose !== "구매") return undefined;
  const blocks = Array.isArray(d.blocks) ? d.blocks : [];
  // ③ primary 본체 product 블록만 = block_data.ref_drop_id 없는 것. (ref_drop_id 있으면
  //   "담은 상품"이라 메인 커머스 카드로 잡으면 안 됨 — 관련 상품 섹션으로 분리.)
  const pb = blocks.find(
    (b): b is { block_kind?: string; block_data?: Record<string, unknown> } =>
      !!b &&
      typeof b === "object" &&
      (b as { block_kind?: string }).block_kind === "product" &&
      !(b as { block_data?: Record<string, unknown> }).block_data?.ref_drop_id,
  );
  const data = (pb?.block_data ?? {}) as {
    name?: unknown;
    price_krw?: unknown;
    headline?: unknown;
    selling_points?: unknown;
    is_fresh?: unknown;
    harvest_date?: unknown;
    stock_limit?: unknown;
    price_band_enabled?: unknown;
  };
  const priceKrw = typeof data.price_krw === "number" ? data.price_krw : null;
  const name =
    typeof data.name === "string" && data.name.trim() ? data.name.trim() : (d.source.title ?? "");
  // 나-2 — 상품 메인 블록(self)에 저장된 카피(나-1). 있으면 상품 /d 페이지에 리치 표시.
  const headline = typeof data.headline === "string" ? data.headline.trim() : "";
  const sellingPoints = Array.isArray(data.selling_points)
    ? (data.selling_points as unknown[])
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
    : [];
  // ② 신선 원물(농가 선주문) — ① 이 block_data 에 ADDITIVE 로 저장한 신선 속성.
  //   is_fresh===true 일 때만 신선 카드. harvest_date/stock_limit 은 있을 때만.
  const isFresh = data.is_fresh === true;
  const harvestDate =
    typeof data.harvest_date === "string" && data.harvest_date.trim()
      ? data.harvest_date.trim()
      : null;
  const stockLimit =
    typeof data.stock_limit === "number" && Number.isFinite(data.stock_limit)
      ? data.stock_limit
      : null;
  const priceBandEnabled = data.price_band_enabled === true;
  return {
    name,
    priceKrw,
    buyUrl: d.source.source_url ?? "#",
    imageUrl: d.source.thumbnail_url ?? "",
    // S2b — 합성 source_url prefix 면 자체업로드 상품 → 카드가 "주문 문의(tel:)" 로 분기.
    selfUpload: (d.source.source_url ?? "").startsWith(SELF_UPLOAD_SOURCE_PREFIX),
    ...(headline ? { headline } : {}),
    ...(sellingPoints.length > 0 ? { sellingPoints } : {}),
    // ② 신선 속성 동봉 — isFresh 는 항상, 나머지는 신선일 때만 의미.
    isFresh,
    ...(isFresh && harvestDate ? { harvestDate } : {}),
    ...(isFresh && stockLimit != null ? { stockLimit } : {}),
    ...(isFresh ? { priceBandEnabled } : {}),
  };
}

/**
 * ③ 카드 담기 — 담은(관련) 상품 블록 → 관련 상품 리스트.
 *   attached = block_kind='product' && block_data.ref_drop_id 있음(위저드가 담은 참조형).
 *   목적 무관(정보/쿠폰/예약/구매 어디든 담을 수 있음). position 순. 없으면 undefined.
 */
function buildAttachedProducts(d: DropDetailRpc): InfoDropPageProps["attachedProducts"] {
  const blocks = Array.isArray(d.blocks) ? d.blocks : [];
  const items = blocks
    .filter(
      (b): b is { block_kind?: string; block_data?: Record<string, unknown>; position?: number } =>
        !!b &&
        typeof b === "object" &&
        (b as { block_kind?: string }).block_kind === "product" &&
        typeof (b as { block_data?: Record<string, unknown> }).block_data?.ref_drop_id ===
          "string" &&
        // B 홍보 카드(is_promo)는 buildPromoCards 로 분리 — 관련 상품 리스트에선 제외(회귀 0).
        (b as { block_data?: Record<string, unknown> }).block_data?.is_promo !== true,
    )
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((b) => {
      const bd = (b.block_data ?? {}) as Record<string, unknown>;
      // 나-2 — 담을 때 동봉된 카피 스냅샷(있으면 컴팩트 렌더에 헤드라인 태그라인).
      const sp = Array.isArray(bd.selling_points)
        ? (bd.selling_points as unknown[])
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim())
        : [];
      return {
        refDropId: String(bd.ref_drop_id),
        refShareUuid: typeof bd.ref_share_uuid === "string" ? bd.ref_share_uuid : null,
        name: typeof bd.name === "string" && bd.name.trim() ? bd.name.trim() : "상품",
        priceKrw: typeof bd.price_krw === "number" ? bd.price_krw : null,
        imageUrl: typeof bd.image_url === "string" ? bd.image_url : null,
        ...(typeof bd.headline === "string" && bd.headline.trim()
          ? { headline: bd.headline.trim() }
          : {}),
        ...(sp.length > 0 ? { sellingPoints: sp } : {}),
      };
    });
  return items.length > 0 ? items : undefined;
}

/**
 * B 상품 홍보 카드 — block_kind='product' && block_data.is_promo===true → 리치 홍보 카드.
 *   기존 "관련 상품"(is_promo 없음)과 같은 enum, block_data 키로만 구분. position 순.
 *   ref_drop_id 없는(=본체 커머스) 블록은 제외. 없으면 undefined.
 */
function buildPromoCards(d: DropDetailRpc): InfoDropPageProps["promoCards"] {
  const blocks = Array.isArray(d.blocks) ? d.blocks : [];
  const items = blocks
    .filter(
      (b): b is { block_kind?: string; block_data?: Record<string, unknown>; position?: number } =>
        !!b &&
        typeof b === "object" &&
        (b as { block_kind?: string }).block_kind === "product" &&
        (b as { block_data?: Record<string, unknown> }).block_data?.is_promo === true,
    )
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((b) => {
      const bd = (b.block_data ?? {}) as Record<string, unknown>;
      const sp = Array.isArray(bd.selling_points)
        ? (bd.selling_points as unknown[]).filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0,
          )
        : [];
      return {
        refDropId: typeof bd.ref_drop_id === "string" ? bd.ref_drop_id : null,
        refShareUuid: typeof bd.ref_share_uuid === "string" ? bd.ref_share_uuid : null,
        name: typeof bd.name === "string" && bd.name.trim() ? bd.name.trim() : "상품",
        priceKrw: typeof bd.price_krw === "number" ? bd.price_krw : null,
        imageUrl: typeof bd.image_url === "string" ? bd.image_url : null,
        headline: typeof bd.headline === "string" ? bd.headline.trim() : "",
        sellingPoints: sp.map((s) => s.trim()),
      };
    });
  return items.length > 0 ? items : undefined;
}

/**
 * G2 멀티소스 — block_kind='video'(영상) + 'article'(글) 블록 → 함께 담은 콘텐츠 리스트(primary 외).
 *   position 순. 없으면 undefined. (primary 영상은 source_id → videoThumbnailUrl 로 별도 렌더.)
 */
function buildAttachedVideos(d: DropDetailRpc): InfoDropPageProps["attachedVideos"] {
  const blocks = Array.isArray(d.blocks) ? d.blocks : [];
  const items = blocks
    .filter(
      (b): b is { block_kind?: string; block_data?: Record<string, unknown>; position?: number } =>
        !!b &&
        typeof b === "object" &&
        ((b as { block_kind?: string }).block_kind === "video" ||
          (b as { block_kind?: string }).block_kind === "article"),
    )
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((b) => {
      const bd = (b.block_data ?? {}) as Record<string, unknown>;
      const isArticle = (b as { block_kind?: string }).block_kind === "article";
      return {
        type: (isArticle ? "article" : "video") as "video" | "article",
        provider: typeof bd.provider === "string" ? bd.provider : "youtube",
        sourceId: typeof bd.source_id === "string" ? bd.source_id : "",
        sourceUrl:
          typeof bd.source_url === "string"
            ? bd.source_url
            : typeof bd.canonical_url === "string"
              ? bd.canonical_url
              : "",
        title: typeof bd.title === "string" ? bd.title : null,
        thumbnailUrl: typeof bd.thumbnail_url === "string" ? bd.thumbnail_url : null,
        authorName: typeof bd.author_name === "string" ? bd.author_name : null,
        snippet: typeof bd.snippet === "string" ? bd.snippet : null,
      };
    })
    .filter((v) => v.sourceUrl);
  return items.length > 0 ? items : undefined;
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
    // v7.1c — 손님 캘린더 → reservation_slots 연동. 예약 드롭에서만 사용.
    partnerId: d.drop.partner_id ?? null,
    // v7.2 — 메이커 카드색. NULL(옛 드롭)이면 undefined → 손님 fallback(e단계). 기본색 강제 안 함.
    cardColor: d.drop.card_color ?? undefined,
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
    commerce: buildCommerce(d),
    attachedProducts: buildAttachedProducts(d),
    promoCards: buildPromoCards(d),
    attachedVideos: buildAttachedVideos(d),
    local: {
      name: d.store?.name ?? "",
      category: d.store?.kind ?? "공유된 정보",
      distance: "",
      address: d.store?.address ?? "",
      statusLabel: "",
      // phase1-3: store.contact_phone → local.phone (CTA tel:/sms: 연결)
      phone: d.store?.phone ?? "",
      // c-1: 네이버형 매장 식별 — 외부 예약 URL 보유 시 순수 쿠폰 카드에 보조 링크 노출.
      reservationUrl: d.store?.reservation_url ?? null,
    },
    creator: {
      // 커머스(구매): "원본 영상" 프레이밍 제거 — 판매자명(author_name) 없으면 생략(빈값).
      channelName: d.source.author_name ?? (d.drop.purpose === "구매" ? "" : "원본 영상"),
      channelUrl: d.source.source_url ?? "#",
    },
    aiSummary: d.drop.ai_summary ?? undefined,
    keyPoints: toKeyPoints(d.drop.ai_key_points),
    // share_code(6자) 있으면 drop.how/{code} 단축 URL, 없으면 긴 URL fallback.
    // apex(drop.how) 하드코딩 — origin은 app.drop.how가 되어 단축 도메인을 못 거침.
    shareUrl: d.share_code ? `https://drop.how/${d.share_code}` : `${PROD_BASE}/d/${d.share_uuid}`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 4단계 준비 — 손님 데이터(InfoDropPageProps) → CardBodyProps 변환(순수함수).
//   이번 단계는 함수만 추가(어디서도 호출 0). 손님이 CardBody 를 렌더하는 4단계에서 사용.
//   스튜디오는 자체 state 로 CardBody 를 채우고, 손님은 이 어댑터로 채워 = 싱크로율.
// ──────────────────────────────────────────────────────────────────────────

// DropViewVariant(5목적 UI) → DropPurpose(enum). PURPOSE_TO_VARIANT 의 역방향.
const VARIANT_TO_PURPOSE: Record<DropViewVariant, DropPurpose> = {
  info: "정보",
  coupon: "쿠폰",
  reservation: "예약",
  purchase: "구매",
  lead: "상담",
};

// 초 → "M:SS"(또는 ≥1h "H:MM:SS"). VideoSlot.durationLabel 용(YouTubeLiteEmbed 오버레이).
function secToDurationLabel(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// 손님 영상 필드 → VideoSlot. videoSourceUrl 없거나 파싱 실패 시 null(영상 슬롯 미렌더).
//   videoId = parseVideoUrl(videoSourceUrl). isShorts = duration ≤60(스튜디오 어댑터 동일 규칙).
function toVideoSlot(p: InfoDropPageProps): VideoSlot | null {
  if (!p.videoSourceUrl) return null;
  const parsed = parseVideoUrl(p.videoSourceUrl);
  if (!parsed) return null;
  return {
    videoId: parsed.videoId,
    thumbnailUrl: p.videoThumbnailUrl,
    title: p.title,
    isShorts: p.videoDurationSec > 0 && p.videoDurationSec <= 60,
    durationLabel: p.videoDurationSec > 0 ? secToDurationLabel(p.videoDurationSec) : undefined,
    sourceLabel: p.videoSourceLabel,
  };
}

/** 손님 InfoDropPageProps → CardBodyProps. 순수함수. (4단계에서 호출, 지금은 미사용.) */
export function toCardBodyProps(props: InfoDropPageProps): CardBodyProps {
  const coupon: CouponPreviewCoupon | null = props.funnelCoupon
    ? {
        title: props.funnelCoupon.title,
        coupon_type: props.funnelCoupon.coupon_type,
        gift_item: props.funnelCoupon.gift_item,
        conditions: props.funnelCoupon.conditions,
        valid_until: props.funnelCoupon.valid_until,
      }
    : null;

  return {
    mode: "live",
    cardColor: props.cardColor ?? "#1E3A8A",
    video: toVideoSlot(props),
    // 제목 = 영상 헤드라인(손님), 부제 = 메이커 한마디(curator_message=makerMessage).
    title: props.title,
    tagline: props.makerMessage ?? "",
    sellingPoints: props.keyPoints ?? [],
    coupon,
    // local → store(연락 매핑). local 은 InfoDropPageProps 필수라 항상 객체.
    store: {
      name: props.local.name,
      phone: props.local.phone,
      address: props.local.address,
      reservationUrl: props.local.reservationUrl ?? null,
    },
    purpose: props.variant ? VARIANT_TO_PURPOSE[props.variant] : "정보",
    // 연락 슬롯(contactSlot)·하단 블록 슬롯은 container(info-drop-page)가 주입(지금 undefined).
    //   reservationSlot·ctaSlot 은 3d 에서 제거(미사용 live전용 안티패턴).
  };
}

/** 손님 InfoDropPageProps → ProductWidgetProps. props.commerce(이미 buildCommerce 로 만든 구매 데이터) + local(산지) 매핑.
 *  C1 신규(호출 0 — C2 에서 손님 purchase 분기가 CardBody.productBlock 으로 주입). onPreorder 는 container 가 주입.
 *  ※ buildCommerce 는 DropDetailRpc 입력용 — 여기선 이미 변환된 props.commerce 를 재사용(중복 변환 회피). */
export function buildProductWidget(props: InfoDropPageProps): ProductWidgetProps {
  const c = props.commerce;
  // 구매 데이터 없으면(purpose≠구매 등) 최소 형태 — title/가격미정. (C2 는 purchase 에서만 호출.)
  if (!c) {
    return { name: props.title, priceKrw: null };
  }
  return {
    name: c.name,
    priceKrw: c.priceKrw,
    media: { type: "image", imageUrl: c.imageUrl },
    imageUrl: c.imageUrl,
    headline: c.headline,
    sellingPoints: c.sellingPoints,
    isFresh: c.isFresh,
    harvestDate: c.harvestDate,
    stockLimit: c.stockLimit,
    local: props.local
      ? { name: props.local.name, address: props.local.address, distance: props.local.distance }
      : undefined,
    selfUpload: c.selfUpload,
    buyUrl: c.buyUrl,
  };
}
