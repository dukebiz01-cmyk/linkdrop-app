import { Calendar, MessageCircle, Newspaper, ShoppingBag, Tag } from "lucide-react";
import type { CardJourneyNode, CardModel } from "./card-model.types";
// S4 — 부스터 칩·공동구매 산출은 스튜디오(CardStudioPage45 :2146·:2170)와 동일 순수 모듈 소비(거울 성립).
import { buildBoosterChips, buildGroupBuyView } from "./booster45";

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

/** FIX-60 — 카드 칩 라벨 단일 상수(거울 단일 소스 — buildShippingView 문법): 수신
 *  fromDropDetail 과 스튜디오 미리보기(content.category)가 같은 문자열을 소비한다.
 *  정본 = 수신 산출("정보 카드"·"상품 카드"). 모드 탭 등 UI 명칭(퍼블릭/상품판매)과는 별개. */
export const CARD_CATEGORY_LABELS = {
  info: "정보 카드",
  reserve: "예약 · 쿠폰 카드",
  commerce: "상품 카드",
  lead: "상담 카드",
} as const;

const DEFAULT_CARD_COLOR = "#FFFFFF";
/** 카드 뒤 페이지 배경(쿠폰 노치 구멍색) — 앱 표면 톤. */
const DEFAULT_PAGE_BG = "#F8FAFC";

function won(n: number | null | undefined): string {
  return n != null ? `${Math.round(n).toLocaleString("ko-KR")}원` : "";
}

/** S4-6 — 배송 표시행 산출(★공용 단일 소스): 수신(fromDropDetail)·스튜디오(CardStudioPage45
 *  preview 주입) 양쪽이 이 헬퍼만 소비한다 — 문구·행 순서·무료배송 규칙이 한 소스(거울 정의).
 *  실값 있는 행만 산출, 0행 = null(미주입 = 셀 미렌더). SHIP_STAGES/송장 무관(§0 S4b 락). */
export function buildShippingView(i: {
  shipMethod?: string | null;
  freeShip?: boolean;
  shipFeeKrw?: number | null;
  shipNote?: string | null;
  /** 수확·발송 예정일(yyyy-mm-dd) — "M월 D일 수확·발송 예정" 가공도 여기 단일 소스. */
  harvestDate?: string | null;
}): { rows: Array<{ label: string; value: string }> } | null {
  const rows: Array<{ label: string; value: string }> = [];
  if (i.shipMethod?.trim()) rows.push({ label: "배송방법", value: i.shipMethod.trim() });
  if (i.freeShip) rows.push({ label: "배송비", value: "무료배송" });
  else if (i.shipFeeKrw != null && i.shipFeeKrw > 0)
    rows.push({ label: "배송비", value: `${i.shipFeeKrw.toLocaleString("ko-KR")}원` });
  if (i.harvestDate?.trim()) {
    const p = String(i.harvestDate).split("-");
    rows.push({
      label: "발송",
      value:
        p[1] && p[2]
          ? `${Number(p[1])}월 ${Number(p[2])}일 수확·발송 예정`
          : String(i.harvestDate),
    });
  }
  if (i.shipNote?.trim()) rows.push({ label: "안내", value: i.shipNote.trim() });
  return rows.length > 0 ? { rows } : null;
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
  /** FIX-59b — ← InfoDropPageProps.aiSummary (drop.ai_summary 실값만). 카드 [영상 요약] 접이 요약문. */
  aiSummary?: string;
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
    /** S4 — 외부 구매 링크(자체업로드 합성 URL 포함). 모델에 URL 미운반 — CTA 액션은
     *  페이지가 actions.onPreorder 분기로 주입(어댑터는 신호만). */
    buyUrl?: string;
    /** S4 — 자체업로드 상품(CTA "주문예약" 분기·품절 칩 게이트 신호). */
    selfUpload?: boolean;
    /** S4 — 수확·발송 예정일(yyyy-mm-dd, 신선 원물만). productDateRangeLabel 가공 재료. */
    harvestDate?: string | null;
    /** S4-6 — 배송정보 셀 재료(buildShippingView 입력 — 실값만, 미주입 = 셀 미렌더). */
    shipMethod?: string;
    freeShip?: boolean;
    shipFeeKrw?: number | null;
    shipNote?: string;
    /** S4 — 판매기간 마감(yyyy-mm-dd). 부스터 D-day 근거(booster45 ddayLabel — 스튜디오 동일 모듈). */
    saleEndIso?: string;
    /** S4 — 공동구매 원시 키(buildGroupBuyView 입력 — 스튜디오 :2170 동일 빌더). */
    groupBuy?: { targetN: number; priceKrw: number; deadline: string | null };
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
  /** S3-3 ⑤ — 매장 시설 태그 관통(applied.link 게이트 하 렌더). 현행 공급원 부재(RPC store
   *  미포함) = 미주입 = 미렌더 — 가짜값 금지, 관통 자리만. */
  facilities?: string[];
  /** S3-3 ⑦ — 내장 푸터 "나도 만들기" 실링크(수신 전용). 미주입(스튜디오) = 시각 stub. */
  remakeHref?: string;
  remakeLabel?: string;
  /** S3-4d — 쿠폰 variant 캘린더 장착 신호(페이지 showCalendar = 파트너 캘린더 보유).
   *  예약 variant 는 캘린더 필수 블록이라 신호 불요(항상 장착). */
  calendarEquipped?: boolean;
  /** ← InfoDropPageProps.local (RPC store). */
  local?: {
    name?: string;
    phone?: string;
    address?: string;
    reservationUrl?: string | null;
  };
  /** ← InfoDropPageProps.initialSlots (slot_available RPC 행). */
  initialSlots?: ReservationSlotRow[];
  /** ← InfoDropPageProps.calendarMode — 현재 date_range 만 구현(운반만). */
  calendarMode?: "date_range" | "date_time_slot";
  /** ← attachedProducts 스냅샷 — 도킹 카드 표기. S3-4: imageUrl(포토 셀 실사진)·refShareUuid
   *  (수신 새 탭 이동) additive. */
  attachedProducts?: Array<{
    name: string;
    priceKrw?: number | null;
    producerName?: string;
    imageUrl?: string | null;
    refShareUuid?: string | null;
  }>;
  /** 🟡 별도 조회 주입 — get_share_journey(카드 단건 RPC 미포함). 미주입 = 미렌더. */
  journey?: CardJourneyNode[];
  /** 🟡 별도 조회 주입 — share_count/SM-3 배치값. */
  shareCount?: number;
};

