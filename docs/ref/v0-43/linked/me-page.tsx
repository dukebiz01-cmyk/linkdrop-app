"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronRight,
  Plus,
  Search,
  Settings,
  Share2,
  Edit3,
  Copy,
  Bell,
  Store,
  Film,
  Ticket,
  Calendar,
  ShoppingBag,
  MessageCircle,
  Info,
  FileText,
  Eye,
  Users,
  TrendingUp,
  Sparkles,
  Inbox,
} from "lucide-react";

// 스튜디오와 동일한 색 규율: 모노크롬 잉크 + "전환력" 지표에만 블루 포인트
const POINT = "#1D4ED8";
// 크리스프 단일 라인 (테두리 번짐 방지) — 스튜디오와 동일
const CARD_LINE = "[box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]";

export type DropIntent = "info" | "coupon" | "reservation" | "purchase" | "consultation";

export interface DropItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  intent: DropIntent;
  createdAt: string;
  stats: {
    views: number;
    coupons?: number;
    reservations?: number;
    purchases?: number;
    consultations?: number;
    shares: number;
  };
}

export interface UserProfile {
  name: string;
  avatarUrl?: string;
  bio?: string;
  stats: {
    totalDrops: number;
    totalViews: number;
    totalConversions: number;
  };
  membership?: {
    tier: "Free" | "Starter" | "Pro" | "Business";
    nextPaymentDate?: string;
  };
}

export interface MePageProps {
  user: UserProfile;
  drops: DropItem[];
  onCreateNew?: () => void;
  onViewResults?: (dropId: string) => void;
  onShare?: (dropId: string) => void;
  onEdit?: (dropId: string) => void;
  onDuplicate?: (dropId: string) => void;
  onSearch?: () => void;
  onSettings?: () => void;
  onNotifications?: () => void;
  onNavigate?: (path: string) => void;
}

const INTENT_CONFIG: Record<DropIntent, { label: string; bg: string; text: string; icon: typeof Info }> = {
  info: { label: "정보", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: Info },
  coupon: { label: "쿠폰", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: Ticket },
  reservation: { label: "예약", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: Calendar },
  purchase: { label: "구매", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: ShoppingBag },
  consultation: { label: "상담", bg: "bg-[#F5F5F5]", text: "text-[#525252]", icon: MessageCircle },
};

const TIER_CONFIG = {
  Free: { label: "Free", bg: "bg-[#F5F5F5]", text: "text-[#525252]" },
  Starter: { label: "Starter", bg: "bg-[#F5F5F5]", text: "text-[#525252]" },
  Pro: { label: "Pro", bg: "bg-[#0A0A0A]", text: "text-white" },
  Business: { label: "Business", bg: "bg-[#0A0A0A]", text: "text-white" },
};

