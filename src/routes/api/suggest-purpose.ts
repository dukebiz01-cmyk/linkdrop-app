// POST /api/suggest-purpose — 영상 목적 추천 (Home UX)
//
// purpose-suggestion.ts(클라이언트 helper)가 호출하는 엔드포인트.
// suggest-purpose Edge Function 은 verify_jwt=true + user_id 필수라 클라이언트가
// 직접 못 부른다 → 이 Route 가 서버에서 user 를 확인하고 user JWT 로 Edge Function 호출.
//
// 입력:  { source_id, url?, title?, platform?, author_name? }  (source_id 만 사용)
// 출력:  { purpose, confidence, reasoning, alternatives, cached, ai_generation_id }

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import { invokeEdge } from "@/lib/edge-invoke.server";

export const Route = createFileRoute("/api/suggest-purpose")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { source_id?: string };
          if (!body.source_id) {
            return Response.json(
              { error: "INVALID_INPUT", message: "source_id가 필요해요." },
              { status: 400 },
            );
          }

          const supabase = getSupabaseServer();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            return Response.json(
              { error: "UNAUTHORIZED", message: "로그인이 필요해요." },
              { status: 401 },
            );
          }
          const {
            data: { session },
          } = await supabase.auth.getSession();

          // suggest-purpose Edge Function (verify_jwt=true) — user JWT 전달
          const result = await invokeEdge(
            "suggest-purpose",
            { source_id: body.source_id, user_id: user.id },
            session?.access_token ?? null,
          );
          if (result.error || !result.data) {
            return Response.json(
              {
                error: "SUGGEST_FAILED",
                message: "목적 추천에 실패했어요.",
                details: result.error,
              },
              { status: 502 },
            );
          }
          return Response.json(result.data);
        } catch {
          return Response.json(
            { error: "INTERNAL_ERROR", message: "서버 오류가 발생했어요." },
            { status: 500 },
          );
        }
      },
    },
  },
});
