// POST /api/generate-promo-copy — 업주 상품 홍보 카피(헤드라인 + 셀링포인트) (B 상품 홍보 카드)
//
// generate-promo-copy Edge Function 은 verify_jwt=true + user_id 필수라 클라이언트가
// 직접 못 부른다 → 이 Route 가 서버에서 user 를 확인하고 user JWT 로 Edge Function 호출.
// (suggest-purpose 라우트 패턴 차용.)
//
// 입력:  { product_name, price_krw?, notes?, product_id? }
// 출력:  { headline, selling_points, cached, ai_generation_id }

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import { invokeEdge } from "@/lib/edge-invoke.server";

export const Route = createFileRoute("/api/generate-promo-copy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            product_name?: string;
            price_krw?: number | null;
            notes?: string;
            product_id?: string;
            image_url?: string | null;
            /** COPY-1 — 카테고리 톤 분기 passthrough. 미전달 = Edge 가 fresh 폴백. */
            category?: string | null;
          };
          if (!body.product_name || !body.product_name.trim()) {
            return Response.json(
              { error: "INVALID_INPUT", message: "상품명이 필요해요." },
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
            "generate-promo-copy",
            {
              product_name: body.product_name.trim(),
              price_krw: typeof body.price_krw === "number" ? body.price_krw : null,
              notes: (body.notes ?? "").trim(),
              product_id: body.product_id ?? null,
              image_url: body.image_url ?? null,
              category: body.category ?? null, // COPY-1 — passthrough
              user_id: user.id,
            },
            session?.access_token ?? null,
          );
          if (result.error || !result.data) {
            return Response.json(
              {
                error: "PROMO_FAILED",
                message: "카피 생성에 실패했어요. 직접 입력해 주세요.",
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
