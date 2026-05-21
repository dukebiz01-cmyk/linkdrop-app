import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Home,
  Inbox,
  Info,
  Link as LinkIcon,
  MessageCircle,
  Play,
  Plus,
  Search,
  ShoppingCart,
  Ticket,
  User,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

// ============================================================
// Types (라우트 연결 유지 — 기존 props 시그니처 보존)
// ============================================================

export type HomePageV3NavTab = "home" | "create" | "my-drops" | "inbox" | "profile";

type HomeDropIntent = "info" | "coupon" | "reservation" | "commerce" | "lead";

interface HomeMyDrop {
  id: string;
  thumbnailUrl: string;
  title: string;
  intent: HomeDropIntent;
  stats: { views: number; coupons?: number; reservations?: number };
}

export interface HomePageV3Props {
  isAuthenticated?: boolean;
  activeNavTab?: HomePageV3NavTab;
  onCreateDrop?: () => void;
  onPurposeClick?: (label: string) => void;
  onNavTab?: (tab: HomePageV3NavTab) => void;
}

/** 라우트 미수정 단계 — 내 Drop 섹션 UI 검증용 기본 mock */
const DEFAULT_MY_DROPS: HomeMyDrop[] = [
  {
    id: "mock-1",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=192&h=192&fit=crop",
    title: "서울숲 근처 브런치 카페 맛집",
    intent: "coupon",
    stats: { views: 184, coupons: 37 },
  },
  {
    id: "mock-2",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=192&h=192&fit=crop",
    title: "노을이 예쁜 캠핑장",
    intent: "reservation",
    stats: { views: 92, reservations: 12 },
  },
];

const INTENTS: {
  id: HomeDropIntent;
  label: string;
  description: string;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}[] = [
  {
    id: "info",
    label: "정보",
    description: "내용을 쉽게 정리해요",
    icon: Info,
    bgColor: "bg-[#DBEAFE]",
    iconColor: "text-[#2563EB]",
  },
  {
    id: "coupon",
    label: "쿠폰",
    description: "혜택으로 손님을 불러요",
    icon: Ticket,
    bgColor: "bg-[#FEF3C7]",
    iconColor: "text-[#D97706]",
  },
  {
    id: "reservation",
    label: "예약",
    description: "날짜를 고르고 예약해요",
    icon: Calendar,
    bgColor: "bg-[#D1FAE5]",
    iconColor: "text-[#10B981]",
  },
  {
    id: "commerce",
    label: "구매",
    description: "상품을 찾고 가격을 비교해요",
    icon: ShoppingCart,
    bgColor: "bg-[#FCE7F3]",
    iconColor: "text-[#DB2777]",
  },
  {
    id: "lead",
    label: "상담",
    description: "궁금한 점을 문의받아요",
    icon: MessageCircle,
    bgColor: "bg-[#E0E7FF]",
    iconColor: "text-[#6366F1]",
  },
];

interface VideoPreview {
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration?: string;
}

function VideoPreviewCard({ preview }: { preview: VideoPreview }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <div className="relative h-[45px] w-[80px] shrink-0 overflow-hidden rounded-lg bg-[#E2E8F0]">
        <img src={preview.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        {preview.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
            {preview.duration}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0F172A]">{preview.title}</p>
        <p className="truncate text-xs text-[#64748B]">{preview.channelName}</p>
      </div>
      <Check className="size-5 shrink-0 text-[#10B981]" strokeWidth={2} />
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <div className="h-[45px] w-[80px] shrink-0 animate-pulse rounded-lg bg-[#E2E8F0]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[#E2E8F0]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#E2E8F0]" />
      </div>
    </div>
  );
}

