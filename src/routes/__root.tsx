import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

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
      { title: "리워드" },
      { name: "description", content: "포인트와 쿠폰을 한 곳에서." },
      { property: "og:title", content: "리워드" },
      { property: "og:description", content: "포인트와 쿠폰을 한 곳에서." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
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

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
