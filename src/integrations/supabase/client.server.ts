// Scaffolding for server-side admin tasks. Currently used by /api/drops self_upload(서비스롤 INSERT).
// SECURITY: never import from client code.
// V2 secret key (sb_secret_*) since 2026-05-16; legacy SUPABASE_SERVICE_ROLE_KEY removed.
//
// env 접근(중요): Cloudflare Workers 핸들러 컨텍스트에서 `process.env`는 신뢰할 수 없다.
//   특히 process.env.SUPABASE_URL 이 "truthy 인데 유효하지 않은 값"이면 `??` 폴백이 그걸
//   집어 검증된 VITE 값을 못 써서 createClient "Invalid supabaseUrl" → 500.
//   → URL 은 new URL() 로 검증해 유효한 후보를 고른다(invalid 는 건너뜀). 후보 순서:
//   ALS(live Worker env) → import.meta.env.VITE_SUPABASE_URL(SSR 클라와 동일·빌드 인라인·검증됨)
//   → process.env. getWorkerEnv() 는 src/server.ts 가 workerEnvStore.run({env}) 로 흘린
//   env 객체(top-level) — discover getKV(wenv.KV)와 동일 shape.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getWorkerEnv } from "@/lib/worker-env.server";

/** 후보 중 new URL() 로 파싱되는 첫 유효 URL. truthy-but-invalid 값은 건너뛴다. */
function pickValidUrl(...candidates: Array<string | undefined>): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      try {
        new URL(c.trim());
        return c.trim();
      } catch {
        /* invalid candidate — skip */
      }
    }
  }
  return undefined;
}

function createSupabaseAdminClient() {
  const wenv = (getWorkerEnv() ?? {}) as Record<string, string | undefined>;

  const procUrl = typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined;
  const viteUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  // VITE 를 process.env 보다 앞에 — SSR 클라가 쓰는 검증된 값. 게다가 검증으로 invalid 제외.
  const SUPABASE_URL = pickValidUrl(wenv.SUPABASE_URL, viteUrl, procUrl);

  // SECRET — ALS → process.env (브라우저 노출 금지 → VITE 폴백 없음).
  //   하드닝: 대시보드 복붙 시 끝에 공백/개행이 붙으면 PostgREST 401(빈 에러) → .trim() 으로 방어.
  //   (URL 은 pickValidUrl 이 이미 trim 한 값을 반환.)
  const SUPABASE_SECRET_KEY = (
    wenv.SUPABASE_SECRET_KEY ??
    (typeof process !== "undefined" ? process.env.SUPABASE_SECRET_KEY : undefined)
  )?.trim();

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_SECRET_KEY ? ["SUPABASE_SECRET_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
