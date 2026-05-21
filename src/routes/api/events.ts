// POST /api/events — 이벤트 추적 (Step 7 §3)
//
// 무로그인. track_drop_event RPC. best-effort — 실패해도 200 (사용자 경험 영향 X).
// 명세 입력(drop_id/visitor_anon_id/event_type/metadata) → v3.1 실제 시그니처
//   track_drop_event(p_event_type, p_info_drop_id, p_anonymous_id, p_context) 로 매핑.

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";

type EventBody = {
  drop_id?: string;
  visitor_anon_id?: string;
  event_type?: string;
  metadata?: Record<string, unknown>;
};

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as EventBody;
          if (!body.drop_id || !body.visitor_anon_id || !body.event_type) {
            return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
          }
          const supabase = getSupabaseServer();
          const { data, error } = await supabase.rpc("track_drop_event", {
            p_event_type: body.event_type,
            p_info_drop_id: body.drop_id,
            p_anonymous_id: body.visitor_anon_id,
            p_context: body.metadata ?? {},
          });
          if (error) {
            // best-effort: 실패해도 200 (이벤트 누락이 흐름을 막지 않음)
            console.warn("[/api/events] track failed:", error.message);
            return Response.json({ success: false }, { status: 200 });
          }
          return Response.json({ event_id: data, success: true });
        } catch {
          return Response.json({ success: false }, { status: 200 });
        }
      },
    },
  },
});
