import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreVertical, MapPin, ExternalLink } from "lucide-react";

export interface DropFeedCardProps {
  shareUuid: string;
  maker: {
    name: string;
    avatarUrl?: string;
    droppedAgo: string;
  };
  videoThumbnailUrl: string;
  videoSourceLabel: "YouTube" | "Instagram";
  videoDurationSec: number;
  intent:
    | "coupon"
    | "reservation"
    | "commerce"
    | "info"
    | "ticket"
    | "lead"
    | "discussion"
    | "meme"
    | "campaign"
    | "custom";
  title: string;
  localName?: string;
  distance?: string;
  receivedByCount?: number;
  remainingCoupons?: number;
  creator?: {
    channelName: string;
    channelUrl: string;
  };
  onClick?: () => void;
  onCtaClick?: () => void;
}

function getIntentLabel(intent: DropFeedCardProps["intent"]): string {
  const labels: Record<DropFeedCardProps["intent"], string> = {
    coupon: "쿠폰",
    reservation: "예약",
    commerce: "구매",
    info: "정보",
    ticket: "티켓",
    lead: "신청",
    discussion: "대화",
    meme: "밈",
    campaign: "캠페인",
    custom: "커스텀",
  };
  return labels[intent];
}

function getIntentStyle(intent: DropFeedCardProps["intent"]): string {
  // info / discussion / meme: bg-[#F5F5F5] text-[#525252]
  // coupon / reservation / commerce / ticket: bg-[#EFF6FF] text-[#2563EB]
  // lead / campaign: bg-[#ECFDF5] text-[#10B981]
  // custom: bg-white border border-[#E5E5E5] text-[#525252]
  switch (intent) {
    case "info":
    case "discussion":
    case "meme":
      return "bg-[#F5F5F5] text-[#525252]";
    case "coupon":
    case "reservation":
    case "commerce":
    case "ticket":
      return "bg-[#EFF6FF] text-[#2563EB]";
    case "lead":
    case "campaign":
      return "bg-[#ECFDF5] text-[#10B981]";
    case "custom":
      return "bg-white border border-[#E5E5E5] text-[#525252]";
    default:
      return "bg-[#F5F5F5] text-[#525252]";
  }
}

