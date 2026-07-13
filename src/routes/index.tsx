import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { HomePageV3 } from "@/components/home-page-v3";
import { BottomNav } from "@/components/bottom-nav";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getAuthClient } from "@/lib/auth-context";

// BUG-3B — 루트(/) SSR 응답에 no-store: 로그아웃 랜딩(구 메인 HomePageV3)이 엣지/브라우저
//   캐시에 고착돼 로그인 유저에게 재노출되는 경로 차단. 서버 브랜치만 실체 — start-compiler-plugin
//   이 클라 번들에서 .server() 를 제거하므로 @tanstack/react-start/server import 는 클라에 안 남는다.
const setRootNoStore = createIsomorphicFn()
  .client(() => {})
  .server(async () => {
    try {
      const { setResponseHeader } = await import("@tanstack/react-start/server");
      setResponseHeader("Cache-Control", "private, no-store");
    } catch {
      // 헤더 설정 실패는 치명 아님 — 랜딩/리다이렉트 렌더는 계속.
    }
  });

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
    // BUG-3B — 루트 응답 no-store(서버에서만 실효, 클라 no-op). 세션 유무와 무관하게 부착.
    await setRootNoStore();
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
  // BUG-3B — SSR 세션 판정이 쿠키 레이스로 미스했을 때 로그인 유저에게 구 메인(HomePageV3)이
  //   노출되는 것을 클라 마운트 후 세션 재확인 1회로 차단. 세션 있으면 현 홈으로 replace 이동.
  //   재확인 완료 전에는 로딩만 렌더(구 메인 깜빡임 최소화). 비로그인은 재확인 후 즉시 랜딩.
  const [checking, setChecking] = useState(isSupabaseConfigured);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    void (async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (!alive) return;
        if (data.session) {
          void navigate({ to: "/home", replace: true });
          return; // checking 유지 → 이동 중 로딩만(구 메인 미표시)
        }
      } catch {
        // 세션 조회 실패 = 비로그인 취급 → 아래 랜딩 렌더.
      }
      if (alive) setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  const goLogin = (redirectPath?: string) =>
    navigate({
      to: "/login",
      search: redirectPath ? ({ redirect: redirectPath } as never) : undefined,
    });

  // BUG-3B — 세션 재확인 완료 전(또는 로그인 유저 /home 이동 중): 구 메인 대신 로딩만.
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <span
          className="size-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#0A0A0A]"
          aria-hidden
        />
      </div>
    );
  }

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
