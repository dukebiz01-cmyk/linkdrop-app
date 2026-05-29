import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * OAuth callback — 카카오 동의 후 redirect 도착 지점.
 *
 * Flow: implicit (F2a-cb-fix5 — PKCE grant 엔드포인트가 이 프로젝트에서 404 거부).
 *   토큰은 URL hash(`#access_token=...&refresh_token=...&expires_in=...`)로 도착.
 *
 * F2a-cb-fix6: detectSessionInUrl 자동 처리만 의존하지 않고 hash 를 명시적으로 파싱·
 *   setSession 한다. fix5 의 8초 타임아웃 원인이 (a) ssr:false 클라 마운트 지연으로
 *   hash 가 사라지는 케이스, (b) TanStack Router 가 hash 가로채는 케이스, (c)
 *   onAuthStateChange 구독이 SIGNED_IN 발화보다 늦은 케이스 셋 다 대응.
 *
 * 처리 흐름:
 *   1. onAuthStateChange 먼저 구독 (SIGNED_IN 놓치지 않게)
 *   2. getSession 즉시 확인 — 이미 끝났거나 기존 로그인
 *   3. URL hash 명시 파싱 + setSession({ access_token, refresh_token })
 *   4. getSession 500ms 폴링 (10회 = 5초) — detectSessionInUrl 비동기 처리 대기
 *   5. 8초 최종 타임아웃 → /login?error=oauth (콘솔에 hash/search 로깅)
 *
 * ⚠️ ssr:false 유지 — F2a-cb-fix4 의 hydration 타이밍 보호.
 * ⚠️ 부모 가드 없음 — _user/_partner/_admin 아래에 두지 말 것 (로그인 전 접근 보장).
 */
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "로그인 처리 중 — LinkDrop" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setErrorMsg("Supabase 연결 정보가 없어요.");
      return;
    }
    if (typeof window === "undefined") return;

    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let subscription: { unsubscribe: () => void } | undefined;
    const supabase = getSupabase();

    const finish = (path: string) => {
      if (done) return;
      done = true;
      subscription?.unsubscribe();
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
      window.location.replace(path);
    };

    (async () => {
      // 1) onAuthStateChange 먼저 구독 — SIGNED_IN 이벤트 놓치지 않게.
      const sub = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) finish("/home");
      });
      subscription = sub.data.subscription;

      // 2) 마운트 시점에 이미 세션 있나.
      const { data: pre } = await supabase.auth.getSession();
      if (pre?.session) {
        finish("/home");
        return;
      }

      // 3) implicit hash 명시 처리 — URL hash 에 access_token 있으면 setSession.
      const hash = window.location.hash; // #access_token=...&refresh_token=...
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!error) {
            finish("/home");
            return;
          }
          console.error("[auth.callback] setSession failed:", error);
        }
      }

      // 4) getSession 폴링 (500ms × 10 = 5초) — detectSessionInUrl 비동기 처리 대기.
      let tries = 0;
      poll = setInterval(async () => {
        tries++;
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          finish("/home");
          return;
        }
        if (tries >= 10 && poll) clearInterval(poll);
      }, 500);

      // 5) 8초 최종 타임아웃 — 콘솔에 hash/search 출력 (다음 진단 단서).
      timer = setTimeout(() => {
        if (done) return;
        console.error(
          "[auth.callback] timeout — no session after 8s.",
          "hash:", window.location.hash,
          "search:", window.location.search,
        );
        setErrorMsg("로그인 처리에 실패했어요. 다시 시도해 주세요.");
        finish("/login?error=oauth");
      }, 8000);
    })();

    return () => {
      if (!done) {
        subscription?.unsubscribe();
        if (timer) clearTimeout(timer);
        if (poll) clearInterval(poll);
      }
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 tracking-ko">
      <div className="flex flex-col items-center gap-4">
        <span
          className="size-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#2563EB]"
          aria-hidden
        />
        <p className="text-sm font-semibold text-[#0F172A]">
          {errorMsg ?? "로그인 처리 중이에요..."}
        </p>
      </div>
    </main>
  );
}
