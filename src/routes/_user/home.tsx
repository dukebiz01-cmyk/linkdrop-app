import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HomePage, type DropFeedItem, type HomePageProps } from "@/components/home-page";
import { getAuthClient } from "@/lib/auth-context";
import { getDiscoverDrops, getSentDrops } from "@/lib/feed-queries";

export const Route = createFileRoute("/_user/home")({
  head: () => ({ meta: [{ title: "홈" }] }),
  loader: async (): Promise<{
    user: { name: string };
    discoverDrops: DropFeedItem[];
    sentDrops: DropFeedItem[];
  }> => {
    const supabase = await getAuthClient();
    if (!supabase) {
      return { user: { name: "사용자" }, discoverDrops: [], sentDrops: [] };
    }
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email ?? null;
    const userId = data.session?.user.id;
    const displayName = email ? email.split("@")[0] : "사용자";

    const [discoverDrops, sentDrops] = await Promise.all([
      getDiscoverDrops(supabase),
      userId ? getSentDrops(supabase, userId) : Promise.resolve([] as DropFeedItem[]),
    ]);

    return { user: { name: displayName }, discoverDrops, sentDrops };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { user, discoverDrops, sentDrops } = Route.useLoaderData();
  const navigate = useNavigate();
  const [category, setCategory] = useState<HomePageProps["category"]>("discover");
  const [activeTab, setActiveTab] = useState<HomePageProps["activeTab"]>("home");

  const drops = category === "discover" ? discoverDrops : category === "sent" ? sentDrops : [];

  return (
    <HomePage
      user={user}
      category={category}
      activeTab={activeTab}
      drops={drops}
      unreadCount={0}
      onCategoryChange={(cat) => setCategory(cat as HomePageProps["category"])}
      onDropClick={(shareUuid) => navigate({ to: "/d/$shareUuid", params: { shareUuid } })}
      onCreateDrop={() => navigate({ to: "/create" })}
      onTabChange={(tab) => {
        if (tab === "home") {
          setActiveTab("home");
          return;
        }
        if (tab === "explore") {
          setActiveTab("explore");
          setCategory("discover");
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (tab === "inbox") {
          setActiveTab("inbox");
          navigate({ to: "/inbox" });
        } else if (tab === "profile") {
          setActiveTab("profile");
          navigate({ to: "/profile" });
        } else {
          console.log("[home] unhandled tab:", tab);
        }
      }}
    />
  );
}
