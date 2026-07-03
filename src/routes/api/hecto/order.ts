// POST /api/hecto/order — 헥토 카드 단건결제 주문 생성 (v1 스파이크, 백엔드만).
//   body { amountKrw, orderName } → createCardOrder → 결제창 호출 파라미터 JSON.
import { createFileRoute } from "@tanstack/react-router";
import { createCardOrder } from "@/server/payments/hecto/order";

type OrderBody = {
  amountKrw?: number;
  orderName?: string;
  /** CASH-c1 — "cash_charge" 면 충전 주문(LDW 채번). 미지정=일반결제. */
  purpose?: "cash_charge";
  /** CASH-c1 — 충전 시 로그인 user_id → mchtParam(uid=)으로 운반, 노티가 회수해 캐시 발행. */
  userId?: string;
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

          // CASH-c1 — 충전 주문이면 로그인 user_id 필수(노티가 mchtParam 으로 회수해 캐시 발행).
          const isCashCharge = body.purpose === "cash_charge";
          const userId = (body.userId ?? "").trim();
          if (isCashCharge && !userId) {
            return Response.json(
              { error: "INVALID_USER", message: "충전은 로그인 정보가 필요해요." },
              { status: 400 },
            );
          }

          const order = await createCardOrder({
            amountKrw,
            orderName,
            purpose: isCashCharge ? "cash_charge" : undefined,
            mchtParam: isCashCharge ? `uid=${userId}` : undefined,
          });
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
