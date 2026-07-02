// POST /api/hecto/order — 헥토 카드 단건결제 주문 생성 (v1 스파이크, 백엔드만).
//   body { amountKrw, orderName } → createCardOrder → 결제창 호출 파라미터 JSON.
import { createFileRoute } from "@tanstack/react-router";
import { createCardOrder } from "@/server/payments/hecto/order";

type OrderBody = {
  amountKrw?: number;
  orderName?: string;
};

export const Route = createFileRoute("/api/hecto/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as OrderBody;
          const amountKrw = Number(body.amountKrw);
          const orderName = (body.orderName ?? "").trim();

          if (!Number.isFinite(amountKrw) || amountKrw <= 0) {
            return Response.json(
              { error: "INVALID_AMOUNT", message: "결제 금액이 올바르지 않아요." },
              { status: 400 },
            );
          }
          if (!orderName) {
            return Response.json(
              { error: "INVALID_ORDER_NAME", message: "주문명이 필요해요." },
              { status: 400 },
            );
          }

          const order = await createCardOrder({ amountKrw, orderName });
          return Response.json(order);
        } catch (e) {
          console.error("[api/hecto/order]", e);
          return Response.json(
            { error: "INTERNAL_ERROR", message: "주문 생성 중 오류가 발생했어요." },
            { status: 500 },
          );
        }
      },
    },
  },
});
