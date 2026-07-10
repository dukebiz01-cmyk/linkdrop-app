"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronDown,
  Bell,
  Settings,
  Ticket,
  Calendar,
  TrendingUp,
  Sparkles,
  Plus,
  ChevronRight,
  Play,
  MessageCircle,
  Clock,
  DollarSign,
  Users,
  Store,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ============================================================
// Partner Dashboard Page (/me/partners/[id]/dashboard)
// WHY: 매장 사장님의 진짜 운영 도구. 쉬운 카피 + 큰 숫자 시각
// ============================================================

interface Store {
  id: string;
  name: string;
  imageUrl?: string;
}

interface TodayStat {
  label: string;
  value: number | string;
  subLabel?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
}

interface TopDropper {
  id: string;
  name: string;
  avatarUrl?: string;
  couponUsed: number;
  period: string;
}

interface TopVideo {
  id: string;
  thumbnailUrl: string;
  title: string;
  dropperName: string;
  views: number;
  reservations: number;
}

interface ActiveCoupon {
  id: string;
  title: string;
  discount: string;
  expiresIn: string;
  usedCount: number;
}

interface PartnerDashboardPageProps {
  stores: Store[];
  currentStoreId: string;
  storeName: string;
  todayVisitors: number;
  todayStats: TodayStat[];
  weeklyData: { date: string; issued: number; used: number }[];
  topDroppers: TopDropper[];
  topVideos: TopVideo[];
  aiRecommendation?: {
    title: string;
    reason: string;
  };
  activeCoupons: ActiveCoupon[];
  nextExpiry?: string;
  monthlyBilling: number;
  onStoreChange?: (storeId: string) => void;
  onSendThankYou?: (dropperId: string) => void;
  onMakeRegular?: (videoId: string) => void;
  onIssueCoupon?: (recommendation?: string) => void;
  onNewCoupon?: () => void;
  onViewBilling?: () => void;
  onEditStoreInfo?: () => void;
}

