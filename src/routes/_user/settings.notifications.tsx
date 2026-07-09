// /settings/notifications — 알림 설정 (v0-43 notification-settings-page 이식).
//   _user 자식: 인증 가드는 부모 _user.tsx. 로더 없음(순수 클라 UI) → 리다이렉트 루프 무관.
//   가 방침(E-3): 모든 토글·빈도는 로컬 useState 로 화면만. 저장 백엔드·가짜 성공 토스트·테스트발송 없음.
//   ⚠️ 원본의 마케팅 토스트·"테스트 알림 보내기"·"마지막 알림/알림 기록"(mock)·시스템설정 링크(dead)는 §0 로 제거.
//      "매장 운영"(사장님) 섹션은 실 isBusiness 게이트가 없으면 mock 노출이 되므로 미이식(백엔드/게이트 확정 후).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { ComponentType } from "react";
import {
  ArrowLeft,
  Inbox,
  Bell,
  Ticket,
  Clock,
  Calendar,
  BarChart3,
  Users,
  Smartphone,
  MessageCircle,
  Mail,
  Moon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_user/settings/notifications")({
  head: () => ({ meta: [{ title: "알림 설정 — LinkDrop" }] }),
  component: NotificationSettingsPage,
});

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#F8FAFC] px-4 py-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
        {children}
      </span>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  enabled,
  onChange,
  disabled = false,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 border-b border-[#F1F5F9] px-4 py-4 last:border-b-0 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#94A3B8]">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-medium text-[#0F172A]">{label}</span>
          <Switch checked={enabled} onCheckedChange={onChange} disabled={disabled} />
        </div>
        <p className="mt-0.5 text-[12px] text-[#94A3B8]">{description}</p>
        {children}
      </div>
    </div>
  );
}

