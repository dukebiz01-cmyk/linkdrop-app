// POST /api/coupons/claim — 쿠폰 클레임 (Step 7 §5)
//
// 무로그인 + phone. claim_coupon_anon RPC (v3.4 신규 — 1인/총 한도 + 6자리 코드).

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";

type ClaimBody = {
  coupon_id?: string;
  phone?: string;
  visitor_anon_id?: string;
};

export const Route = createFileRoute("/api/coupons/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as ClaimBody;
          if (!body.coupon_id || !body.phone || !body.visitor_anon_id) {
            return Response.json(
              { error: "INVALID_INPUT", message: "필수 정보를 입력해 주세요." },
              { status: 400 },
            );
          }

          const supabase = getSupabaseServer();
          const { data, error } = await supabase.rpc("claim_coupon_anon", {
            p_coupon_id: body.coupon_id,
            p_phone: body.phone,
            p_visitor_anon_id: body.visitor_anon_id,
          });

          if (error) {
            const m = error.message ?? "";
            if (m.includes("already_claimed")) {
              return Response.json(
                { error: "ALREADY_CLAIMED", message: "이미 받은 쿠폰이에요." },
                { status: 409 },
              );
            }
            if (m.includes("quota_exceeded")) {
              return Response.json(
                { error: "COUPON_SOLD_OUT", message: "쿠폰이 모두 소진됐어요." },
                { status: 410 },
              );
            }
            if (
              m.includes("coupon_expired") ||
              m.includes("coupon_not_started") ||
              m.includes("coupon_inactive")
            ) {
              return Response.json(
                { error: "COUPON_UNAVAILABLE", message: "지금은 받을 수 없는 쿠폰이에요." },
                { status: 410 },
              );
            }
            if (m.includes("coupon_not_found")) {
              return Response.json(
                { error: "NOT_FOUND", message: "쿠폰을 찾을 수 없어요." },
                { status: 404 },
              );
            }
            return Response.json(
              { error: "CLAIM_FAILED", message: "쿠폰 받기에 실패했어요.", details: m },
              { status: 500 },
            );
          }

          const r = data as { claim_id: string; claim_code: string };
          return Response.json({
            claim_id: r.claim_id,
            claim_code: r.claim_code,
            message: "쿠폰을 받았어요. 매장에서 코드를 보여주세요.",
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
