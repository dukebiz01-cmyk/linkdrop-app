// POST /api/cash/use — 세션 인증 유저의 캐시 차감 (use_cash RPC, CASH-c2).
//   쿠키 세션 클라이언트(getSupabaseServer)로 호출 → RPC 가 유저 JWT 로 실행 → 내부 auth.uid() = 본인.
//   ⚠️ use_cash 는 p_user 파라미터가 없고 auth.uid() 만 사용 → 타인 지갑 차감 원천 불가.
import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";

type UseBody = {
  sku?: string;
  amount?: number;
};

const KNOWN_ERRORS = ["INSUFFICIENT_CASH", "INVALID_SKU", "INVALID_AMOUNT", "UNAUTHORIZED"] as const;

export const Route = createFileRoute("/api/cash/use")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as UseBody;
          const sku = (body.sku ?? "").trim();
          const amount = Number(body.amount);

          if (!sku) {
            return Response.json({ error: "INVALID_SKU", message: "SKU가 필요해요." }, { status: 400 });
          }
          if (!Number.isFinite(amount) || amount <= 0) {
            return Response.json(
              { error: "INVALID_AMOUNT", message: "사용 금액이 올바르지 않아요." },
              { status: 400 },
            );
          }

          const supabase = getSupabaseServer();
          const { data: sess } = await supabase.auth.getSession();
          if (!sess.session) {
            return Response.json(
              { error: "UNAUTHORIZED", message: "로그인이 필요해요." },
              { status: 401 },
            );
          }

          // use_cash 는 gen types 미반영(신설) → 유저 JWT 클라이언트로 호출. auth.uid()=세션 유저.
          const { data, error } = await supabase.rpc("use_cash", { p_sku: sku, p_amount: amount });
          if (error) {
            const msg = error.message ?? "";
            const known = KNOWN_ERRORS.find((k) => msg.includes(k));
            console.warn("[api/cash/use] use_cash error", { known, message: msg });
            return Response.json(
              { error: known ?? "USE_FAILED", message: known ?? msg },
              { status: known === "INSUFFICIENT_CASH" ? 409 : 400 },
            );
          }
          return Response.json({ result: data });
        } catch (e) {
          console.error("[api/cash/use]", e);
          return Response.json(
            { error: "INTERNAL_ERROR", message: "사용 처리 중 오류가 발생했어요." },
            { status: 500 },
          );
        }
      },
    },
  },
});
