/**
 * Lovable Cloud 클라이언트 래퍼.
 * 실제 클라이언트는 `src/integrations/supabase/client.ts`(자동 생성)에서 옵니다.
 */
import { supabase } from "@/integrations/supabase/client";

export function getSupabase() {
  return supabase;
}

// Cloud 활성화 후에는 항상 true.
export const isSupabaseConfigured = true;