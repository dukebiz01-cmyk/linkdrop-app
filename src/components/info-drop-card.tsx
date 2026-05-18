import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, MapPin, ExternalLink, Share2 } from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface InfoDropCardProps {
  videoThumbnailUrl: string;
  videoDurationSec: number;
  videoSourceLabel: "YouTube" | "Instagram";
  maker: { name: string; avatarUrl?: string };
  sentAt: Date | string;
  title: string;
  description: string;
  intent: "coupon" | "reservation" | "commerce" | "info" | "ticket" | "lead";
  local: {
    name: string;
    category: string;
    distanceKm?: number;
    statusLabel: string;
    hoursLabel?: string;
  };
  creator: { channelName: string; channelUrl: string };
  onPrimaryAction?: () => void;
  onWatchOriginal?: () => void;
  onShare?: () => void;
}

// ============================================================
// Helpers
// ============================================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return then.toLocaleDateString("ko-KR");
}

function getIntentLabel(intent: InfoDropCardProps["intent"]): string {
  const labels: Record<InfoDropCardProps["intent"], string> = {
    coupon: "쿠폰 드롭",
    reservation: "예약 드롭",
    commerce: "구매 드롭",
    info: "정보 드롭",
    ticket: "티켓 드롭",
    lead: "관심 드롭",
  };
  return labels[intent];
}

function getCtaLabel(intent: InfoDropCardProps["intent"]): string {
  const labels: Record<InfoDropCardProps["intent"], string> = {
    coupon: "쿠폰 받기",
    reservation: "예약하기",
    commerce: "구매하러 가기",
    info: "자세히 보기",
    ticket: "티켓 구하기",
    lead: "관심 등록",
  };
  return labels[intent];
}

// ============================================================
// Main Component
// ============================================================

