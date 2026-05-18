import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Bell, Home, Compass, Plus, Inbox, User } from "lucide-react";
import { DropFeedCard, DropFeedCardSkeleton, type DropFeedCardProps } from "./drop-feed-card";

// Types
export interface DropFeedItem {
  shareUuid: string;
  maker: { name: string; avatarUrl?: string; droppedAgo: string };
  videoThumbnailUrl: string;
  videoSourceLabel: "YouTube" | "Instagram";
  videoDurationSec: number;
  intent: DropFeedCardProps["intent"];
  title: string;
  localName?: string;
  distance?: string;
  receivedByCount?: number;
  remainingCoupons?: number;
  creator?: { channelName: string; channelUrl: string };
}

export interface HomePageProps {
  user: { name: string; avatarUrl?: string };
  category: "discover" | "sent" | "saved";
  drops: DropFeedItem[];
  unreadCount?: number;
  onCategoryChange: (cat: string) => void;
  onDropClick: (shareUuid: string) => void;
  onCreateDrop: () => void;
  onTabChange: (tab: string) => void;
}

type Category = HomePageProps["category"];

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "discover", label: "탐색" },
  { key: "sent", label: "내가 보낸" },
  { key: "saved", label: "저장됨" },
];

function emptyCopyFor(category: Category): string {
  switch (category) {
    case "discover":
      return "아직 공개된 드롭이 없어요";
    case "sent":
      return "아직 보낸 드롭이 없어요. 첫 드롭을 만들어 보세요";
    case "saved":
      return "저장 기능은 곧 만나요";
  }
}

// Main Component
export function HomePage({
  user,
  category,
  drops,
  unreadCount = 0,
  onCategoryChange,
  onDropClick,
  onCreateDrop,
  onTabChange,
}: HomePageProps) {
  return (
    <div className="relative min-h-screen bg-white pb-14">
      {/* A. Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
        <span className="text-xl font-bold tracking-tight text-[#0A0A0A]">LinkDrop</span>
        <div className="flex items-center gap-1">
          <button
            className="flex h-8 w-8 items-center justify-center rounded text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5]"
            onClick={() => console.log("[HomePage] Search clicked")}
            aria-label="검색"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5]"
            onClick={() => console.log("[HomePage] Notifications clicked")}
            aria-label="알림"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#2563EB]" />
            )}
          </button>
        </div>
      </header>

      {/* B. Category Tabs */}
      <div className="sticky top-14 z-10 h-12 bg-white">
        <div className="flex h-full snap-x snap-mandatory overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                console.log("[HomePage] Category changed:", cat.key);
                onCategoryChange(cat.key);
              }}
              className={`flex h-full shrink-0 snap-start items-center px-4 text-sm transition-colors duration-150 ${
                category === cat.key
                  ? "border-b-2 border-[#2563EB] font-semibold text-[#0A0A0A]"
                  : "text-[#525252] hover:text-[#0A0A0A]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#F5F5F5]" />
      </div>

      {/* C. Main Feed */}
      <main className="mx-auto max-w-md space-y-3 px-4 py-4">
        {drops.length > 0 ? (
          drops.map((drop) => (
            <DropFeedCard
              key={drop.shareUuid}
              {...drop}
              onClick={() => onDropClick(drop.shareUuid)}
              onCtaClick={() => onDropClick(drop.shareUuid)}
            />
          ))
        ) : (
          /* D. Empty State */
          <div className="mt-24 flex flex-col items-center justify-center">
            <Inbox className="h-12 w-12 text-[#A3A3A3]" />
            <p className="mt-4 text-sm text-[#525252]">{emptyCopyFor(category)}</p>
          </div>
        )}
      </main>

      {/* E. Floating CTA */}
      <button
        onClick={() => {
          console.log("[HomePage] Create drop clicked");
          onCreateDrop();
        }}
        className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white transition-all duration-150 ease-out hover:scale-105 hover:bg-[#1D4ED8] active:scale-95"
        style={{ boxShadow: "0 8px 24px rgba(37, 99, 235, 0.35)" }}
        aria-label="드롭 만들기"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* F. Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-14 items-center border-t border-[#F5F5F5] bg-white px-2">
        <TabButton
          icon={<Home className="h-5 w-5" />}
          label="홈"
          isActive={true}
          onClick={() => onTabChange("home")}
        />
        <TabButton
          icon={<Compass className="h-5 w-5" />}
          label="탐색"
          isActive={false}
          onClick={() => onTabChange("explore")}
        />
        <TabButton
          icon={<Plus className="h-5 w-5" />}
          label="만들기"
          isActive={false}
          onClick={() => onCreateDrop()}
        />
        <TabButton
          icon={<Inbox className="h-5 w-5" />}
          label="받은함"
          isActive={false}
          hasNotification={unreadCount > 0}
          onClick={() => onTabChange("inbox")}
        />
        <TabButton
          icon={<User className="h-5 w-5" />}
          label="나"
          isActive={false}
          onClick={() => onTabChange("profile")}
        />
      </nav>
    </div>
  );
}

// Tab Button Component
function TabButton({
  icon,
  label,
  isActive,
  hasNotification,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  hasNotification?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => {
        console.log("[HomePage] Tab clicked:", label);
        onClick();
      }}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
        isActive ? "text-[#2563EB]" : "text-[#A3A3A3]"
      }`}
    >
      <div className="relative">
        {icon}
        {hasNotification && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#2563EB]" />
        )}
      </div>
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

