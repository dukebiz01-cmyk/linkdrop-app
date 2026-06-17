import type { CardUserAction } from "@/components/cards/types";
import type { DropPurpose } from "@/lib/types";
import type { VideoMetadata } from "@/lib/video-metadata";

export interface VideoInfo {
  url: string;
  thumbnailUrl: string;
  title: string;
  channelName: string;
  duration: string;
  platform: "youtube" | "instagram";
}

export interface LocalPartner {
  id: string;
  name: string;
  category: string;
  address: string;
  avatarUrl: string;
}

export interface AiPreviewData {
  title: string;
  summary: string;
  keyPoints: string[];
  suggestedShareText: string;
}

/** ③ 카드 담기 — 위저드에 담은 자체업로드 상품 1건(참조). get_my_products 행에서 매핑. */
export interface AttachedProduct {
  /** 참조하는 상품 드롭 id (info_drops.id) */
  refDropId: string;
  /** 참조 상품의 공개 카드 share_uuid (/d/{share_uuid}) */
  refShareUuid: string;
  name: string;
  priceKrw: number | null;
  imageUrl: string | null;
  /** 나-2 — 상품 메인 블록에 저장된 카피 스냅샷(있으면 관련 상품 컴팩트 렌더에 노출). */
  headline?: string;
  sellingPoints?: string[];
}

/** B 상품 홍보 카드 — 업주 상품 1개 + AI(또는 수동) 헤드라인·셀링포인트. block_kind="product"
 *  + block_data.is_promo:true 로 적재(기존 "관련 상품"과 구분, DDL 0). MVP = 드롭당 1개. */
export interface PromoCard {
  refDropId: string;
  refShareUuid: string;
  name: string;
  priceKrw: number | null;
  imageUrl: string | null;
  headline: string;
  sellingPoints: string[];
}

/** G2 멀티소스 — 카드에 담은 추가 콘텐츠(primary 외). 검색 후보(DiscoverCandidate)에서 매핑.
 *  type: 영상='video'(YouTube) / 글='article'(Naver 뉴스·블로그). provider 보존 = 멀티-provider.
 *  sourceId = dedup 키(영상=videoId, 글=link). (이름은 호환 위해 AttachedVideo 유지.) */
export interface AttachedVideo {
  type: "video" | "article";
  provider: string;
  sourceId: string;
  sourceUrl: string;
  canonicalUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  authorName: string | null;
  snippet?: string | null;
}

export type WizardSuggestionConfidence = "high" | "medium" | "low";

export interface CreateDropWizardProps {
  variant?: "default" | "skeleton";
  /** phase1 B: 비지니스(approved partner owner). true 만 "쿠폰" 카드 노출. */
  isBusiness?: boolean;
  initialUrl?: string;
  initialPurpose?: DropPurpose;
  initialSuggestedPurpose?: DropPurpose;
  initialSuggestionConfidence?: WizardSuggestionConfidence;
  initialPlatform?: string;
  initialSourceId?: string;
  /** 이 드롭이 타깃하는 매장(탐색 진입 시 자동 연결된 partner). AI 추천 키워드 매장 신호. */
  initialPartnerId?: string;
  /** Home sessionStorage draft — Step 1 즉시 preview */
  initialMetadata?: VideoMetadata | null;
  onClose?: () => void;
  /**
   * Step 5 진입 후 첫 카카오톡 공유/링크 복사 클릭 시 호출.
   * 실제 /api/drops 저장을 수행하고 real share_uuid/share_url 을 반환.
   * 실패 시 throw 하면 wizard 가 인라인 에러를 표시한다.
   */
  onComplete?: (data: {
    video: VideoInfo;
    purpose: DropPurpose;
    local?: LocalPartner;
    ai: AiPreviewData;
    makerMessage: string;
    /** v5.12 — 메이커가 위저드에서 선택한 funnel coupon id (쿠폰 목적만). */
    selectedFunnelCouponId?: string | null;
    /** F2 커머스(구매) — 가격(원)/상품명/카테고리. 구매 목적에서만 채워진다. */
    priceKrw?: number | null;
    productName?: string | null;
    category?: string | null;
    /** ③ 카드 담기 — 위저드에서 담은 자체업로드 상품들(전 목적 공통). */
    attachedProducts?: AttachedProduct[];
    /** Slice2 멀티영상 — primary 외 추가 영상(video 블록으로 적재). */
    attachedVideos?: AttachedVideo[];
    /** B 상품 홍보 카드(MVP 1개). 있으면 is_promo product 블록으로 적재. */
    promoCard?: PromoCard | null;
  }) => Promise<{ shareUuid: string; shareUrl: string }>;
}

