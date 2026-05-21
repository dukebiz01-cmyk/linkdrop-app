// GET /api/drops/$shareCode — Drop 상세 조회 (Step 7 §2)
//
// 무로그인 열람. get_drop_detail RPC(SECURITY DEFINER, anon EXECUTE)를 호출한다.

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";

export const Route = createFileRoute("/api/drops/$shareCode")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const supabase = getSupabaseServer();
          const { data, error } = await supabase.rpc("get_drop_detail", {
            p_share_uuid: params.shareCode,
          });
          if (error || !data) {
            return Response.json(
              { error: "NOT_FOUND", message: "Drop을 찾을 수 없어요." },
              { status: 404 },
            );
          }
          return Response.json(data, {
            headers: { "Cache-Control": "public, max-age=60" },
          });
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
