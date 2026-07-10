"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Plus,
  Search,
  Share2,
  Edit3,
  Copy,
  ChevronRight,
  ChevronDown,
  Ticket,
  Calendar,
  ShoppingBag,
  MessageCircle,
  Info,
  FileText,
} from "lucide-react";

export type DropIntent = "info" | "coupon" | "reservation" | "purchase" | "consultation";

export interface DropItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  intent: DropIntent;
  createdAt: string;
  stats: {
    views: number;
    uniqueVisitors?: number;
    coupons?: number;
    reservations?: number;
    purchases?: number;
    consultations?: number;
    shares: number;
  };
}

export interface MyDropsPageProps {
  drops: DropItem[];
  onBack?: () => void;
  onCreateNew?: () => void;
  onViewResults?: (dropId: string) => void;
  onShare?: (dropId: string) => void;
  onEdit?: (dropId: string) => void;
  onDuplicate?: (dropId: string) => void;
  onSearch?: () => void;
}

const INTENT_CONFIG: Record<DropIntent, { label: string; bg: string; text: string; icon: typeof Info }> = {
  info: { label: "정보", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: Info },
  coupon: { label: "쿠폰", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: Ticket },
  reservation: { label: "예약", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: Calendar },
  purchase: { label: "구매", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: ShoppingBag },
  consultation: { label: "상담", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: MessageCircle },
};

const FILTER_OPTIONS: { value: DropIntent | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "info", label: "정보" },
  { value: "coupon", label: "쿠폰" },
  { value: "reservation", label: "예약" },
  { value: "purchase", label: "구매" },
  { value: "consultation", label: "상담" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "최신순" },
  { value: "views", label: "조회순" },
  { value: "results", label: "결과순" },
];