// Skeleton Variant
export function HomePageSkeleton() {
  return (
    <div className="relative min-h-screen bg-white pb-14">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
        <div className="h-6 w-24 animate-pulse rounded bg-[#E5E5E5]" />
        <div className="flex gap-1">
          <div className="h-8 w-8 animate-pulse rounded bg-[#E5E5E5]" />
          <div className="h-8 w-8 animate-pulse rounded bg-[#E5E5E5]" />
        </div>
      </header>

      {/* Category Tabs */}
      <div className="sticky top-14 z-10 h-12 bg-white">
        <div className="flex h-full overflow-x-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex h-full shrink-0 items-center px-4">
              <div className="h-4 w-16 animate-pulse rounded bg-[#E5E5E5]" />
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#F5F5F5]" />
      </div>

      {/* Feed Skeletons */}
      <main className="mx-auto max-w-md space-y-3 px-4 py-4">
        <DropFeedCardSkeleton />
        <DropFeedCardSkeleton />
        <DropFeedCardSkeleton />
      </main>

      {/* Floating CTA */}
      <div className="fixed bottom-20 right-4 z-20 h-14 w-14 animate-pulse rounded-full bg-[#E5E5E5]" />

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-14 items-center border-t border-[#F5F5F5] bg-white px-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <div className="h-5 w-5 animate-pulse rounded bg-[#E5E5E5]" />
            <div className="h-2.5 w-6 animate-pulse rounded bg-[#E5E5E5]" />
          </div>
        ))}
      </nav>
    </div>
  );
}

// Demo data
const DEMO_DROPS: DropFeedItem[] = [
  {
    shareUuid: "drop-001",
    maker: {
      name: "지민",
      avatarUrl: "https://picsum.photos/seed/maker1/100",
      droppedAgo: "2시간 전",
    },
    videoThumbnailUrl: "https://picsum.photos/seed/cafe1/800/450",
    videoSourceLabel: "YouTube",
    videoDurationSec: 185,
    intent: "coupon",
    title: "성수동 숨은 루프탑 카페, 분위기 미쳤음",
    localName: "어반플랜트 성수",
    distance: "1.2km",
    remainingCoupons: 12,
    creator: { channelName: "카페탐방러", channelUrl: "https://youtube.com/@cafetour" },
  },
  {
    shareUuid: "drop-002",
    maker: {
      name: "수현",
      avatarUrl: "https://picsum.photos/seed/maker2/100",
      droppedAgo: "5시간 전",
    },
    videoThumbnailUrl: "https://picsum.photos/seed/camp1/800/450",
    videoSourceLabel: "YouTube",
    videoDurationSec: 420,
    intent: "reservation",
    title: "가평 프라이빗 글램핑장 솔직 후기",
    localName: "숲속애글램핑",
    distance: "45km",
    receivedByCount: 28,
    creator: { channelName: "캠핑브이로그", channelUrl: "https://youtube.com/@campvlog" },
  },
  {
    shareUuid: "drop-003",
    maker: {
      name: "현우",
      avatarUrl: "https://picsum.photos/seed/maker3/100",
      droppedAgo: "어제",
    },
    videoThumbnailUrl: "https://picsum.photos/seed/art1/800/450",
    videoSourceLabel: "Instagram",
    videoDurationSec: 62,
    intent: "info",
    title: "teamLab 전시 꼭 가봐야 하는 이유",
    localName: "teamLab Seoul",
    distance: "3.5km",
    receivedByCount: 156,
    creator: { channelName: "전시덕후", channelUrl: "https://instagram.com/exhibition_lover" },
  },
];

// Export demo variants
export function HomePageDemo() {
  return (
    <HomePage
      user={{ name: "나", avatarUrl: "https://picsum.photos/seed/me/100" }}
      category="discover"
      drops={DEMO_DROPS}
      unreadCount={3}
      onCategoryChange={(cat) => console.log("[Demo] Category:", cat)}
      onDropClick={(id) => console.log("[Demo] Drop clicked:", id)}
      onCreateDrop={() => console.log("[Demo] Create drop")}
      onTabChange={(tab) => console.log("[Demo] Tab:", tab)}
    />
  );
}

export function HomePageEmptyDemo() {
  return (
    <HomePage
      user={{ name: "나", avatarUrl: "https://picsum.photos/seed/me/100" }}
      category="discover"
      drops={[]}
      unreadCount={0}
      onCategoryChange={(cat) => console.log("[Demo] Category:", cat)}
      onDropClick={(id) => console.log("[Demo] Drop clicked:", id)}
      onCreateDrop={() => console.log("[Demo] Create drop")}
      onTabChange={(tab) => console.log("[Demo] Tab:", tab)}
    />
  );
}
