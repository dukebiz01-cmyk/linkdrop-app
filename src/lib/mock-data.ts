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
    creator: MOCK_CREATORS.cafeTour,
    metaText: "조회 1.2만",
  },
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
    creator: MOCK_CREATORS.foodHunter,
    metaText: "D-7 마감",
  },
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
    creator: MOCK_CREATORS.seoulWalk,
    metaText: "품절 임박",
  },
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
    creator: MOCK_CREATORS.cafeTour,
    metaText: "예약 가능",
  },
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
    distance: "2.5km",
    metaText: "잔여 12석",
  },
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
    creator: MOCK_CREATORS.instaCafe,
    metaText: "선착순 10명",
  },
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
    creator: MOCK_CREATORS.cafeTour,
    metaText: "댓글 238",
  },
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
    distance: undefined,
    metaText: "좋아요 5.2만",
  },
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
    creator: MOCK_CREATORS.seoulWalk,
    metaText: "참여 1,234명",
  },
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
