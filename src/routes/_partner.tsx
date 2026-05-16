import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";

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
  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-bg">
      <Outlet />
    </div>
  );
}
