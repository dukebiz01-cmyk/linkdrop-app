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
