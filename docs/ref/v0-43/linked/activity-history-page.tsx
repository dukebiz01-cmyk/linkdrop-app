"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Download,
  Sparkles,
  Ticket,
  Calendar,
  ShoppingBag,
  MessageSquare,
  LogIn,
  ChevronRight,
  X,
  Smartphone,
  Monitor,
  MapPin,
} from "lucide-react";
import { Card } from "@/components/ui/card";

// Types
interface ActivityItem {
  id: string;
  type: "drop" | "coupon" | "reservation" | "purchase" | "consultation" | "login";
  title: string;
  subtitle: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Mock data
const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: "1",
    type: "drop",
    title: "Drop 생성",
    subtitle: "캠핑 영상 속 장바구니 + 쿠폰",
    timestamp: new Date("2025-05-20T14:23:00"),
    metadata: { dropId: "drop_123", intent: "정보", videoUrl: "https://youtu.be/..." },
  },
  {
    id: "2",
    type: "coupon",
    title: "쿠폰 받음",
    subtitle: "모래재캠핑장 15% 할인",
    timestamp: new Date("2025-05-20T09:15:00"),
    metadata: { couponId: "cpn_456", discount: "15%", expiresIn: "5일" },
  },
  {
    id: "3",
    type: "reservation",
    title: "예약 클릭",
    subtitle: "캠핏 외부 예약 link",
    timestamp: new Date("2025-05-19T22:30:00"),
    metadata: { provider: "캠핏", url: "https://camfit.co.kr/..." },
  },
  {
    id: "4",
    type: "login",
    title: "로그인",
    subtitle: "iPhone · 서울 강남구",
    timestamp: new Date("2025-05-19T09:00:00"),
    metadata: { device: "iPhone 15 Pro", os: "iOS 17.4", ip: "xxx.xxx.xxx.xxx", location: "서울 강남구" },
  },
  {
    id: "5",
    type: "purchase",
    title: "구매 클릭",
    subtitle: "네이버 쇼핑 외부 링크",
    timestamp: new Date("2025-05-18T16:45:00"),
    metadata: { provider: "네이버 쇼핑", productName: "캠핑 체어" },
  },
  {
    id: "6",
    type: "consultation",
    title: "상담 신청",
    subtitle: "모래재캠핑장 전화 연결",
    timestamp: new Date("2025-05-18T11:20:00"),
    metadata: { storeName: "모래재캠핑장", phone: "010-xxxx-xxxx" },
  },
  {
    id: "7",
    type: "drop",
    title: "Drop 조회",
    subtitle: "친구에게 받은 맛집 추천",
    timestamp: new Date("2025-05-17T20:15:00"),
    metadata: { dropId: "drop_789", senderName: "김철수" },
  },
  {
    id: "8",
    type: "coupon",
    title: "쿠폰 사용",
    subtitle: "스타벅스 아메리카노 1+1",
    timestamp: new Date("2025-05-17T14:30:00"),
    metadata: { couponId: "cpn_012", usedAt: "스타벅스 강남점" },
  },
];

type PeriodFilter = "today" | "week" | "month" | "all";
type CategoryFilter = "all" | "drop" | "coupon" | "reservation" | "purchase" | "consultation" | "login";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  today: "오늘",
  week: "지난 주",
  month: "지난 달",
  all: "전체",
};

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "전체",
  drop: "Drop",
  coupon: "쿠폰",
  reservation: "예약",
  purchase: "구매",
  consultation: "상담",
  login: "로그인",
};

const TYPE_COLORS: Record<ActivityItem["type"], string> = {
  drop: "#0A0A0A",
  coupon: "#D97706",
  reservation: "#22C55E",
  purchase: "#DB2777",
  consultation: "#6366F1",
  login: "#A3A3A3",
};

const TYPE_ICONS: Record<ActivityItem["type"], React.ElementType> = {
  drop: Sparkles,
  coupon: Ticket,
  reservation: Calendar,
  purchase: ShoppingBag,
  consultation: MessageSquare,
  login: LogIn,
};

// Helper functions
function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return formatDate(date);
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

interface ActivityHistoryPageProps {
  onBack?: () => void;
}

