import type { LucideIcon } from "lucide-react";

/**
 * CardModel 거울 2.0 — 제작(studio)·공유(share)·수신(receiver)에서 동일하게 렌더되는
 * 카드의 완성 상태. 정본: docs/ref/v0-45-card-body.tsx (868줄).
 *
 * 원칙(정본 §CardModel 주석 승계): 모든 표시 문자열은 어댑터(빌더)에서 미리 확정해 넣어,
 * 어느 화면에서 그려도 결과가 같다(거울). 블록은 ReactNode 가 아닌 데이터 필드.
 *
 * ★ "미주입 = 미렌더" 계약: optional 필드는 값이 없으면 해당 섹션을 그리지 않는다.
 *   특히 백엔드 부재 영역 — 배송추적(SHIP_STAGES 계열: courier/shipStage/trackingNo/
 *   shipFee/shipEta), 시설태그(facilities), 후기(rating/reviewText), 판매기간(saleStart/
 *   saleEnd) — 은 실데이터 공급원이 생기기 전까지 어댑터가 채우지 않는다(가짜값 금지).
 *
 * ★ 직렬화 예외 2필드: categoryIcon/ctaIcon 은 LucideIcon 컴포넌트 참조(정본 계약 유지).
 *   직렬화가 필요한 경계(서버 저장 등)에서는 어댑터가 아이콘을 제외하고 운반한 뒤
 *   렌더 직전에 다시 주입한다. 나머지 필드는 전부 JSON 직렬화 가능.
 *
 * 기존 파일 의존 0 — 아래 미러 필드의 출처는 주석으로만 기록(import 금지, 회귀 0):
 *   · heroImageUrl/clip/source ← CardBody.types.ts VideoSlot(thumbnailUrl/durationLabel/
 *     sourceLabel) 및 image 블록 block_data.image_url 발췌.
 *   · couponLabel/couponShort ← CouponPreview.tsx CouponPreviewCoupon(title 등) 발췌.
 *   · priceText/productQty/productPoints ← ProductWidget.tsx ProductWidgetProps
 *     (priceKrw/stockLimit/sellingPoints) 데이터부 발췌.
 */

export type CardModelVariant = "studio" | "share" | "receiver";

/** 공유 여정 노드 — 정본 CardJourneyNode 그대로. */
export type CardJourneyNode = {
  name: string;
  role: string;
  kind: "peer" | "me" | "buyer";
  emphasis?: boolean;
};

/** 배송 진행 단계 — 정본 SHIP_STAGES 그대로(store-hub 배송 상태와 일관). */
export const SHIP_STAGES = ["배송준비", "배송중", "배송완료"] as const;

