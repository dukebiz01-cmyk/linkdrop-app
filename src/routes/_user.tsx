import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/_user")({
  beforeLoad: async ({ location }) => {
    if (!isSupabaseConfigured) return;
    const { data } = await getSupabase().auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href } as never,
      });
    }
  },
  component: UserLayout,
});

function UserLayout() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-bg">
      <Outlet />
    </div>
  );
}