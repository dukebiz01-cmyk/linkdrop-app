// POST /api/handoff/create — 카톡 인앱 → 크롬 세션 핸드오프 1회용 코드 발급 (KAKAO-LINGO-1 B방식).
//
// 쿠키 세션 필수(무세션 401). 현재 세션의 refresh_token 을 handoff_codes 에 저장하고
// code(uuid)만 반환한다 — 토큰 자체는 URL 에 싣지 않는다(§4 ②단명·URL 비저장).
// 쓰기는 service role 전용(supabaseAdmin) — 테이블은 RLS + revoke 로 클라 접근 전면 차단.
// 검증·1회용 처리(사용 마킹)는 exchange 라우트가 담당.

import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function jsonResponse(body: object, status: number): Response {
  return Response.json(body, { status });
}

export const Route = createFileRoute("/api/handoff/create")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const supabase = getSupabaseServer();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            return jsonResponse({ code: "unauthorized", friendly: "로그인이 필요해요." }, 401);
          }
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const refreshToken = session?.refresh_token;
          if (!refreshToken) {
            return jsonResponse({ code: "unauthorized", friendly: "로그인이 필요해요." }, 401);
          }

          // handoff_codes 는 신설 테이블 — 생성 타입(Database) 재생성 전이라 무타입 경유.
          const admin = supabaseAdmin as unknown as SupabaseClient;
          const { data, error } = await admin
            .from("handoff_codes")
            .insert({ user_id: user.id, refresh_token: refreshToken })
            .select("code")
            .single();
          if (error || !data?.code) {
            console.error("[api/handoff/create] insert failed:", error?.message);
            return jsonResponse(
              { code: "create_failed", friendly: "잠시 후 다시 시도해 주세요." },
              500,
            );
          }
          return jsonResponse({ code: data.code as string }, 200);
        } catch (e) {
          console.error("[api/handoff/create] unexpected:", String((e as Error).message ?? e));
          return jsonResponse(
            { code: "internal_error", friendly: "잠시 후 다시 시도해 주세요." },
            500,
          );
        }
      },
    },
  },
});
