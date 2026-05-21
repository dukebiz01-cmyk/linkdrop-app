// GET /api/oembed?url=... — 영상 메타 미리보기 (Step 7 §7)
//
// 사용자가 영상 링크를 paste 하면 입력창에서 즉시 미리보기를 띄우기 위한 엔드포인트.
// extract-meta Edge Function 을 호출(content_sources 캐싱 활용). 무로그인 가능.

import { createFileRoute } from "@tanstack/react-router";
import { invokeEdge } from "@/lib/edge-invoke.server";

export const Route = createFileRoute("/api/oembed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const videoUrl = new URL(request.url).searchParams.get("url");
          if (!videoUrl) {
            return Response.json(
              { error: "MISSING_URL", message: "영상 링크가 필요해요." },
              { status: 400 },
            );
          }

          // 무로그인 — accessToken 없이 호출 (extract-meta 는 AI 아님)
          const meta = await invokeEdge("extract-meta", { url: videoUrl }, null);
          if (meta.error || !meta.data) {
            return Response.json(
              {
                error: "OEMBED_FAILED",
                message: "영상 정보를 불러올 수 없어요. 링크를 확인해 주세요.",
                details: meta.error,
              },
              { status: 400 },
            );
          }

          return Response.json(meta.data);
        } catch (e) {
          return Response.json(
            { error: "INTERNAL_ERROR", message: "서버 오류가 발생했어요." },
            { status: 500 },
          );
        }
      },
    },
  },
});
