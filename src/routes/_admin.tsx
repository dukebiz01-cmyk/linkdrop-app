import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ location }) => {
    if (!isSupabaseConfigured) return;
    const { data } = await getSupabase().auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
    // TODO: user_roles에서 'staff' 또는 'admin' 역할 검증
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