export function MyDropsPage({
  drops,
  onBack,
  onCreateNew,
  onViewResults,
  onShare,
  onEdit,
  onDuplicate,
  onSearch,
}: MyDropsPageProps) {
  const [activeFilter, setActiveFilter] = useState<DropIntent | "all">("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const filteredDrops = drops.filter((drop) => {
    if (activeFilter === "all") return true;
    return drop.intent === activeFilter;
  });

  const sortedDrops = [...filteredDrops].sort((a, b) => {
    if (sortBy === "views") return b.stats.views - a.stats.views;
    if (sortBy === "results") {
      const aResults = (a.stats.coupons || 0) + (a.stats.reservations || 0) + (a.stats.purchases || 0) + (a.stats.consultations || 0);
      const bResults = (b.stats.coupons || 0) + (b.stats.reservations || 0) + (b.stats.purchases || 0) + (b.stats.consultations || 0);
      return bResults - aResults;
    }
    return 0;
  });

  const getResultLabel = (drop: DropItem) => {
    switch (drop.intent) {
      case "coupon":
        return { label: "쿠폰", value: drop.stats.coupons || 0 };
      case "reservation":
        return { label: "예약", value: drop.stats.reservations || 0 };
      case "purchase":
        return { label: "구매", value: drop.stats.purchases || 0 };
      case "consultation":
        return { label: "상담", value: drop.stats.consultations || 0 };
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E5E5E5] bg-white px-5">
        <button
          onClick={() => onBack?.()}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#525252] transition-all hover:bg-[#F5F5F5] active:scale-95"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <h2 className="text-[15px] font-semibold text-[#0A0A0A]">내 Drop</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSearch?.()}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#525252] transition-all hover:bg-[#F5F5F5] active:scale-95"
            aria-label="검색"
          >
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => onCreateNew?.()}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0A0A0A] transition-all hover:bg-[#F5F5F5] active:scale-95"
            aria-label="새 Drop 만들기"
          >
            <Plus className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5">
        {/* Filter Chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95 ${
                activeFilter === option.value
                  ? "bg-[#0A0A0A] text-white shadow-[0_2px_8px_rgba(15,23,42,0.15)]"
                  : "bg-white text-[#525252] border border-[#E5E5E5] hover:bg-[#FAFAFA]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="mt-1 flex items-center justify-between py-2">
          <span className="text-[13px] text-[#525252]">
            총 <span className="font-semibold text-[#0A0A0A]">{sortedDrops.length}</span>개
          </span>
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 text-[13px] text-[#525252] transition-colors hover:text-[#525252]"
            >
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              <ChevronDown className={`h-4 w-4 transition-transform ${showSortDropdown ? "rotate-180" : ""}`} />
            </button>
            {showSortDropdown && (
              <div className="absolute right-0 top-full z-10 mt-2 w-28 overflow-hidden rounded-xl border border-[#E5E5E5] bg-white py-1 shadow-[0_4px_16px_rgba(15,23,42,0.12)]">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[#FAFAFA] ${
                      sortBy === option.value ? "font-semibold text-[#0A0A0A]" : "text-[#525252]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drop Cards */}
        {sortedDrops.length > 0 ? (
          <div className="mt-2 space-y-3">
            {sortedDrops.map((drop) => {
              const intentConfig = INTENT_CONFIG[drop.intent];
              const resultLabel = getResultLabel(drop);

              return (
                <div
                  key={drop.id}
                  className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all hover:border-[#D4D4D4] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]"
                >
                  {/* Top: Thumbnail + Info */}
                  <div className="flex gap-3">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-[#F5F5F5]">
                      <img
                        src={drop.thumbnailUrl}
                        alt={drop.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-center min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${intentConfig.bg} ${intentConfig.text}`}
                        >
                          <intentConfig.icon className="h-3 w-3" />
                          {intentConfig.label}
                        </span>
                      </div>
                      <h3 className="mt-1.5 line-clamp-2 text-[14px] font-semibold leading-tight text-[#0A0A0A]">
                        {drop.title}
                      </h3>
                      <p className="mt-1 text-[11px] text-[#A3A3A3]">{drop.createdAt}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex items-center gap-4 text-[12px]">
                    <span className="text-[#525252]">
                      조회 <span className="font-semibold tabular-nums text-[#0A0A0A]">{drop.stats.views.toLocaleString()}</span>
                    </span>
                    {resultLabel && (
                      <span className="text-[#525252]">
                        {resultLabel.label} <span className="font-semibold tabular-nums text-[#0A0A0A]">{resultLabel.value.toLocaleString()}</span>
                      </span>
                    )}
                    <span className="text-[#525252]">
                      공유 <span className="font-semibold tabular-nums text-[#0A0A0A]">{drop.stats.shares.toLocaleString()}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2 border-t border-[#F5F5F5] pt-3">
                    <button
                      onClick={() => onViewResults?.(drop.id)}
                      className="flex h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-[#0A0A0A] text-[13px] font-semibold text-white transition-all hover:bg-[#171717] active:scale-[0.98]"
                    >
                      결과 보기
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onShare?.(drop.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E5] text-[#525252] transition-all hover:bg-[#FAFAFA] active:scale-95"
                      aria-label="공유"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit?.(drop.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E5] text-[#525252] transition-all hover:bg-[#FAFAFA] active:scale-95"
                      aria-label="수정"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDuplicate?.(drop.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E5] text-[#525252] transition-all hover:bg-[#FAFAFA] active:scale-95"
                      aria-label="복사"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeFilter !== "all" ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F5F5]">
              <FileText className="h-7 w-7 text-[#525252]" />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-[#0A0A0A]">
              조건에 맞는 Drop이 없어요
            </p>
            <p className="mt-1 text-[13px] text-[#525252]">
              다른 필터를 선택해보세요
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#F5F5F5]">
              <Plus className="h-9 w-9 text-[#525252]" />
            </div>
            <h3 className="mt-5 text-[17px] font-bold text-[#0A0A0A]">
              아직 만든 Drop이 없어요
            </h3>
            <p className="mt-1 text-[13px] text-[#525252]">
              첫 Drop을 만들어볼까요?
            </p>
            <button
              onClick={() => onCreateNew?.()}
              className="mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-5 text-[14px] font-semibold text-white shadow-[0_4px_12px_rgba(15,23,42,0.2)] transition-all hover:bg-[#171717] active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" />
              Drop 만들기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export function MyDropsPageDemo() {
  const mockDrops: DropItem[] = [
    {
      id: "1",
      title: "노을이 아름다운 캠핑장 추천 - 가평 노을재",
      thumbnailUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&h=200&fit=crop",
      intent: "coupon",
      createdAt: "2024년 5월 18일",
      stats: { views: 184, coupons: 37, shares: 16 },
    },
    {
      id: "2",
      title: "성수동 브런치 카페 추천 TOP 5",
      thumbnailUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop",
      intent: "info",
      createdAt: "2024년 5월 15일",
      stats: { views: 342, shares: 28 },
    },
    {
      id: "3",
      title: "스노우피크 텐트 가격 비교",
      thumbnailUrl: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=200&h=200&fit=crop",
      intent: "purchase",
      createdAt: "2024년 5월 12일",
      stats: { views: 89, purchases: 5, shares: 8 },
    },
    {
      id: "4",
      title: "봄 시즌 네일 아트 추천",
      thumbnailUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop",
      intent: "consultation",
      createdAt: "2024년 5월 10일",
      stats: { views: 156, consultations: 12, shares: 14 },
    },
    {
      id: "5",
      title: "주말 캠핑장 예약 - 별빛 캠핑파크",
      thumbnailUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&h=200&fit=crop",
      intent: "reservation",
      createdAt: "2024년 5월 8일",
      stats: { views: 67, reservations: 8, shares: 5 },
    },
  ];

  return <MyDropsPage drops={mockDrops} />;
}

export function MyDropsPageEmptyDemo() {
  return <MyDropsPage drops={[]} />;
}