export function HomePageV3({
  isAuthenticated = false,
  activeNavTab = "home",
  onCreateDrop,
  onPurposeClick,
  onNavTab,
}: HomePageV3Props) {
  const myDrops = DEFAULT_MY_DROPS;
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPreview, setVideoPreview] = useState<VideoPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const createTarget = isAuthenticated ? "/create" : "/login";
  const isButtonEnabled = Boolean(videoPreview) && !isLoadingPreview;

  useEffect(() => {
    if (!videoUrl.trim()) {
      setVideoPreview(null);
      setIsLoadingPreview(false);
      return;
    }

    const isValidUrl =
      videoUrl.includes("youtube.com") ||
      videoUrl.includes("youtu.be") ||
      videoUrl.includes("instagram.com");

    if (!isValidUrl) {
      setVideoPreview(null);
      setIsLoadingPreview(false);
      return;
    }

    setIsLoadingPreview(true);
    const timer = setTimeout(() => {
      setVideoPreview({
        title: "서울숲 근처 브런치 카페 맛집 투어",
        channelName: "카페투어 브이로그",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=160&h=90&fit=crop",
        duration: "2:34",
      });
      setIsLoadingPreview(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [videoUrl]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setVideoUrl(text.trim());
    } catch {
      console.log("[HomePageV3] Clipboard read failed");
    }
  }, []);

  const handleCreateDrop = useCallback(() => {
    if (!isButtonEnabled) return;
    onCreateDrop?.();
  }, [isButtonEnabled, onCreateDrop]);

  const handlePurpose = useCallback(
    (intentId: HomeDropIntent, label: string) => {
      if (onPurposeClick) {
        onPurposeClick(label);
        return;
      }
      console.log("[HomePageV3] Purpose selected:", intentId);
    },
    [onPurposeClick],
  );

  return (
    <div
      className="relative mx-auto min-h-screen max-w-md pb-16"
      style={{
        background: "radial-gradient(circle at top right, #EFF6FF 0%, transparent 60%), #FFFFFF",
      }}
    >
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#F1F5F9] bg-white/80 px-4 backdrop-blur-xl">
        <h1
          className="flex items-center gap-1 text-xl font-bold tracking-ko text-[#0A0A0A]"
          style={{ letterSpacing: "-0.02em" }}
        >
          LinkDrop
          <span className="inline-block size-1.5 rounded-full bg-[#2563EB]" aria-hidden />
        </h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#0A0A0A] transition-colors hover:bg-[#F1F5F9]"
            aria-label="검색"
            onClick={() => console.log("[HomePageV3] Search clicked")}
          >
            <Search className="size-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#0A0A0A] transition-colors hover:bg-[#F1F5F9]"
            aria-label="알림"
            onClick={() => console.log("[HomePageV3] Notifications clicked")}
          >
            <Bell className="size-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="px-5">
        {/* Hero */}
        <section className="flex flex-col items-center pb-6 pt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
            Link to Action
          </p>
          <h2
            className="mt-3 text-center text-[32px] font-bold leading-[1.2] text-[#0F172A]"
            style={{ letterSpacing: "-0.02em" }}
          >
            영상을{" "}
            <span className="relative inline-block text-[#2563EB]">
              Drop
              <svg
                className="absolute -bottom-0.5 left-0 w-full"
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                height="6"
                aria-hidden
              >
                <path
                  d="M0,6 Q50,0 100,6"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            으로
          </h2>
          <p className="mt-3 text-center text-[15px] leading-relaxed text-[#64748B]">
            유튜브·인스타 링크를 붙이면
            <br />
            AI가 핵심을 정리하고,
            <br />
            쿠폰·예약·구매·상담 버튼까지 추천해요.
          </p>
        </section>

        {/* AI 안내 — v0 bottom sheet */}
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className="group flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-3 text-[13px] font-medium text-[#475569] transition-colors duration-150 hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
        >
          <Play className="size-4" strokeWidth={2} />
          AI가 어떻게 만드는지 보기
          <ChevronDown className="size-4" strokeWidth={2} />
        </button>

        {/* 영상 링크 입력 + preview */}
        <section className="mt-4">
          <div
            className={cn(
              "relative flex h-14 items-center gap-3 rounded-xl border bg-white px-4 transition-colors duration-150",
              videoUrl
                ? "border-[#2563EB] shadow-[0_1px_3px_rgba(37,99,235,0.12)]"
                : "border-[#E2E8F0] hover:border-[#CBD5E1]",
            )}
          >
            <LinkIcon className="size-5 shrink-0 text-[#94A3B8]" strokeWidth={2} />
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="영상 링크 붙여넣기"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handlePaste()}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#F1F5F9] px-3 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#E2E8F0] hover:text-[#0F172A]"
            >
              <Clipboard className="size-3.5" strokeWidth={2} />
              붙여넣기
            </button>
          </div>
          {isLoadingPreview && <PreviewSkeleton />}
          {videoPreview && !isLoadingPreview && <VideoPreviewCard preview={videoPreview} />}
        </section>

        {/* Drop 만들기 */}
        <section className="mt-5">
          {onCreateDrop ? (
            <button
              type="button"
              onClick={handleCreateDrop}
              disabled={!isButtonEnabled}
              className={cn(
                "relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-[16px] font-bold transition-all duration-150",
                isButtonEnabled
                  ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)] hover:shadow-[0_6px_24px_rgba(37,99,235,0.45)]"
                  : "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]",
              )}
            >
              Drop 만들기
              <ArrowRight className="size-5" strokeWidth={2} />
            </button>
          ) : isButtonEnabled ? (
            <Link to={createTarget} className="block">
              <span className="relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-[16px] font-bold text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)]">
                Drop 만들기
                <ArrowRight className="size-5" strokeWidth={2} />
              </span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="relative flex h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-[#E2E8F0] text-[16px] font-bold text-[#94A3B8]"
            >
              Drop 만들기
              <ArrowRight className="size-5" strokeWidth={2} />
            </button>
          )}
        </section>

        {/* How it works sheet */}
        {showHowItWorks && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-t-2xl bg-white pb-8 pt-4 shadow-[0_-8px_32px_rgba(15,23,42,0.12)]">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E2E8F0]" />
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] transition-colors hover:bg-[#E2E8F0]"
                aria-label="닫기"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
              <div className="px-6">
                <h3 className="text-center text-lg font-bold tracking-ko text-[#0F172A]">
                  AI가 어떻게 만드는지 보기
                </h3>
                <p className="mt-1 text-center text-sm font-medium text-[#64748B]">
                  3단계로 Drop 페이지가 완성돼요
                </p>
                <ol className="mt-8 flex flex-col items-center gap-6">
                  <li className="flex w-full items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-lg font-bold text-[#2563EB]">
                      1
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0F172A]">영상 링크 붙여넣기</p>
                      <p className="text-sm text-[#64748B]">유튜브, 인스타 영상 링크를 붙여넣어요</p>
                    </div>
                  </li>
                  <ChevronDown className="size-5 text-[#CBD5E1]" aria-hidden />
                  <li className="flex w-full items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-lg font-bold text-[#2563EB]">
                      2
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0F172A]">AI가 분석해요</p>
                      <p className="text-sm text-[#64748B]">영상 내용을 요약하고 정보를 추출해요</p>
                    </div>
                  </li>
                  <ChevronDown className="size-5 text-[#CBD5E1]" aria-hidden />
                  <li className="flex w-full items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-lg font-bold text-[#2563EB]">
                      3
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0F172A]">행동 버튼 추가</p>
                      <p className="text-sm text-[#64748B]">쿠폰, 예약, 구매, 상담 버튼을 붙여요</p>
                    </div>
                  </li>
                </ol>
                <button
                  type="button"
                  onClick={() => setShowHowItWorks(false)}
                  className="mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-[#2563EB] text-[15px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  알겠어요
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 목적 카드 */}
        <section className="mt-8 pb-6">
          <h3 className="text-lg font-bold tracking-ko text-[#0F172A]">무엇을 만들까요?</h3>
          <p className="mt-1 text-[13px] font-medium text-[#64748B]">원하는 목적을 선택하세요.</p>
          <ul className="mt-4 space-y-2.5">
            {INTENTS.map((intent) => {
              const Icon = intent.icon;
              const cardClass =
                "group flex w-full items-center gap-3.5 rounded-xl border border-[#E2E8F0] bg-white p-3.5 text-left transition-colors duration-150 hover:border-[#2563EB] hover:shadow-[0_1px_4px_rgba(15,23,42,0.06)]";
              const inner = (
                <>
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      intent.bgColor,
                    )}
                  >
                    <Icon className={cn("size-5", intent.iconColor)} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[#0F172A]">
                      {intent.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#64748B]">
                      {intent.description}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-[#CBD5E1] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
                </>
              );

              if (onPurposeClick) {
                return (
                  <li key={intent.id}>
                    <button
                      type="button"
                      className={cardClass}
                      onClick={() => handlePurpose(intent.id, intent.label)}
                    >
                      {inner}
                    </button>
                  </li>
                );
              }

              return (
                <li key={intent.id}>
                  <Link to={createTarget} className={cardClass}>
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 내 Drop — 컴포넌트 내부 mock */}
        {myDrops.length > 0 && (
          <section className="pb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold tracking-ko text-[#0F172A]">내 Drop</h3>
              <button
                type="button"
                className="flex items-center gap-0.5 text-[13px] font-medium text-[#64748B] transition-colors hover:text-[#2563EB]"
                onClick={() => console.log("[HomePageV3] View all drops")}
              >
                전체 보기
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </button>
            </div>
            <ul className="mt-3 space-y-2.5">
              {myDrops.slice(0, 3).map((drop) => {
                const intentMeta = INTENTS.find((i) => i.id === drop.intent);
                return (
                  <li key={drop.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 text-left transition-colors hover:border-[#CBD5E1]"
                      onClick={() => console.log("[HomePageV3] View drop:", drop.id)}
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-[#E2E8F0]">
                        <img
                          src={drop.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[#0F172A]">
                          {drop.title}
                        </p>
                        <span
                          className={cn(
                            "mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                            drop.intent === "coupon" && "bg-[#FEF3C7] text-[#D97706]",
                            drop.intent === "reservation" && "bg-[#D1FAE5] text-[#10B981]",
                            drop.intent === "commerce" && "bg-[#FCE7F3] text-[#DB2777]",
                            drop.intent === "lead" && "bg-[#E0E7FF] text-[#6366F1]",
                            drop.intent === "info" && "bg-[#DBEAFE] text-[#2563EB]",
                          )}
                        >
                          {intentMeta?.label ?? "정보"}
                        </span>
                        <p className="mt-1 text-[11px] text-[#64748B]">
                          조회 {drop.stats.views}
                          {drop.stats.coupons !== undefined && ` · 쿠폰 ${drop.stats.coupons}`}
                          {drop.stats.reservations !== undefined &&
                            ` · 예약 ${drop.stats.reservations}`}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-[#CBD5E1]" strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      {/* 하단 네비 — v0 톤 */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex h-16 max-w-md items-center justify-around border-t border-[#F1F5F9] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <BottomNavTab
          icon={<Home className="size-5" strokeWidth={2} />}
          label="홈"
          isActive={activeNavTab === "home"}
          onClick={() => onNavTab?.("home")}
        />
        <BottomNavTab
          icon={<Plus className="size-4" strokeWidth={2} />}
          label="만들기"
          highlight
          isActive={activeNavTab === "create"}
          onClick={() => onNavTab?.("create")}
        />
        <BottomNavTab
          icon={<Inbox className="size-5" strokeWidth={2} />}
          label="내 Drop"
          isActive={activeNavTab === "my-drops"}
          onClick={() => onNavTab?.("my-drops")}
        />
        <BottomNavTab
          icon={<Inbox className="size-5" strokeWidth={2} />}
          label="받은함"
          isActive={activeNavTab === "inbox"}
          onClick={() => onNavTab?.("inbox")}
        />
        <BottomNavTab
          icon={<User className="size-5" strokeWidth={2} />}
          label="나"
          isActive={activeNavTab === "profile"}
          onClick={() => onNavTab?.("profile")}
        />
      </nav>
    </div>
  );
}

function BottomNavTab({
  icon,
  label,
  isActive,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-0.5 px-3 py-1.5",
        isActive || highlight ? "text-[#2563EB]" : "text-[#94A3B8]",
      )}
    >
      {highlight ? (
        <span className="flex size-8 items-center justify-center rounded-full bg-[#2563EB] text-white">
          {icon}
        </span>
      ) : (
        icon
      )}
      <span
        className={cn(
          "text-[10px] tracking-ko",
          highlight ? "font-semibold text-[#2563EB]" : "font-medium",
        )}
      >
        {label}
      </span>
    </button>
  );
}
