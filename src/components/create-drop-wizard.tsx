import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
  Info,
  MessageCircle,
  Gift,
  Calendar,
  ShoppingBag,
  Ticket,
  Send,
  Megaphone,
  Settings,
  Search,
  MapPin,
  Check,
  Play,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Share2,
  ExternalLink,
  Smile,
  ArrowRight,
  Clipboard,
  Sparkles,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export type Intent =
  | "info"
  | "discussion"
  | "meme"
  | "coupon"
  | "reservation"
  | "commerce"
  | "ticket"
  | "lead"
  | "campaign"
  | "custom";

export type IntentCategory = "share" | "benefit" | "purchase" | "participate" | "free";

export interface VideoInfo {
  url: string;
  thumbnailUrl: string;
  title: string;
  channelName: string;
  duration: string;
  platform: "youtube" | "instagram";
}

export interface LocalPartner {
  id: string;
  name: string;
  category: string;
  distance: string;
  avatarUrl: string;
}

export interface DropCardData {
  title: string;
  description: string;
  makerMessage: string;
  timeLink: { start: string; end: string } | null;
  couponCode?: string;
  couponExpiry?: string;
  couponDiscount?: string;
}

export interface CreateDropWizardProps {
  variant?: "default" | "skeleton";
  onClose?: () => void;
  onComplete?: (data: {
    video: VideoInfo;
    intent: Intent;
    local?: LocalPartner;
    card: DropCardData;
  }) => void;
}

// =============================================================================
// Intent Config
// =============================================================================

interface IntentConfig {
  id: Intent;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresPartner: boolean;
  category: IntentCategory;
  friendAction: string;
  exampleMessage: string;
}

const INTENTS: IntentConfig[] = [
  // Share category
  {
    id: "info",
    label: "정보",
    description: "유용한 정보 공유",
    icon: Info,
    requiresPartner: false,
    category: "share",
    friendAction: "정보 확인 → 가볼까 생각",
    exampleMessage: "이 카페 좋아 보여, 가봐",
  },
  {
    id: "discussion",
    label: "대화",
    description: "의견 나누기",
    icon: MessageCircle,
    requiresPartner: false,
    category: "share",
    friendAction: "의견 남기기 → 대화",
    exampleMessage: "이거 어떻게 생각해?",
  },
  {
    id: "meme",
    label: "밈",
    description: "재미있는 거 공유",
    icon: Smile,
    requiresPartner: false,
    category: "share",
    friendAction: "웃음 → 친구에게 또 보내기",
    exampleMessage: "ㅋㅋㅋ 이거 봤어?",
  },
  // Benefit category
  {
    id: "coupon",
    label: "쿠폰",
    description: "할인 쿠폰 전달",
    icon: Gift,
    requiresPartner: true,
    category: "benefit",
    friendAction: "쿠폰 받음 → 매장 사용",
    exampleMessage: "이 카페 쿠폰 받아가",
  },
  {
    id: "reservation",
    label: "예약",
    description: "예약 연결",
    icon: Calendar,
    requiresPartner: true,
    category: "benefit",
    friendAction: "예약 → 매장 방문",
    exampleMessage: "여기 예약해봐",
  },
  // Purchase category
  {
    id: "commerce",
    label: "상품",
    description: "상품 구매 연결",
    icon: ShoppingBag,
    requiresPartner: true,
    category: "purchase",
    friendAction: "구매 → 배송",
    exampleMessage: "이거 진짜 좋아",
  },
  {
    id: "ticket",
    label: "티켓",
    description: "티켓 예매",
    icon: Ticket,
    requiresPartner: true,
    category: "purchase",
    friendAction: "예매 → 입장",
    exampleMessage: "같이 가자",
  },
  // Participate category
  {
    id: "lead",
    label: "신청",
    description: "신청 폼 연결",
    icon: Send,
    requiresPartner: false,
    category: "participate",
    friendAction: "관심 등록 → 안내",
    exampleMessage: "이거 신청해봐",
  },
  {
    id: "campaign",
    label: "캠페인",
    description: "캠페인 참여",
    icon: Megaphone,
    requiresPartner: false,
    category: "participate",
    friendAction: "캠페인 참여 → 응원",
    exampleMessage: "좋은 캠페인이야",
  },
  // Free category
  {
    id: "custom",
    label: "커스텀",
    description: "직접 설정",
    icon: Settings,
    requiresPartner: false,
    category: "free",
    friendAction: "Maker가 정의한 액션",
    exampleMessage: "내가 직접 설정할게",
  },
];

