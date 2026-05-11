/**
 * 자체 Supabase 프로젝트 raw 클라이언트.
 * - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 두 환경변수 기반.
 * - 빈 상태에서 throw 하지 않도록 lazy init.
 * - master-schema-v2.sql 적용된 자체 Supabase 프로젝트와 함께 사용.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase 환경변수가 비어있습니다. Workspace Build Secrets에 " +
        "VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 등록해 주세요.",
    );
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}