export type CardModel = {
  /** 모드별 강조색 — 카드 전체(칩·버튼·스텝퍼·여정)에 흐르는 accent(정본 색 시스템). */
  accent: string;
  /** 카드 배경색 — info_drops.card_color(v7.2) 매핑 대상. */
  cardColor: string;
  /** 카드 뒤 페이지 배경 — 쿠폰 이음새 노치의 "구멍" 색으로 사용(정본). */
  pageBg: string;
  /** 카테고리 라벨(예: 예약 카드 · 상품 카드). */
  category: string;
  /** 직렬화 예외 ① — 카테고리 칩 아이콘. 미주입 시 렌더러 기본값(Tag). */
  categoryIcon?: LucideIcon;
  /** 출처 라벨(예: YouTube) ← VideoSlot.sourceLabel 발췌. */
  source: string;
  /** 직렬화 예외 ② — 구매 버튼 아이콘. 미주입 시 렌더러 기본값(Tag). */
  ctaIcon?: LucideIcon;
  /** 매장/메이커 이름 — 쿠폰 카드 발급처 표기 등. */
  store?: string;
  /** 블록 장착 맵 — studio-build applied 와 같은 시맨틱(키별 섹션 게이트). */
  applied: Record<string, boolean>;
  titleText: string;
  subtitleText: string;

  /** 히어로 실이미지 — 영상 썸네일(VideoSlot.thumbnailUrl) 또는 상품 이미지
   *  (block_data.image_url). 미주입 = 정본 placeholder(Play/ImageIcon) 렌더. */
  heroImageUrl?: string;
  /** 핵심 클립 길이 라벨(예: "1:24") ← VideoSlot.durationLabel 발췌. */
  clip?: string;

  /** 브랜드(매장) 소개문 — applied["brand"] 게이트. */
  brandText?: string;

  // ── 상품(가격) — ProductWidgetProps 데이터부 발췌 ──
  /** 표시용 확정 가격 문자열(예: "12,000원"). */
  priceText?: string;
  productType?: string;
  productOrigin?: string;
  productUnitLabel?: string;
  /** FIX-24 — 수확·발송 기간 스냅샷(예: "7/15~7/22 순차 발송") ← block_data.date_range_label.
   *  단일일이면 미주입 = 미렌더(기존 형식 유지). */
  productDateRangeLabel?: string;
  /** 한정 수량 라벨(숫자 문자열) ← stockLimit/remaining_stock. */
  productQty?: string;
  /** BUG-2 T2 — 한정 수량 단위 라벨(FIX-45c: '박스'/'망'/'kg' 등). 미주입 = '개' 폴백. /d 위젯과 단위 동기화. */
  productQtyUnit?: string;
  /** 셀링포인트 ← selling_points/ai_key_points. */
  productPoints?: string[];
  /** FIX-39 — 판매 부스터 칩(전부 실값 · 빈 배열/미주입 = 미렌더).
   *  산출은 booster45.ts 순수 모듈(D-day·남은수량 = 조회 시점 계산 — 스냅샷 박제 금지). */
  boosterChips?: Array<{ kind: "stock" | "dday" | "orders" | "benefit"; label: string }>;
  /** FIX-40 — 공동구매 v1 표시(미주입 = 미렌더). 산출은 booster45.buildGroupBuyView(순수).
   *  progressLine 은 preorders 실집계 있을 때만(null = 진행률 미렌더 — 가짜 집계 금지). */
  groupBuy?: {
    offerLine: string;
    progressLine: string | null;
    noticeLine: string;
    cancelLine: string;
  };

  // ── 배송 — 백엔드 부재(운송장·배송 테이블 없음). 전부 미주입 = 미렌더. ──
  shipFee?: string;
  shipEta?: string;
  /** 택배사(예: CJ대한통운). */
  courier?: string;
  /** 배송 진행 단계 인덱스: 0 배송준비 · 1 배송중 · 2 배송완료. */
  shipStage?: number;
  /** 송장번호. */
  trackingNo?: string;

  // ── 후기 — 백엔드 부재. 미주입 = 미렌더. ──
  rating?: number;
  reviewText?: string;

  // ── 예약 — initialSlots(slot_date/slot_time/available)·reservation_data 매핑 대상 ──
  /** 단일 날짜 폴백(dates 미주입 시). */
  date?: string;
  /** 단일 시간 폴백(times 미주입 시). */
  time?: string;
  /** 판매 캘린더 판매 기간(시작~종료) — 데이터 부재 시 미렌더. */
  saleStart?: string;
  saleEnd?: string;
  dates?: string[];
  /** 빈 배열 = 시간 미지정(종일) — 정본 시맨틱 유지. */
  times?: string[];
  /** 날짜 공통 잔여석 폴백. */
  slots?: number;
  /** 날짜별 잔여석. */
  slotsByDate?: Record<string, number>;
  /** 인원(예약 파티 크기). */
  party?: number;

  // ── 쿠폰 — CouponPreviewCoupon(title) 발췌. applied["coupon"] 게이트. ──
  couponLabel?: string;
  couponShort?: string;
  /** ST2b-0 — 쿠폰 마감 시각(ISO, coupons.valid_until). 미주입 = 타이머 미렌더
   *  (수신카드 1-C couponTimer 게이트 동형 — 거울 원칙). */
  couponExpiresAt?: string | null;

  // ── 매장정보(link 블록) ──
  phone?: boolean;
  map?: boolean;
  /** 매장 시설 태그(주차·와이파이 등) — 백엔드 부재(현행 유일 공급원 = mock).
   *  미주입 = 미렌더. */
  facilities?: string[];

  // ── 도킹(함께 받는 카드) — attached product 블록 스냅샷 발췌 ──
  dockTitle?: string;
  dockMeta?: string;

  // ── 여정·확산 — get_share_journey/share_count. 카드 단건 RPC 미포함이라 optional. ──
  /** 미주입 = 여정 섹션 미렌더. */
  journey?: CardJourneyNode[];
  /** 확산 인원 — journey 렌더 시 0 폴백. */
  spreadCount?: number;
};

/**
 * receiver variant 실동작 콜백 — 전부 optional.
 * 미주입 시 해당 버튼은 studio/share 와 동일한 시각 stub(onClick 없음)으로 렌더.
 */
export type CardModelActions = {
  /** 쿠폰 카드 "쿠폰 받기". */
  onClaimCoupon?: () => void;
  /** 본체 "예약하기". */
  onReserve?: () => void;
  /** 본체 "구매"(선주문). */
  onPreorder?: () => void;
  /** 매장정보/전화/위치 버튼. */
  onContact?: () => void;
  /** 공유 푸터 "카톡 공유". */
  onShare?: () => void | Promise<void>;
  /** 공유 푸터 "링크 복사". */
  onCopyLink?: () => void | Promise<void>;
  /** 함께 받는 카드(도킹) 열기. */
  onDockOpen?: () => void;
  /** FIX-41 — 품절 카드 "재입고 알림 받기"(drop_alerts 신청). /d 배선은 ST2b — 미주입 = stub. */
  onRestockAlert?: () => void;
};