const CATEGORY_CONFIG: Record<IntentCategory, { label: string; subtitle: string; color: string }> =
  {
    share: { label: "공유", subtitle: "정보·의견을 나누기", color: "#525252" },
    benefit: { label: "혜택", subtitle: "쿠폰·예약을 연결하기", color: "#2563EB" },
    purchase: { label: "구매", subtitle: "상품·티켓을 연결하기", color: "#0A0A0A" },
    participate: { label: "참여", subtitle: "신청·캠페인에 참여시키기", color: "#10B981" },
    free: { label: "자유", subtitle: "목적을 직접 정하기", color: "#A3A3A3" },
  };

// =============================================================================
// Mock Data
// =============================================================================

const MOCK_LOCALS: LocalPartner[] = [
  {
    id: "1",
    name: "카페 온도",
    category: "카페 · 브런치",
    distance: "도보 5분",
    avatarUrl: "https://picsum.photos/seed/cafe1/64/64",
  },
  {
    id: "2",
    name: "스시 오마카세 히든",
    category: "일식 · 오마카세",
    distance: "도보 12분",
    avatarUrl: "https://picsum.photos/seed/sushi1/64/64",
  },
  {
    id: "3",
    name: "솔캠핑 파크",
    category: "캠핑 · 글램핑",
    distance: "차량 25분",
    avatarUrl: "https://picsum.photos/seed/camp1/64/64",
  },
];

// =============================================================================
// Step Components
// =============================================================================

