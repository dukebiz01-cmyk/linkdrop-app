import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, PlusCircle, User } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

/**
 * 공통 하단 nav (phase1-#1 마무리) — v0.26 검정 미니멀 디자인 4탭.
 * 홈·탐색·만들기·나 (#6 4탭 설계). 탐색 라우트 미존재 → placeholder("준비중").
 *
 * active 상태는 현재 URL 에서 파생 → 직접 접속·붙여넣기·SSR/hydration 모두 동작.
 * v3 내장 4탭 nav 는 phase1-#1 마무리에서 home-page-v3 본문 제거 — 충돌 원천 제거.
 *
 * focused 화면(`/results`/`/coupon`)은 _user.tsx 가 shouldHideNav 로 미렌더.
 */

type NavId = "home" | "explore" | "create" | "me";

type NavTab = {
  id: NavId;
  label: string;
  Icon: typeof Home;
  to?: "/" | "/create-wizard" | "/me";
  match: (pathname: string) => boolean;
  placeholder?: string; // 라우트 미존재 시 toast 메시지
};

const TABS: NavTab[] = [
  {
    id: "home",
    label: "홈",
    Icon: Home,
    to: "/",
    match: (p) => p === "/" || p.startsWith("/home"),
  },
  {
    id: "explore",
    label: "탐색",
    Icon: Search,
    // 라우트 미존재 — placeholder. 별도 유닛에서 신설 시 to 추가.
    match: (p) => p.startsWith("/explore"),
    placeholder: "탐색은 준비 중이에요.",
  },
  {
    id: "create",
    label: "만들기",
    Icon: PlusCircle,
    to: "/create-wizard",
    match: (p) => p.startsWith("/create"),
  },
  {
    id: "me",
    label: "나",
    Icon: User,
    to: "/me",
    match: (p) => p === "/me" || p.startsWith("/me") || p === "/profile",
  },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/98 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
        aria-label="하단 탭 네비"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-[#E5E5E5]" />
        <div className="mx-auto grid h-[60px] max-w-md grid-cols-4">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const labelColor = active ? "text-[#0A0A0A]" : "text-[#A3A3A3]";
            const iconColor = active ? "text-[#0A0A0A]" : "text-[#A3A3A3]";
            const iconStroke = active ? 2.25 : 1.75;
            const labelWeight = active ? "font-bold" : "font-medium";

            const content = (
              <>
                {active ? (
                  <span className="absolute top-0 h-[3px] w-8 rounded-full bg-[#0A0A0A]" />
                ) : null}
                <tab.Icon
                  className={`h-[22px] w-[22px] transition-transform duration-150 group-active:scale-90 ${iconColor} ${
                    !active ? "group-hover:text-[#525252]" : ""
                  }`}
                  strokeWidth={iconStroke}
                />
                <span
                  className={`text-[11px] tracking-ko transition-colors ${labelColor} ${labelWeight} ${
                    !active ? "group-hover:text-[#525252]" : ""
                  }`}
                >
                  {tab.label}
                </span>
              </>
            );

            const className =
              "group relative flex min-h-[44px] flex-col items-center justify-center gap-1";

            // 라우트 있는 탭은 Link, 없으면 button + placeholder toast
            if (tab.to) {
              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  className={className}
                  aria-label={tab.label}
                  aria-current={active ? "page" : undefined}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.placeholder) toast.info(tab.placeholder);
                }}
                className={className}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
              >
                {content}
              </button>
            );
          })}
        </div>
      </nav>
      <Toaster richColors position="top-center" />
    </>
  );
}
