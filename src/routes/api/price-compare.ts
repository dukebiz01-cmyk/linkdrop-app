// POST /api/price-compare — 가격 비교 (Step 7 §6)
//
// 로그인 필수. 기존 product_detections 있으면 캐시 반환, 없으면 detect-product
// Edge Function 호출. 명세 §6.4 출력을 v3.0 실제 컬럼(product_name_guess 등)으로 매핑.

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import { invokeEdge } from "@/lib/edge-invoke.server";

type PriceCompareBody = {
  drop_id?: string;
  source_id?: string;
  refresh?: boolean;
};

export const Route = createFileRoute("/api/price-compare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
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
          const jwt = session?.access_token ?? null;

          const body = (await request.json()) as PriceCompareBody;
          if (!body.drop_id) {
            return Response.json(
              { error: "INVALID_INPUT", message: "drop_id가 필요해요." },
              { status: 400 },
            );
          }

          // 기존 product_detections 캐시 조회
          const { data: existing } = await supabase
            .from("product_detections")
            // 단일 리터럴 문자열 — concat 시 TS 리터럴 타입이 풀려 Supabase 추론이 깨진다.
            .select(
              "id, product_name_guess, brand_guess, category, confidence, product_offers(seller_name, seller_country, platform, price, currency, product_url, estimated_total_price)",
            )
            .eq("drop_id", body.drop_id)
            .limit(1)
            .maybeSingle();

          if (existing && !body.refresh) {
            return Response.json({
              detection_id: existing.id,
              product: {
                name: existing.product_name_guess,
                brand: existing.brand_guess,
                category: existing.category,
                confidence: existing.confidence,
              },
              offers: existing.product_offers ?? [],
              cached: true,
            });
          }

          // source_id 확보
          let sourceId = body.source_id;
          if (!sourceId) {
            const { data: drop } = await supabase
              .from("info_drops")
              .select("source_id")
              .eq("id", body.drop_id)
              .maybeSingle();
            sourceId = drop?.source_id ?? undefined;
          }
          if (!sourceId) {
            return Response.json(
              { error: "SOURCE_NOT_FOUND", message: "영상 정보를 찾을 수 없어요." },
              { status: 404 },
            );
          }

          // detect-product Edge Function
          const result = await invokeEdge(
            "detect-product",
            { source_id: sourceId, drop_id: body.drop_id, user_id: user.id },
            jwt,
          );
          if (result.error || !result.data) {
            return Response.json(
              {
                error: "PRICE_COMPARE_FAILED",
                message: "가격 비교에 실패했어요.",
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
