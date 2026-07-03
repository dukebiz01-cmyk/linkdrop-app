// POST /api/hecto/cancel-tx — 헥토 신용카드 취소 API(APICancel.do) 서버-서버 호출 (v1.6).
//   body { orgTrdNo, amountKrw } → buildCancelRequest → 헥토 APICancel.do POST →
//   응답(params.outStatCd/outRsltCd/outRsltMsg + data.cnclAmt/blcAmt) 구조화 로그 + JSON 반환.
//   ⚠️ 결제창 리턴 수신용 /api/hecto/cancel(cancel.ts route) 과는 별개 라우트 — 혼동/수정 금지.
import { createFileRoute } from "@tanstack/react-router";
import { buildCancelRequest } from "@/server/payments/hecto/cancel";

type CancelTxBody = {
  orgTrdNo?: string;
  amountKrw?: number;
};

/** 헥토 취소 응답 봉투( { params, data } ) 최소 형태. */
type CancelResponse = {
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export const Route = createFileRoute("/api/hecto/cancel-tx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as CancelTxBody;
          const orgTrdNo = (body.orgTrdNo ?? "").trim();
          const amountKrw = Number(body.amountKrw);

          if (!orgTrdNo) {
            return Response.json(
              { error: "INVALID_ORG_TRD_NO", message: "원거래번호(orgTrdNo)가 필요해요." },
              { status: 400 },
            );
          }
          if (!Number.isFinite(amountKrw) || amountKrw <= 0) {
            return Response.json(
              { error: "INVALID_AMOUNT", message: "취소 금액이 올바르지 않아요." },
              { status: 400 },
            );
          }

          const cancelReq = await buildCancelRequest({ orgTrdNo, cancelAmountKrw: amountKrw });
          const upstream = await fetch(cancelReq.endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(cancelReq.body),
          });

          const text = await upstream.text();
          let parsed: CancelResponse | null = null;
          try {
            parsed = JSON.parse(text) as CancelResponse;
          } catch {
            // 비-JSON 응답(에러 HTML 등) — raw 로 그대로 넘김.
          }

          const outStatCd = String(parsed?.params?.outStatCd ?? "");
          const outRsltCd = String(parsed?.params?.outRsltCd ?? "");
          const outRsltMsg = String(parsed?.params?.outRsltMsg ?? "");
          const cnclAmt = String(parsed?.data?.cnclAmt ?? "");
          const blcAmt = String(parsed?.data?.blcAmt ?? "");

          console.log(
            JSON.stringify({
              tag: "[api/hecto/cancel-tx]",
              httpStatus: upstream.status,
              endpoint: cancelReq.endpoint,
              cancelMchtTrdNo: cancelReq.mchtTrdNo,
              orgTrdNo,
              cnclOrd: cancelReq.cnclOrd,
              outStatCd,
              outRsltCd,
              outRsltMsg,
              cnclAmt,
              blcAmt,
            }),
          );

          return Response.json(
            {
              httpStatus: upstream.status,
              cancelMchtTrdNo: cancelReq.mchtTrdNo,
              outStatCd,
              outRsltCd,
              outRsltMsg,
              cnclAmt,
              blcAmt,
              raw: parsed ?? text,
            },
            { status: upstream.ok ? 200 : 502 },
          );
        } catch (e) {
          console.error("[api/hecto/cancel-tx]", e);
          return Response.json(
            { error: "INTERNAL_ERROR", message: "취소 요청 중 오류가 발생했어요." },
            { status: 500 },
          );
        }
      },
    },
  },
});