export function InfoDropCard({
  videoThumbnailUrl,
  videoDurationSec,
  videoSourceLabel,
  maker,
  sentAt,
  title,
  description,
  intent,
  local,
  creator,
  onPrimaryAction,
  onWatchOriginal,
  onShare,
}: InfoDropCardProps) {
  return (
    <Card className="w-full max-w-[480px] overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-sm">
      {/* 1. Video Section */}
      <div className="relative aspect-video w-full bg-[#F5F5F5]">
        <img src={videoThumbnailUrl} alt={title} className="h-full w-full object-cover" />
        {/* Play Button Overlay */}
        <button
          className="absolute inset-0 flex items-center justify-center"
          onClick={() => {
            console.log("[InfoDropCard] Play video clicked");
            onWatchOriginal?.();
          }}
          aria-label="영상 재생"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </button>
        {/* Source Badge - Top Right */}
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {videoSourceLabel}
        </span>
        {/* Duration - Bottom Left */}
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {formatDuration(videoDurationSec)}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* 2. Maker Sender Line */}
        <div className="flex h-10 items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={maker.avatarUrl} alt={maker.name} />
            <AvatarFallback className="bg-[#E5E5E5] text-sm text-[#525252]">
              {maker.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 text-sm font-medium text-[#0A0A0A]">
            {maker.name}님이 보낸 드롭
          </span>
          <span className="text-xs text-[#A3A3A3]">{formatRelativeTime(sentAt)}</span>
        </div>

        {/* 3. Title + Description */}
        <div className="flex flex-col gap-1">
          <h2 className="line-clamp-2 text-lg font-semibold tracking-tight text-[#0A0A0A]">
            {title}
          </h2>
          <p className="line-clamp-3 text-sm leading-relaxed text-[#525252]">{description}</p>
        </div>

        {/* 4. Intent Badge */}
        <div>
          <Badge
            variant="secondary"
            className="rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF]"
          >
            {getIntentLabel(intent)}
          </Badge>
        </div>

        {/* 5. Local Info Card */}
        <div className="flex items-center justify-between rounded-md bg-[#FAFAFA] p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-medium text-[#0A0A0A]">{local.name}</span>
            <span className="text-sm text-[#525252]">
              {local.category}
              {local.distanceKm !== undefined && ` · ${local.distanceKm}km`}
            </span>
            <span className="text-sm">
              <span
                className={
                  local.statusLabel === "영업중" || local.statusLabel === "예약 가능"
                    ? "text-[#10B981]"
                    : "text-[#525252]"
                }
              >
                {local.statusLabel}
              </span>
              {local.hoursLabel && <span className="text-[#525252]"> · {local.hoursLabel}</span>}
            </span>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-md text-[#525252] hover:bg-[#F5F5F5]"
            onClick={() => console.log("[InfoDropCard] Map clicked")}
            aria-label="지도 보기"
          >
            <MapPin className="h-5 w-5" />
          </button>
        </div>

        {/* 6. Primary CTA Button */}
        <Button
          className="h-12 w-full bg-[#2563EB] text-base font-medium text-white hover:bg-[#1D4ED8]"
          onClick={() => {
            console.log("[InfoDropCard] Primary action:", intent);
            onPrimaryAction?.();
          }}
        >
          {getCtaLabel(intent)}
        </Button>

        {/* 7. Secondary Actions Row */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-[#525252] hover:text-[#0A0A0A]"
            onClick={() => {
              console.log("[InfoDropCard] Watch original clicked");
              onWatchOriginal?.();
            }}
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            원본 영상
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-[#525252] hover:text-[#0A0A0A]"
            onClick={() => {
              console.log("[InfoDropCard] Share clicked");
              onShare?.();
            }}
          >
            <Share2 className="mr-1.5 h-4 w-4" />
            친구에게 전달
          </Button>
        </div>

        {/* 8. Footer: Trust + Disclosure */}
        <div className="flex flex-col gap-1 border-t border-[#E5E5E5] pt-3">
          <a
            href={creator.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#A3A3A3] hover:text-[#2563EB]"
          >
            원본 크리에이터: {creator.channelName}
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-xs text-[#A3A3A3] hover:text-[#2563EB] cursor-pointer">
            광고/제휴 안내 적용 (FTC 권고 사항)
          </span>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Variant 2: Reservation Intent
// ============================================================

export function InfoDropCardReservation() {
  return (
    <InfoDropCard
      videoThumbnailUrl="https://picsum.photos/seed/camping/800/450"
      videoDurationSec={185}
      videoSourceLabel="YouTube"
      maker={{ name: "지영" }}
      sentAt={new Date(Date.now() - 1000 * 60 * 60 * 5)} // 5시간 전
      title="주말에 여기 어때? 노을이 정말 예쁜 캠핑장"
      description="서울에서 1시간 반 거리에 있는데 뷰가 진짜 미쳤어. 특히 해질 때 노을 보면서 고기 구우면 힐링 그 자체야."
      intent="reservation"
      local={{
        name: "노을재 캠핑장",
        category: "캠핑장",
        distanceKm: 80,
        statusLabel: "예약 가능",
      }}
      creator={{
        channelName: "캠핑하는 직장인",
        channelUrl: "https://youtube.com/@campingworker",
      }}
    />
  );
}

// ============================================================
// Variant 3: Loading/Skeleton State
// ============================================================

export function InfoDropCardSkeleton() {
  return (
    <Card className="w-full max-w-[480px] overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-sm">
      {/* Video Skeleton */}
      <Skeleton className="aspect-video w-full" />

      <div className="flex flex-col gap-4 p-4">
        {/* Maker Line Skeleton */}
        <div className="flex h-10 items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>

        {/* Title + Description Skeleton */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Intent Badge Skeleton */}
        <Skeleton className="h-5 w-20 rounded-md" />

        {/* Local Info Skeleton */}
        <div className="flex items-center justify-between rounded-md bg-[#FAFAFA] p-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>

        {/* CTA Skeleton */}
        <Skeleton className="h-12 w-full rounded-md" />

        {/* Secondary Actions Skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>

        {/* Footer Skeleton */}
        <div className="flex flex-col gap-1 border-t border-[#E5E5E5] pt-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Default Export: Variant 1 - Coupon Intent
// ============================================================

export default function InfoDropCardCoupon() {
  return (
    <InfoDropCard
      videoThumbnailUrl="https://picsum.photos/seed/cafe/800/450"
      videoDurationSec={154}
      videoSourceLabel="YouTube"
      maker={{ name: "Duke" }}
      sentAt={new Date(Date.now() - 1000 * 60 * 60 * 2)} // 2시간 전
      title="여기 분위기 진짜 좋더라, 작업하기 딱이야"
      description="창가 자리에서 노을 보면서 커피 마시면 시간 가는 줄 몰라. 디저트도 맛있고 와이파이 빵빵해서 노트북 작업하기 좋아."
      intent="coupon"
      local={{
        name: "노을재 카페",
        category: "카페",
        distanceKm: 0.8,
        statusLabel: "영업중",
        hoursLabel: "22:00까지",
      }}
      creator={{
        channelName: "카페탐방러",
        channelUrl: "https://youtube.com/@cafehunter",
      }}
    />
  );
}
