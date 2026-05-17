/**
 * 환경별 Supabase 클라이언트를 반환. 양쪽 모두 같은 쿠키를 읽으므로 세션이 공유된다.
 *
 * `createIsomorphicFn`은 TanStack Start의 start-compiler-plugin이 빌드 시
 * 환경별로 한쪽 branch만 남기고 잘라낸다 (`handleCreateIsomorphicFn.ts` 참고).
 * 따라서 `.server(...)` 안의 dynamic `import("./supabase-server.server")`는
 * 클라이언트 번들에서 완전히 제거된다 — 이전 `typeof window` 가드 방식은
 * dynamic import 청크가 클라이언트 빌드에 남아 `@tanstack/react-start/server`
 * import-protection을 위반하던 문제가 있었다.
 */
import { createIsomorphicFn } from "@tanstack/react-start";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const getAuthClient = createIsomorphicFn()
  .client(async (): Promise<SupabaseClient | null> => {
    if (!isSupabaseConfigured) return null;
    return getSupabase();
  })
  .server(async (): Promise<SupabaseClient | null> => {
    if (!isSupabaseConfigured) return null;
    const { getSupabaseServer } = await import("./supabase-server.server");
    return getSupabaseServer();
  });
