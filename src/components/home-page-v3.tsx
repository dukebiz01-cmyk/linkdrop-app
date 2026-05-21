import { useCallback, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Gift,
  Home,
  Inbox,
  Layers,
  Link as LinkIcon,
  Phone,
  Play,
  Plus,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { WIZARD_PRIMARY_BUTTON_CLASS } from "@/components/create-wizard-button-styles";
import { cn } from "@/lib/utils";

const PURPOSE_CARDS: {
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  { label: "정보", description: "영상 핵심 정리", icon: BookOpen },
  { label: "쿠폰", description: "혜택으로 손님 모으기", icon: Gift },
  { label: "예약", description: "날짜·예약 연결", icon: Calendar },
  { label: "구매", description: "AI 가격 비교", icon: ShoppingBag },
  { label: "상담", description: "문의·상담 받기", icon: Phone },
];

const AI_HOW_IT_WORKS_COPY =
  "영상 링크를 붙이면 AI가 제목·핵심·행동 버튼을 추천하고, 목적에 맞는 Drop 페이지를 만들어 드려요. 쿠폰·예약·구매·상담 흐름까지 한 번에 연결할 수 있어요.";

export type HomePageV3NavTab = "home" | "create" | "my-drops" | "inbox" | "profile";

export interface HomePageV3Props {
  isAuthenticated?: boolean;
  activeNavTab?: HomePageV3NavTab;
  onCreateDrop?: () => void;
  onPurposeClick?: (label: string) => void;
  onNavTab?: (tab: HomePageV3NavTab) => void;
}

export function HomePageV3({
  isAuthenticated = false,
  activeNavTab = "home",
  onCreateDrop,
  onPurposeClick,
  onNavTab,
}: HomePageV3Props) {
  const [videoUrl, setVideoUrl] = useState("");
  const [aiGuideOpen, setAiGuideOpen] = useState(false);

  const hasUrl = videoUrl.trim().length > 0;
  const createTarget = isAuthenticated ? "/create" : "/login";

  const handleCreateDrop = useCallback(() => {
    if (!hasUrl) return;
    if (onCreateDrop) {
      onCreateDrop();
      return;
    }
  }, [hasUrl, onCreateDrop]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setVideoUrl(text.trim());
    } catch {
      console.log("[HomePageV3] Clipboard read failed");
    }
  }, []);

  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-white pb-16">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-ko text-[#111111]">LinkDrop</span>
          <span
            className="size-2 shrink-0 rounded-full bg-[#2563EB]"
            aria-hidden
            style={{ boxShadow: "0 0 8px rgba(37, 99, 235, 0.45)" }}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#111111] transition-colors hover:bg-[#F5F5F5]"
            aria-label="검색"
            onClick={() => console.log("[HomePageV3] Search clicked")}
          >
            <Search className="size-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#111111] transition-colors hover:bg-[#F5F5F5]"
            aria-label="알림"
            onClick={() => console.log("[HomePageV3] Notifications clicked")}
          >
            <Bell className="size-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pt-6">
        <p className="text-xs font-semibold uppercase tracking-ko text-[#2563EB]">
          영상 링크로 DROP 만들기
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-ko text-[#111111]">
          영상을 Drop으로
        </h1>
        <p className="mt-4 text-base font-medium leading-relaxed tracking-ko text-[#525252]">
          유튜브·인스타 링크를 붙이면
          <br />
          AI가 핵심을 정리하고,
          <br />
          쿠폰·예약·구매·상담 버튼까지 추천해요.
        </p>

        <button
          type="button"
          onClick={() => setAiGuideOpen((open) => !open)}
          className="mt-6 flex min-h-[44px] w-full items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 text-left transition-colors hover:border-[#D4D4D4]"
          aria-expanded={aiGuideOpen}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#2563EB]">
            <Play className="size-4 text-[#2563EB]" strokeWidth={2} />
          </span>
          <span className="flex-1 text-sm font-semibold tracking-ko text-[#111111]">
            AI가 어떻게 만드는지 보기
          </span>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-[#525252] transition-transform duration-150",
              aiGuideOpen && "rotate-180",
            )}
            strokeWidth={2}
          />
        </button>
        {aiGuideOpen && (
          <p className="mt-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-medium leading-relaxed tracking-ko text-[#525252]">
            {AI_HOW_IT_WORKS_COPY}
          </p>
        )}

        <div className="relative mt-8 flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-2 pl-4">
          <LinkIcon
            className="pointer-events-none size-5 shrink-0 text-[#A3A3A3]"
            strokeWidth={2}
          />
          <Input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="영상 링크 붙여넣기"
            className="h-12 min-h-0 flex-1 border-0 bg-transparent px-0 font-sans text-sm shadow-none placeholder:text-[#A3A3A3] focus-visible:ring-0"
          />
          <button
            type="button"
            onClick={() => void handlePaste()}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-[#525252] transition-colors hover:bg-[#F5F5F5]"
            aria-label="붙여넣기"
          >
            <Clipboard className="size-5" strokeWidth={2} />
          </button>
        </div>

        {onCreateDrop ? (
          <button
            type="button"
            disabled={!hasUrl}
            onClick={handleCreateDrop}
            className={cn(
              WIZARD_PRIMARY_BUTTON_CLASS,
              "mt-4 inline-flex items-center justify-center gap-1",
            )}
          >
            Drop 만들기
            <ArrowRight className="size-5" strokeWidth={2} />
          </button>
        ) : hasUrl ? (
          <Link to={createTarget} className="mt-4 block">
            <span
              className={cn(
                WIZARD_PRIMARY_BUTTON_CLASS,
                "inline-flex items-center justify-center gap-1",
              )}
            >
              Drop 만들기
              <ArrowRight className="size-5" strokeWidth={2} />
            </span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={cn(
              WIZARD_PRIMARY_BUTTON_CLASS,
              "mt-4 inline-flex items-center justify-center gap-1",
            )}
          >
            Drop 만들기
            <ArrowRight className="size-5" strokeWidth={2} />
          </button>
        )}

        <section className="mt-12 pb-4">
          <h2 className="text-lg font-bold tracking-ko text-[#111111]">무엇을 만들까요?</h2>
          <p className="mt-1 text-sm font-medium tracking-ko text-[#525252]">
            원하는 목적을 선택하세요.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {PURPOSE_CARDS.map((item) => {
              const Icon = item.icon;
              const cardInner = (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF]">
                    <Icon className="size-5 text-[#2563EB]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tracking-ko text-[#111111]">{item.label}</p>
                    <p className="mt-1 text-xs font-medium tracking-ko text-[#525252]">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-[#A3A3A3]" strokeWidth={2} />
                </>
              );
              const cardClass =
                "flex min-h-[80px] w-full items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-left transition-colors hover:border-[#2563EB] hover:bg-[#EFF6FF]/20";

              if (onPurposeClick) {
                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      className={cardClass}
                      onClick={() => onPurposeClick(item.label)}
                    >
                      {cardInner}
                    </button>
                  </li>
                );
              }

              return (
                <li key={item.label}>
                  <Link to={createTarget} className={cardClass}>
                    {cardInner}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex h-14 max-w-md items-center border-t border-[#E5E7EB] bg-white px-1">
        <NavTab
          icon={<Home className="size-5" strokeWidth={2} />}
          label="홈"
          isActive={activeNavTab === "home"}
          onClick={() => onNavTab?.("home")}
        />
        <NavTab
          icon={<Plus className="size-5" strokeWidth={2} />}
          label="만들기"
          isActive={activeNavTab === "create"}
          onClick={() => onNavTab?.("create")}
        />
        <NavTab
          icon={<Layers className="size-5" strokeWidth={2} />}
          label="내 Drop"
          isActive={activeNavTab === "my-drops"}
          onClick={() => onNavTab?.("my-drops")}
        />
        <NavTab
          icon={<Inbox className="size-5" strokeWidth={2} />}
          label="받은함"
          isActive={activeNavTab === "inbox"}
          onClick={() => onNavTab?.("inbox")}
        />
        <NavTab
          icon={<User className="size-5" strokeWidth={2} />}
          label="나"
          isActive={activeNavTab === "profile"}
          onClick={() => onNavTab?.("profile")}
        />
      </nav>
    </div>
  );
}

function NavTab({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150",
        isActive ? "text-[#2563EB]" : "text-[#A3A3A3]",
      )}
    >
      {icon}
      <span className="text-[10px] font-medium tracking-ko">{label}</span>
    </button>
  );
}