export function ActivityHistoryPage({ onBack }: ActivityHistoryPageProps) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  // Filter activities
  const filteredActivities = MOCK_ACTIVITIES.filter((activity) => {
    // Category filter
    if (categoryFilter !== "all" && activity.type !== categoryFilter) {
      return false;
    }

    // Period filter
    const now = new Date();
    const activityDate = activity.timestamp;
    
    if (periodFilter === "today") {
      return isSameDay(activityDate, now);
    } else if (periodFilter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return activityDate >= weekAgo;
    } else if (periodFilter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return activityDate >= monthAgo;
    }
    
    return true;
  });

  // Group by date
  const groupedActivities: { date: Date; activities: ActivityItem[] }[] = [];
  filteredActivities.forEach((activity) => {
    const existingGroup = groupedActivities.find((g) =>
      isSameDay(g.date, activity.timestamp)
    );
    if (existingGroup) {
      existingGroup.activities.push(activity);
    } else {
      groupedActivities.push({
        date: activity.timestamp,
        activities: [activity],
      });
    }
  });

  const handleDownload = () => {
    const dataStr = JSON.stringify(filteredActivities, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkdrop-activity.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5]"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-base font-semibold text-[#0A0A0A]">활동 내역</h1>
        <button
          onClick={handleDownload}
          className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5]"
        >
          <Download className="h-4 w-4" />
          JSON
        </button>
      </header>

      {/* Filters */}
      <div className="border-b border-[#F5F5F5] bg-white px-4 py-3">
        {/* Period filter */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((period) => (
            <button
              key={period}
              onClick={() => setPeriodFilter(period)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                periodFilter === period
                  ? "bg-[#0A0A0A] text-white"
                  : "bg-[#F5F5F5] text-[#A3A3A3] hover:bg-[#E5E5E5]"
              }`}
            >
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((category) => (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                categoryFilter === category
                  ? "bg-[#0A0A0A] text-white"
                  : "bg-white text-[#A3A3A3] border border-[#E5E5E5] hover:border-[#D4D4D4]"
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 px-4 py-4">
        {groupedActivities.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F5F5]">
              <Sparkles className="h-8 w-8 text-[#A3A3A3]" />
            </div>
            <p className="text-base font-medium text-[#A3A3A3]">활동 내역이 없어요</p>
            <p className="mt-1 text-sm text-[#A3A3A3]">
              Drop을 만들거나 받으면 여기에 표시돼요
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedActivities.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date header (sticky) */}
                <div className="sticky top-14 z-10 -mx-4 bg-[#FAFAFA] px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#A3A3A3]">
                    {formatDate(group.date)}
                  </p>
                </div>

                {/* Activity cards */}
                <div className="space-y-2">
                  {group.activities.map((activity) => {
                    const Icon = TYPE_ICONS[activity.type];
                    const color = TYPE_COLORS[activity.type];

                    return (
                      <Card
                        key={activity.id}
                        className="cursor-pointer border-[#F5F5F5] bg-white p-4 shadow-subtle transition-all hover:shadow-elevated"
                        onClick={() => setSelectedActivity(activity)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${color}15` }}
                          >
                            <Icon className="h-5 w-5" style={{ color }} />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#0A0A0A]">
                              {activity.title}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-[#A3A3A3]">
                              {activity.subtitle}
                            </p>
                            <p className="mt-1 text-xs text-[#A3A3A3]">
                              {formatTime(activity.timestamp)} · {getRelativeTime(activity.timestamp)}
                            </p>
                          </div>

                          {/* Arrow */}
                          <ChevronRight className="h-5 w-5 shrink-0 text-[#D4D4D4]" />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setSelectedActivity(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[#F5F5F5] px-4 py-4">
              <h2 className="text-lg font-semibold text-[#0A0A0A]">활동 상세</h2>
              <button
                onClick={() => setSelectedActivity(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#A3A3A3] hover:bg-[#F5F5F5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal content */}
            <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
              {/* Activity summary */}
              <div className="mb-4 flex items-start gap-3">
                {(() => {
                  const Icon = TYPE_ICONS[selectedActivity.type];
                  const color = TYPE_COLORS[selectedActivity.type];
                  return (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="h-6 w-6" style={{ color }} />
                    </div>
                  );
                })()}
                <div>
                  <p className="text-base font-semibold text-[#0A0A0A]">
                    {selectedActivity.title}
                  </p>
                  <p className="text-sm text-[#A3A3A3]">{selectedActivity.subtitle}</p>
                  <p className="mt-1 text-xs text-[#A3A3A3]">
                    {formatDate(selectedActivity.timestamp)} {formatTime(selectedActivity.timestamp)}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              {selectedActivity.metadata && (
                <div className="rounded-xl border border-[#F5F5F5] bg-[#FAFAFA] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A3A3A3]">
                    상세 정보
                  </p>
                  <div className="space-y-2">
                    {Object.entries(selectedActivity.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-4">
                        <span className="text-sm text-[#A3A3A3]">{key}</span>
                        <span className="text-right text-sm font-medium text-[#0A0A0A]">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Device info for login */}
              {selectedActivity.type === "login" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-[#F5F5F5] bg-white p-3">
                    <Smartphone className="h-5 w-5 text-[#A3A3A3]" />
                    <div>
                      <p className="text-sm font-medium text-[#0A0A0A]">기기</p>
                      <p className="text-xs text-[#A3A3A3]">
                        {(selectedActivity.metadata?.device as string) || "알 수 없음"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-[#F5F5F5] bg-white p-3">
                    <MapPin className="h-5 w-5 text-[#A3A3A3]" />
                    <div>
                      <p className="text-sm font-medium text-[#0A0A0A]">위치</p>
                      <p className="text-xs text-[#A3A3A3]">
                        {(selectedActivity.metadata?.location as string) || "알 수 없음"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* JSON preview */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-[#0A0A0A]">
                  원시 데이터 보기
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[#0A0A0A] p-3 text-xs text-[#E5E5E5]">
                  {JSON.stringify(selectedActivity, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Demo export
export function ActivityHistoryPageDemo() {
  return <ActivityHistoryPage />;
}