// phase1 A: 5스텝 → 3스텝 재구성.
//   Step 1 = URL 입력 + 목적 선택 (옛 Step1 + Step2 병합).
//   Step 2 = 목적별 디테일 (옛 Step3 그대로).
//   Step 3 = 미리보기 + 공유 (옛 Step4 + Step5 병합).
export type StepNum = 1 | 2 | 3;

export type PurposeFlowConfig = {
  badge: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  chipClass: string;
  /** Step 3 세부 유형 카드 */
  detailCards: { id: string; label: string }[];
  /** Fast Step 2 목적별 추가 편집 필드 라벨 */
  editFields: string[];
};

/** 목적별 copy/버튼/세부카드/편집필드 — UI는 공통 카드 컴포넌트에 주입만 */
export const PURPOSE_FLOW_CONFIG: Record<DropPurpose, PurposeFlowConfig> = {
  정보: {
    badge: "정보",
    title: "영상 핵심 정리",
    description: "영상의 핵심 내용을 보기 쉽게 정리했어요.",
    points: ["핵심 요약 생성", "정보 구조 정리", "공유 문구 생성"],
    cta: "자세히 보기",
    chipClass: "bg-intent-info-bg text-intent-info",
    detailCards: [
      { id: "summary", label: "영상 핵심 요약" },
      { id: "place", label: "장소/매장 소개" },
      { id: "review", label: "후기 정리" },
      { id: "checklist", label: "체크리스트" },
    ],
    editFields: [],
  },
  쿠폰: {
    badge: "쿠폰",
    // v7.2 — 손님 관점 통일. info-drop-page L185-189 sectionTitle 과 동일
    // ("받을 수 있는 혜택"). 위저드 미리보기 헤더에서도 손님 시점 적용.
    title: "받을 수 있는 혜택",
    description: "친구가 바로 사용할 수 있는 쿠폰형 Drop을 만들었어요.",
    points: ["쿠폰명 생성", "사용 조건 정리", "쿠폰 받기 버튼 구성"],
    cta: "쿠폰 받기",
    chipClass: "bg-intent-warning-bg text-intent-warning",
    detailCards: [
      { id: "discount", label: "할인 쿠폰" },
      { id: "visit", label: "방문 혜택" },
      { id: "invite", label: "친구 초대 혜택" },
      { id: "limited", label: "기간 한정 혜택" },
    ],
    editFields: ["할인 내용", "사용 조건"],
  },
  예약: {
    badge: "예약",
    title: "주말 빈자리 예약",
    description: "비어 있는 날짜와 예약 버튼을 함께 보여주도록 구성했어요.",
    points: ["예약 버튼 구성", "예약 가능한 날짜 표시", "예약 링크 연결"],
    cta: "예약하기",
    chipClass: "bg-intent-success-bg text-intent-success",
    detailCards: [
      { id: "camping", label: "캠핑장 예약" },
      { id: "stay", label: "숙박 예약" },
      { id: "experience", label: "체험 예약" },
      { id: "consult", label: "상담 예약" },
    ],
    editFields: ["예약 링크", "예약 가능 기간"],
  },
  구매: {
    badge: "구매",
    title: "AI 상품 찾기·가격비교",
    description: "영상 속 상품 후보와 구매 연결을 정리했어요.",
    points: ["상품 후보 추출", "가격비교 카드 구성", "구매 버튼 구성"],
    cta: "상품 보기",
    chipClass: "bg-surface text-text-strong",
    detailCards: [
      { id: "find", label: "AI 상품 찾기" },
      { id: "compare", label: "가격 비교" },
      { id: "cart", label: "장바구니 구성" },
      { id: "link", label: "구매 링크 연결" },
    ],
    editFields: ["상품명", "구매 링크"],
  },
  상담: {
    badge: "상담",
    title: "문의·상담 받기",
    description: "관심 있는 사람이 바로 문의할 수 있게 구성했어요.",
    points: ["상담 폼 구성", "문의 버튼 구성", "응답 문구 생성"],
    cta: "상담 신청",
    chipClass: "bg-intent-danger-bg text-intent-danger",
    detailCards: [
      { id: "one_to_one", label: "1:1 문의" },
      { id: "quote", label: "견적 문의" },
      { id: "phone", label: "전화 상담" },
      { id: "booking_consult", label: "예약 상담" },
    ],
    editFields: ["상담 항목", "응답 방식"],
  },
};

export type Step3DetailId = string;

type SummaryTone = "짧게" | "자세히" | "후기처럼";

// 예약 목적 — 메이커가 안내하는 예약 가능 날짜의 상태.
export type ReservationDateStatus = "available" | "few_left" | "almost_full" | "closed" | "inquiry";

// 예약 목적 — 메이커가 정하는 예약 가능 날짜 입력 모드.
export type ReservationDateMode = "single" | "range" | "multiple";