export function MePage({
  user,
  drops,
  onCreateNew,
  onViewResults,
  onShare,
  onEdit,
  onDuplicate,
  onSearch,
  onSettings,
  onNotifications,
  onNavigate,
}: MePageProps) {
  const [activeTab, setActiveTab] = useState<"drops" | "stats">("drops");
  const tierConfig = user.membership ? TIER_CONFIG[user.membership.tier] : TIER_CONFIG.Free;

  const getResultLabel = (drop: DropItem) => {
    switch (drop.intent) {
      case "coupon": return { label: "쿠폰", value: drop.stats.coupons || 0 };
      case "reservation": return { label: "예약", value: drop.stats.reservations || 0 };
      case "purchase": return { label: "구매", value: drop.stats.purchases || 0 };
      case "consultation": return { label: "상담", value: drop.stats.consultations || 0 };
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#EDEDED] bg-white/90 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-5">
          <h1 className="text-[17px] font-bold text-[#0A0A0A]">나</h1>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onNotifications}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#525252] transition-all hover:bg-[#F5F5F5] active:scale-95"
              aria-label="알림"
            >
              <Bell className="h-[22px] w-[22px]" strokeWidth={1.5} />
            </button>
            <button
              onClick={onSettings}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#525252] transition-all hover:bg-[#F5F5F5] active:scale-95"
              aria-label="설정"
            >
              <Settings className="h-[22px] w-[22px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md">
        {/* Profile Hero Section */}
        <section className="bg-white px-5 pb-6 pt-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-[72px] w-[72px] ring-[3px] ring-white shadow-[0_4px_16px_rgba(15,23,42,0.12)]">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="bg-[#0A0A0A] text-[24px] font-bold text-white">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {user.membership?.tier === "Pro" && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#0A0A0A] ring-2 ring-white">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[20px] font-bold text-[#0A0A0A]">{user.name}</h2>
              </div>
              {user.bio && (
                <p className="mt-1 text-[14px] text-[#525252]">{user.bio}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tierConfig.bg} ${tierConfig.text}`}>
                  {user.membership?.tier === "Pro" && <Sparkles className="h-3 w-3" />}
                  {tierConfig.label}
                </span>
                <button
                  onClick={() => onNavigate?.("/me/edit")}
                  className="rounded-full px-3 py-1 text-[11px] font-medium text-[#525252] transition-all [box-shadow:0_0_0_1px_#E5E5E5] hover:bg-[#F5F5F5]"
                >
                  프로필 수정
                </button>
              </div>
            </div>
          </div>

          {/* Stats Hero - 3 Metrics */}
          <div className={`mt-6 grid grid-cols-3 divide-x divide-[#EDEDED] rounded-2xl bg-white py-4 ${CARD_LINE}`}>
            <div className="flex flex-col items-center">
              <span className="text-[22px] font-bold tabular-nums text-[#0A0A0A]">{user.stats.totalDrops}</span>
              <span className="mt-0.5 text-[11px] text-[#A3A3A3]">Drop</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[22px] font-bold tabular-nums text-[#0A0A0A]">{user.stats.totalViews.toLocaleString()}</span>
              <span className="mt-0.5 text-[11px] text-[#A3A3A3]">조회</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[22px] font-bold tabular-nums" style={{ color: POINT }}>
                {user.stats.totalConversions.toLocaleString()}
              </span>
              <span className="mt-0.5 text-[11px] text-[#A3A3A3]">전환</span>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="border-b border-[#F5F5F5] px-5 pb-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onCreateNew}
              className="group flex items-center gap-3 rounded-2xl bg-[#0A0A0A] p-4 text-white transition-all hover:bg-[#171717] active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-bold">새 Drop</p>
                <p className="text-[11px] text-white/50">만들기</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.("/me/store")}
              className={`group flex items-center gap-3 rounded-2xl bg-white p-4 transition-all hover:bg-[#FAFAFA] active:scale-[0.98] ${CARD_LINE}`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F5F5] transition-colors group-hover:bg-[#E5E5E5]">
                <Store className="h-5 w-5 text-[#525252]" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-bold text-[#0A0A0A]">내 매장</p>
                <p className="text-[11px] text-[#A3A3A3]">관리하기</p>
              </div>
            </button>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="sticky top-14 z-10 border-b border-[#EDEDED] bg-white px-5">
          <div className="flex">
            <button
              onClick={() => setActiveTab("drops")}
              className={`relative flex-1 py-3.5 text-[14px] font-semibold transition-colors ${
                activeTab === "drops" ? "text-[#0A0A0A]" : "text-[#A3A3A3]"
              }`}
            >
              내 Drop
              {activeTab === "drops" && (
                <span className="absolute bottom-0 left-1/2 h-[2px] w-12 -translate-x-1/2 rounded-full bg-[#0A0A0A]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`relative flex-1 py-3.5 text-[14px] font-semibold transition-colors ${
                activeTab === "stats" ? "text-[#0A0A0A]" : "text-[#A3A3A3]"
              }`}
            >
              통계
              {activeTab === "stats" && (
                <span className="absolute bottom-0 left-1/2 h-[2px] w-12 -translate-x-1/2 rounded-full bg-[#0A0A0A]" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "drops" ? (
          <div className="bg-[#FAFAFA] px-5 py-4">
            {/* Search & Filter */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[13px] text-[#525252]">
                총 <span className="font-bold text-[#0A0A0A]">{drops.length}</span>개
              </span>
              <button
                onClick={onSearch}
                className="flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-medium text-[#525252] transition-all [box-shadow:0_0_0_1px_#E5E5E5] hover:bg-[#FAFAFA]"
              >
                <Search className="h-3.5 w-3.5" />
                검색
              </button>
            </div>

            {/* Drop List */}
            {drops.length > 0 ? (
              <div className="space-y-3">
                {drops.map((drop) => {
                  const intentConfig = INTENT_CONFIG[drop.intent];
                  const resultLabel = getResultLabel(drop);

                  return (
                    <button
                      key={drop.id}
                      onClick={() => onViewResults?.(drop.id)}
                      className={`group flex w-full gap-3 rounded-2xl bg-white p-3.5 text-left transition-all hover:[box-shadow:0_0_0_1px_#D4D4D4,0_6px_20px_rgba(15,23,42,0.08)] active:scale-[0.99] ${CARD_LINE}`}
                    >
                      <div className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl bg-[#F5F5F5]">
                        <img
                          src={drop.thumbnailUrl}
                          alt={drop.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className={`absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded-md ${intentConfig.bg} px-1.5 py-0.5`}>
                          <intentConfig.icon className={`h-2.5 w-2.5 ${intentConfig.text}`} />
                          <span className={`text-[9px] font-bold ${intentConfig.text}`}>{intentConfig.label}</span>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col justify-center min-w-0">
                        <span className="text-[10px] text-[#A3A3A3]">{drop.createdAt}</span>
                        <h3 className="mt-0.5 line-clamp-2 text-[14px] font-semibold leading-snug text-[#0A0A0A]">
                          {drop.title}
                        </h3>
                        <div className="mt-2 flex items-center gap-4 text-[12px]">
                          <span className="flex items-center gap-1 text-[#525252]">
                            <Eye className="h-3.5 w-3.5 text-[#A3A3A3]" />
                            {drop.stats.views.toLocaleString()}
                          </span>
                          {resultLabel && (
                            <span className="flex items-center gap-1 font-semibold" style={{ color: POINT }}>
                              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} />
                              {resultLabel.value}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <ChevronRight className="h-5 w-5 text-[#D4D4D4] transition-colors group-hover:text-[#A3A3A3]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F5F5F5]">
                  <Sparkles className="h-8 w-8 text-[#A3A3A3]" />
                </div>
                <h3 className="mt-5 text-[16px] font-bold text-[#0A0A0A]">
                  아직 만든 Drop이 없어요
                </h3>
                <p className="mt-1.5 text-[14px] text-[#525252]">
                  첫 Drop을 만들어볼까요?
                </p>
                <button
                  onClick={onCreateNew}
                  className="mt-6 flex h-12 items-center gap-2 rounded-full bg-[#0A0A0A] px-6 text-[14px] font-semibold text-white transition-all hover:bg-[#171717] active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  Drop 만들기
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#FAFAFA] px-5 py-4 space-y-4">
            {/* Weekly Stats */}
            <div className={`rounded-2xl bg-white p-5 ${CARD_LINE}`}>
              <h3 className="text-[15px] font-bold text-[#0A0A0A]">이번 주 성과</h3>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F5]">
                      <Eye className="h-4 w-4 text-[#525252]" />
                    </div>
                    <span className="text-[14px] text-[#525252]">조회수</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] font-bold tabular-nums text-[#0A0A0A]">1,247</span>
                    <span
                      className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ color: POINT, backgroundColor: "rgba(29,78,216,0.08)" }}
                    >
                      <TrendingUp className="h-3 w-3" strokeWidth={2.5} />12%
                    </span>
                  </div>
                </div>
                <div className="h-px bg-[#F5F5F5]" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F5]">
                      <TrendingUp className="h-4 w-4 text-[#525252]" />
                    </div>
                    <span className="text-[14px] text-[#525252]">전환수</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] font-bold tabular-nums text-[#0A0A0A]">89</span>
                    <span
                      className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ color: POINT, backgroundColor: "rgba(29,78,216,0.08)" }}
                    >
                      <TrendingUp className="h-3 w-3" strokeWidth={2.5} />8%
                    </span>
                  </div>
                </div>
                <div className="h-px bg-[#F5F5F5]" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F5]">
                      <Share2 className="h-4 w-4 text-[#525252]" />
                    </div>
                    <span className="text-[14px] text-[#525252]">공유수</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] font-bold tabular-nums text-[#0A0A0A]">34</span>
                    <span className="flex items-center gap-0.5 rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-bold text-[#737373]">
                      <TrendingUp className="h-3 w-3 rotate-180" strokeWidth={2.5} />5%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Performing Drop */}
            <div className={`rounded-2xl bg-white p-5 ${CARD_LINE}`}>
              <h3 className="text-[15px] font-bold text-[#0A0A0A]">가장 인기 있는 Drop</h3>
              {drops.length > 0 && (
                <button 
                  onClick={() => onViewResults?.(drops[0].id)}
                  className="group mt-4 flex w-full items-center gap-3 text-left"
                >
                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-[#F5F5F5]">
                    <img
                      src={drops[0].thumbnailUrl}
                      alt={drops[0].title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#0A0A0A]">{drops[0].title}</p>
                    <p className="mt-1 text-[13px] text-[#525252]">
                      조회 {drops[0].stats.views.toLocaleString()} · 공유 {drops[0].stats.shares}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#D4D4D4] group-hover:text-[#A3A3A3]" />
                </button>
              )}
            </div>

            {/* Upgrade CTA */}
            {(!user.membership || user.membership.tier === "Free") && (
              <button
                onClick={() => onNavigate?.("/billing")}
                className="group w-full overflow-hidden rounded-2xl bg-[#0A0A0A] p-5 text-left text-white transition-all hover:bg-[#171717]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-white/60" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                        PRO 업그레이드
                      </span>
                    </div>
                    <p className="mt-2 text-[17px] font-bold">AI 분석 리포트 이용하기</p>
                    <p className="mt-0.5 text-[13px] text-white/50">월 9,900원부터</p>
                  </div>
                  <ChevronRight className="h-6 w-6 text-white/30 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            )}
          </div>
        )}

        {/* Quick Links */}
        <section className="border-t border-[#F5F5F5] bg-white px-5 py-2">
          <button
            onClick={() => onNavigate?.("/me/inbox")}
            className="flex w-full items-center justify-between py-3.5 transition-colors active:bg-[#FAFAFA]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F5]">
                <Inbox className="h-[18px] w-[18px] text-[#525252]" />
              </div>
              <span className="text-[15px] font-medium text-[#0A0A0A]">받은함</span>
            </div>
            <ChevronRight className="h-5 w-5 text-[#D4D4D4]" />
          </button>
          <div className="ml-12 h-px bg-[#F5F5F5]" />
          <button
            onClick={() => onNavigate?.("/me/coupons")}
            className="flex w-full items-center justify-between py-3.5 transition-colors active:bg-[#FAFAFA]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F5]">
                <Ticket className="h-[18px] w-[18px] text-[#525252]" />
              </div>
              <span className="text-[15px] font-medium text-[#0A0A0A]">쿠폰함</span>
            </div>
            <ChevronRight className="h-5 w-5 text-[#D4D4D4]" />
          </button>
          <div className="ml-12 h-px bg-[#F5F5F5]" />
          <button
            onClick={() => onNavigate?.("/me/creator")}
            className="flex w-full items-center justify-between py-3.5 transition-colors active:bg-[#FAFAFA]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F5]">
                <Film className="h-[18px] w-[18px] text-[#525252]" />
              </div>
              <span className="text-[15px] font-medium text-[#0A0A0A]">크리에이터 등록</span>
            </div>
            <ChevronRight className="h-5 w-5 text-[#D4D4D4]" />
          </button>
          <div className="ml-12 h-px bg-[#F5F5F5]" />
          <button
            onClick={() => onNavigate?.("/billing")}
            className="flex w-full items-center justify-between py-3.5 transition-colors active:bg-[#FAFAFA]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F5]">
                <Sparkles className="h-[18px] w-[18px] text-[#525252]" />
              </div>
              <span className="text-[15px] font-medium text-[#0A0A0A]">요금제</span>
            </div>
            <ChevronRight className="h-5 w-5 text-[#D4D4D4]" />
          </button>
        </section>

        {/* Footer */}
        <div className="py-8 text-center">
          <p className="text-[11px] text-[#A3A3A3]">LinkDrop v4.0</p>
        </div>
      </main>
    </div>
  );
}

export function MePageDemo() {
  const mockDrops: DropItem[] = [
    {
      id: "1",
      title: "노을이 아름다운 캠핑장 추천 - 가평 노을재",
      thumbnailUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&h=200&fit=crop",
      intent: "coupon",
      createdAt: "5월 18일",
      stats: { views: 184, coupons: 37, shares: 16 },
    },
    {
      id: "2",
      title: "성수동 브런치 카페 추천 TOP 5",
      thumbnailUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop",
      intent: "info",
      createdAt: "5월 15일",
      stats: { views: 342, shares: 28 },
    },
    {
      id: "3",
      title: "스노우피크 텐트 가격 비교",
      thumbnailUrl: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=200&h=200&fit=crop",
      intent: "purchase",
      createdAt: "5월 12일",
      stats: { views: 89, purchases: 5, shares: 8 },
    },
  ];

  return (
    <MePage
      user={{
        name: "김지영",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
        bio: "캠핑 좋아하는 직장인",
        stats: {
          totalDrops: 23,
          totalViews: 2847,
          totalConversions: 156,
        },
        membership: {
          tier: "Pro",
          nextPaymentDate: "6/15",
        },
      }}
      drops={mockDrops}
      onNavigate={(path) => console.log("Navigate to:", path)}
      onCreateNew={() => console.log("Create new")}
    />
  );
}
