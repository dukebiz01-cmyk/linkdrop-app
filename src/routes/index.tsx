import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { HomePageV3 } from "@/components/home-page-v3";
import { BottomNav } from "@/components/bottom-nav";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LinkDrop — 영상을 카드로" },
      {
        name: "description",
        content:
          "영상 링크 하나로, 예약·혜택까지. 붙여넣으면 AI가 행동 카드로 만들어드려요.",
      },
      { property: "og:title", content: "LinkDrop" },
      {
        property: "og:description",
        content:
          "영상 링크 하나로, 예약·혜택까지. 붙여넣으면 AI가 행동 카드로 만들어드려요.",
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

  const goLogin = (redirectPath?: string) =>
    navigate({
      to: "/login",
      search: redirectPath ? ({ redirect: redirectPath } as never) : undefined,
    });

  // phase1-#1 마무리: home-page-v3 내장 nav 제거됨 → CSS 숨김 셀렉터 불필요.
  // 공통 BottomNav (v0 검정 4탭) 는 무로그인 진입점에서도 렌더 — 탭 클릭 시
  // goLogin() 또는 placeholder 로 유도.
  return (
    <>
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <HomePageV3
          onCreateDrop={(url, purpose) => {
            const q = new URLSearchParams({ url });
            if (purpose) q.set("purpose", purpose);
            goLogin(`/create-wizard?${q.toString()}`);
          }}
          onViewDrop={() => goLogin()}
          onViewAllDrops={() => goLogin()}
          onTabChange={(tab) => {
            if (tab === "home") return;
            goLogin();
          }}
          onNotifications={() => goLogin()}
        />
        {/* 공개(비로그인) 푸터 — 사업자 정보 도달점(Kakao 심사/전상법). HomePageV3(v0)는 미수정. */}
        <footer className="px-6 pb-8 pt-2 text-center">
          <a
            href="/business-info"
            className="text-xs font-medium tracking-ko text-[#A3A3A3] underline-offset-2 transition-colors hover:text-[#525252] hover:underline"
          >
            사업자 정보
          </a>
        </footer>
      </div>
      <BottomNav />
    </>
  );
}
