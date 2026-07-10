"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronLeft,
  ChevronRight,
  Store,
  Film,
  MessageSquare,
  LayoutGrid,
  Inbox,
  Ticket,
  Activity,
  Bell,
  Shield,
  Globe,
  Moon,
  HelpCircle,
  FileText,
  Lock,
  Info,
  LogOut,
} from "lucide-react";

export interface UserProfile {
  name: string;
  avatarUrl?: string;
  bio?: string;
  stats: {
    drops: number;
    receivers: number;
    regulars: number;
  };
  membership?: {
    tier: "Pro" | "Basic";
    feature: string;
    nextPaymentDate: string;
  };
}

export interface ProfilePageProps {
  user: UserProfile;
  onBack?: () => void;
  onEditProfile?: () => void;
  onNavigate?: (path: string) => void;
  onLogout?: () => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  isLast?: boolean;
  isDanger?: boolean;
  onClick?: () => void;
}

function MenuItem({ icon, label, value, isLast, isDanger, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-3.5 transition-colors hover:bg-[#FAFAFA] active:bg-[#F5F5F5] ${
        !isLast ? "border-b border-[#F5F5F5]" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={isDanger ? "text-[#EF4444]" : "text-[#525252]"}>
          {icon}
        </span>
        <span className={`text-[14px] ${isDanger ? "text-[#EF4444]" : "text-[#0A0A0A]"}`}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-[13px] text-[#A3A3A3]">{value}</span>}
        {!isDanger && <ChevronRight className="h-4 w-4 text-[#D4D4D4]" />}
      </div>
    </button>
  );
}

interface MenuSectionProps {
  title?: string;
  children: React.ReactNode;
}

function MenuSection({ title, children }: MenuSectionProps) {
  return (
    <div className="mt-4">
      {title && (
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#A3A3A3]">
          {title}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {children}
      </div>
    </div>
  );
}

export function ProfilePage({
  user,
  onBack,
  onEditProfile,
  onNavigate,
  onLogout,
}: ProfilePageProps) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-[#FAFAFA]/95 px-5 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#525252] transition-all hover:bg-[#F5F5F5] active:scale-95"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <span className="text-[15px] font-semibold text-[#0A0A0A]">
          프로필
        </span>
        <div className="w-10" />
      </header>

      <main className="mx-auto max-w-md px-5">
        {/* Profile Header Card */}
        <div className="mt-2 overflow-hidden rounded-[28px] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col items-center">
            <Avatar className="h-20 w-20 ring-4 ring-[#FAFAFA]">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback className="bg-[#F5F5F5] text-[24px] font-bold text-[#0A0A0A]">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-[20px] font-bold text-[#0A0A0A]">{user.name}</h2>
            {user.bio && (
              <p className="mt-1 text-[13px] text-[#525252]">{user.bio}</p>
            )}
            
            {/* Stats */}
            <div className="mt-5 flex w-full items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-[20px] font-bold text-[#0A0A0A]">{user.stats.drops}</p>
                <p className="text-[11px] text-[#A3A3A3]">Drop</p>
              </div>
              <div className="h-8 w-px bg-[#F5F5F5]" />
              <div className="text-center">
                <p className="text-[20px] font-bold text-[#0A0A0A]">{user.stats.receivers}</p>
                <p className="text-[11px] text-[#A3A3A3]">받은 사람</p>
              </div>
              <div className="h-8 w-px bg-[#F5F5F5]" />
              <div className="text-center">
                <p className="text-[20px] font-bold text-[#0A0A0A]">{user.stats.regulars}</p>
                <p className="text-[11px] text-[#A3A3A3]">단골</p>
              </div>
            </div>
            
            <button
              onClick={onEditProfile}
              className="mt-5 h-10 w-full rounded-xl border-2 border-[#E5E5E5] text-[13px] font-semibold text-[#0A0A0A] transition-all hover:border-[#D4D4D4] hover:bg-[#FAFAFA] active:scale-[0.98]"
            >
              프로필 수정
            </button>
          </div>
        </div>

        {/* Membership Card */}
        {user.membership && (
          <div className="mt-4 overflow-hidden rounded-2xl bg-[#0A0A0A] p-5 text-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  {user.membership.tier} 회원
                </p>
                <p className="mt-1 text-[16px] font-bold">{user.membership.feature}</p>
                <p className="mt-0.5 text-[12px] text-white/70">
                  다음 결제: {user.membership.nextPaymentDate}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-white/40" />
            </div>
          </div>
        )}

        {/* Menu Sections */}
        <MenuSection title="비즈니스">
          <MenuItem
            icon={<Store className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="내 매장"
            onClick={() => onNavigate?.("/me/store")}
          />
          <MenuItem
            icon={<Film className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="크리에이터 등록"
            onClick={() => onNavigate?.("/me/creator")}
          />
          <MenuItem
            icon={<MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="영상 리뷰어 등록"
            isLast
            onClick={() => onNavigate?.("/me/reviewer")}
          />
        </MenuSection>

        <MenuSection title="활동">
          <MenuItem
            icon={<LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="내 Drop"
            onClick={() => onNavigate?.("/me/drops")}
          />
          <MenuItem
            icon={<Inbox className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="받은함"
            onClick={() => onNavigate?.("/me/inbox")}
          />
          <MenuItem
            icon={<Ticket className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="쿠폰함"
            onClick={() => onNavigate?.("/me/coupons")}
          />
          <MenuItem
            icon={<Activity className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="활동 내역"
            isLast
            onClick={() => onNavigate?.("/me/activity")}
          />
        </MenuSection>

        <MenuSection title="설정">
          <MenuItem
            icon={<Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="알림 설정"
            onClick={() => onNavigate?.("/me/notifications")}
          />
          <MenuItem
            icon={<Shield className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="개인정보"
            onClick={() => onNavigate?.("/me/privacy")}
          />
          <MenuItem
            icon={<Globe className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="언어"
            value="한국어"
            onClick={() => onNavigate?.("/me/language")}
          />
          <MenuItem
            icon={<Moon className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="테마"
            value="시스템"
            isLast
            onClick={() => onNavigate?.("/me/theme")}
          />
        </MenuSection>

        <MenuSection title="도움말">
          <MenuItem
            icon={<HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="고객센터"
            onClick={() => onNavigate?.("/help")}
          />
          <MenuItem
            icon={<FileText className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="약관"
            onClick={() => onNavigate?.("/terms")}
          />
          <MenuItem
            icon={<Lock className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="개인정보처리방침"
            onClick={() => onNavigate?.("/privacy-policy")}
          />
          <MenuItem
            icon={<Info className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="LinkDrop 정보"
            isLast
            onClick={() => onNavigate?.("/about")}
          />
        </MenuSection>

        <MenuSection>
          <MenuItem
            icon={<LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            label="로그아웃"
            isDanger
            isLast
            onClick={onLogout}
          />
        </MenuSection>

        {/* Footer */}
        <div className="mt-8 pb-8 text-center">
          <p className="text-[11px] text-[#A3A3A3]">LinkDrop v3.0</p>
        </div>
      </main>
    </div>
  );
}

export function ProfilePageDemo() {
  return (
    <ProfilePage
      user={{
        name: "김지영",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
        bio: "캠핑 좋아하는 직장인",
        stats: {
          drops: 23,
          receivers: 156,
          regulars: 12,
        },
        membership: {
          tier: "Pro",
          feature: "AI 분석 무제한",
          nextPaymentDate: "6/15",
        },
      }}
      onNavigate={(path) => console.log("Navigate to:", path)}
      onEditProfile={() => console.log("Edit profile")}
      onLogout={() => console.log("Logout")}
    />
  );
}
