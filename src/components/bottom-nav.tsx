import { Link, useLocation } from "@tanstack/react-router";
import type React from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardAwareBar } from "@/components/keyboard-aware-bar";

/**
 * 공통 하단 nav — V4 커스텀 SVG 아이콘(액티브=채움 / 비액티브=라인) + 액티브 알약.
 * 홈·탐색·스튜디오·내페이지 4탭.
 * NAV-1 — 한글 라벨 상시 노출(국내 표준: 카카오톡·토스·네이버 하단 탭 + 중장년 매장주
 *   아이콘 추측 제거). 그리드 실높이 66px 불변 — studio-build 발행 바가
 *   bottom-[calc(66px+…)] 로 결속(P6-9). 라벨 공간은 알약 h-11→h-8 내부 재배치로 확보.
 *
 * active 상태는 현재 URL 에서 파생 → 직접 접속·붙여넣기·SSR/hydration 모두 동작.
 *
 * focused 화면(`/results`/`/coupon`/`/create-wizard`)은 _user.tsx 가 shouldHideNav 로 미렌더.
 */

const INK = "#0F172A";
const MUTED = "#94A3B8";
type NavIconProps = { active: boolean };

function HomeIcon({ active }: NavIconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" aria-hidden="true">
        <path
          d="M10.7 3.3a2 2 0 0 1 2.6 0l6.4 5.5c.5.43.8 1.06.8 1.72V18a2.5 2.5 0 0 1-2.5 2.5h-2.2a.8.8 0 0 1-.8-.8V15.5a2 2 0 0 0-2-2h-.4a2 2 0 0 0-2 2v4.2a.8.8 0 0 1-.8.8H5.5A2.5 2.5 0 0 1 3 18v-7.48c0-.66.29-1.29.8-1.72l6.9-5.5Z"
          fill={INK}
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" aria-hidden="true">
      <path
        d="M4 10.52c0-.66.29-1.29.8-1.72l6.9-5.8a.8.8 0 0 1 1.02 0l6.48 5.8c.51.43.8 1.06.8 1.72V18a1.5 1.5 0 0 1-1.5 1.5h-3.3v-4.5a2 2 0 0 0-2-2h-.4a2 2 0 0 0-2 2v4.5H5.5A1.5 1.5 0 0 1 4 18v-7.48Z"
        fill="none"
        stroke={MUTED}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExploreIcon({ active }: NavIconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" fill={INK} />
        <path
          d="m15.4 8.6-1.5 4.4a1.4 1.4 0 0 1-.9.9l-4.4 1.5 1.5-4.4a1.4 1.4 0 0 1 .9-.9l4.4-1.5Z"
          fill="#FFFFFF"
        />
        <circle cx="12" cy="12" r="1.15" fill={INK} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" fill="none" stroke={MUTED} strokeWidth="1.9" />
      <path
        d="m15.4 8.6-1.5 4.4a1.4 1.4 0 0 1-.9.9l-4.4 1.5 1.5-4.4a1.4 1.4 0 0 1 .9-.9l4.4-1.5Z"
        fill="none"
        stroke={MUTED}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StudioIcon({ active }: NavIconProps) {
  const color = active ? INK : MUTED;
  return (
    <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" aria-hidden="true">
      <path
        d="M11.1 3.3a.95.95 0 0 1 1.8 0l1.05 3.02a4 4 0 0 0 2.48 2.48l3.02 1.05a.95.95 0 0 1 0 1.8l-3.02 1.05a4 4 0 0 0-2.48 2.48l-1.05 3.02a.95.95 0 0 1-1.8 0l-1.05-3.02a4 4 0 0 0-2.48-2.48l-3.02-1.05a.95.95 0 0 1 0-1.8l3.02-1.05a4 4 0 0 0 2.48-2.48L11.1 3.3Z"
        fill={active ? color : "none"}
        stroke={color}
        strokeWidth={active ? 0 : 1.9}
        strokeLinejoin="round"
      />
      <path
        d="M18.3 3.1a.5.5 0 0 1 .95 0l.32.92c.16.46.52.82.98.98l.92.32a.5.5 0 0 1 0 .95l-.92.32a1.6 1.6 0 0 0-.98.98l-.32.92a.5.5 0 0 1-.95 0l-.32-.92a1.6 1.6 0 0 0-.98-.98l-.92-.32a.5.5 0 0 1 0-.95l.92-.32c.46-.16.82-.52.98-.98l.32-.92Z"
        fill={color}
      />
    </svg>
  );
}

function MeIcon({ active }: NavIconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" aria-hidden="true">
        <circle cx="12" cy="8" r="3.9" fill={INK} />
        <path
          d="M4.6 19.4a7.4 7.4 0 0 1 14.8 0 1.3 1.3 0 0 1-1.3 1.3H5.9a1.3 1.3 0 0 1-1.3-1.3Z"
          fill={INK}
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" fill="none" stroke={MUTED} strokeWidth="1.9" />
      <path
        d="M5.5 19.8a6.5 6.5 0 0 1 13 0"
        fill="none"
        stroke={MUTED}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

type NavId = "home" | "explore" | "studio" | "me";

type NavTab = {
  id: NavId;
  label: string;
  Icon: (p: { active: boolean }) => React.JSX.Element;
  to?: "/" | "/explore" | "/studio-build" | "/me";
  match: (pathname: string) => boolean;
  placeholder?: string; // 라우트 미존재 시 toast 메시지
};

const TABS: NavTab[] = [
  {
    id: "home",
    label: "홈",
    Icon: HomeIcon,
    to: "/",
    match: (p) => p === "/" || p.startsWith("/home"),
  },
  {
    id: "explore",
    label: "탐색",
    Icon: ExploreIcon,
    to: "/explore",
    match: (p) => p.startsWith("/explore"),
  },
  {
    id: "studio",
    label: "스튜디오",
    Icon: StudioIcon,
    // P6-1(형님 확정 A) — 제작 진입점 단일화: 탭 → studio-build 직결.
    //   match 는 startsWith("/studio") 유지 — /studio(리다이렉트 잔류)·/studio-build 모두 활성.
    to: "/studio-build",
    match: (p) => p.startsWith("/studio"),
  },
  {
    id: "me",
    // NAV-1 — 형님 확정 문구(구 "나"), NAV-1.1 띄어쓰기 정정. 축약 금지.
    label: "내 페이지",
    Icon: MeIcon,
    to: "/me",
    match: (p) => p === "/me" || p.startsWith("/me") || p === "/profile",
  },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <>
      {/* NAV-fix1 — 키보드(입력 포커스) 중 네비 표시만 숨김: KeyboardAwareBar 공용 래퍼
          (studio-build 발행바와 동일 패턴 · 리렌더 격리 · 탭 상태 보존). */}
      <KeyboardAwareBar>
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
          aria-label="하단 탭 네비"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-[#EEF1F5]" />
          <div className="mx-auto grid h-[66px] max-w-md grid-cols-4">
            {TABS.map((tab) => {
              const active = tab.match(pathname);

              // NAV-1 — 아이콘 + 한글 라벨 상시. active 시 알약(bg-[#F1F5F9]) + 채움 아이콘 +
              //   잉크 라벨(아이콘 톤 동기). 알약 h-8 로 내부 재배치(그리드 66px 불변) — 아이콘 무수정.
              const content = (
                <span className="flex flex-col items-center justify-center gap-1 transition-all duration-200 group-active:scale-90">
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-2xl ${
                      active ? "bg-[#F1F5F9]" : "bg-transparent"
                    }`}
                  >
                    <tab.Icon active={active} />
                  </span>
                  <span
                    className={`whitespace-nowrap text-[10px] font-semibold leading-none tracking-ko ${
                      active ? "text-[#0F172A]" : "text-[#94A3B8]"
                    }`}
                  >
                    {tab.label}
                  </span>
                </span>
              );

              const className =
                "group relative flex min-h-[44px] flex-col items-center justify-center";

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
      </KeyboardAwareBar>
      <Toaster richColors position="top-center" />
    </>
  );
}
