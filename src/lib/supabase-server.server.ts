/**
 * 서버(Cloudflare Workers SSR) 전용 Supabase 클라이언트.
 * TanStack Start의 요청 컨텍스트(`getCookies` / `setCookie`)에서 쿠키를 읽고 쓴다.
 *
 * `.server.ts` suffix → Vite가 클라이언트 번들에서 제거.
 * route beforeLoad에서는 src/lib/auth-context.ts의 getAuthClient()를 통해 동적으로 import.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseServer(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) {
    throw new Error(
      "Supabase 환경변수가 비어있습니다. VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY 필요.",
    );
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        const all = getCookies();
        return Object.entries(all).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options as CookieOptions);
        }
      },
    },
  });
}
