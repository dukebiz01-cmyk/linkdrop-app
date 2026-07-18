import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LandingPageV5 } from "@/components/landing-v5/landing-page-v5";
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

// S3-B — 로그인 흔적 동기 판별. @supabase/ssr createBrowserClient 는 세션을
//   sb-<project-ref>-auth-token 쿠키(용량 초과 시 .0/.1… 청크)에 저장(supabase.ts 주석 근거).
//   흔적만 판별 — 유효성은 getSession 재확인이 담당. SSR(document 없음)에서는 false.
function hasAuthCookieTrace(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sb-[a-z0-9-]+-auth-token(?:\.\d+)?=/i.test(document.cookie);
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "링크드롭 — 영상 링크 하나로, 예약과 혜택까지" },
      {
        name: "description",
        content:
          "영상 링크를 붙여넣으면 AI가 예약·쿠폰·판매 행동 카드로 만들어 카카오톡으로 공유해드려요.",
      },
      { property: "og:title", content: "링크드롭 — 영상 링크 하나로, 예약과 혜택까지" },
      {
        property: "og:description",
        content:
          "영상 링크를 붙여넣으면 AI가 예약·쿠폰·판매 행동 카드로 만들어 카카오톡으로 공유해드려요.",
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
  // S3-B — 초기값 false(SSR·hydration 동일 = 랜딩). 스피너는 "로그인 흔적 있음"일 때만
  //   effect 가 켠다. 흔적 없음(신규/로그아웃 손님) = 스피너 0, 랜딩 즉시.
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // S3-B — 로그인 흔적 없으면 재확인·스피너 생략(랜딩 즉시). 흔적 있을 때만 세션 재확인.
    if (!hasAuthCookieTrace()) return;
    let alive = true;
    setChecking(true);
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

  // LAND-1 — 비로그인 랜딩 = LandingPageV5(v0 48 정본). CTA는 컴포넌트 내부에서 /login 유도.
  // 공통 BottomNav (v0 검정 4탭) 는 무로그인 진입점에서도 렌더.
  return (
    <>
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <LandingPageV5 />
        {/* 사업자 푸터는 __root 글로벌 BusinessFooter(공개 경로)로 이전 — 중복 제거. */}
      </div>
      <BottomNav />
    </>
  );
}
