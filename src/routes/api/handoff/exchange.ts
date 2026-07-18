// POST /api/handoff/exchange — 핸드오프 코드 → refresh_token 교환 (KAKAO-LINGO-1 B방식).
//
// 공개 라우트(코드 자체가 인증 — 쿠키 세션 불요: 새 브라우저에는 세션이 없다).
// 보안 4중 잠금(§4)의 ①1회용·②60초 TTL·③서버 검증을 단일 UPDATE 로 원자 판정:
//   used_at IS NULL AND created_at > now()-60s 조건을 통과한 행만 used_at 마킹 + 토큰 반환.
//   0행 = 존재하지 않음/재사용/만료 — 전부 동일한 거부(구분 정보 비노출).
// service role 은 이 서버 라우트에만 존재(④) — 클라 번들 유입 금지(.server.ts 스트립).

import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL_MS = 60_000;

function jsonResponse(body: object, status: number): Response {
  return Response.json(body, { status });
}

export const Route = createFileRoute("/api/handoff/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: { code?: string };
          try {
            body = await request.json();
          } catch {
            return jsonResponse({ code: "invalid_json", friendly: "요청을 읽지 못했어요." }, 400);
          }
          const code = (body.code ?? "").trim();
          if (!UUID_RE.test(code)) {
            return jsonResponse({ code: "invalid_code", friendly: "이어가기 링크가 올바르지 않아요." }, 400);
          }

          // handoff_codes 는 신설 테이블 — 생성 타입(Database) 재생성 전이라 무타입 경유.
          const admin = supabaseAdmin as unknown as SupabaseClient;
          const { data, error } = await admin
            .from("handoff_codes")
            .update({ used_at: new Date().toISOString() })
            .eq("code", code)
            .is("used_at", null)
            .gt("created_at", new Date(Date.now() - TTL_MS).toISOString())
            .select("refresh_token")
            .maybeSingle();
          if (error) {
            console.error("[api/handoff/exchange] update failed:", error.message);
            return jsonResponse({ code: "exchange_failed", friendly: "잠시 후 다시 시도해 주세요." }, 500);
          }
          if (!data?.refresh_token) {
            // 재사용·만료·미존재 — 단일 거부(§4 ①②③, 사유 비구분).
            return jsonResponse(
              { code: "code_rejected", friendly: "이어가기 링크가 만료됐어요. 다시 시도해 주세요." },
              410,
            );
          }
          return jsonResponse({ refresh_token: data.refresh_token as string }, 200);
        } catch (e) {
          console.error("[api/handoff/exchange] unexpected:", String((e as Error).message ?? e));
          return jsonResponse({ code: "internal_error", friendly: "잠시 후 다시 시도해 주세요." }, 500);
        }
      },
    },
  },
});
