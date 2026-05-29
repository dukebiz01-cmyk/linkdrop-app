import { Link, useLocation } from "@tanstack/react-router";
import { Home, PlusCircle, User } from "lucide-react";

/**
 * 공통 하단 nav (N2) — 3탭: 홈 · 만들기 · 나.
 *
 * `_user.tsx UserLayout` 에서 렌더. v0 home-page-v3 의 내부 nav (메모리 #25 보존)
 * 는 home.tsx wrapper 에서 CSS 로 숨김 — 이 컴포넌트가 유일한 nav.
 *
 * focused 화면(results·coupon 등)은 _user.tsx 가 pathname 으로 미렌더.
 *
 * 디자인 토큰 (#15): active `#2563EB`, inactive `#94A3B8`, 흰 bg, 상단 border
 * `#E5E5E5`, `max-w-md mx-auto` 앱 너비 일치. 각 탭 `min-h-[44px]`.
 * 카피 (#16): "홈" · "만들기" · "나" — 약어·내부용어 X, 이모지 X.
 */

type NavTab = {
  to: "/" | "/create-wizard" | "/me";
  Icon: typeof Home;
  label: string;
  match: (pathname: string) => boolean;
};

const TABS: NavTab[] = [
  {
    // N4-fix1: 홈 탭은 "/" 로. 무로그인 → "/" 머무름 / 로그인 → "/" beforeLoad 가
    // /home 으로 redirect 라 양쪽 다 정상. (이전 "/home" 은 무로그인이 홈 누르면
    // /login 으로 튕기는 회귀였음.)
    to: "/",
    Icon: Home,
    label: "홈",
    match: (p) => p === "/" || p.startsWith("/home"),
  },
  {
    to: "/create-wizard",
    Icon: PlusCircle,
    label: "만들기",
    match: (p) => p.startsWith("/create"),
  },
  {
    to: "/me",
    Icon: User,
    label: "나",
    match: (p) => p === "/me" || p.startsWith("/me") || p === "/profile",
  },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5E5E5] bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const color = active ? "#2563EB" : "#94A3B8";
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 px-2"
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <tab.Icon
                className="size-5"
                strokeWidth={active ? 2.4 : 2}
                color={color}
              />
              <span
                className="text-[11px] font-semibold tracking-ko"
                style={{ color }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
