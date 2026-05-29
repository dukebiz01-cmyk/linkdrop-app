import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  HomePageV3,
  type HomePageV3NavTab,
  type HomeStartCreateParams,
} from "@/components/home-page-v3";
import { BottomNav } from "@/components/bottom-nav";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LinkDrop — 영상을 카드로" },
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

  // N4-fix1: v0 home-page-v3 내부 fixed bottom nav(5탭)는 CSS 셀렉터로 숨기고,
  // 공통 BottomNav(3탭) 를 형제로 렌더. BottomNav 는 wrapper 밖에 둬야 hidden
  // 셀렉터에 잡히지 않음 — wrapper 안에 두면 본 3탭까지 사라짐.
  // pb-16 = _user.tsx UserLayout 과 동일 — 콘텐츠가 BottomNav 에 가림 방지.
  return (
    <>
      <div className="[&_.fixed.bottom-0]:hidden pb-16">
        <HomePageV3
          activeNavTab="home"
          onNavTab={handleNavTab}
          onStartCreate={(params) => goLogin(buildCreateRedirect(params))}
        />
      </div>
      <BottomNav />
    </>
  );
}
