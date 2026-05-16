import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";

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

function UserLayout() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-bg">
      <Outlet />
    </div>
  );
}
