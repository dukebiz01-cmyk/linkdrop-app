/**
 * Lovable Cloud 클라이언트 래퍼.
 * 실제 클라이언트는 `src/integrations/supabase/client.ts`(자동 생성)에서 옵니다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// 스키마 마이그레이션 전이라 자동 생성 타입에 테이블이 없을 수 있어
// 임시로 느슨한 타입(SupabaseClient<any>)으로 노출합니다.
const loose = supabase as unknown as SupabaseClient;

export function getSupabase(): SupabaseClient {
  return loose;
}

// Cloud 활성화 후에는 항상 true.
export const isSupabaseConfigured = true;