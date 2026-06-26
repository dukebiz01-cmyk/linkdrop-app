// POST /api/generate-summary — 영상 메타 → AI 요약 + 핵심포인트 5개 (한마디 AI 제안)
//
// generate-summary Edge Function 은 verify_jwt=true + user_id 필수라 클라이언트가
// 직접 못 부른다 → 이 Route 가 서버에서 user 를 확인하고 user JWT 로 Edge Function 호출.
// (generate-promo-copy 라우트 패턴 차용.)
//
// 입력:  { source_id, purpose? }   (drop_id 안 받음 — 저장 전 미리보기 호출이라 drop 없음)
// 출력:  { ai_summary, ai_key_points, cached, ai_generation_id }

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import { invokeEdge } from "@/lib/edge-invoke.server";

export const Route = createFileRoute("/api/generate-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            source_id?: string;
            purpose?: string;
          };
          if (!body.source_id || !body.source_id.trim()) {
            return Response.json(
              { error: "INVALID_INPUT", message: "영상 정보(source_id)가 필요해요." },
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

          const result = await invokeEdge(
            "generate-summary",
            {
              source_id: body.source_id.trim(),
              // 미리보기 단계라 purpose 추정이 안 왔을 수 있음 → 기본 "정보"(안전).
              purpose: body.purpose ?? "정보",
              user_id: user.id,
              // drop_id 안 넘김 — 저장 전 호출이라 drop 없음. Edge 는 source_id 만으로 동작.
            },
            session?.access_token ?? null,
          );
          if (result.error || !result.data) {
            return Response.json(
              {
                error: "SUMMARY_FAILED",
                message: "요약 생성에 실패했어요. 직접 입력해 주세요.",
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
