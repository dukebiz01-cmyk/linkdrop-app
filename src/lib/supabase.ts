/**
 * 브라우저 Supabase 클라이언트 — @supabase/ssr의 createBrowserClient 기반.
 * document.cookie에 세션을 저장하므로 SSR 가드(서버측)에서도 같은 세션을 읽을 수 있다.
 * (이전 localStorage 기반은 서버에서 보이지 않아 _user/_partner/_admin guard가
 *  로그인 직후 풀-페이지 navigation에서 세션을 못 찾고 /login으로 튕기는 버그가 있었음.)
 *
 * 서버 측에서는 src/lib/supabase-server.server.ts의 getSupabaseServer()를 사용.
 * 양쪽 모두 동일한 쿠키를 읽으므로 세션은 자동 공유됨.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let _client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase 환경변수가 비어있습니다. .env.local 또는 Cloudflare Workers Secrets에 " +
        "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY를 등록해 주세요.",
    );
  }
  if (!_client) {
    // flowType: "implicit" — F2a-cb-fix5. PKCE grant 엔드포인트가 이 프로젝트에서
    // 404 거부 (verifier 문제 아님 — ssr:false 후에도 동일). implicit 으로 전환하면
    // 토큰이 URL hash 로 직접 오고 detectSessionInUrl 이 자동 처리 → token 교환 POST
    // 자체가 불필요해 404 우회. SPA 안전성은 다소 낮으나 SSR 구성에서 안정적.
    // persistSession/autoRefreshToken 유지로 F5 세션 유지(메모리 #17) 보존.
    // ⚠️ 같은 클라이언트를 signInWithPassword(이메일 로그인)도 사용 — 회귀 확인 필수.
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        flowType: "implicit",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}