function NotificationSettingsPage() {
  // 화면만 — 로컬 상태(새로고침 시 리셋). 저장 연동 없음.
  const [master, setMaster] = useState(true);
  const [newDrop, setNewDrop] = useState(true);
  const [friendActivity, setFriendActivity] = useState(true);
  const [couponReceived, setCouponReceived] = useState(true);
  const [couponExpiry, setCouponExpiry] = useState(true);
  const [reservationConfirm, setReservationConfirm] = useState(true);
  const [visitReminder, setVisitReminder] = useState(true);
  const [resultSummary, setResultSummary] = useState(true);
  const [resultFrequency, setResultFrequency] = useState<"daily" | "weekly" | "none">("weekly");
  const [newUsage, setNewUsage] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [kakaoEnabled, setKakaoEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [dnd, setDnd] = useState(false);
  const [dndStart, setDndStart] = useState("22:00");
  const [dndEnd, setDndEnd] = useState("08:00");

  const off = !master;

  return (
    <main className="min-h-screen bg-white tracking-ko pb-16">
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-[#F1F5F9] bg-white/95 px-2 backdrop-blur-xl">
        <Link
          to="/me"
          aria-label="뒤로"
          className="flex size-10 items-center justify-center rounded-full text-[#475569] transition-colors hover:bg-[#F1F5F9]"
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 text-center text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">
          알림 설정
        </h1>
        <div className="w-10" />
      </header>

      <div className="px-4 py-4">
        <div className="flex items-center justify-between rounded-2xl bg-[#F8FAFC] p-5">
          <div>
            <p className="text-base font-bold text-[#0F172A]">전체 알림</p>
            <p className="mt-0.5 text-[12px] text-[#94A3B8]">모든 알림을 한 번에 켜고 끄기</p>
          </div>
          <Switch checked={master} onCheckedChange={setMaster} className="scale-125" />
        </div>
      </div>

      <SectionHeader>받은 Drop</SectionHeader>
      <div>
        <ToggleRow
          icon={Inbox}
          label="새 Drop 받음"
          description="친구가 Drop을 보내면 알림"
          enabled={newDrop}
          onChange={setNewDrop}
          disabled={off}
        />
        <ToggleRow
          icon={Bell}
          label="친구 활동"
          description="친구가 새 매장 추천 시"
          enabled={friendActivity}
          onChange={setFriendActivity}
          disabled={off}
        />
      </div>

      <SectionHeader>쿠폰</SectionHeader>
      <div>
        <ToggleRow
          icon={Ticket}
          label="쿠폰 받음"
          description="새 쿠폰을 받으면 알림"
          enabled={couponReceived}
          onChange={setCouponReceived}
          disabled={off}
        />
        <ToggleRow
          icon={Clock}
          label="만료 임박"
          description="쿠폰 만료 3일 전 알림"
          enabled={couponExpiry}
          onChange={setCouponExpiry}
          disabled={off}
        />
      </div>

      <SectionHeader>예약</SectionHeader>
      <div>
        <ToggleRow
          icon={Calendar}
          label="예약 확정"
          description="매장이 예약을 확정하면"
          enabled={reservationConfirm}
          onChange={setReservationConfirm}
          disabled={off}
        />
        <ToggleRow
          icon={Bell}
          label="방문 알림"
          description="예약 1일 전 / 1시간 전"
          enabled={visitReminder}
          onChange={setVisitReminder}
          disabled={off}
        />
      </div>

      <SectionHeader>내 Drop 결과</SectionHeader>
      <div>
        <ToggleRow
          icon={BarChart3}
          label="결과 요약"
          description="매일 또는 매주 결과 받기"
          enabled={resultSummary}
          onChange={setResultSummary}
          disabled={off}
        >
          {resultSummary && !off ? (
            <div className="mt-3 flex gap-2">
              {(["daily", "weekly", "none"] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setResultFrequency(freq)}
                  className={`flex h-8 items-center justify-center rounded-lg px-3 text-[13px] font-semibold transition-all ${
                    resultFrequency === freq
                      ? "bg-[#0F172A] text-white"
                      : "bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E8EDF3]"
                  }`}
                >
                  {freq === "daily" ? "매일" : freq === "weekly" ? "매주" : "안 받음"}
                </button>
              ))}
            </div>
          ) : null}
        </ToggleRow>
        <ToggleRow
          icon={Users}
          label="새 사용 알림"
          description="누가 쿠폰을 사용했을 때"
          enabled={newUsage}
          onChange={setNewUsage}
          disabled={off}
        />
      </div>

      <SectionHeader>어떻게 받을까요?</SectionHeader>
      <div>
        <ToggleRow
          icon={Smartphone}
          label="푸시 알림"
          description="앱이 백그라운드일 때"
          enabled={pushEnabled}
          onChange={setPushEnabled}
          disabled={off}
        />
        <ToggleRow
          icon={MessageCircle}
          label="카카오 알림톡"
          description="카카오톡으로 받기"
          enabled={kakaoEnabled}
          onChange={setKakaoEnabled}
          disabled={off}
        />
        <ToggleRow
          icon={Mail}
          label="이메일"
          description="중요한 알림만 이메일"
          enabled={emailEnabled}
          onChange={setEmailEnabled}
          disabled={off}
        />
      </div>

      <SectionHeader>방해 금지</SectionHeader>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#94A3B8]">
              <Moon className="size-5" strokeWidth={2} />
            </span>
            <span>
              <span className="block text-[14px] font-medium text-[#0F172A]">방해 금지 시간</span>
              <span className="mt-0.5 block text-[12px] text-[#94A3B8]">
                설정한 시간에는 알림 안 함
              </span>
            </span>
          </span>
          <Switch checked={dnd} onCheckedChange={setDnd} />
        </div>
        {dnd ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#F8FAFC] p-4">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] text-[#94A3B8]">시작</label>
              <input
                type="time"
                value={dndStart}
                onChange={(e) => setDndStart(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#E8EDF3] bg-white px-3 text-sm text-[#0F172A]"
              />
            </div>
            <span className="mt-4 text-[#94A3B8]">~</span>
            <div className="flex-1">
              <label className="mb-1 block text-[11px] text-[#94A3B8]">종료</label>
              <input
                type="time"
                value={dndEnd}
                onChange={(e) => setDndEnd(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#E8EDF3] bg-white px-3 text-sm text-[#0F172A]"
              />
            </div>
          </div>
        ) : null}
      </div>

      <p className="px-4 pt-4 text-[11px] leading-relaxed text-[#94A3B8]">
        알림 설정은 이 화면에서 켜고 끌 수 있어요. 저장 연동은 서비스 오픈 후 순차 적용됩니다.
      </p>
    </main>
  );
}
