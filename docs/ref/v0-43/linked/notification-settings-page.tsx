"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Inbox,
  Bell,
  Ticket,
  Clock,
  Calendar,
  BarChart3,
  Users,
  Store,
  DollarSign,
  Megaphone,
  Gift,
  Smartphone,
  MessageCircle,
  Mail,
  Moon,
  Send,
  ExternalLink,
  Check,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ============================================================
// 알림 설정 화면 (/me/notifications)
// WHY: 사용자가 진짜 control 가능 = retention + 신뢰
// WHY: GDPR/마케팅법 준수
// ============================================================

interface NotificationSettingsPageProps {
  user?: {
    name: string;
    avatarUrl?: string;
    isPartner?: boolean;
  };
  onBack?: () => void;
  onOpenSystemSettings?: () => void;
  onViewActivityLog?: () => void;
  lastNotificationTime?: string;
}

export function NotificationSettingsPage({
  user = { name: "사용자", isPartner: true },
  onBack,
  onOpenSystemSettings,
  onViewActivityLog,
  lastNotificationTime = "2시간 전",
}: NotificationSettingsPageProps) {
  // Master toggle
  const [masterEnabled, setMasterEnabled] = useState(true);

  // 받은 Drop
  const [newDropEnabled, setNewDropEnabled] = useState(true);
  const [friendActivityEnabled, setFriendActivityEnabled] = useState(true);

  // 쿠폰
  const [couponReceivedEnabled, setCouponReceivedEnabled] = useState(true);
  const [couponExpiryEnabled, setCouponExpiryEnabled] = useState(true);

  // 예약
  const [reservationConfirmEnabled, setReservationConfirmEnabled] = useState(true);
  const [visitReminderEnabled, setVisitReminderEnabled] = useState(true);

  // 내 Drop 결과
  const [resultSummaryEnabled, setResultSummaryEnabled] = useState(true);
  const [resultFrequency, setResultFrequency] = useState<"daily" | "weekly" | "none">("weekly");
  const [newUsageEnabled, setNewUsageEnabled] = useState(true);

  // 매장 운영 (사장님)
  const [newBookingEnabled, setNewBookingEnabled] = useState(true);
  const [settlementEnabled, setSettlementEnabled] = useState(true);

  // 마케팅
  const [newFeatureEnabled, setNewFeatureEnabled] = useState(false);
  const [promotionEnabled, setPromotionEnabled] = useState(false);

  // 채널
  const [pushEnabled, setPushEnabled] = useState(true);
  const [kakaoEnabled, setKakaoEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  // 방해 금지
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState("22:00");
  const [dndEnd, setDndEnd] = useState("08:00");

  // Toast
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const handleMarketingChange = (type: "feature" | "promo", value: boolean) => {
    if (type === "feature") {
      setNewFeatureEnabled(value);
    } else {
      setPromotionEnabled(value);
    }
    showSuccessToast("마케팅 수신 동의가 변경됐어요");
  };

  const handleTestNotification = () => {
    showSuccessToast("테스트 알림을 보냈어요");
  };

  // Toggle row component
  const ToggleRow = ({
    icon: Icon,
    label,
    description,
    enabled,
    onChange,
    disabled = false,
    children,
  }: {
    icon: React.ElementType;
    label: string;
    description: string;
    enabled: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => (
    <div
      className={`flex items-start gap-3 border-b border-[#F5F5F5] px-4 py-4 last:border-b-0 ${
        disabled || !masterEnabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F5]">
        <Icon className="h-5 w-5 text-[#A3A3A3]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium text-[#0A0A0A]">{label}</span>
          <Switch
            checked={enabled}
            onCheckedChange={onChange}
            disabled={disabled || !masterEnabled}
          />
        </div>
        <p className="mt-0.5 text-[13px] text-[#A3A3A3]">{description}</p>
        {children}
      </div>
    </div>
  );

  // Section header
  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-[#FAFAFA] px-4 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#A3A3A3]">
        {children}
      </span>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-white pb-24">
      {/* 1. 헤더 */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white/95 px-4 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#F5F5F5]"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5 text-[#A3A3A3]" />
        </button>
        <span className="text-sm font-semibold tracking-tight text-[#0A0A0A]">
          알림 설정
        </span>
        <div className="w-9" />
      </header>

      <main>
        {/* 2. 마스터 Toggle */}
        <div className="px-4 py-4">
          <div className="rounded-2xl bg-[#FAFAFA] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-[#0A0A0A]">전체 알림</p>
                <p className="mt-0.5 text-[13px] text-[#A3A3A3]">
                  모든 알림을 한 번에 켜고 끄기
                </p>
              </div>
              <Switch
                checked={masterEnabled}
                onCheckedChange={setMasterEnabled}
                className="scale-125"
              />
            </div>
          </div>
        </div>

        {/* 3. 카테고리별 알림 */}
        
        {/* 섹션 1: 받은 Drop */}
        <SectionHeader>받은 Drop</SectionHeader>
        <div className="bg-white">
          <ToggleRow
            icon={Inbox}
            label="새 Drop 받음"
            description="친구가 Drop을 보내면 알림"
            enabled={newDropEnabled}
            onChange={setNewDropEnabled}
          />
          <ToggleRow
            icon={Bell}
            label="친구 활동"
            description="친구가 새 매장 추천 시"
            enabled={friendActivityEnabled}
            onChange={setFriendActivityEnabled}
          />
        </div>

        {/* 섹션 2: 쿠폰 */}
        <SectionHeader>쿠폰</SectionHeader>
        <div className="bg-white">
          <ToggleRow
            icon={Ticket}
            label="쿠폰 받음"
            description="새 쿠폰을 받으면 알림"
            enabled={couponReceivedEnabled}
            onChange={setCouponReceivedEnabled}
          />
          <ToggleRow
            icon={Clock}
            label="만료 임박"
            description="쿠폰 만료 3일 전 알림"
            enabled={couponExpiryEnabled}
            onChange={setCouponExpiryEnabled}
          />
        </div>

        {/* 섹션 3: 예약 */}
        <SectionHeader>예약</SectionHeader>
        <div className="bg-white">
          <ToggleRow
            icon={Calendar}
            label="예약 확정"
            description="매장이 예약을 확정하면"
            enabled={reservationConfirmEnabled}
            onChange={setReservationConfirmEnabled}
          />
          <ToggleRow
            icon={Bell}
            label="방문 알림"
            description="예약 1일 전 / 1시간 전"
            enabled={visitReminderEnabled}
            onChange={setVisitReminderEnabled}
          />
        </div>

        {/* 섹션 4: 내 Drop 결과 */}
        <SectionHeader>내 Drop 결과</SectionHeader>
        <div className="bg-white">
          <ToggleRow
            icon={BarChart3}
            label="결과 요약"
            description="매일 또는 매주 결과 받기"
            enabled={resultSummaryEnabled}
            onChange={setResultSummaryEnabled}
          >
            {resultSummaryEnabled && masterEnabled && (
              <div className="mt-3 flex gap-2">
                {(["daily", "weekly", "none"] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setResultFrequency(freq)}
                    className={`flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium transition-all ${
                      resultFrequency === freq
                        ? "bg-[#0A0A0A] text-white"
                        : "bg-[#F5F5F5] text-[#A3A3A3] hover:bg-[#E5E5E5]"
                    }`}
                  >
                    {freq === "daily" ? "매일" : freq === "weekly" ? "매주" : "안 받음"}
                  </button>
                ))}
              </div>
            )}
          </ToggleRow>
          <ToggleRow
            icon={Users}
            label="새 사용 알림"
            description="누가 쿠폰을 사용했을 때"
            enabled={newUsageEnabled}
            onChange={setNewUsageEnabled}
          />
        </div>

        {/* 섹션 5: 매장 운영 (사장님) */}
        {user.isPartner && (
          <>
            <SectionHeader>매장 운영</SectionHeader>
            <div className="bg-white">
              <ToggleRow
                icon={Store}
                label="새 예약/상담"
                description="손님이 예약/상담 신청 시"
                enabled={newBookingEnabled}
                onChange={setNewBookingEnabled}
              />
              <ToggleRow
                icon={DollarSign}
                label="정산 알림"
                description="월 정산 + 결제 알림"
                enabled={settlementEnabled}
                onChange={setSettlementEnabled}
              />
            </div>
          </>
        )}

        {/* 섹션 6: 마케팅 */}
        {/* WHY: 마케팅 동의 = consent_records 저장 (GDPR) */}
        <SectionHeader>마케팅</SectionHeader>
        <div className="bg-white">
          <ToggleRow
            icon={Megaphone}
            label="신기능 안내"
            description="LinkDrop 업데이트 소식"
            enabled={newFeatureEnabled}
            onChange={(v) => handleMarketingChange("feature", v)}
          />
          <ToggleRow
            icon={Gift}
            label="프로모션"
            description="이벤트, 할인 정보"
            enabled={promotionEnabled}
            onChange={(v) => handleMarketingChange("promo", v)}
          />
        </div>

        {/* 4. 알림 채널 */}
        {/* WHY: 채널 분리 = 사용자 선호 채널 존중 */}
        <SectionHeader>어떻게 받을까요?</SectionHeader>
        <div className="bg-white">
          <ToggleRow
            icon={Smartphone}
            label="푸시 알림"
            description="앱이 백그라운드일 때"
            enabled={pushEnabled}
            onChange={setPushEnabled}
          />
          <ToggleRow
            icon={MessageCircle}
            label="카카오 알림톡"
            description="카카오톡으로 받기"
            enabled={kakaoEnabled}
            onChange={setKakaoEnabled}
          />
          <ToggleRow
            icon={Mail}
            label="이메일"
            description="중요한 알림만 이메일"
            enabled={emailEnabled}
            onChange={setEmailEnabled}
          />
        </div>

        {/* 5. 방해 금지 시간 */}
        {/* WHY: 방해 금지 시간 = 사용자 휴식 보호 */}
        <SectionHeader>방해 금지</SectionHeader>
        <div className="bg-white px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F5]">
                <Moon className="h-5 w-5 text-[#A3A3A3]" />
              </div>
              <div>
                <p className="text-[15px] font-medium text-[#0A0A0A]">방해 금지 시간</p>
                <p className="mt-0.5 text-[13px] text-[#A3A3A3]">
                  설정한 시간에는 알림 안 함
                </p>
              </div>
            </div>
            <Switch checked={dndEnabled} onCheckedChange={setDndEnabled} />
          </div>

          {dndEnabled && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#FAFAFA] p-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-[#A3A3A3]">시작</label>
                <input
                  type="time"
                  value={dndStart}
                  onChange={(e) => setDndStart(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-[#0A0A0A]"
                />
              </div>
              <span className="mt-4 text-[#A3A3A3]">~</span>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-[#A3A3A3]">종료</label>
                <input
                  type="time"
                  value={dndEnd}
                  onChange={(e) => setDndEnd(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-[#0A0A0A]"
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. 테스트 알림 */}
        <div className="px-4 py-4">
          <button
            onClick={handleTestNotification}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#E5E5E5] bg-white text-sm font-medium text-[#525252] transition-all hover:bg-[#FAFAFA]"
          >
            <Send className="h-4 w-4" />
            테스트 알림 보내기
          </button>
        </div>

        {/* 푸시 권한 안내 (OS 거부 시) */}
        {!pushEnabled && (
          <div className="mx-4 mb-4 rounded-xl bg-[#FFFBEB] p-4">
            <p className="text-sm font-medium text-[#92400E]">
              기기에서 푸시 알림이 꺼져 있어요
            </p>
            <button
              onClick={onOpenSystemSettings}
              className="mt-2 flex items-center gap-1 text-sm font-medium text-[#D97706]"
            >
              시스템 설정 열기
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 7. 푸터 */}
        {/* WHY: 알림 기록 = 사용자 추적 가능 */}
        <div className="border-t border-[#F5F5F5] px-4 py-4">
          <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
            <span>마지막 알림: {lastNotificationTime}</span>
            <button
              onClick={onViewActivityLog}
              className="font-medium text-[#0A0A0A]"
            >
              알림 기록 →
            </button>
          </div>
        </div>
      </main>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-medium text-white shadow-floating">
            <Check className="h-4 w-4 text-[#22C55E]" />
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}

// Demo component
export function NotificationSettingsPageDemo() {
  return (
    <NotificationSettingsPage
      user={{ name: "김영희", isPartner: true }}
      lastNotificationTime="2시간 전"
    />
  );
}