export function PartnerDashboardPage({
  stores,
  currentStoreId,
  storeName,
  todayVisitors,
  todayStats,
  weeklyData,
  topDroppers,
  topVideos,
  aiRecommendation,
  activeCoupons,
  nextExpiry,
  monthlyBilling,
  onStoreChange,
  onSendThankYou,
  onMakeRegular,
  onIssueCoupon,
  onNewCoupon,
  onViewBilling,
  onEditStoreInfo,
}: PartnerDashboardPageProps) {
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-8">
      {/* 1. 헤더 */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
        {/* 매장 선택 dropdown */}
        <button
          onClick={() => setShowStoreDropdown(!showStoreDropdown)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#FAFAFA]"
        >
          <Store className="h-5 w-5 text-[#0A0A0A]" />
          <span className="text-[15px] font-semibold text-[#0A0A0A]">{storeName}</span>
          <ChevronDown className="h-4 w-4 text-[#A3A3A3]" />
        </button>

        <div className="flex items-center gap-2">
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#FAFAFA]">
            <Bell className="h-5 w-5 text-[#A3A3A3]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#EF4444]" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#FAFAFA]">
            <Settings className="h-5 w-5 text-[#A3A3A3]" />
          </button>
        </div>

        {/* Store dropdown */}
        {showStoreDropdown && stores.length > 1 && (
          <div className="absolute left-4 top-14 z-30 w-56 rounded-xl border border-[#E5E5E5] bg-white py-2 shadow-floating">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => {
                  onStoreChange?.(store.id);
                  setShowStoreDropdown(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#FAFAFA] ${
                  store.id === currentStoreId ? "bg-[#F5F5F5]" : ""
                }`}
              >
                <Store className="h-4 w-4 text-[#A3A3A3]" />
                <span className="text-sm text-[#525252]">{store.name}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="px-4 pt-5">
        {/* 2. 인사 + 오늘 요약 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[#0A0A0A]">
            {storeName} 사장님, 안녕하세요
          </h2>
          <p className="mt-1 text-2xl font-bold text-[#0A0A0A]">
            오늘 {todayVisitors}명이 다녀갔어요
          </p>
        </section>

        {/* 3. 오늘 지표 카드들 */}
        {/* WHY: 큰 숫자 시각 = 즉시 가치 인지 */}
        <section className="mb-6 grid grid-cols-2 gap-3">
          {todayStats.map((stat, index) => (
            <div
              key={index}
              className="rounded-xl bg-white p-5 shadow-subtle"
            >
              <div className="flex items-center gap-2 text-[#A3A3A3]">
                {stat.icon}
                <span className="text-[13px]">{stat.label}</span>
              </div>
              <p className="mt-2 text-[32px] font-semibold tabular-nums leading-tight text-[#0A0A0A]">
                {stat.value}
              </p>
              {stat.subLabel && (
                <p className="mt-1 text-[13px] text-[#525252]">{stat.subLabel}</p>
              )}
              {stat.change !== undefined && (
                <div className="mt-2 flex items-center gap-1">
                  {stat.change >= 0 ? (
                    <ArrowUp className="h-3.5 w-3.5 text-[#22C55E]" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5 text-[#EF4444]" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      stat.change >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                    }`}
                  >
                    {stat.change >= 0 ? "+" : ""}
                    {stat.change} {stat.changeLabel}
                  </span>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* 4. 지난 7일 차트 */}
        <section className="mb-6 rounded-xl bg-white p-5 shadow-subtle">
          <h3 className="text-[15px] font-semibold text-[#0A0A0A]">지난 7일</h3>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#A3A3A3" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#A3A3A3" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E5E5",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px" }}
                  iconType="circle"
                  iconSize={8}
                />
                <Line
                  type="monotone"
                  dataKey="issued"
                  stroke="#0A0A0A"
                  strokeWidth={2}
                  dot={false}
                  name="발급"
                />
                <Line
                  type="monotone"
                  dataKey="used"
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={false}
                  name="사용"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 5. 친구 추천으로 온 손님 (Dropper별) */}
        {/* WHY: 단골 후보 = 진짜 매장 운영 가치 */}
        <section className="mb-6 rounded-xl bg-white p-5 shadow-subtle">
          <h3 className="text-[15px] font-semibold text-[#0A0A0A]">
            이번 주 단골 후보
          </h3>
          <p className="mt-1 text-[13px] text-[#A3A3A3]">
            친구 추천으로 자주 방문하는 손님
          </p>

          <div className="mt-4 space-y-3">
            {topDroppers.map((dropper) => (
              <div
                key={dropper.id}
                className="flex items-center justify-between rounded-lg bg-[#FAFAFA] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={dropper.avatarUrl} alt={dropper.name} />
                    <AvatarFallback className="bg-[#E5E5E5] text-sm font-medium text-[#A3A3A3]">
                      {dropper.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[15px] font-medium text-[#0A0A0A]">
                      {dropper.name}
                    </p>
                    <p className="text-[13px] text-[#A3A3A3]">
                      쿠폰 사용 {dropper.couponUsed}건 ({dropper.period})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onSendThankYou?.(dropper.id)}
                  className="text-[13px] font-medium text-[#0A0A0A] transition-colors hover:text-[#171717]"
                >
                  감사 메시지
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 6. 인기 후기 영상 */}
        <section className="mb-6 rounded-xl bg-white p-5 shadow-subtle">
          <h3 className="text-[15px] font-semibold text-[#0A0A0A]">
            이번 주 가장 효과적인 영상
          </h3>

          <div className="mt-4 space-y-3">
            {topVideos.map((video) => (
              <div
                key={video.id}
                className="flex gap-3 rounded-lg border border-[#E5E5E5] p-3"
              >
                <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#0A0A0A]">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-[#0A0A0A] text-[#0A0A0A]" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <p className="line-clamp-1 text-[14px] font-medium text-[#0A0A0A]">
                    {video.title}
                  </p>
                  <p className="text-[12px] text-[#A3A3A3]">
                    {video.dropperName} · 조회 {video.views} · 예약 {video.reservations}
                  </p>
                  <button
                    onClick={() => onMakeRegular?.(video.id)}
                    className="mt-1 self-start text-[12px] font-medium text-[#0A0A0A] transition-colors hover:text-[#171717]"
                  >
                    이 영상으로 단골 만들기 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7. AI 쿠폰 추천 */}
        {aiRecommendation && (
          <section className="mb-6 rounded-xl bg-gradient-to-br from-[#F5F5F5] to-white p-5 shadow-subtle">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#0A0A0A]" />
              <h3 className="text-[15px] font-semibold text-[#0A0A0A]">
                다음 쿠폰 추천
              </h3>
            </div>
            <p className="mt-3 text-[15px] font-medium text-[#0A0A0A]">
              {aiRecommendation.title}
            </p>
            <p className="mt-1 text-[13px] text-[#A3A3A3]">
              이유: {aiRecommendation.reason}
            </p>
            <button
              onClick={() => onIssueCoupon?.(aiRecommendation.title)}
              className="mt-4 flex h-14 w-full items-center justify-center rounded-xl bg-[#0A0A0A] text-base font-semibold text-white transition-all hover:bg-[#171717] active:scale-[0.99]"
            >
              발행하기
            </button>
          </section>
        )}

        {/* 8. 쿠폰 관리 */}
        <section className="mb-6 rounded-xl bg-white p-5 shadow-subtle">
          <h3 className="text-[15px] font-semibold text-[#0A0A0A]">쿠폰 관리</h3>

          <button
            onClick={onNewCoupon}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] text-base font-semibold text-white transition-all hover:bg-[#171717] active:scale-[0.99]"
          >
            <Plus className="h-5 w-5" />
            새 쿠폰 발행
          </button>

          {nextExpiry && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#FFFBEB] px-3 py-2">
              <Clock className="h-4 w-4 text-[#D97706]" />
              <span className="text-[13px] font-medium text-[#D97706]">
                다음 만료: {nextExpiry}
              </span>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {activeCoupons.map((coupon) => (
              <div
                key={coupon.id}
                className="flex items-center justify-between rounded-lg border border-[#E5E5E5] px-4 py-3"
              >
                <div>
                  <p className="text-[14px] font-medium text-[#0A0A0A]">
                    {coupon.title}
                  </p>
                  <p className="text-[12px] text-[#A3A3A3]">
                    {coupon.discount} · 사용 {coupon.usedCount}건
                  </p>
                </div>
                <span className="text-[12px] text-[#A3A3A3]">
                  {coupon.expiresIn}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 9. 매장 정보 수정 */}
        <section className="mb-6">
          <button
            onClick={onEditStoreInfo}
            className="flex w-full items-center justify-between rounded-xl bg-white px-5 py-4 shadow-subtle transition-colors hover:bg-[#FAFAFA]"
          >
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-[#A3A3A3]" />
              <span className="text-[15px] font-medium text-[#0A0A0A]">
                매장 정보 수정
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
          </button>
        </section>

        {/* 10. 정산 (이번 달) */}
        <section className="rounded-xl bg-white p-5 shadow-subtle">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#A3A3A3]" />
            <h3 className="text-[15px] font-semibold text-[#0A0A0A]">이번 달 정산</h3>
          </div>
          <p className="mt-3 text-xl font-bold tabular-nums text-[#0A0A0A]">
            청구 예상액: ₩{monthlyBilling.toLocaleString()}
          </p>
          <p className="mt-1 text-[13px] text-[#A3A3A3]">월정액 + 사용량</p>
          <button
            onClick={onViewBilling}
            className="mt-3 text-[14px] font-medium text-[#0A0A0A] transition-colors hover:text-[#171717]"
          >
            상세 보기 →
          </button>
        </section>
      </main>
    </div>
  );
}

// Demo component
export function PartnerDashboardPageDemo() {
  return (
    <PartnerDashboardPage
      stores={[
        { id: "1", name: "모래재캠핑장" },
        { id: "2", name: "강변글램핑" },
      ]}
      currentStoreId="1"
      storeName="모래재캠핑장"
      todayVisitors={8}
      todayStats={[
        {
          label: "쿠폰 발급",
          value: 87,
          change: 12,
          changeLabel: "vs 어제",
          icon: <Ticket className="h-4 w-4" />,
        },
        {
          label: "쿠폰 사용",
          value: 23,
          subLabel: "사용률 26%",
          icon: <Ticket className="h-4 w-4" />,
        },
        {
          label: "예약 클릭",
          value: 12,
          subLabel: "외부 link 이동",
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          label: "예상 매출",
          value: "₩187,000",
          subLabel: "쿠폰 기반 추정",
          icon: <TrendingUp className="h-4 w-4" />,
        },
      ]}
      weeklyData={[
        { date: "월", issued: 45, used: 12 },
        { date: "화", issued: 52, used: 18 },
        { date: "수", issued: 38, used: 14 },
        { date: "목", issued: 65, used: 22 },
        { date: "금", issued: 78, used: 28 },
        { date: "토", issued: 92, used: 35 },
        { date: "일", issued: 87, used: 23 },
      ]}
      topDroppers={[
        { id: "1", name: "지민", couponUsed: 12, period: "이번 달" },
        { id: "2", name: "수현", couponUsed: 8, period: "이번 달" },
        { id: "3", name: "현우", couponUsed: 5, period: "이번 달" },
      ]}
      topVideos={[
        {
          id: "1",
          thumbnailUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=300&fit=crop",
          title: "노을 뷰가 미쳤던 캠핑장 후기",
          dropperName: "캠핑하는 직장인",
          views: 184,
          reservations: 12,
        },
        {
          id: "2",
          thumbnailUrl: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&h=300&fit=crop",
          title: "가족 캠핑 추천 장소 TOP 3",
          dropperName: "주말가족여행",
          views: 156,
          reservations: 8,
        },
      ]}
      aiRecommendation={{
        title: "신메뉴 출시 쿠폰: 30% 할인 추천",
        reason: "지난 주 일요일 매출 부진",
      }}
      activeCoupons={[
        { id: "1", title: "첫 방문 할인", discount: "20% 할인", expiresIn: "2일 후", usedCount: 45 },
        { id: "2", title: "주말 특가", discount: "15% 할인", expiresIn: "5일 후", usedCount: 32 },
        { id: "3", title: "단골 감사", discount: "10% 할인", expiresIn: "12일 후", usedCount: 18 },
      ]}
      nextExpiry="2일 후"
      monthlyBilling={99000}
    />
  );
}
