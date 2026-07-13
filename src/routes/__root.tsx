import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { BusinessFooter } from "@/components/business-footer";
// T7 PWA v1 — beforeinstallprompt 캡처 싱글턴 1회 로드(SSR 가드 내장 · 서비스워커 없음).
import "@/lib/pwa-install";
// FIX-47b — 인앱 브라우저 전역 유도 배너(getInAppBrowser 공용 판정 재사용 · §13 안내 1줄만).
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getInAppBrowser, type InAppBrowser } from "@/lib/pwa-install";

// 로그인 앱 경로 — 여기선 사업자 푸터를 숨긴다(하단 BottomNav 충돌 회피).
// 그 외(공개 경로: / · /d/ · /r · /alliance · /terms · /business-info · /privacy 등)에만 노출.
const APP_PREFIXES = ["/home", "/explore", "/me", "/create", "/studio", "/partner", "/admin"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-extrabold text-text-strong">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-text-strong">
          페이지를 찾을 수 없어요
        </h2>
        <p className="mt-2 text-sm font-medium text-text-muted">
          주소가 바뀌었거나 사라진 것 같아요.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-action px-6 py-3 text-sm font-semibold text-action-foreground transition-colors hover:bg-text-strong/90"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-text-strong">
          페이지를 불러오지 못했어요
        </h1>
        <p className="mt-2 text-sm font-medium text-text-muted">
          잠깐 문제가 생긴 것 같아요. 다시 시도해 주세요.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-action px-6 py-3 text-sm font-semibold text-action-foreground transition-colors hover:bg-text-strong/90"
          >
            다시 시도
          </button>
          <a
            href="/"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-bg px-6 py-3 text-sm font-semibold text-text-strong transition-colors hover:border-text-muted"
          >
            홈으로
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LinkDrop" },
      { name: "description", content: "영상 속 정보를 친구와 카톡으로 나누는 가장 빠른 방법" },
      { property: "og:title", content: "LinkDrop" },
      { property: "og:description", content: "영상 속 정보를 친구와 카톡으로 나누는 가장 빠른 방법" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // T7 PWA v1 — 상단 톤 실측값(#FFFFFF — home 헤더 bg-white).
      { name: "theme-color", content: "#FFFFFF" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      // T7 PWA v1 — manifest(서비스워커 없음 — 설치 가능성만).
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // 공개(비로그인) 경로에서만 사업자 푸터 — 카카오 비즈 심사·전상법 §10 도달점.
  const isApp = APP_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <QueryClientProvider client={queryClient}>
      {/* FIX-47b — 인앱 유도 배너(전역 셸 상단 1줄): 자동 리다이렉트·팝업 0(§13). */}
      <InAppBrowserBanner />
      <Outlet />
      {!isApp &&
        (pathname === "/" ? (
          <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <BusinessFooter />
          </div>
        ) : (
          <BusinessFooter />
        ))}
    </QueryClientProvider>
  );
}

// FIX-47b — 인앱 브라우저 전역 유도 배너. 감지 = pwa-install getInAppBrowser 공용(중복 정의 0).
//   마운트 후 판정(SSR=미렌더 — hydration 안전) · X 닫기 = sessionStorage 세션 내 재노출 0
//   (useLingoVoice TTS 세션 키 관례 동일 — localStorage 아님). 일반 브라우저 = 미렌더.
const INAPP_BANNER_KEY = "ld-inapp-banner-dismissed";

function InAppBrowserBanner() {
  const [inApp, setInApp] = useState<InAppBrowser | null>(null);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(INAPP_BANNER_KEY) === "1") return;
    } catch {
      // sessionStorage 접근 불가(일부 WebView 프라이빗 모드) — 배너는 표시.
    }
    setInApp(getInAppBrowser());
  }, []);
  if (!inApp) return null;
  return (
    <div className="flex items-start gap-2 bg-[#0F172A] px-4 py-2 text-white">
      <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed tracking-ko [word-break:keep-all]">
        {inApp === "kakao"
          ? "카카오톡 브라우저예요. 오른쪽 위 메뉴 → '다른 브라우저로 열기'를 누르면 로그인과 음성까지 전부 쓸 수 있어요"
          : "앱 속 브라우저예요. 크롬 등 다른 브라우저로 열면 로그인과 음성까지 전부 쓸 수 있어요"}
      </p>
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={() => {
          try {
            window.sessionStorage.setItem(INAPP_BANNER_KEY, "1");
          } catch {
            // 저장 실패 — 이번 렌더만 닫힘(다음 진입 시 재노출 허용, 정직 폴백).
          }
          setInApp(null);
        }}
        className="-my-2 -mr-3 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-white/70 hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
