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
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!);
  }
  return _client;
}