// 예약 가능 날짜 1건 — 하루/기간/여러 날짜를 같은 배열(reservationDates)에 담는다.
// WHY: 예약 가능 기간을 시스템이 단정하지 않는다. 메이커가 모드를 골라 직접 입력한다.
export type ReservationDateItem = {
  id: string;
  mode: ReservationDateMode;
  /** single=[d] · range=[start,end] · multiple=[d,...] */
  dates: string[];
  startDate?: string;
  endDate?: string;
  nights?: number;
  status: ReservationDateStatus;
  remainingCount?: number;
  memo?: string;
  /** 그날의 행사/이벤트 — 메이커 자유 입력. 고정 chip·eventTypes 없음. */
  eventTitle?: string;
  eventDescription?: string;
  highlighted?: boolean;
};

// 예약 업종 — 공용 카드 구조의 분기 키. 이번 작업은 stay 만 구현, 나머지는 fallback.
export type ReservationVertical =
  | "stay"
  | "beauty"
  | "restaurant"
  | "experience"
  | "medical"
  | "general";

// 예약 일정 방식 — 업종별 캘린더/시간 입력 방식. 이번 작업은 checkin_checkout 만 구현.
export type ScheduleMode =
  | "checkin_checkout"
  | "time_slots"
  | "date_time_party"
  | "sessions"
  | "general";

export type Step3FieldState = {
  summaryTone: SummaryTone;
  shareMessage: string;
  couponName: string;
  discountText: string;
  useCondition: string;
  expiryDate: string;
  dateMode: string;
  guestCount: string;
  petAllowed: boolean;
  bookingLink: string;
  /** 예약 목적 — 예약 버튼 연결 방식 (RESERVATION_DESTS.id) */
  reservationDest: string;
  /** 예약 목적 — 업종. 공용 카드 구조의 분기 키 (현재 stay 만 구현). */
  reservationVertical: ReservationVertical;
  /** 예약 목적 — 일정 방식 (현재 checkin_checkout 만 구현). */
  scheduleMode: ScheduleMode;
  /** 예약 목적 — 어떤 예약을 알릴지 (빈자리/주말/펜션 객실 등) */
  reservationType: string;
  /** 예약 목적 — 어느 사이트/객실인지 (전체/캠핑 사이트/펜션 객실/글램핑/직접 입력) */
  facilityTarget: string;
  /** 예약 목적 — facilityTarget 이 직접 입력일 때 메이커가 적는 시설명 */
  facilityCustom: string;
  /** 예약 목적 — 장소 정보 (searchPlaces 후보 선택 또는 직접 입력) */
  placeName: string;
  placeAddress: string;
  placePhone: string;
  placeMapUrl: string;
  placeSource: string;
  /** 예약 목적 — 캘린더에서 선택한 예약 가능 날짜 (각 single 모드 항목) */
  reservationDates: ReservationDateItem[];
  /** 예약 목적 — 더 자세히 만들기(고급 설정) */
  checkInTime: string;
  checkOutTime: string;
  baseGuests: string;
  maxGuests: string;
  facilityDetail: string;
  cautionNote: string;
  couponCondition: string;
  operatorNote: string;
  eventDetail: string;
  productKeyword: string;
  priceCompareEnabled: boolean;
  productCount: string;
  purchaseLink: string;
  collectContact: boolean;
  consultItem: string;
  ctaCopy: string;
  privacyNotice: string;
  shareMessageUserAction: CardUserAction;
  /** 정보 목적 — 한줄요약 (AI 추천 또는 사용자 수정) */
  infoHeadline: string;
  infoHeadlineUserAction: CardUserAction;
  /** 정보 목적 — 키포인트 (옵션, 고급 카드) */
  infoKeyPoints: string[];
  /** 정보 목적 — 체크리스트 (옵션, 고급 카드) */
  infoChecklist: string[];
  /** 정보 목적 — 인용 (옵션, 고급 카드) */
  infoQuote: string;
};

// 예약 Step 3 입력값 → 받는 사람 화면/공유 데이터로 흐를 요약.
export type ReservationSummary = {
  placeName: string;
  placeAddress: string;
  placePhone: string;
  placeMapUrl: string;
  destKind: string;
  destLabel: string;
  destValue: string;
  /** '나중에 입력'이 아니고 연결값이 있을 때만 예약하기 버튼 노출 */
  hasReserveButton: boolean;
  hasPhoneButton: boolean;
  hasMapButton: boolean;
  dates: ReservationDateItem[];
};

// 예약 목적 — 장소 검색 후보. searchPlaces 결과 단위.
export type PlaceCandidate = {
  name: string;
  address: string;
  phone: string;
  mapUrl: string;
  source: string;
};
