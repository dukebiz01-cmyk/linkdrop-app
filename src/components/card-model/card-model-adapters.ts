import { Calendar, MessageCircle, Newspaper, ShoppingBag, Tag, Ticket } from "lucide-react";
import type { CardJourneyNode, CardModel } from "./card-model.types";

/**
 * CardModel 어댑터 2방향 — READ 6항 매핑표 기준.
 *
 * ⚠️ 기존 파일 의존 0(회귀 0): src/lib/adapters.ts·info-drop-page.tsx·studio-build.tsx 를
 *   import 하지 않는다. 입력 타입은 이 파일에 "미러 선언" — 필드별 출처를 주석으로 박제.
 *   실제 연결(마운트)은 ST2 — 이 단계에서는 어떤 기존 화면에도 꽂지 않는다.
 *
 * 매핑 가능/불가(READ 6항 결론 승계):
 *   ✅ 색(card_color)·본체(title/tagline/포인트/영상)·가격(price_krw/remaining_stock)·
 *      쿠폰(funnelCoupon) — 실배선.
 *   🟡 예약(initialSlots·calendarMode·reservation_url)·여정·확산수 — optional 운반
 *      (여정·확산수는 get_drop_detail 미포함이라 호출부가 별도 조회 후 주입).
 *   ❌ 배송추적·시설태그·후기·판매기간 — 백엔드 부재. 어댑터가 채우지 않는다
 *      (미주입 = 미렌더, 가짜값 금지).
 */

// ── 모드별 accent — v0-45 정본 실측값(ST2a STEP0 정정 — ST1 추정 5색 폐기, 45는 모드 3종 체계).
//    정본 근거: docs/ref/v0-45-card-studio-page.tsx MODE_SKIN(:996-1000) + POINT(:258).
export const CARD_MODEL_ACCENTS = {
  /** 일반(퍼블릭) — 슬레이트. */
  general: "#475569",
  /** 예약·쿠폰(reserve) — 포인트 블루. */
  reserve: "#1D4ED8",
  /** 상품판매(commerce) — 틸. */
  commerce: "#0F766E",
} as const;

const DEFAULT_CARD_COLOR = "#FFFFFF";
/** 카드 뒤 페이지 배경(쿠폰 노치 구멍색) — 앱 표면 톤. */
const DEFAULT_PAGE_BG = "#F8FAFC";

function won(n: number | null | undefined): string {
  return n != null ? `${Math.round(n).toLocaleString("ko-KR")}원` : "";
}

