import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HomePage, type HomePageProps } from "@/components/home-page";
import { getAuthClient } from "@/lib/auth-context";

export const Route = createFileRoute("/_user/home")({
  head: () => ({ meta: [{ title: "홈" }] }),
  loader: async () => {
    const supabase = await getAuthClient();
    if (!supabase) return { user: { name: "사용자" } };
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email ?? null;
    const displayName = email ? email.split("@")[0] : "사용자";
    return { user: { name: displayName } };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { user } = Route.useLoaderData();
  const navigate = useNavigate();
  const [category, setCategory] = useState<HomePageProps["category"]>("received");

  return (
    <HomePage
      user={user}
      category={category}
      drops={[]}
      unreadCount={0}
      onCategoryChange={(cat) => setCategory(cat as HomePageProps["category"])}
      onDropClick={(shareUuid) => navigate({ to: "/d/$shareUuid", params: { shareUuid } })}
      onCreateDrop={() => navigate({ to: "/create" })}
      onTabChange={(tab) => {
        if (tab === "home") return;
        if (tab === "inbox") navigate({ to: "/inbox" });
        else if (tab === "profile") navigate({ to: "/profile" });
        else console.log("[home] unhandled tab:", tab);
      }}
    />
  );
}
