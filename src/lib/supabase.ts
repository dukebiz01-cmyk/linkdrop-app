/**
 * 자체 Supabase 프로젝트 raw 클라이언트 (브라우저 전용).
 * V2 publishable key 기반 (legacy JWT anon key는 2026-05-16 전환으로 폐기).
 * - 빈 상태에서 throw 하지 않도록 lazy init.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

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
    _client = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}