/** 초 → "m:ss" 클립 라벨 (VideoSlot.durationLabel 부재 시 폴백). */
function clipLabel(sec: number | null | undefined): string | undefined {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return undefined;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ═════════════════════════════════════════════════════════════
// ① fromDropDetail — 손님(receiver/share) 방향
// ═════════════════════════════════════════════════════════════

/**
 * InfoDropPageProps(기존 infoDropAdapter 출력) 미러 — 필요한 필드만 발췌 선언.
 * 각 필드 출처: src/components/info-drop-page.tsx InfoDropPageProps(92-232) 동명 필드.
 * 여분 필드가 있는 실객체를 그대로 넘겨도 구조적 타이핑으로 수용된다.
 */
export type DropDetailInput = {
  /** ← InfoDropPageProps.title (source.title). */
  title: string;
  /** ← InfoDropPageProps.description (ai_summary → curator_message 폴백). */
  description: string;
  /** ← InfoDropPageProps.variant (drop.purpose → 5종). */
  variant?: "info" | "coupon" | "reservation" | "purchase" | "lead";
  /** ← InfoDropPageProps.cardColor (info_drops.card_color, v7.2). */
  cardColor?: string;
  /** ← InfoDropPageProps.videoThumbnailUrl (image 블록 hero → source.thumbnail_url). */
  videoThumbnailUrl?: string;
  /** ← InfoDropPageProps.videoDurationSec (source.duration_sec). */
  videoDurationSec?: number;
  /** ← InfoDropPageProps.videoSourceLabel ("YouTube" | "Instagram"). */
  videoSourceLabel?: string;
  /** 거울 수렴 S1 — 재생 가능한 영상 슬롯(toVideoSlot 결과). 있으면 CardModelBody 히어로가
   *  YouTubeLiteEmbed 로 렌더. 변환부(toDropDetailInput)가 parseVideoUrl 로 조립(어댑터는 무파싱). */
  videoEmbed?: {
    videoId: string;
    thumbnailUrl: string;
    title: string;
    isShorts: boolean;
    durationLabel?: string;
    sourceLabel?: string;
  };
  /** ← InfoDropPageProps.maker.name (public_profiles.display_name). */
  maker?: { name: string };
  /** ← InfoDropPageProps.keyPoints (drop.ai_key_points). */
  keyPoints?: string[];
  /** ← InfoDropPageProps.commerce (본체 product 블록 block_data). */
  commerce?: {
    name: string;
    priceKrw: number | null;
    imageUrl?: string;
    headline?: string;
    sellingPoints?: string[];
    stockLimit?: number | null;
    /** BUG-2 T2 — 재고 단위 라벨(FIX-45c). productQtyUnit 관통용. 미주입 = CardModelBody '개' 폴백. */
    stockUnitLabel?: string;
    /** BADGE-ⓑ — 드로피 예상 보상(floor(dropy_rate×price)). 거울 수렴 S0: 값은 안 쓰고 존재
     *  여부만 dropyReady 신호로 변환(숫자 미노출 락). 미주입 = 라인 미렌더. */
    dropyReward?: number;
  };
  /** ← InfoDropPageProps.remainingStock (get_drop_detail v8.1 파생 재고). */
  remainingStock?: number | null;
  /** ← InfoDropPageProps.funnelCoupon (RPC coupon 객체). valid_until = 마감 타이머(2a 갭 수정).
   *  S2 — 구 CouponPreview 렌더 필드 커버리지: coupon_type/gift_item(증정 칩)·conditions.min_amount(조건 문구). */
  funnelCoupon?: {
    title: string;
    valid_until?: string | null;
    coupon_type?: string | null;
    gift_item?: string | null;
    conditions?: { min_amount?: number; [k: string]: unknown } | null;
  } | null;
  /** S2 — 라우트 확정 마감시각(min(coupon.valid_until, share_events.expires_at)).
   *  계산은 d.$shareUuid.tsx 라우트 존치 — 여기는 확정값 운반만. 미주입 = valid_until 폴백. */
  couponExpiresAt?: string | null;
  /** S2 — 서버 기준시각(라우트 loader serverNow). TimerBadge offset 보정 관통. */
  serverNow?: string;
  /** ← InfoDropPageProps.local (RPC store). */
  local?: {
    name?: string;
    phone?: string;
    address?: string;
    reservationUrl?: string | null;
  };
  /** ← InfoDropPageProps.initialSlots (slot_available RPC 행). */
  initialSlots?: Array<{ slot_date: string; slot_time: string | null; available: number }>;
  /** ← InfoDropPageProps.calendarMode — 현재 date_range 만 구현(운반만). */
  calendarMode?: "date_range" | "date_time_slot";
  /** ← attachedProducts[0] 스냅샷 (name/producerName/priceKrw) — 도킹 카드 표기. */
  attachedProducts?: Array<{ name: string; priceKrw?: number | null; producerName?: string }>;
  /** 🟡 별도 조회 주입 — get_share_journey(카드 단건 RPC 미포함). 미주입 = 미렌더. */
  journey?: CardJourneyNode[];
  /** 🟡 별도 조회 주입 — share_count/SM-3 배치값. */
  shareCount?: number;
};

export function fromDropDetail(input: DropDetailInput): CardModel {
  const variant = input.variant ?? "info";
  const isCommerce = variant === "purchase" && !!input.commerce;
  const isReservation = variant === "reservation";
  const hasCoupon = !!input.funnelCoupon;

  // 45 모드 3종 매핑 — 예약·쿠폰 = reserve / 구매 = commerce / 정보·상담 = general.
  const accent = isCommerce
    ? CARD_MODEL_ACCENTS.commerce
    : isReservation || variant === "coupon"
      ? CARD_MODEL_ACCENTS.reserve
      : CARD_MODEL_ACCENTS.general;

  const category = isCommerce
    ? "상품 카드"
    : isReservation
      ? "예약 카드"
      : variant === "coupon"
        ? "쿠폰 카드"
        : variant === "lead"
          ? "상담 카드"
          : "정보 카드";
  const categoryIcon = isCommerce
    ? ShoppingBag
    : isReservation
      ? Calendar
      : variant === "coupon"
        ? Ticket
        : variant === "lead"
          ? MessageCircle
          : Newspaper;

  // 예약 — initialSlots(slot_date/slot_time/available) → dates/times/slotsByDate 집계.
  const slots = input.initialSlots ?? [];
  const dates = [...new Set(slots.map((s) => s.slot_date))];
  const times = [...new Set(slots.map((s) => s.slot_time).filter((t): t is string => !!t))];
  const slotsByDate: Record<string, number> = {};
  for (const s of slots) {
    slotsByDate[s.slot_date] = (slotsByDate[s.slot_date] ?? 0) + (s.available ?? 0);
  }

  const heroImageUrl = isCommerce
    ? (input.commerce?.imageUrl || input.videoThumbnailUrl)
    : input.videoThumbnailUrl;

  const dock = input.attachedProducts?.[0];
  const qty = input.remainingStock ?? input.commerce?.stockLimit ?? null;

  return {
    accent,
    // FIX-56(Day45 Duke 확정) — 수신 렌더는 저장색 무시, 흰색 정본 고정. DB 값은 보존(읽기만 차단).
    cardColor: DEFAULT_CARD_COLOR,
    pageBg: DEFAULT_PAGE_BG,
    category,
    categoryIcon,
    source: input.videoSourceLabel ?? "YouTube",
    ctaIcon: Tag,
    store: input.local?.name || input.maker?.name || undefined,
    applied: {
      // 본체 콘텐츠 — 영상 썸네일 유무. 커머스는 상품 이미지 슬롯(productimage)로.
      content: !isCommerce && !!input.videoThumbnailUrl,
      productimage: isCommerce && !!heroImageUrl,
      product: isCommerce,
      calendar: isReservation && (dates.length > 0 || !!input.local?.reservationUrl),
      coupon: hasCoupon,
      link: !!(input.local?.phone || input.local?.address),
      dock: !!dock,
      // ❌ 백엔드 부재 — 켜지 않는다(가짜 렌더 금지): seasonal/delivery/review/brand/
      //    top/boost/marketing/party.
    },
    titleText: isCommerce ? input.commerce!.name || input.title : input.title,
    subtitleText: isCommerce
      ? input.commerce?.headline || input.description
      : input.description,
    heroImageUrl,
    clip: clipLabel(input.videoDurationSec),
    // 거울 수렴 S1 — 재생 임베드(수신 방향 전용). 미주입 = 현행 썸네일. 커머스는 상품이미지가
    //   히어로라 영상 임베드 미적용(정보/쿠폰/예약 영상 카드에서만).
    ...(!isCommerce && input.videoEmbed ? { videoEmbed: input.videoEmbed } : {}),
    priceText: isCommerce ? won(input.commerce?.priceKrw) : undefined,
    productQty: qty != null && qty > 0 ? String(qty) : undefined,
    // BUG-2 T2 — 한정 배지 단위 라벨(FIX-45c): commerce 재고 단위 관통(미주입 = CardModelBody '개' 폴백).
    productQtyUnit: isCommerce ? input.commerce?.stockUnitLabel : undefined,
    productPoints: isCommerce
      ? (input.commerce?.sellingPoints?.length ? input.commerce.sellingPoints : input.keyPoints)
      : input.keyPoints,
    // 예약 데이터 — 슬롯 없으면 미주입(=예약 섹션 미렌더, 외부 reservation_url 은 link 버튼 몫).
    ...(dates.length > 0 ? { dates, slotsByDate } : {}),
    ...(times.length > 0 ? { times } : {}),
    couponLabel: input.funnelCoupon?.title,
    couponShort: input.funnelCoupon?.title,
    // 거울 수렴 S0 — 쿠폰 마감 타이머(2a 갭): coupons.valid_until → couponExpiresAt(수신 타이머
    //   게이트). fromStudioState 와 동형(ST2b-2 몫이던 /d 방향을 여기서 채움).
    //   S2 — 라우트 확정값(couponExpiresAt input) 우선, 없으면 valid_until 폴백. serverNow 관통.
    ...(input.couponExpiresAt || input.funnelCoupon?.valid_until
      ? { couponExpiresAt: input.couponExpiresAt ?? input.funnelCoupon?.valid_until }
      : {}),
    ...(input.serverNow ? { serverNow: input.serverNow } : {}),
    // S2 — 구 CouponPreview 필드 커버리지(증정 칩 ↔ 조건 문구 상호배타 · 기한 표기 — 동일 로직 이식).
    ...(input.funnelCoupon?.coupon_type === "gift" && input.funnelCoupon.gift_item?.trim()
      ? { couponGift: input.funnelCoupon.gift_item.trim() }
      : typeof input.funnelCoupon?.conditions?.min_amount === "number"
        ? {
            couponCondition: `${input.funnelCoupon.conditions.min_amount.toLocaleString("ko-KR")}원 이상 사용하실 때`,
          }
        : {}),
    ...(input.funnelCoupon
      ? {
          couponValidText: input.funnelCoupon.valid_until
            ? `${new Date(input.funnelCoupon.valid_until).toLocaleDateString("ko-KR")}까지`
            : "기간 제한 없음",
        }
      : {}),
    // 거울 수렴 S0 — 드로피 적립 신호(수신 전용·숫자 미포함). 보상>0 일 때만 라인 렌더(락 §드로피).
    ...(isCommerce && (input.commerce?.dropyReward ?? 0) > 0 ? { dropyReady: true } : {}),
    phone: !!input.local?.phone,
    map: !!input.local?.address,
    ...(dock
      ? {
          dockTitle: dock.name,
          dockMeta:
            [dock.producerName, dock.priceKrw != null ? won(dock.priceKrw) : ""]
              .filter(Boolean)
              .join(" · ") || "함께 담긴 카드",
        }
      : {}),
    // 🟡 여정·확산 — 호출부 별도 조회 주입(미주입 = 미렌더).
    ...(input.journey ? { journey: input.journey } : {}),
    ...(input.shareCount != null ? { spreadCount: input.shareCount } : {}),
  };
}

// ═════════════════════════════════════════════════════════════
// ② fromStudioState — 스튜디오 미리보기 방향
// ═════════════════════════════════════════════════════════════

/**
 * studio-build.tsx 로컬 state 미러 — 각 필드 출처는 studio-build.tsx useState(361-432).
 * studio-build 는 이 단계에서 수정하지 않는다 — 연결(state → 이 입력 조립)은 ST2.
 */
export type StudioStateInput = {
  /** ← studio-build buildMode(365): general | reserve | commerce. */
  buildMode: "general" | "reserve" | "commerce";
  /** ← studio-build cardColor(366). */
  cardColor: string;
  /** ← studio-build applied(361) — 블록 장착 토글 맵(content/coupon/calendar/link/image/dock…). */
  applied: Record<string, boolean>;
  /** ← studio-build tagline(411). */
  tagline: string;
  /** ← studio-build selectedVideo(413) — CardBody.types.ts VideoSlot 미러(필드 발췌). */
  selectedVideo?: {
    videoId: string;
    thumbnailUrl: string;
    title: string;
    isShorts: boolean;
    durationLabel?: string;
    sourceLabel?: string;
  } | null;
  /** ← studio-build pickedPoints(424). */
  pickedPoints?: string[];
  /** ← studio-build selectedCoupon(449 파생) — coupons 행에서 title 만.
   *  ST2b-0 — valid_until additive(옵셔널): 미리보기 마감 타이머용. 미주입 = 타이머 미렌더. */
  selectedCoupon?: { title: string; valid_until?: string | null } | null;
  /** ← studio-build store(파트너) display_name/contact. */
  storeName?: string | null;
  storePhone?: string | null;
  storeAddress?: string | null;
  /** ← studio-build productName(385)/productPrice(386)/productImageUrl(382). */
  productName?: string;
  productPrice?: number | null;
  productImageUrl?: string;
  /** ← studio-build productCopy(388) — ProductCopyValue{headline, sellingPoints}. */
  productCopy?: { headline?: string; sellingPoints?: string[] };
  /** ← studio-build dockedProducts(379) 첫 항목 스냅샷. */
  dockedProduct?: { name: string; priceKrw?: number | null; producerName?: string } | null;
};

/**
 * @param preview — ST2a: 스튜디오 로컬 설정(예약 날짜/시간/좌석·시설·브랜드·판매기간 등
 *   미영속 프리뷰 필드)을 마지막에 병합. WYSIWYG 거울 전용 — 발행 payload 와 무관.
 */
export function fromStudioState(input: StudioStateInput, preview?: Partial<CardModel>): CardModel {
  const isCommerce = input.buildMode === "commerce";
  const isReserve = input.buildMode === "reserve";
  const accent = isCommerce
    ? CARD_MODEL_ACCENTS.commerce
    : isReserve
      ? CARD_MODEL_ACCENTS.reserve
      : CARD_MODEL_ACCENTS.general;

  const video = input.selectedVideo ?? null;
  const heroImageUrl = isCommerce ? input.productImageUrl : video?.thumbnailUrl;

  return {
    accent,
    cardColor: input.cardColor || DEFAULT_CARD_COLOR,
    pageBg: DEFAULT_PAGE_BG,
    category: isCommerce ? "상품 카드" : isReserve ? "예약 카드" : "정보 카드",
    categoryIcon: isCommerce ? ShoppingBag : isReserve ? Calendar : Newspaper,
    source: video?.sourceLabel ?? "YouTube",
    ctaIcon: Tag,
    store: input.storeName || undefined,
    applied: {
      // studio applied 맵 승계 + 모드 파생 플래그 보강(미리보기 즉시 반영).
      ...input.applied,
      content: !!video && !isCommerce,
      productimage: isCommerce && !!input.productImageUrl,
      product: isCommerce,
      coupon: !!input.selectedCoupon && (input.applied["coupon"] ?? true),
      // FIX-54 — 매장정보 누수 수정: 기본값만 모드 의존(예약=ON 현행 유지 / general·commerce=OFF).
      //   어느 모드든 사용자가 매장정보 블록 명시 장착(applied.link=true)하면 렌더(도킹 락 보존).
      link: !!(input.storePhone || input.storeAddress) && (input.applied["link"] ?? (input.buildMode === "reserve")),
      dock: !!input.dockedProduct,
    },
    titleText: isCommerce
      ? input.productName || "상품 이름"
      : input.storeName || video?.title || "",
    subtitleText: isCommerce
      ? input.productCopy?.headline || input.tagline
      : input.tagline,
    heroImageUrl,
    clip: video?.durationLabel,
    priceText: isCommerce ? won(input.productPrice) : undefined,
    productPoints: isCommerce
      ? (input.productCopy?.sellingPoints?.length
          ? input.productCopy.sellingPoints
          : input.pickedPoints)
      : input.pickedPoints,
    couponLabel: input.selectedCoupon?.title,
    couponShort: input.selectedCoupon?.title,
    // ST2b-0 — 마감 타이머(실값만 · 미주입 = 미렌더). /d 방향(fromDropDetail)은 ST2b-2 몫.
    ...(input.selectedCoupon?.valid_until
      ? { couponExpiresAt: input.selectedCoupon.valid_until }
      : {}),
    phone: !!input.storePhone,
    map: !!input.storeAddress,
    ...(input.dockedProduct
      ? {
          dockTitle: input.dockedProduct.name,
          dockMeta:
            [
              input.dockedProduct.producerName,
              input.dockedProduct.priceKrw != null ? won(input.dockedProduct.priceKrw) : "",
            ]
              .filter(Boolean)
              .join(" · ") || "함께 담긴 카드",
        }
      : {}),
    // ❌ 백엔드 부재(배송·후기)·여정(스튜디오 무의미) — 미주입 = 미렌더.
    // ST2a — 스튜디오 로컬 프리뷰 필드(예약 날짜·시설·브랜드 등)는 preview 로 병합.
    ...preview,
  };
}
