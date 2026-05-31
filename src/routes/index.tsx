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

  // A 단계 임시 stub — B+C 와이어링에서 purpose 매핑·라우트 분기 정식 적용.
  // 무로그인 사용자는 모든 동작이 /login 으로 유도되고, 카드 생성 의도는
  // ?redirect= 로 보존되어 로그인 후 /create-wizard 로 복귀.
  return (
    <>
      <div className="pb-16 [&_.fixed.bottom-0]:hidden">
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
          onSearch={() => goLogin()}
          onNotifications={() => goLogin()}
        />
      </div>
      <BottomNav />
    </>
  );
}
