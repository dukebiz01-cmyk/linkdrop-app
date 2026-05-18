import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  MapPin,
  ExternalLink,
  Share2,
  ChevronLeft,
  MoreVertical,
  Star,
  Clock,
  MessageCircle,
  Gift,
  Calendar,
  ShoppingBag,
  Bookmark,
  Send,
  Ticket,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface InfoDropPageProps {
  videoThumbnailUrl: string;
  videoDurationSec: number;
  videoSourceLabel: "YouTube" | "Instagram";
  maker: { name: string; avatarUrl?: string; droppedAgo: string };
  makerMessage?: string;
  title: string;
  description: string;
  intent: "coupon" | "reservation" | "commerce" | "info" | "ticket" | "lead";
  local: {
    name: string;
    category: string;
    thumbnailUrl?: string;
    distance: string;
    address: string;
    statusLabel: string;
    hoursLabel?: string;
    rating?: number;
    reviewCount?: number;
    responseNote?: string;
    priceRange?: string;
  };
  creator: { channelName: string; channelUrl: string; avatarUrl?: string };
  onPrimaryAction?: () => void;
  onWatchOriginal?: () => void;
  onShare?: () => void;
  onBack?: () => void;
  onSave?: () => void;
  onForward?: () => void;
}

// ============================================================
// Helpers
// ============================================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getIntentLabel(intent: InfoDropPageProps["intent"]): string {
  const labels: Record<InfoDropPageProps["intent"], string> = {
    coupon: "쿠폰",
    reservation: "예약",
    commerce: "구매",
    info: "정보",
    ticket: "티켓",
    lead: "관심등록",
  };
  return labels[intent];
}

function getCtaLabel(intent: InfoDropPageProps["intent"]): string {
  const labels: Record<InfoDropPageProps["intent"], string> = {
    coupon: "쿠폰 받기",
    reservation: "예약하기",
    commerce: "구매하기",
    info: "자세히 보기",
    ticket: "티켓 보기",
    lead: "관심 등록",
  };
  return labels[intent];
}

function getCtaIcon(intent: InfoDropPageProps["intent"]) {
  const icons: Record<InfoDropPageProps["intent"], React.ReactNode> = {
    coupon: <Gift className="h-5 w-5" />,
    reservation: <Calendar className="h-5 w-5" />,
    commerce: <ShoppingBag className="h-5 w-5" />,
    info: <ExternalLink className="h-5 w-5" />,
    ticket: <Ticket className="h-5 w-5" />,
    lead: <Send className="h-5 w-5" />,
  };
  return icons[intent];
}

// ============================================================
// Main Page Component
// ============================================================

