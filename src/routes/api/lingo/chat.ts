// POST /api/lingo/chat — 링고 대화 SSE 중계 (T3)
//
// lingo-chat Edge Function 은 verify_jwt + user JWT 필수라 클라이언트가 직접 못 부른다
// → 이 Route 가 서버에서 세션을 확인하고 user JWT 로 Edge 를 호출, SSE 를 무버퍼 파이프한다.
// (세션 확인·JWT 승계 = generate-summary.ts 패턴. 단 invokeEdge 는 res.json() 통짜라
//  스트림에 못 쓰므로 fetch 직결 — env 해석은 edge-invoke.server.ts 와 동일 승계.)
//
// 입력:  { session_id?, message(필수·2000자 이하), context?, input_channel:'text' }
// 출력:  Edge 응답이 text/event-stream 이면 body 스트림 그대로(웹표준 ReadableStream,
//        Cloudflare Workers 호환 — Node 스트림 API 미사용). JSON(quota 429 등)이면
//        상태코드·본문 그대로. 네트워크 실패는 502 friendly JSON(예외 던지지 않음).
// 키·토큰은 로그에 출력하지 않는다.

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";

// env 승계 — edge-invoke.server.ts 와 동일한 해석 순서(process.env 우선, VITE_ 폴백).
const SUPABASE_URL =
  (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ??
  (import.meta.env.VITE_SUPABASE_URL as string | undefined);
const PUBLISHABLE_KEY =
  (typeof process !== "undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);

const MAX_MESSAGE_CHARS = 2000;

function jsonResponse(body: object, status: number): Response {
  return Response.json(body, { status });
}

export const Route = createFileRoute("/api/lingo/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
            return jsonResponse(
              { code: "not_configured", friendly: "서버 설정이 아직 안 됐어요." },
              500,
            );
          }

          // 0) 최소 검증 — message 존재·길이, input_channel 은 'text' 만(미전송 = text 취급).
          let body: {
            session_id?: string | null;
            message?: string;
            context?: unknown;
            input_channel?: string;
          };
          try {
            body = await request.json();
          } catch {
            return jsonResponse(
              { code: "invalid_json", friendly: "요청을 읽지 못했어요. 다시 시도해 주세요." },
              400,
            );
          }
          const message = (body.message ?? "").trim();
          if (!message) {
            return jsonResponse(
              { code: "empty_message", friendly: "하고 싶은 말을 입력해 주세요." },
              400,
            );
          }
          if (message.length > MAX_MESSAGE_CHARS) {
            return jsonResponse(
              { code: "message_too_long", friendly: "메시지가 너무 길어요. 2000자 안으로 줄여 주세요." },
              400,
            );
          }
          if (body.input_channel !== undefined && body.input_channel !== "text") {
            return jsonResponse(
              { code: "channel_not_supported", friendly: "지금은 글로만 대화할 수 있어요." },
              400,
            );
          }

          // 1) 세션 확인 + user JWT 확보 (generate-summary.ts 와 동일 방식).
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
          const token = session?.access_token;
          if (!token) {
            return jsonResponse({ code: "unauthorized", friendly: "로그인이 필요해요." }, 401);
          }

          // 2) Edge lingo-chat 호출 — body 그대로 전달. 실패는 502 friendly(throw 금지).
          let edgeRes: Response;
          try {
            edgeRes = await fetch(`${SUPABASE_URL}/functions/v1/lingo-chat`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: PUBLISHABLE_KEY,
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            });
          } catch (e) {
            console.error("[api/lingo/chat] edge fetch failed:", String((e as Error).message ?? e));
            return jsonResponse(
              { code: "edge_unreachable", friendly: "죄송해요, 지금 링고가 잠깐 느려요. 조금 뒤에 다시 해볼게요." },
              502,
            );
          }

          const contentType = edgeRes.headers.get("content-type") ?? "";

          // 3) SSE — body 스트림을 버퍼링 없이 그대로 파이프(웹표준 ReadableStream 패스스루).
          if (contentType.includes("text/event-stream") && edgeRes.body) {
            return new Response(edgeRes.body, {
              status: edgeRes.status,
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache",
              },
            });
          }

          // 4) JSON 경로(quota 429·검증 400 등) — 상태코드·본문 그대로 반환.
          const text = await edgeRes.text();
          return new Response(text, {
            status: edgeRes.status,
            headers: { "Content-Type": contentType || "application/json; charset=utf-8" },
          });
        } catch (e) {
          console.error("[api/lingo/chat] unexpected:", String((e as Error).message ?? e));
          return jsonResponse(
            { code: "internal_error", friendly: "처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요." },
            500,
          );
        }
      },
    },
  },
});