function StepIndicator({ current, total }: { current: number; total: number }) {
  const progress = (current / total) * 100;
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#F5F5F5]">
      <div
        className="h-full bg-[#2563EB] transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// Step 1: URL Input
function Step1UrlInput({
  value,
  onChange,
  status,
  videoInfo,
}: {
  value: string;
  onChange: (v: string) => void;
  status: "idle" | "loading" | "success" | "error";
  videoInfo: VideoInfo | null;
}) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch (err) {
      console.log("[Step1] Clipboard paste failed:", err);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-5 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          영상 링크를 붙여넣어 주세요
        </h1>
        <p className="mt-2 text-sm text-[#525252]">YouTube 또는 Instagram 링크를 받을 수 있어요</p>

        {/* URL Input */}
        <div className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A3A3A3]" />
            <Input
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://youtu.be/..."
              className="h-14 rounded-lg border-[#E5E5E5] pl-12 pr-10 font-mono text-sm placeholder:font-sans placeholder:text-[#A3A3A3] focus:border-[#2563EB] focus:ring-[#2563EB]"
            />
            {value && (
              <button
                onClick={() => onChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#525252]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={handlePaste}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#E5E5E5] text-[#525252] transition-colors hover:bg-[#F5F5F5]"
            aria-label="붙여넣기"
          >
            <Clipboard className="h-5 w-5" />
          </button>
        </div>

        {/* Hint Card (idle state) */}
        {status === "idle" && !value && (
          <div className="mt-4 rounded-lg border border-[#F5F5F5] bg-[#FAFAFA] p-4">
            <p className="text-sm text-[#525252]">
              친구에게 보여주고 싶은 영상의 링크를 복사해서 붙여넣어 주세요. YouTube와 Instagram
              Reels를 지원해요.
            </p>
          </div>
        )}

        {/* Status */}
        <div className="mt-4">
          {status === "loading" && (
            <div className="flex items-center gap-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-4">
              <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
              <span className="text-sm text-[#525252]">영상을 분석하고 있어요...</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4">
              <AlertCircle className="h-5 w-5 text-[#EF4444]" />
              <span className="text-sm text-[#EF4444]">URL을 다시 확인해 주세요</span>
            </div>
          )}

          {status === "success" && videoInfo && (
            <div className="flex gap-3 rounded-lg border border-[#E5E5E5] bg-white p-3">
              <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5]">
                <img src={videoInfo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                  {videoInfo.duration}
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-center gap-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-[#0A0A0A]">
                  {videoInfo.title}
                </p>
                <p className="text-xs text-[#525252]">{videoInfo.channelName}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Step 2: Intent Selection (3-Layer Discovery)
function Step2IntentSelect({
  selected,
  onSelect,
  friendName,
  videoCategory,
  recommendedIntents,
  videoInfo,
}: {
  selected: Intent | null;
  onSelect: (i: Intent) => void;
  friendName?: string;
  videoCategory?: string;
  recommendedIntents?: Intent[];
  videoInfo?: VideoInfo | null;
}) {
  const [showAllCategories, setShowAllCategories] = useState(
    !recommendedIntents || recommendedIntents.length === 0,
  );
  const selectedIntent = INTENTS.find((i) => i.id === selected);

  // Get recommended intent configs
  const recommendedConfigs = recommendedIntents
    ? INTENTS.filter((i) => recommendedIntents.includes(i.id)).slice(0, 2)
    : [];

  // Group intents by category
  const intentsByCategory = INTENTS.reduce(
    (acc, intent) => {
      if (!acc[intent.category]) acc[intent.category] = [];
      acc[intent.category].push(intent);
      return acc;
    },
    {} as Record<IntentCategory, IntentConfig[]>,
  );

  const categoryOrder: IntentCategory[] = ["share", "benefit", "purchase", "participate", "free"];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
        {/* Header */}
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">이런 정보를 발견했어요</h1>
        <p className="mt-1 text-sm text-[#525252]">어떤 목적으로 보내시겠어요?</p>

        {/* Extracted Info Cards */}
        {videoInfo && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {/* Location Card */}
            <div className="group rounded-lg border border-[#E5E5E5] p-4 transition-colors hover:border-[#D4D4D4]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFF6FF]">
                <MapPin className="h-4 w-4 text-[#2563EB]" />
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[#A3A3A3]">
                장소
              </p>
              <p className="mt-1 text-base font-medium text-[#0A0A0A]">성수동 카페</p>
            </div>
            {/* Category Card */}
            <div className="group rounded-lg border border-[#E5E5E5] p-4 transition-colors hover:border-[#D4D4D4]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFF6FF]">
                <ShoppingBag className="h-4 w-4 text-[#2563EB]" />
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[#A3A3A3]">
                카테고리
              </p>
              <p className="mt-1 text-base font-medium text-[#0A0A0A]">카페 · 브런치</p>
            </div>
          </div>
        )}

        {/* Layer 1: Recommended Cards (if available) */}
        {recommendedConfigs.length > 0 && !showAllCategories && (
          <div className="mt-6 space-y-4">
            {recommendedConfigs.map((intent, index) => {
              const Icon = intent.icon;
              const isSelected = selected === intent.id;
              return (
                <button
                  key={intent.id}
                  onClick={() => onSelect(intent.id)}
                  className={`relative w-full cursor-pointer rounded-xl border-2 p-6 text-left transition-all duration-150 ease-out active:scale-[0.99] ${
                    isSelected
                      ? "border-[#2563EB] bg-[#EFF6FF] shadow-md"
                      : "border-[#E5E5E5] bg-white hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:shadow-md"
                  }`}
                >
                  {/* AI 추천 badge */}
                  {index === 0 && (
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[#2563EB]">
                      <Sparkles className="h-3 w-3" />
                      AI 추천
                    </span>
                  )}

                  {/* Icon + Label */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                        isSelected ? "bg-[#2563EB]" : "bg-[#EFF6FF]"
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${isSelected ? "text-white" : "text-[#2563EB]"}`} />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-lg font-semibold ${isSelected ? "text-[#2563EB]" : "text-[#0A0A0A]"}`}
                        >
                          {intent.label}로 보내기
                        </span>
                        {intent.requiresPartner && (
                          <span className="rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10px] font-medium text-[#525252]">
                            매장 연결
                          </span>
                        )}
                      </div>
                      {/* Example message */}
                      <p className="mt-1.5 text-sm italic text-[#525252]">
                        &quot;{intent.exampleMessage}&quot;
                      </p>
                      {/* Friend action flow */}
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-[#A3A3A3]">
                        <span>친구가</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{intent.friendAction}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom-right arrow */}
                  <ArrowRight
                    className={`absolute bottom-4 right-4 h-5 w-5 ${isSelected ? "text-[#2563EB]" : "text-[#A3A3A3]"}`}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Toggle: Show all categories */}
        {recommendedConfigs.length > 0 && (
          <button
            onClick={() => setShowAllCategories(!showAllCategories)}
            className="mt-6 flex w-full items-center justify-center gap-1.5 py-3 text-sm text-[#525252] transition-colors hover:text-[#0A0A0A]"
          >
            <span>{showAllCategories ? "추천만 보기" : "다른 목적으로 보내기"}</span>
            {showAllCategories ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Layer 2: All Intents Grid (expanded) */}
        {showAllCategories && (
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium text-[#0A0A0A]">정확한 목적을 골라주세요</p>
            <div className="grid grid-cols-2 gap-3">
              {INTENTS.map((intent) => {
                const Icon = intent.icon;
                const isSelected = selected === intent.id;
                return (
                  <button
                    key={intent.id}
                    onClick={() => onSelect(intent.id)}
                    className={`relative flex aspect-square flex-col items-start justify-between rounded-lg border p-4 text-left transition-all duration-150 ease-out ${
                      isSelected
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-[#E5E5E5] bg-white hover:border-[#2563EB] hover:bg-[#EFF6FF]"
                    }`}
                  >
                    {/* Checkmark when selected */}
                    {isSelected && (
                      <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB]">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Icon */}
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isSelected ? "bg-[#2563EB]" : "bg-[#EFF6FF]"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? "text-white" : "text-[#2563EB]"}`} />
                    </div>

                    {/* Label + Description */}
                    <div>
                      <p
                        className={`text-lg font-bold ${isSelected ? "text-[#2563EB]" : "text-[#0A0A0A]"}`}
                      >
                        {intent.label}
                      </p>
                      <p className="mt-1 text-xs text-[#525252]">{intent.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Layer 3: Compact Grid (always visible at bottom) */}
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#A3A3A3]">
            모든 목적 보기
          </p>
          <div className="grid grid-cols-3 gap-2">
            {INTENTS.map((intent) => {
              const Icon = intent.icon;
              const isSelected = selected === intent.id;
              return (
                <button
                  key={intent.id}
                  onClick={() => onSelect(intent.id)}
                  className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border p-3 transition-all duration-150 ease-out ${
                    isSelected
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                      : "border-[#E5E5E5] bg-white text-[#525252] hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{intent.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview card (when intent selected) */}
        {selectedIntent && videoInfo && (
          <div className="mt-6 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#A3A3A3]">
              친구가 받을 카드
            </p>
            <div className="mt-3 flex gap-3">
              {/* Mini thumbnail */}
              <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#E5E5E5]">
                <img src={videoInfo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                {/* Intent badge */}
                <span className="inline-flex w-fit rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[#2563EB]">
                  {selectedIntent.label}
                </span>
                {/* Title */}
                <p className="line-clamp-1 text-sm font-medium text-[#0A0A0A]">{videoInfo.title}</p>
                {/* CTA preview */}
                <span className="text-xs text-[#525252]">
                  {selectedIntent.id === "coupon" && "받기"}
                  {selectedIntent.id === "reservation" && "예약"}
                  {selectedIntent.id === "commerce" && "구매"}
                  {selectedIntent.id === "ticket" && "예매"}
                  {selectedIntent.id === "lead" && "신청"}
                  {(selectedIntent.id === "info" ||
                    selectedIntent.id === "discussion" ||
                    selectedIntent.id === "meme" ||
                    selectedIntent.id === "campaign" ||
                    selectedIntent.id === "custom") &&
                    "보기"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Step 3: Local Partner Selection
function Step3LocalSelect({
  searchQuery,
  onSearchChange,
  locals,
  selected,
  onSelect,
  onNext,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  locals: LocalPartner[];
  selected: LocalPartner | null;
  onSelect: (l: LocalPartner | null) => void;
  onNext: () => void;
}) {
  const filtered = locals.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          어떤 매장과 연결할까요?
        </h1>
        <p className="mt-2 text-sm text-[#525252]">쿠폰/예약 드롭은 매장 등록이 필요해요</p>

        {/* Search */}
        <div className="relative mt-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A3A3A3]" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="매장 이름 검색"
            className="h-12 rounded-xl border-[#E5E5E5] pl-12 text-sm placeholder:text-[#A3A3A3] focus:border-[#2563EB] focus:ring-[#2563EB]"
          />
        </div>

        {/* Selected */}
        {selected && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#2563EB] bg-[#EFF6FF] p-3">
            <img src={selected.avatarUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#0A0A0A]">{selected.name}</p>
              <p className="text-xs text-[#525252]">{selected.category}</p>
            </div>
            <button onClick={() => onSelect(null)} className="text-xs font-medium text-[#2563EB]">
              변경
            </button>
          </div>
        )}

        {/* Results */}
        {!selected && (
          <div className="mt-4 space-y-2">
            {filtered.map((local) => (
              <div
                key={local.id}
                className="flex items-center gap-3 rounded-xl border border-[#E5E5E5] bg-white p-3"
              >
                <img src={local.avatarUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#0A0A0A]">{local.name}</p>
                  <div className="flex items-center gap-1 text-xs text-[#525252]">
                    <span>{local.category}</span>
                    <span>·</span>
                    <MapPin className="h-3 w-3" />
                    <span>{local.distance}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelect(local)}
                  className="h-8 rounded-lg border-[#2563EB] text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF]"
                >
                  선택
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* New Partner Link (disabled for now) */}
        <button disabled className="mt-4 flex items-center gap-1 text-sm text-[#A3A3A3]">
          <span>새 매장 등록하기</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Action */}
      <div className="p-5">
        <Button
          onClick={onNext}
          disabled={!selected}
          className="h-12 w-full rounded-xl bg-[#2563EB] text-base font-semibold text-white hover:bg-[#1D4ED8] disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
        >
          다음
        </Button>
      </div>
    </div>
  );
}

// Step 4: Card Preview (카드 미리보기)
function Step4Preview({
  videoInfo,
  intent,
  local,
  onEdit,
}: {
  videoInfo: VideoInfo;
  intent: Intent;
  local: LocalInfo | null;
  onEdit?: () => void;
}) {
  const intentConfig = INTENTS.find((i) => i.id === intent);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          어떻게 보일지 확인해 주세요
        </h1>
        <p className="mt-1 text-sm text-[#525252]">친구가 받을 카드예요</p>

        {/* Card Preview */}
        <div className="mt-6 overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
          {/* Video */}
          <div className="relative aspect-video w-full bg-[#F5F5F5]">
            <img src={videoInfo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95">
                <Play className="h-6 w-6 fill-[#0A0A0A] text-[#0A0A0A]" />
              </div>
            </div>
            <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
              {videoInfo.source}
            </span>
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs tabular-nums text-white">
              {videoInfo.duration}
            </span>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Intent badge */}
            <span className="inline-block rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-medium text-[#2563EB]">
              {intentConfig?.label}
            </span>

            {/* Title */}
            <h2 className="mt-2 text-lg font-semibold leading-snug text-[#0A0A0A]">
              {videoInfo.title}
            </h2>

            {/* Local info */}
            {local && (
              <div className="mt-3 flex items-center gap-2 text-sm text-[#525252]">
                <MapPin className="h-4 w-4 text-[#A3A3A3]" />
                <span>{local.name}</span>
              </div>
            )}

            {/* Creator */}
            <div className="mt-3 border-t border-[#F5F5F5] pt-3">
              <p className="text-xs text-[#A3A3A3]">원본: {videoInfo.channelName}</p>
            </div>
          </div>
        </div>

        {/* Edit button */}
        {onEdit && (
          <button
            onClick={onEdit}
            className="mt-4 w-full text-center text-sm text-[#525252] hover:text-[#0A0A0A]"
          >
            수정하기
          </button>
        )}
      </div>
    </div>
  );
}

// Step 5: Personal Message (친구에게 한마디)
function Step5Message({
  value,
  onChange,
  maxLength = 100,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-5 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          친구에게 메시지를 남겨주세요
        </h1>
        <p className="mt-1 text-sm text-[#525252]">카드와 함께 보낼 메시지를 적어주세요</p>

        {/* Textarea */}
        <div className="mt-6">
          <textarea
            value={value}
            onChange={(e) => {
              if (e.target.value.length <= maxLength) {
                onChange(e.target.value);
              }
            }}
            placeholder="예: 여기 진짜 좋더라. 너 좋아할 것 같아!"
            rows={5}
            className="w-full resize-none rounded-lg border border-[#E5E5E5] p-4 text-sm leading-relaxed placeholder:text-[#A3A3A3] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
          <p className="mt-2 text-right text-xs text-[#A3A3A3]">
            {value.length}/{maxLength}
          </p>
        </div>

        {/* Skip option */}
        <p className="mt-4 text-center text-xs text-[#A3A3A3]">
          건너뛰기를 누르면 메시지 없이 보낼 수 있어요
        </p>
      </div>
    </div>
  );
}

// Step 6: Share (카카오톡으로 보내기)
function Step6Share({
  onKakaoShare,
  onCopyLink,
  onComplete,
}: {
  onKakaoShare: () => void;
  onCopyLink: () => void;
  onComplete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-5">
        {/* Success Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#10B981]/10">
          <Check className="h-10 w-10 text-[#10B981]" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#0A0A0A]">준비 완료!</h1>
        <p className="mt-2 text-center text-sm text-[#525252]">이제 친구에게 공유해보세요</p>

        {/* Link Copy Option */}
        <div className="mt-8 w-full">
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border-[#E5E5E5] text-sm font-medium text-[#0A0A0A] hover:bg-[#F5F5F5]"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-[#10B981]" />
                복사됨!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                링크 복사하기
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Footer with Kakao button */}
      <footer className="sticky bottom-0 z-20 space-y-2 border-t border-[#F5F5F5] bg-white px-4 py-3">
        <Button
          onClick={onKakaoShare}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-sm font-medium text-white hover:bg-[#1D4ED8]"
        >
          <MessageCircle className="h-5 w-5" />
          카카오톡으로 보내기
        </Button>
        <button
          onClick={onComplete}
          className="h-10 w-full text-sm font-medium text-[#525252] hover:text-[#0A0A0A]"
        >
          홈으로 돌아가기
        </button>
      </footer>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CreateDropWizard({
  variant = "default",
  onClose,
  onComplete,
}: CreateDropWizardProps) {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [urlStatus, setUrlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [selectedLocal, setSelectedLocal] = useState<LocalPartner | null>(null);
  const [cardData, setCardData] = useState<DropCardData>({
    title: "",
    description: "",
    makerMessage: "",
    timeLink: null,
  });

  // Calculate total steps based on intent
  const intentConfig = INTENTS.find((i) => i.id === selectedIntent);
  const requiresPartner = intentConfig?.requiresPartner ?? false;
  const totalSteps = requiresPartner ? 6 : 5;

  // Simulate URL parsing
  useEffect(() => {
    if (!url) {
      setUrlStatus("idle");
      setVideoInfo(null);
      return;
    }

    const isValidUrl = url.includes("youtu") || url.includes("instagram");
    if (!isValidUrl) {
      setUrlStatus("error");
      return;
    }

    setUrlStatus("loading");
    const timer = setTimeout(() => {
      setUrlStatus("success");
      setVideoInfo({
        url,
        thumbnailUrl: "https://picsum.photos/seed/video1/640/360",
        title: "서울 성수동 힙한 카페 투어 | 요즘 핫한 브런치 맛집 5곳",
        channelName: "먹방여행 크리에이터",
        duration: "12:34",
        platform: "youtube",
      });
      setCardData((prev) => ({
        ...prev,
        title: "서울 성수동 힙한 카페 투어 | 요즘 핫한 브런치 맛집 5곳",
      }));
    }, 1500);

    return () => clearTimeout(timer);
  }, [url]);

  const handleBack = () => {
    if (step === 1) {
      onClose?.();
    } else if (step === 4 && !requiresPartner) {
      setStep(2);
    } else {
      setStep(step - 1);
    }
  };

  const handleNext = () => {
    if (step === 2 && !requiresPartner) {
      setStep(4);
    } else if (step === totalSteps) {
      // Complete
    } else {
      setStep(step + 1);
    }
  };

  const handleKakaoShare = () => {
    console.log("[CreateDropWizard] KakaoTalk share");
  };

  const handleCopyLink = () => {
    console.log("[CreateDropWizard] Copy link");
  };

  const handleComplete = () => {
    onComplete?.({
      video: videoInfo!,
      intent: selectedIntent!,
      local: selectedLocal || undefined,
      card: cardData,
    });
    onClose?.();
  };

  // Skeleton
  if (variant === "skeleton") {
    return (
      <div className="flex h-full min-h-screen flex-col bg-white">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </header>

        <div className="flex-1 px-5 pt-6">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="mt-2 h-4 w-64 rounded" />
          <Skeleton className="mt-6 h-14 w-full rounded-xl" />
          <Skeleton className="mt-6 h-24 w-full rounded-xl" />
        </div>

        <div className="p-5">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Map step to actual step number for display
  const displayStep = step <= 2 ? step : requiresPartner ? step : step - 1;
  const displayTotalSteps = requiresPartner ? 6 : 5;

  return (
    <div className="flex h-full min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
        <button
          onClick={() => {
            console.log("[CreateDropWizard] Cancel clicked");
            onClose?.();
          }}
          className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-[#F5F5F5]"
          aria-label="닫기"
        >
          <X className="h-5 w-5 text-[#0A0A0A]" />
        </button>

        <span className="text-base font-medium text-[#0A0A0A]">드롭 만들기</span>

        <span className="text-sm text-[#525252]">
          {displayStep}/{displayTotalSteps}
        </span>

        <StepIndicator current={displayStep} total={displayTotalSteps} />
      </header>

      {/* Step Content */}
      {step === 1 && (
        <Step1UrlInput value={url} onChange={setUrl} status={urlStatus} videoInfo={videoInfo} />
      )}

      {step === 2 && (
        <Step2IntentSelect
          selected={selectedIntent}
          onSelect={setSelectedIntent}
          videoInfo={videoInfo}
          recommendedIntents={["info", "coupon"]}
        />
      )}

      {step === 3 && requiresPartner && (
        <Step3LocalSelect
          searchQuery={localSearchQuery}
          onSearchChange={setLocalSearchQuery}
          locals={MOCK_LOCALS}
          selected={selectedLocal}
          onSelect={setSelectedLocal}
          onNext={handleNext}
        />
      )}

      {step === 4 && videoInfo && selectedIntent && (
        <Step4Preview
          videoInfo={videoInfo}
          intent={selectedIntent}
          local={selectedLocal}
          onEdit={() => setStep(2)}
        />
      )}

      {step === 5 && (
        <Step5Message
          value={cardData.makerMessage}
          onChange={(v) => setCardData((prev) => ({ ...prev, makerMessage: v }))}
          maxLength={100}
        />
      )}

      {step === 6 && (
        <Step6Share
          onKakaoShare={handleKakaoShare}
          onCopyLink={handleCopyLink}
          onComplete={handleComplete}
        />
      )}

      {/* Footer - Navigation buttons (except Step 6) */}
      {step !== 6 && (
        <footer className="sticky bottom-0 z-20 flex h-16 items-center justify-between border-t border-[#F5F5F5] bg-white px-4">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="h-10 rounded-lg px-4 text-sm font-medium text-[#525252] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          {step === 5 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleNext}
                className="h-10 rounded-lg px-4 text-sm font-medium text-[#525252] transition-colors hover:bg-[#F5F5F5]"
              >
                건너뛰기
              </button>
              <button
                onClick={handleNext}
                disabled={!cardData.makerMessage}
                className="h-10 rounded-lg bg-[#2563EB] px-6 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
              >
                다음
              </button>
            </div>
          ) : (
            <button
              onClick={handleNext}
              disabled={
                (step === 1 && urlStatus !== "success") ||
                (step === 2 && !selectedIntent) ||
                (step === 3 && requiresPartner && !selectedLocal)
              }
              className="h-10 rounded-lg bg-[#2563EB] px-6 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
            >
              다음
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default CreateDropWizard;