export function InfoDropPage({
  videoThumbnailUrl,
  videoDurationSec,
  videoSourceLabel,
  maker,
  makerMessage,
  title,
  description,
  intent,
  local,
  creator,
  onPrimaryAction,
  onWatchOriginal,
  onShare,
  onBack,
  onSave,
  onForward,
}: InfoDropPageProps) {
  const isOpen = local.statusLabel === "영업중" || local.statusLabel === "예약 가능";

  return (
    <div className="relative min-h-screen bg-white pb-32">
      {/* A. Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
        <button
          onClick={() => {
            console.log("[InfoDropPage] Back clicked");
            onBack?.();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#F5F5F5]"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-6 w-6 text-[#0A0A0A]" />
        </button>
        <span className="text-sm font-medium tracking-tight text-[#0A0A0A]">LinkDrop</span>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#F5F5F5]"
          aria-label="더보기"
        >
          <MoreVertical className="h-5 w-5 text-[#525252]" />
        </button>
      </header>

      {/* Maker Info Row */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Avatar className="h-8 w-8">
          <AvatarImage src={maker.avatarUrl} alt={maker.name} />
          <AvatarFallback className="bg-[#E5E5E5] text-xs font-medium text-[#525252]">
            {maker.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-[#0A0A0A]">{maker.name}</span>
          <span className="text-xs text-[#A3A3A3]">{maker.droppedAgo} 드롭</span>
        </div>
      </div>

      {/* B. Video Hero */}
      <div className="relative aspect-video w-full bg-[#0A0A0A]">
        <img src={videoThumbnailUrl} alt={title} className="h-full w-full object-cover" />
        {/* YouTube label - top right */}
        <span className="absolute right-3 top-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
          {videoSourceLabel}
        </span>
        {/* Duration - bottom left */}
        <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium tabular-nums text-white">
          {formatDuration(videoDurationSec)}
        </span>
        {/* Play button - center */}
        <button
          className="absolute inset-0 flex items-center justify-center"
          onClick={() => {
            console.log("[InfoDropPage] Play video clicked");
            onWatchOriginal?.();
          }}
          aria-label="영상 재생"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl">
            <Play className="ml-0.5 h-6 w-6 fill-[#0A0A0A] text-[#0A0A0A]" />
          </div>
        </button>
      </div>

      {/* C. Title Block */}
      <div className="px-5 py-6">
        {/* Intent badge */}
        <span className="mb-3 inline-block rounded-md bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#2563EB]">
          {getIntentLabel(intent)}
        </span>
        {/* Title */}
        <h1 className="text-2xl font-bold leading-snug tracking-tight text-[#0A0A0A]">{title}</h1>
        {/* Maker message */}
        {makerMessage && (
          <p className="mt-3 border-l-2 border-[#E5E5E5] pl-3 text-sm italic leading-relaxed text-[#525252]">
            {makerMessage}
          </p>
        )}
        {/* Description */}
        <p className="mt-4 text-base leading-relaxed text-[#525252]">{description}</p>
      </div>

      {/* D. Local Info Card */}
      <div className="mx-5 mt-6 rounded-xl bg-[#FAFAFA] p-5">
        {/* Top row */}
        <div className="flex gap-4">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[#E5E5E5]">
            <img
              src={local.thumbnailUrl || videoThumbnailUrl}
              alt={local.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <h3 className="text-lg font-semibold text-[#0A0A0A]">{local.name}</h3>
            <span className="text-sm text-[#525252]">
              {local.category} · {local.distance}
            </span>
            {local.rating && (
              <div className="mt-1 flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span className="text-sm font-medium tabular-nums text-[#0A0A0A]">
                  {local.rating}
                </span>
                {local.reviewCount && (
                  <span className="text-sm text-[#525252]">· 리뷰 {local.reviewCount}개</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-[#E5E5E5]" />

        {/* 2x2 Grid */}
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <div className="flex items-center gap-2 text-[#525252]">
            <MapPin className="h-3.5 w-3.5" />
            <span>{local.address}</span>
          </div>
          <div className="flex items-center gap-2 text-[#525252]">
            <Clock className="h-3.5 w-3.5" />
            <span>
              <span className={isOpen ? "text-[#10B981]" : "text-[#525252]"}>
                {local.statusLabel}
              </span>
              {local.hoursLabel && ` · ${local.hoursLabel}`}
            </span>
          </div>
          {local.responseNote && (
            <div className="flex items-center gap-2 text-[#525252]">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{local.responseNote}</span>
            </div>
          )}
          {local.priceRange && <div className="text-[#525252]">{local.priceRange}</div>}
        </div>
      </div>

      {/* E. Creator Attribution */}
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-[#F5F5F5] p-4">
        <Avatar className="h-8 w-8">
          <AvatarImage src={creator.avatarUrl} alt={creator.channelName} />
          <AvatarFallback className="bg-[#F5F5F5] text-xs text-[#525252]">
            {creator.channelName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col">
          <span className="text-xs uppercase tracking-wider text-[#A3A3A3]">원본 영상</span>
          <span className="text-sm font-medium text-[#0A0A0A]">{creator.channelName}</span>
        </div>
        <a
          href={creator.channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-[#0A0A0A] hover:underline"
        >
          YouTube에서 보기
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* F. Disclosure */}
      <p className="mx-5 mt-6 text-xs text-[#A3A3A3]">
        본 콘텐츠는 LinkDrop 광고/제휴 안내가 적용됩니다. (FTC 권고 사항)
      </p>

      {/* G. Floating Action Bar */}
      <div className="fixed bottom-5 left-0 right-0 px-5">
        <div className="mx-auto flex max-w-md items-center gap-3">
          {/* Tertiary actions - minimal */}
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                console.log("[InfoDropPage] Save clicked");
                onSave?.();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#525252] hover:opacity-90"
              aria-label="저장"
            >
              <Bookmark className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                console.log("[InfoDropPage] Share clicked");
                onShare?.();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#525252] hover:opacity-90"
              aria-label="외부 공유"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>

          {/* CTA - Secondary */}
          <button
            onClick={() => {
              console.log("[InfoDropPage] Primary action:", intent);
              onPrimaryAction?.();
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#EFF6FF] px-5 text-[#2563EB] hover:opacity-90"
          >
            {getCtaIcon(intent)}
            <span className="text-sm font-semibold">{getCtaLabel(intent)}</span>
          </button>

          {/* Forward - PRIMARY viral action */}
          <button
            onClick={() => {
              console.log("[InfoDropPage] Forward clicked");
              onForward?.();
            }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#2563EB] text-white hover:opacity-90"
          >
            <Send className="h-[18px] w-[18px]" />
            <span className="text-sm font-semibold">친구에게 전달</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Skeleton Variant
// ============================================================

export function InfoDropPageSkeleton() {
  return (
    <div className="relative min-h-screen bg-white pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </header>

      {/* Maker row */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Video */}
      <Skeleton className="aspect-video w-full" />

      {/* Title block */}
      <div className="px-5 py-6">
        <Skeleton className="mb-3 h-6 w-14 rounded-md" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="mt-2 h-8 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
      </div>

      {/* Local info card */}
      <div className="mx-5 mt-6 rounded-xl bg-[#FAFAFA] p-5">
        <div className="flex gap-4">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <div className="flex flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="my-4 border-t border-[#E5E5E5]" />
        <div className="grid grid-cols-2 gap-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Creator */}
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-[#F5F5F5] p-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Disclosure */}
      <Skeleton className="mx-5 mt-6 h-4 w-64" />

      {/* Floating bar */}
      <div className="fixed bottom-5 left-0 right-0 px-5">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex gap-1.5">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
          <Skeleton className="h-11 w-28 rounded-md" />
          <Skeleton className="h-11 flex-1 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Variant 1: Coupon (Cafe)
// ============================================================

export default function InfoDropPageCoupon() {
  return (
    <InfoDropPage
      videoThumbnailUrl="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=450&fit=crop"
      videoDurationSec={154}
      videoSourceLabel="YouTube"
      maker={{ name: "Duke", droppedAgo: "2시간 전" }}
      makerMessage="여기 진짜 분위기 좋더라. 너 좋아할 것 같아서 보내"
      title="서울숲 근처 숨은 브런치 카페 발견"
      description="서울숲역 3번 출구에서 도보 5분, 창가 자리에서 숲 뷰가 보이는 조용한 카페입니다. 시그니처 라떼가 맛있어요."
      intent="coupon"
      local={{
        name: "포레스트 커피",
        category: "카페 · 브런치",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=200&h=200&fit=crop",
        distance: "0.8km",
        address: "서울 성동구",
        statusLabel: "영업중",
        hoursLabel: "22:00까지",
        rating: 4.8,
        reviewCount: 127,
        responseNote: "카톡 응답 빠름",
        priceRange: "평균 8,000원",
      }}
      creator={{
        channelName: "카페투어 브이로그",
        channelUrl: "https://youtube.com/@cafetour",
      }}
    />
  );
}

// ============================================================
// Variant 2: Reservation (Camping)
// ============================================================

export function InfoDropPageReservation() {
  return (
    <InfoDropPage
      videoThumbnailUrl="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=450&fit=crop"
      videoDurationSec={312}
      videoSourceLabel="YouTube"
      maker={{ name: "지영", droppedAgo: "1시간 전" }}
      makerMessage="주말에 시간 되면 같이 가자! 진짜 힐링됨"
      title="주말에 여기 어때? 노을이 정말 예쁜 캠핑장"
      description="서울에서 1시간 반 거리에 있는데 뷰가 진짜 미쳤어. 특히 해질 때 노을 보면서 고기 구우면 힐링 그 자체야."
      intent="reservation"
      local={{
        name: "노을재 캠핑장",
        category: "캠핑 · 글램핑",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=200&h=200&fit=crop",
        distance: "가평",
        address: "경기 가평군",
        statusLabel: "예약 가능",
        hoursLabel: "체크인 15:00",
        rating: 4.9,
        reviewCount: 89,
        responseNote: "당일 예약 가능",
        priceRange: "1박 120,000원",
      }}
      creator={{
        channelName: "캠핑하는 직장인",
        channelUrl: "https://youtube.com/@campingworker",
      }}
    />
  );
}
