import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import { BottomNav } from "@/components/bottom-nav";

/**
 * 파트너(approved owner) 보호 레이아웃.
 * - 비로그인: /login
 * - 로그인했지만 owner가 아님: /partner/register
 */
export const Route = createFileRoute("/_partner")({
  beforeLoad: async ({ location }) => {
    const supabase = await getAuthClient();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href } as never,
      });
    }

    // /partner/register 자체는 owner 아님 상태에서 접근해야 하므로 통과
    if (location.pathname === "/partner/register") return;

    const { data: isOwner } = await supabase.rpc("is_active_partner_owner", {
      _user_id: session.user.id,
    });
    if (!isOwner) {
      throw redirect({ to: "/partner/register" });
    }
  },
  component: PartnerLayout,
});

function PartnerLayout() {
  // B-1 fix: 파트너 화면 갇힘 방지 — 메인 앱과 동일한 BottomNav 노출.
  // User 단일 역할(#30)이라 같은 사용자가 파트너↔메인을 자유롭게 오감.
  // 콘텐츠 하단 패딩은 _user.tsx 와 같은 값으로 nav(h-16 + safe-area) 가림 방지.
  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-bg">
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
