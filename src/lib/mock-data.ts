// ─────────────────────────────────────────────────────────────
// Mock Data for Drop Feed Cards
// ─────────────────────────────────────────────────────────────

import type { DropFeedCardProps } from "@/components/drop-feed-card";

// ─────────────────────────────────────────────────────────────
// Makers
// ─────────────────────────────────────────────────────────────

export const MOCK_MAKERS = {
  duke: {
    name: "Duke",
    avatarUrl: "https://picsum.photos/seed/duke/64/64",
    droppedAgo: "3분 전",
  },
  minji: {
    name: "민지",
    avatarUrl: "https://picsum.photos/seed/minji/64/64",
    droppedAgo: "1시간 전",
  },
  alexK: {
    name: "Alex K",
    avatarUrl: "https://picsum.photos/seed/alexk/64/64",
    droppedAgo: "어제",
  },
  noAvatar: {
    name: "익명",
    avatarUrl: "",
    droppedAgo: "2일 전",
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Locals (Partners)
// ─────────────────────────────────────────────────────────────

export const MOCK_LOCALS = {
  forestCoffee: {
    name: "포레스트 커피",
    distance: "350m",
  },
  noeulMakgeolli: {
    name: "노을재 막걸리",
    distance: "1.2km",
  },
  seongsuBookshop: {
    name: "성수동 작은 책방",
    distance: undefined, // No distance
  },
  gangnamCafe: {
    name: "강남 루프탑 카페",
    distance: "500m",
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Creators
// ─────────────────────────────────────────────────────────────

export const MOCK_CREATORS = {
  cafeTour: {
    channelName: "카페투어 브이로그",
    channelUrl: "https://youtube.com/@cafetour",
  },
  seoulWalk: {
    channelName: "서울 산책기",
    channelUrl: "https://youtube.com/@seoulwalk",
  },
  foodHunter: {
    channelName: "맛집 헌터",
    channelUrl: "https://youtube.com/@foodhunter",
  },
  instaCafe: {
    channelName: "인스타 카페탐방",
    channelUrl: "https://instagram.com/instacafe",
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Drop Feed Items
// ─────────────────────────────────────────────────────────────

export const MOCK_DROP_FEED_ITEMS: DropFeedCardProps[] = [
  // Info intent - with distance
  {
    shareUuid: "drop-001",
    maker: MOCK_MAKERS.duke,
    videoThumbnailUrl: "https://picsum.photos/seed/cafe1/640/360",
    videoDurationSec: 185,
    videoSourceLabel: "YouTube",
    intent: "info",
    title: "성수동 숨은 카페 발견! 분위기 진짜 좋아요",
    localName: MOCK_LOCALS.forestCoffee.name,
    distance: MOCK_LOCALS.forestCoffee.distance,
    creator: MOCK_CREATORS.cafeTour,  },
  // Coupon intent - with partner
  {
    shareUuid: "drop-002",
    maker: MOCK_MAKERS.minji,
    videoThumbnailUrl: "https://picsum.photos/seed/makgeolli/640/360",
    videoDurationSec: 312,
    videoSourceLabel: "YouTube",
    intent: "coupon",
    title: "전통 막걸리 맛집에서 10% 할인받는 법",
    localName: MOCK_LOCALS.noeulMakgeolli.name,
    distance: MOCK_LOCALS.noeulMakgeolli.distance,
    creator: MOCK_CREATORS.foodHunter,  },
  // Commerce intent - no distance
  {
    shareUuid: "drop-003",
    maker: MOCK_MAKERS.alexK,
    videoThumbnailUrl: "https://picsum.photos/seed/bookshop/640/360",
    videoDurationSec: 423,
    videoSourceLabel: "Instagram",
    intent: "commerce",
    title: "독립서점에서 찾은 희귀 에세이집",
    localName: MOCK_LOCALS.seongsuBookshop.name,
    distance: MOCK_LOCALS.seongsuBookshop.distance,
    creator: MOCK_CREATORS.seoulWalk,  },
  // Reservation intent
  {
    shareUuid: "drop-004",
    maker: MOCK_MAKERS.duke,
    videoThumbnailUrl: "https://picsum.photos/seed/rooftop/640/360",
    videoDurationSec: 245,
    videoSourceLabel: "YouTube",
    intent: "reservation",
    title: "강남 루프탑 카페 예약 필수! 뷰 맛집",
    localName: MOCK_LOCALS.gangnamCafe.name,
    distance: MOCK_LOCALS.gangnamCafe.distance,
    creator: MOCK_CREATORS.cafeTour,  },
  // Ticket intent - no avatar maker
  {
    shareUuid: "drop-005",
    maker: MOCK_MAKERS.noAvatar,
    videoThumbnailUrl: "https://picsum.photos/seed/concert/640/360",
    videoDurationSec: 178,
    videoSourceLabel: "YouTube",
    intent: "ticket",
    title: "이번 주말 재즈 공연 티켓 오픈!",
    localName: "블루노트 서울",
    distance: "2.5km",  },
  // Lead intent
  {
    shareUuid: "drop-006",
    maker: MOCK_MAKERS.minji,
    videoThumbnailUrl: "https://picsum.photos/seed/workshop/640/360",
    videoDurationSec: 534,
    videoSourceLabel: "Instagram",
    intent: "lead",
    title: "도자기 원데이클래스 신청받아요",
    localName: "성수 공방",
    distance: "800m",
    creator: MOCK_CREATORS.instaCafe,  },
  // Discussion intent
  {
    shareUuid: "drop-007",
    maker: MOCK_MAKERS.alexK,
    videoThumbnailUrl: "https://picsum.photos/seed/discussion/640/360",
    videoDurationSec: 892,
    videoSourceLabel: "YouTube",
    intent: "discussion",
    title: "요즘 MZ세대가 좋아하는 카페 스타일은?",
    localName: "연남동",
    distance: undefined,
    creator: MOCK_CREATORS.cafeTour,  },
  // Meme intent
  {
    shareUuid: "drop-008",
    maker: MOCK_MAKERS.duke,
    videoThumbnailUrl: "https://picsum.photos/seed/meme/640/360",
    videoDurationSec: 45,
    videoSourceLabel: "Instagram",
    intent: "meme",
    title: "카페 사장님의 하루 (공감주의)",
    localName: "전국 카페",
    distance: undefined,  },
  // Campaign intent
  {
    shareUuid: "drop-009",
    maker: MOCK_MAKERS.minji,
    videoThumbnailUrl: "https://picsum.photos/seed/campaign/640/360",
    videoDurationSec: 267,
    videoSourceLabel: "YouTube",
    intent: "campaign",
    title: "지역 소상공인 응원 캠페인 참여하기",
    localName: "서울 전역",
    distance: undefined,
    creator: MOCK_CREATORS.seoulWalk,  },
];

// ─────────────────────────────────────────────────────────────
// Feed by Intent
// ─────────────────────────────────────────────────────────────

export const getDropsByIntent = (intent: DropFeedCardProps["intent"]) =>
  MOCK_DROP_FEED_ITEMS.filter((item) => item.intent === intent);

export const getDropsByMaker = (makerName: string) =>
  MOCK_DROP_FEED_ITEMS.filter((item) => item.maker.name === makerName);

// ─────────────────────────────────────────────────────────────
// Video Info (for wizard)
// ─────────────────────────────────────────────────────────────

export const MOCK_VIDEO_INFO = {
  cafeTour: {
    title: "성수동 숨은 카페 발견! 분위기 진짜 좋아요",
    thumbnailUrl: "https://picsum.photos/seed/cafe1/640/360",
    duration: "3:05",
    channelName: "카페투어 브이로그",
    channelUrl: "https://youtube.com/@cafetour",
    source: "YouTube" as const,
  },
  makgeolli: {
    title: "전통 막걸리 맛집에서 10% 할인받는 법",
    thumbnailUrl: "https://picsum.photos/seed/makgeolli/640/360",
    duration: "5:12",
    channelName: "맛집 헌터",
    channelUrl: "https://youtube.com/@foodhunter",
    source: "YouTube" as const,
  },
  bookshop: {
    title: "독립서점에서 찾은 희귀 에세이집",
    thumbnailUrl: "https://picsum.photos/seed/bookshop/640/360",
    duration: "7:03",
    channelName: "서울 산책기",
    channelUrl: "https://instagram.com/seoulwalk",
    source: "Instagram" as const,
  },
};

// ─────────────────────────────────────────────────────────────
// Local Partners (for wizard Step 3)
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Drop view (/d) — variant mock (무로그인 열람 UI 검증)
// ─────────────────────────────────────────────────────────────

export type DropViewVariant = "info" | "coupon" | "reservation" | "purchase" | "lead";

/** 공개 Drop 예약 variant — 예약 헤더 설명 (info-drop-page) */
export const MOCK_RESERVATION_SECTION_GUIDE =
  "체크인·체크아웃 날짜를 고르면 숙박일수가 자동 계산되고 예약 가능 여부를 확인할 수 있어요.";

/** /d 예약 variant — 캘린더 초기 선택 mock (Phase 1) */
export const MOCK_RESERVATION_DEFAULTS = {
  checkIn: "2026-05-18",
  checkOut: "2026-05-24",
  adults: 2,
  children: 0,
  pets: false,
} as const;

/** 캠핑장 정보 출처 — Phase 2에서 naver / ai_estimate 분리 표시 */
export type ReservationCampgroundSource = "naver" | "ai_estimate";

export interface ReservationCampgroundFacilities {
  pool: string;
  poolType: string;
  valley: string;
  store: string;
  shower: string;
  toilet: string;
  sink: string;
  electricity: string;
  parking: string;
  pet: string;
  firewood: string;
}

export interface ReservationCampgroundFacilityItem {
  label: string;
  value: string;
}

export interface ReservationCampgroundFacilityGroup {
  title: string;
  items: ReservationCampgroundFacilityItem[];
}

export interface ReservationCampgroundInfo {
  name: string;
  region: string;
  concept: string;
  source: ReservationCampgroundSource;
  sourceLabel: string;
  sourceNote: string;
  /** 초기 compact — 핵심 시설 chip (최대 4개 권장) */
  highlightBadges: string[];
  /** 펼침 시 상세 — 물놀이/편의/위생/동반·불멍 */
  facilityGroups: ReservationCampgroundFacilityGroup[];
  facilities: ReservationCampgroundFacilities;
}

export const MOCK_PRICE_OFFERS = [
  {
    id: "offer-kr",
    sellerName: "쿠팡",
    platform: "국내",
    priceLabel: "₩89,000",
    shippingLabel: "무료",
    totalLabel: "₩89,000",
    productUrl: "https://example.com/coupang",
    isBest: true,
  },
  {
    id: "offer-global",
    sellerName: "Amazon US",
    platform: "해외",
    priceLabel: "$62.00",
    shippingLabel: "₩18,000",
    totalLabel: "약 ₩104,000",
    productUrl: "https://example.com/amazon",
  },
] as const;

/** 공개 Drop (/d) AI 요약 mock — create wizard MOCK_AI_BY_PURPOSE 와 동기화. */
export const MOCK_DROP_AI_BY_VARIANT: Record<
  DropViewVariant,
  { summary: string; keyPoints: string[] }
> = {
  info: {
    summary: "영상 속 카페 위치, 대표 메뉴, 방문 팁을 짧게 정리했어요.",
    keyPoints: ["도보 5분 거리", "브런치 메뉴 인기", "평일 오전 한산"],
  },
  coupon: {
    summary: "영상에 나온 매장에서 바로 쓸 수 있는 혜택이에요.",
    keyPoints: ["1인 1회 사용", "예약 후 방문 권장", "현장 제시"],
  },
  reservation: {
    summary: "체크인·체크아웃을 고르면 숙박일수가 자동 계산돼요.",
    keyPoints: ["날짜 범위 선택", "반려견 동반 가능", "네이버 예약 연결"],
  },
  purchase: {
    summary: "AI가 찾은 구매처와 예상 가격을 비교해 드려요.",
    keyPoints: ["국내·해외 셀러 비교", "배송비 포함 안내", "구매 전 가격 재확인"],
  },
  lead: {
    summary: "바로 예약하지 않는 분을 위한 문의 폼이에요.",
    keyPoints: ["전화·카톡 응답", "원하는 날짜 메모", "개인정보 최소 수집"],
  },
};

export const MOCK_DROP_VIEW_BY_VARIANT: Record<
  DropViewVariant,
  {
    title: string;
    description: string;
    makerMessage: string;
    productName?: string;
    brandGuess?: string;
    partnerName: string;
  }
> = {
  info: {
    title: "성수동 숨은 카페 — 분위기·메뉴 한눈에",
    description: "영상 속 카페 위치, 대표 메뉴, 방문 팁을 짧게 정리했어요.",
    makerMessage: "여기 진짜 좋더라. 가볼 만해!",
    partnerName: "포레스트 커피",
  },
  coupon: {
    title: "브런치 10% 할인 쿠폰",
    description: "이번 주말까지 사용 가능한 매장 쿠폰이에요.",
    makerMessage: "쿠폰 받아가!",
    partnerName: "포레스트 커피",
  },
  reservation: {
    title: "주말 빈자리 예약 — 노을 뷰 캠핑",
    description: MOCK_RESERVATION_SECTION_GUIDE,
    makerMessage: "같이 가자!",
    partnerName: "노을재 캠핑장",
  },
  purchase: {
    title: "영상 속 캠핑 의자 — 가격 비교",
    description: "AI가 찾은 구매처와 예상 가격을 비교해 드려요.",
    makerMessage: "이거 진짜 편해 보여",
    productName: "초경량 캠핑 체어 (영상 속 모델)",
    brandGuess: "Helinox",
    partnerName: "아웃도어 스토어",
  },
  lead: {
    title: "1:1 상담 신청",
    description: "바로 예약하지 않아도 괜찮아요. 연락만 남겨 주세요.",
    makerMessage: "궁금한 거 있으면 신청해봐",
    partnerName: "노을재 캠핑장",
  },
};

export const MOCK_LOCAL_PARTNERS = [
  {
    id: "local-001",
    name: "포레스트 커피",
    category: "카페",
    address: "서울 성동구 성수동2가 315-20",
    avatarUrl: "https://picsum.photos/seed/forest/128/128",
    rating: 4.8,
    reviewCount: 234,
  },
  {
    id: "local-002",
    name: "노을재 막걸리",
    category: "전통주",
    address: "서울 종로구 익선동 123-4",
    avatarUrl: "https://picsum.photos/seed/noeul/128/128",
    rating: 4.6,
    reviewCount: 189,
  },
  {
    id: "local-003",
    name: "성수동 작은 책방",
    category: "서점",
    address: "서울 성동구 연무장5가길 7",
    avatarUrl: "https://picsum.photos/seed/bookshop2/128/128",
    rating: 4.9,
    reviewCount: 156,
  },
  {
    id: "local-004",
    name: "강남 루프탑 카페",
    category: "카페 · 바",
    address: "서울 강남구 역삼동 678-9",
    avatarUrl: "https://picsum.photos/seed/rooftop2/128/128",
    rating: 4.5,
    reviewCount: 312,
  },
  {
    id: "local-005",
    name: "연남동 빈티지샵",
    category: "의류",
    address: "서울 마포구 연남동 456-7",
    avatarUrl: "https://picsum.photos/seed/vintage/128/128",
    rating: 4.7,
    reviewCount: 98,
  },
];
