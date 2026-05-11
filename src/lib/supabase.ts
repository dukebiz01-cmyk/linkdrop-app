import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Raw Supabase client. Reads credentials from Vite env at build time.
 * Both vars must be set in `.env.local` (see `.env.example`).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase 연결 정보가 없어요. `.env.local`에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 설정해 주세요.",
    );
  }
  _client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

export const isSupabaseConfigured = Boolean(url && anonKey);