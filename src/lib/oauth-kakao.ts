/**
 * 카카오 OAuth 시작 — F2-a 핵심 흐름 보존 + H1-d funnel 복귀 지원.
 *
 * `next` 가 주어지면 callback URL 에 `?next={경로}` 부착 → auth.callback 이
 * 토큰 처리 완료 후 그 경로로 복귀. `next` 없으면 callback 이 /home 으로 기본
 * 복귀(기존 이메일/일반 카톡 로그인 흐름 무영향, 회귀 0).
 *
 * `next` 는 같은 origin 내부 경로만(/로 시작, // 차단) — auth.callback 측에서도
 * 같은 가드를 한 번 더 적용.
 *
 * scopes 는 F2-a-fix scope-nickname 그대로 — `profile_nickname` 만 요청해
 * 이메일 검수 영구 회피.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type StartKakaoLoginResult =
  | { ok: true }
  | { ok: false; reason: "no_config" | "ssr" | "oauth_error"; message?: string };

export async function startKakaoLogin(next?: string): Promise<StartKakaoLoginResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: "no_config" };
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const callback = `${window.location.origin}/auth/callback`;
  const redirectTo = safeNext
    ? `${callback}?next=${encodeURIComponent(safeNext)}`
    : callback;

  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo,
      // 카카오는 닉네임만 요청 (메모리 #20 회원 전환점). KOE205 + 이메일 검수 영구
      // 회피. F2-a-fix scope-nickname 과 동일.
      scopes: "profile_nickname",
    },
  });

  if (error) {
    console.error("[startKakaoLogin] signInWithOAuth failed:", error);
    return { ok: false, reason: "oauth_error", message: error.message };
  }
  return { ok: true };
  // 성공 시 카카오 동의 화면으로 자동 리다이렉트 — 이 함수는 반환 안 될 수도 있음.
}
