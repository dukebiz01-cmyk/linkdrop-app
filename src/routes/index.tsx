import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { HomePageV3, type HomePageV3NavTab } from "@/components/home-page-v3";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LinkDrop — 영상을 Drop으로" },
      {
        name: "description",
        content:
          "유튜브·인스타 링크를 붙이면 AI가 핵심을 정리하고, 쿠폰·예약·구매·상담 버튼까지 추천해요.",
      },
      { property: "og:title", content: "LinkDrop" },
      {
        property: "og:description",
        content:
          "유튜브·인스타 링크를 붙이면 AI가 핵심을 정리하고, 쿠폰·예약·구매·상담 버튼까지 추천해요.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await getSupabase().auth.getSession();
    if (data.session) {
      throw redirect({ to: "/home" });
    }
  },
  component: IndexHomePage,
});

function IndexHomePage() {
  const navigate = useNavigate();

  const goLogin = () => navigate({ to: "/login" });

  const handleNavTab = (tab: HomePageV3NavTab) => {
    if (tab === "home") return;
    goLogin();
  };

  return (
    <HomePageV3
      activeNavTab="home"
      onNavTab={handleNavTab}
      onPurposeClick={goLogin}
    />
  );
}
