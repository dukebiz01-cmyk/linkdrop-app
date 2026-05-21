import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  HomePageV3,
  type HomePageV3NavTab,
  type HomeStartCreateParams,
} from "@/components/home-page-v3";
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

  const goLogin = (redirect?: string) =>
    navigate({ to: "/login", search: redirect ? ({ redirect } as never) : undefined });

  const handleNavTab = (tab: HomePageV3NavTab) => {
    if (tab === "home") return;
    goLogin();
  };

  const buildCreateRedirect = (params: HomeStartCreateParams) => {
    const q = new URLSearchParams({ url: params.url, purpose: params.purpose });
    if (params.intent_suggested) q.set("intent_suggested", params.intent_suggested);
    if (params.confidence) q.set("confidence", params.confidence);
    if (params.source_id) q.set("source_id", params.source_id);
    if (params.platform) q.set("platform", params.platform);
    return `/create-wizard?${q.toString()}`;
  };

  return (
    <HomePageV3
      activeNavTab="home"
      onNavTab={handleNavTab}
      onStartCreate={(params) => goLogin(buildCreateRedirect(params))}
    />
  );
}
