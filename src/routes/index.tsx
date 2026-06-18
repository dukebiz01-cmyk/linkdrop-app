import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { HomePageV3 } from "@/components/home-page-v3";
import { BottomNav } from "@/components/bottom-nav";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getAuthClient } from "@/lib/auth-context";

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
    // isomorphic 클라 — SSR(서버)에서도 세션을 읽어 랜딩 렌더 전에 /home redirect → flash 제거.
    //   (브라우저 전용 getSupabase()는 SSR에 document 없어 session=null → 클라에서야 redirect되어 깜빡임.)
    const supabase = await getAuthClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
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
        {/* 사업자 푸터는 __root 글로벌 BusinessFooter(공개 경로)로 이전 — 중복 제거. */}
      </div>
      <BottomNav />
    </>
  );
}
