// /handoff — 카톡 인앱 → 크롬 세션 핸드오프 수신 라우트 (KAKAO-LINGO-1 B방식 · 공개, 가드 밖).
//
// 크롬이 이 URL 을 열면: ?code 를 /api/handoff/exchange 로 교환(1회용·60초 TTL 서버 판정)
// → refresh_token 으로 auth.refreshSession() = 세션 수립(브라우저 클라가 쿠키에 저장)
// → ?next(같은-오리진 가드: "/" 시작 · "//" 차단 — auth.callback 동일 규칙) 또는
//   /studio-build 로 replace. 실패 = 안내 1줄 표시 후 /login?error=handoff 로 replace.
// 성공 경로의 토큰은 화면·URL 에 노출하지 않는다(응답 body → setSession 직행).

import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const DEFAULT_NEXT = "/studio-build";

export const Route = createFileRoute("/handoff")({
  validateSearch: (search: Record<string, unknown>): { code?: string; next?: string } => {
    const code = typeof search.code === "string" ? search.code : undefined;
    const n = search.next;
    const next =
      typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : undefined;
    return { ...(code ? { code } : {}), ...(next ? { next } : {}) };
  },
  component: HandoffRoute,
});

function HandoffRoute() {
  const { code, next } = Route.useSearch();
  const navigate = useNavigate();
  const [failed, setFailed] = useState<string | null>(null);
  const ranRef = useRef(false); // StrictMode·리렌더 이중 실행 방지 — 코드는 1회용이라 재호출 = 자기 거부.

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const fail = (friendly: string) => {
      setFailed(friendly);
      // 안내 1줄을 잠깐 보여준 뒤 로그인으로(명세 §3 — /login?error=handoff).
      setTimeout(() => {
        void navigate({ to: "/login", search: { error: "handoff" } as never, replace: true });
      }, 1600);
    };
    if (!code || !isSupabaseConfigured) {
      fail("이어가기 링크가 올바르지 않아요. 다시 로그인해 주세요.");
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/handoff/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const json = (await res.json().catch(() => null)) as
          | { refresh_token?: string; friendly?: string }
          | null;
        if (!res.ok || !json?.refresh_token) {
          fail(json?.friendly ?? "이어가기 링크가 만료됐어요. 다시 로그인해 주세요.");
          return;
        }
        // refresh_token 단독 세션 수립 — setSession 은 access_token 짝이 필요해
        // 토큰-단독 교환에는 refreshSession 이 동등 정본(코드 테이블은 refresh_token 만 보관).
        const { error } = await getSupabase().auth.refreshSession({
          refresh_token: json.refresh_token,
        });
        if (error) {
          fail("로그인을 이어받지 못했어요. 다시 로그인해 주세요.");
          return;
        }
        void navigate({ to: next ?? DEFAULT_NEXT, replace: true });
      } catch {
        fail("네트워크가 불안정해요. 다시 로그인해 주세요.");
      }
    })();
  }, [code, next, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F8FAFC] px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {failed ? (
          <p className="text-[14px] font-semibold tracking-ko text-[#0F172A] [word-break:keep-all]">
            {failed}
          </p>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" strokeWidth={2.5} />
            <p className="text-[14px] font-semibold tracking-ko text-[#0F172A]">
              크롬에서 이어서 여는 중이에요…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
