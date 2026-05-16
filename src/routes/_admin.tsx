import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";

/**
 * 관리자(staff/admin) 보호 레이아웃.
 * - 비로그인: /login
 * - 로그인했지만 staff/admin 둘 다 false: / 로 redirect
 */
export const Route = createFileRoute("/_admin")({
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
    const [{ data: isStaff }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: session.user.id, _role: "staff" }),
      supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }),
    ]);
    if (!isStaff && !isAdmin) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-bg">
      <Outlet />
    </div>
  );
}
