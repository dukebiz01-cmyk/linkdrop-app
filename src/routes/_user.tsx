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
  },
  component: UserLayout,
});

// focused 화면 — 공통 nav 숨김 (D0 짤림 방지 + 화면 집중도).
// results·coupon 은 자체 화면이 풀높이 + 자체 CTA 가 있어 nav 가 겹친다.
function shouldHideNav(pathname: string): boolean {
  return pathname.startsWith("/results") || pathname.startsWith("/coupon");
}

function UserLayout() {
  const { pathname } = useLocation();
  const hideNav = shouldHideNav(pathname);
  return (
    <div className="mx-auto min-h-screen max-w-md bg-bg">
      <div className={hideNav ? undefined : "pb-16"}>
        <Outlet />
      </div>
      {hideNav ? null : <BottomNav />}
    </div>
  );
}