/** FIX-62 — get_available_slots 행(RPC 정렬 ORDER BY slot_date, slot_time 그대로 수신). */
export type ReservationSlotRow = { slot_date: string; slot_time: string | null; available: number };

/** FIX-62 — 예약 슬롯 집계 단일 소스: 수신(fromDropDetail)과 스튜디오 미리보기(CardStudioPage45)
 *  가 같은 함수로 dates/times/slotsByDate 를 산출한다 — 날짜·좌석·정렬 거울 자동.
 *  dates = slot_date 등장 순서(= RPC 정렬), slotsByDate = available 합산, times = slot_time 실값만. */
export function buildReservationSlotView(slots: ReservationSlotRow[]): {
  dates: string[];
  times: string[];
  slotsByDate: Record<string, number>;
} {
  const dates = [...new Set(slots.map((s) => s.slot_date))];
  const times = [...new Set(slots.map((s) => s.slot_time).filter((t): t is string => !!t))];
  const slotsByDate: Record<string, number> = {};
  for (const s of slots) {
    slotsByDate[s.slot_date] = (slotsByDate[s.slot_date] ?? 0) + (s.available ?? 0);
  }
  return { dates, times, slotsByDate };
}

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

  // S3-2 지점① — 본체 칩 = 스튜디오 실렌더 동형(CardStudioPage45 content.category):
  //   reserve 모드 = "예약 · 쿠폰 카드"(Calendar). 쿠폰 variant 를 "쿠폰 카드"로 쓰면
  //   도킹 쿠폰 존 칩("쿠폰 카드" — CardModelBody 고정)과 2회 중복 — 스튜디오는 1회.
  // FIX-60 — 칩 라벨 = 단일 상수 소비(스튜디오 미리보기와 문자 단위 동형).
  const category = isCommerce
    ? CARD_CATEGORY_LABELS.commerce
    : isReservation || variant === "coupon"
      ? CARD_CATEGORY_LABELS.reserve
      : variant === "lead"
        ? CARD_CATEGORY_LABELS.lead
        : CARD_CATEGORY_LABELS.info;
  const categoryIcon = isCommerce
    ? ShoppingBag
    : isReservation || variant === "coupon"
      ? Calendar
      : variant === "lead"
        ? MessageCircle
        : Newspaper;

  // 예약 — initialSlots(slot_date/slot_time/available) → dates/times/slotsByDate 집계.
  //   FIX-62 — buildReservationSlotView 단일 소스(스튜디오 미리보기와 공유 — 거울 자동).
  const { dates, times, slotsByDate } = buildReservationSlotView(input.initialSlots ?? []);

  const heroImageUrl = isCommerce
    ? (input.commerce?.imageUrl || input.videoThumbnailUrl)
    : input.videoThumbnailUrl;

  const dock = input.attachedProducts?.[0];
  const qty = input.remainingStock ?? input.commerce?.stockLimit ?? null;

  // ── S4 — purchase 거울 수렴(신규 매핑 · 렌더 신설 0, CardModelBody 기존 섹션 재사용) ──
  // 품절 = 페이지 RestockAlert 게이트(:1941-1944)와 동형: selfUpload + 파생 재고 0 이하.
  const soldOut =
    isCommerce && !!input.commerce?.selfUpload && input.remainingStock != null && input.remainingStock <= 0;
  // todayIso = serverNow(라우트 loader 고정값) KST 변환 — SSR/클라 동일 산출(하이드레이션 안전).
  //   serverNow 미주입 = D-day 미산출(가짜 시계 금지 · placeholder 는 saleEndIso null 이라 미사용).
  const todayIso = input.serverNow
    ? new Date(Date.parse(input.serverNow) + 9 * 3600_000).toISOString().slice(0, 10)
    : null;
  // 부스터 칩 — 스튜디오(:2146)와 동일 모듈 buildBoosterChips 소비. 수량 칩은 미산출(stockLimit
  //   null): 수량은 기존 productQty("한정 N개", 판매가 행)가 담당 — 이중 표기 방지.
  //   orderCount·benefits = 수신 공급원 부재 → 미주입(가짜값 금지).
  const boosterChips = isCommerce
    ? buildBoosterChips({
        stockLimit: null,
        soldOut,
        saleEndIso: todayIso ? (input.commerce?.saleEndIso ?? null) : null,
        todayIso: todayIso ?? "1970-01-01",
        groupBuyActive: !!input.commerce?.groupBuy,
      })
    : [];
  // 공동구매 — 스튜디오(:2170)·페이지 GroupBuySection 과 동일 빌더. joinedCount 실집계 입력
  //   부재 → null(진행률 미렌더 — 가짜 집계 금지).
  const groupBuyView =
    isCommerce && input.commerce?.groupBuy
      ? buildGroupBuyView({
          targetN: input.commerce.groupBuy.targetN,
          achievedPriceKrw: input.commerce.groupBuy.priceKrw,
          joinedCount: null,
        })
      : null;
  // S4-6 — 배송정보 셀(공용 buildShippingView — 스튜디오 주입부와 단일 소스). 실값 0 = null = 미장착.
  const shippingView = isCommerce
    ? buildShippingView({
        shipMethod: input.commerce?.shipMethod,
        freeShip: input.commerce?.freeShip,
        shipFeeKrw: input.commerce?.shipFeeKrw,
        shipNote: input.commerce?.shipNote,
        harvestDate: input.commerce?.harvestDate,
      })
    : null;
  // 수확·발송 칩 — 렌더 접두 "수확·발송 "(:522)과 합쳐 ProductWidget(:130) 문구 동형
  //   ("M월 D일 수확·발송 예정" ↔ "수확·발송 M월 D일 예정"). 파싱 실패 = 원문 그대로(위젯 동일).
  const harvestParts = input.commerce?.harvestDate ? String(input.commerce.harvestDate).split("-") : null;
  const harvestChip = harvestParts
    ? harvestParts[1] && harvestParts[2]
      ? `${Number(harvestParts[1])}월 ${Number(harvestParts[2])}일 예정`
      : String(input.commerce!.harvestDate)
    : null;

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
      // S3-4d(A안) — applied.calendar = "장착 신호"로 재정: 예약 목적 = 캘린더 필수 블록(스튜디오
      //   :1025 required)이라 항상 장착 / 쿠폰 = 파트너 캘린더 보유(calendarEquipped=페이지
      //   showCalendar). dates 유무는 렌더러 펼침 분기(슬롯0 정직 안내)로만 — 스튜디오는
      //   cfgDates 0이면 장착 자체가 disabled 라 "장착=dates 보유"가 항상 성립, 수신의 슬롯0
      //   분기는 발행 후 시점 데이터 상태의 정직 표기(거울 상위집합·위반 아님).
      calendar: isReservation || (variant === "coupon" && !!input.calendarEquipped),
      coupon: hasCoupon,
      // S4-4a — 커머스 그리드 다이어트: purchase 는 매장정보 셀 미장착(스튜디오 주입부와 동형
      //   거울). 잔여 장착물(도킹 등)만 그리드존에 남는다. 타 variant 는 현행 유지.
      link: !isCommerce && !!(input.local?.phone || input.local?.address),
      // S4-6 — 배송정보 셀 장착(이중 게이트 전단 — 실값 행 존재 시만).
      shipping: !!shippingView,
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
    // FIX-59b — 비커머스 [영상 요약] 접이 요약문(실값만 · 커머스 미주입 = 현행 셀링포인트 무접촉).
    ...(!isCommerce && input.aiSummary?.trim() ? { summaryText: input.aiSummary.trim() } : {}),
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
    // S4 — 부스터 칩(D-day·품절)·공동구매·수확발송 칩(전부 기존 렌더 재사용 · 빈/미산출 = 미주입).
    ...(boosterChips.length > 0 ? { boosterChips } : {}),
    ...(groupBuyView ? { groupBuy: groupBuyView } : {}),
    ...(harvestChip ? { productDateRangeLabel: harvestChip } : {}),
    // S4-6 — 배송정보 셀 표 행(공용 헬퍼 산출 그대로).
    ...(shippingView ? { shipping: shippingView } : {}),
    // S4 — CTA 라벨 분기(selfUpload 우선 — 합성 buyUrl 공존 시 "주문예약"이 이김. actions 동일).
    //   그 외 미주입 = 렌더러 "구매" 폴백. 스튜디오(fromStudioState)는 미주입 = 렌더 불변.
    ...(isCommerce && input.commerce?.selfUpload
      ? { ctaLabel: "주문예약" }
      : isCommerce && input.commerce?.buyUrl
        ? { ctaLabel: "구매하기" }
        : {}),
    phone: !!input.local?.phone,
    map: !!input.local?.address,
    // S3-3 ⑤·⑦ — 시설 태그·나도 만들기 관통(미주입 = 미렌더/스튜디오 stub).
    //   S4-4a — 커머스는 시설 셀 미장착(그리드 다이어트 · 스튜디오 주입부 동형).
    ...(!isCommerce && input.facilities?.length ? { facilities: input.facilities } : {}),
    ...(input.remakeHref ? { remakeHref: input.remakeHref } : {}),
    ...(input.remakeLabel ? { remakeLabel: input.remakeLabel } : {}),
    ...(dock
      ? {
          dockTitle: dock.name,
          dockMeta:
            [dock.producerName, dock.priceKrw != null ? won(dock.priceKrw) : ""]
              .filter(Boolean)
              .join(" · ") || "함께 담긴 카드",
          // S3-4 §3 — 포토 셀·펼침 리스트용 전체 목록(실사진·수신 새 탭 href).
          dockItems: input.attachedProducts!.map((p) => ({
            name: p.name,
            ...(p.priceKrw != null ? { priceLabel: won(p.priceKrw) } : {}),
            ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
            ...(p.refShareUuid ? { href: `/d/${p.refShareUuid}` } : {}),
          })),
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
  /** ← studio-build dockedProducts(379) 첫 항목 스냅샷. S3-4: imageUrl additive(포토 셀 거울). */
  dockedProduct?: {
    name: string;
    priceKrw?: number | null;
    producerName?: string;
    imageUrl?: string | null;
  } | null;
};

/**
 * @param preview — ST2a: 스튜디오 로컬 설정(시설·브랜드·판매기간 등 프리뷰 필드)을 마지막에
 *   병합. WYSIWYG 거울 전용 — 발행 payload 와 무관.
 *   FIX-62 — 예약 dates/times/slotsByDate 는 미영속 프리뷰(구 cfgDates)가 아니라 실슬롯
 *   (get_available_slots → buildReservationSlotView, 수신과 동일 소스·동일 정렬)이 흐른다.
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
          // S3-4 §3 — 포토 셀 거울(스튜디오 = 장착 1개, href 없음 = stub).
          dockItems: [
            {
              name: input.dockedProduct.name,
              ...(input.dockedProduct.priceKrw != null
                ? { priceLabel: won(input.dockedProduct.priceKrw) }
                : {}),
              ...(input.dockedProduct.imageUrl ? { imageUrl: input.dockedProduct.imageUrl } : {}),
            },
          ],
        }
      : {}),
    // ❌ 백엔드 부재(배송·후기)·여정(스튜디오 무의미) — 미주입 = 미렌더.
    // ST2a — 스튜디오 로컬 프리뷰 필드(예약 날짜·시설·브랜드 등)는 preview 로 병합.
    ...preview,
  };
}