function getCtaLabel(intent: DropFeedCardProps["intent"]): string {
  const labels: Record<DropFeedCardProps["intent"], string> = {
    coupon: "받기",
    reservation: "예약",
    commerce: "구매",
    info: "보기",
    ticket: "예매",
    lead: "신청",
    discussion: "보기",
    meme: "보기",
    campaign: "참여",
    custom: "보기",
  };
  return labels[intent];
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DropFeedCard({
  shareUuid,
  maker,
  videoThumbnailUrl,
  videoSourceLabel,
  videoDurationSec,
  intent,
  title,
  localName,
  distance,
  receivedByCount,
  remainingCoupons,
  creator,
  onClick,
  onCtaClick,
}: DropFeedCardProps) {
  const metaText =
    intent === "coupon" && remainingCoupons
      ? `쿠폰 ${remainingCoupons}장 남음`
      : receivedByCount
        ? `${receivedByCount}명이 받음`
        : null;

  return (
    <article
      className="cursor-pointer overflow-hidden rounded-xl border border-[#E5E5E5] bg-white transition-all duration-150 ease-out hover:border-[#D4D4D4] hover:shadow-md active:scale-[0.99]"
      onClick={() => {
        console.log("[DropFeedCard] Card clicked:", shareUuid);
        onClick?.();
      }}
    >
      {/* Maker row */}
      <div className="flex h-12 items-center justify-between border-b border-[#F5F5F5] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src={maker.avatarUrl} alt={maker.name} />
            <AvatarFallback className="bg-[#F5F5F5] text-xs text-[#525252]">
              {maker.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-[#0A0A0A]">{maker.name}</span>
            <span className="text-[#A3A3A3]">·</span>
            <span className="text-xs text-[#A3A3A3]">{maker.droppedAgo}</span>
          </div>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-[#A3A3A3] transition-colors hover:bg-[#F5F5F5]"
          onClick={(e) => {
            e.stopPropagation();
            console.log("[DropFeedCard] More menu clicked:", shareUuid);
          }}
          aria-label="더 보기"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      {/* Video thumbnail */}
      <div className="relative aspect-video w-full bg-[#F5F5F5]">
        <img src={videoThumbnailUrl} alt={title} className="h-full w-full object-cover" />
        {/* Source label */}
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
          {videoSourceLabel}
        </span>
        {/* Duration */}
        {videoDurationSec > 0 && (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs tabular-nums text-white backdrop-blur-sm">
            {formatDuration(videoDurationSec)}
          </span>
        )}
      </div>

      {/* Intent chip — display only, swallow click so card body navigate doesn't fire */}
      <div className="mx-4 mt-3" onClick={(e) => e.stopPropagation()}>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getIntentStyle(intent)}`}
        >
          {getIntentLabel(intent)}
        </span>
      </div>

      {/* Title */}
      <h3 className="mt-2 line-clamp-2 px-4 text-base font-medium leading-snug text-[#0A0A0A]">
        {title}
      </h3>

      {/* Local row */}
      {localName && (
        <div className="mt-3 flex items-center gap-2 px-4">
          <MapPin className="h-3.5 w-3.5 text-[#A3A3A3]" />
          <span className="text-sm text-[#525252]">{localName}</span>
          {distance && (
            <>
              <span className="text-[#A3A3A3]">·</span>
              <span className="text-sm text-[#A3A3A3]">{distance}</span>
            </>
          )}
        </div>
      )}

      {/* Mini creator attribution */}
      {creator && (
        <div className="mx-4 mt-3 flex items-center gap-1 border-t border-[#F5F5F5] py-3 text-xs text-[#A3A3A3]">
          <span>원본: {creator.channelName}</span>
          <ExternalLink className="h-3 w-3" />
        </div>
      )}

      {/* Action row (only if no creator attribution shown) */}
      {!creator && (
        <div className="flex items-center justify-between border-t border-[#F5F5F5] px-4 py-2.5 mt-3">
          {metaText ? <span className="text-xs text-[#A3A3A3]">{metaText}</span> : <span />}
          <button
            className="rounded-full bg-[#2563EB] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8]"
            onClick={(e) => {
              e.stopPropagation();
              console.log("[DropFeedCard] CTA clicked:", intent, shareUuid);
              onCtaClick?.();
            }}
          >
            {getCtaLabel(intent)}
          </button>
        </div>
      )}
    </article>
  );
}

// Skeleton variant
export function DropFeedCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
      {/* Maker row skeleton */}
      <div className="flex h-12 items-center gap-2.5 border-b border-[#F5F5F5] px-4 py-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[#E5E5E5]" />
        <div className="h-4 w-24 animate-pulse rounded bg-[#E5E5E5]" />
      </div>
      {/* Video skeleton */}
      <div className="aspect-video w-full animate-pulse bg-[#E5E5E5]" />
      {/* Intent chip skeleton */}
      <div className="mx-4 mt-3">
        <div className="h-5 w-12 animate-pulse rounded-full bg-[#E5E5E5]" />
      </div>
      {/* Title skeleton */}
      <div className="mt-2 px-4">
        <div className="h-5 w-3/4 animate-pulse rounded bg-[#E5E5E5]" />
      </div>
      {/* Local row skeleton */}
      <div className="mt-3 flex items-center gap-2 px-4">
        <div className="h-3.5 w-3.5 animate-pulse rounded bg-[#E5E5E5]" />
        <div className="h-4 w-32 animate-pulse rounded bg-[#E5E5E5]" />
      </div>
      {/* Attribution skeleton */}
      <div className="mx-4 mt-3 border-t border-[#F5F5F5] py-3">
        <div className="h-3 w-28 animate-pulse rounded bg-[#E5E5E5]" />
      </div>
    </div>
  );
}
