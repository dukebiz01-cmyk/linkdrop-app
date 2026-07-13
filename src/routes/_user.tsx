import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import { BottomNav } from "@/components/bottom-nav";

export const Route = createFileRoute("/_user")({
  beforeLoad: async ({ location }) => {
    const supabase = await getAuthClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href } as never,
      });
    }
    // ── ADDITIVE: 신규 1회 게이트인트로 ──
    // /start 자신은 화이트리스트(루프 방지). 온보딩 플래그 없으면 /start 로.
    if (!location.pathname.startsWith("/start")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!profile?.onboarding_completed_at) {
        // BUG-3A — 온보딩 게이트가 삼키던 복귀 주소 보존(쿠폰 수령 등 funnel 복귀). 오픈
        //   리다이렉트 방지: 같은 오리진 경로("/..." 시작·"//" 차단)만 next 로 부착, 아니면 미부착.
        const back = location.href;
        const safeNext = back.startsWith("/") && !back.startsWith("//") ? back : undefined;
        throw redirect({
          to: "/start",
          search: (safeNext ? { next: safeNext } : {}) as never,
        });
      }
    }
  },
  component: UserLayout,
});

// focused 화면 — 공통 nav 숨김 (D0 짤림 방지 + 화면 집중도).
// results·coupon 은 자체 화면이 풀높이 + 자체 CTA 가 있어 nav 가 겹친다.
// create-wizard(Slice 2) = 전체화면 위저드 — 자체 닫기/이전 헤더가 있어 nav 숨김.
function shouldHideNav(pathname: string): boolean {
  return (
    pathname.startsWith("/results") ||
    pathname.startsWith("/coupon") ||
    pathname.startsWith("/create-wizard")
  );
}

function UserLayout() {
  const { pathname } = useLocation();
  const hideNav = shouldHideNav(pathname);
  return (
    <div className="mx-auto min-h-screen max-w-md bg-bg">
      <div
        className={
          hideNav ? undefined : "pb-[calc(6rem+env(safe-area-inset-bottom))]"
        }
      >
        <Outlet />
      </div>
      {hideNav ? null : <BottomNav />}
    </div>
  );
}
