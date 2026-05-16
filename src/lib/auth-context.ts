/**
 * SSR/브라우저 환경에 맞는 Supabase 클라이언트를 반환.
 * 양쪽 다 동일한 쿠키를 공유하므로 세션이 자동 동기화됨.
 *
 * `.server.ts` 모듈은 typeof window 체크 안에서만 동적으로 import →
 * Vite가 클라이언트 번들에서 안전하게 제거.
 */
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAuthClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  if (typeof window === "undefined") {
    const { getSupabaseServer } = await import("./supabase-server.server");
    return getSupabaseServer();
  }
  return getSupabase();
}
