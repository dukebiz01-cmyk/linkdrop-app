// POST /api/hecto/cancel-tx — 헥토 신용카드 취소 API(APICancel.do) 서버-서버 호출.
//   모드 1) 일반 취소: body { orgTrdNo, amountKrw } → APICancel (v1.6, 무변경).
//   모드 2) 충전 취소(CASH-c3): body { chargeTrdNo, amountKrw } → 세션 uid 확인 →
//     payment_notifications 에서 LDW 의 trd_no(원거래번호) 조회 → begin(선차감) →
//     APICancel(orgTrdNo=trd_no) → 0021=finalize(true) / 그 외·예외=finalize(false, 보상복원).
//   ⚠️ 결제창 리턴 수신용 /api/hecto/cancel(cancel.ts route) 과는 별개 라우트 — 혼동/수정 금지.
import { createFileRoute } from "@tanstack/react-router";
import { buildCancelRequest } from "@/server/payments/hecto/cancel";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import type { SupabaseClient } from "@supabase/supabase-js";

type CancelTxBody = {
  orgTrdNo?: string;
  amountKrw?: number;
  /** CASH-c3 — 충전취소 모드(LDW mchtTrdNo). 있으면 캐시 역분개 흐름으로 분기. */
  chargeTrdNo?: string;
};

/** 헥토 취소 응답 봉투( { params, data } ) 최소 형태. */
type CancelResponse = {
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

interface ApiCancelOutcome {
  httpStatus: number;
  ok: boolean;
  cancelMchtTrdNo: string;
  outStatCd: string;
  outRsltCd: string;
  outRsltMsg: string;
  cnclAmt: string;
  blcAmt: string;
  raw: unknown;
}

/** 헥토 APICancel.do 호출 + 응답 파싱(양 모드 공용). */
async function callApiCancel(orgTrdNo: string, amountKrw: number): Promise<ApiCancelOutcome> {
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
  return {
    httpStatus: upstream.status,
    ok: upstream.ok,
    cancelMchtTrdNo: cancelReq.mchtTrdNo,
    outStatCd,
    outRsltCd,
    outRsltMsg,
    cnclAmt,
    blcAmt,
    raw: parsed ?? text,
  };
}

const BEGIN_KNOWN = [
  "CHARGE_NOT_FOUND",
  "CANCEL_IN_PROGRESS",
  "EXCEEDS_CANCELABLE",
  "INSUFFICIENT_PAID",
  "INVALID_ARGS",
] as const;

export const Route = createFileRoute("/api/hecto/cancel-tx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as CancelTxBody;
          const amountKrw = Number(body.amountKrw);
          if (!Number.isFinite(amountKrw) || amountKrw <= 0) {
            return Response.json(
              { error: "INVALID_AMOUNT", message: "취소 금액이 올바르지 않아요." },
              { status: 400 },
            );
          }

          // ───────── 모드 2: 충전 취소(CASH-c3) — 선차감→PG→finalize ─────────
          const chargeTrdNo = (body.chargeTrdNo ?? "").trim();
          if (chargeTrdNo) {
            const userClient = getSupabaseServer();
            const { data: sess } = await userClient.auth.getSession();
            if (!sess.session) {
              return Response.json(
                { error: "UNAUTHORIZED", message: "로그인이 필요해요." },
                { status: 401 },
              );
            }
            const uid = sess.session.user.id;
            const admin = supabaseAdmin as unknown as SupabaseClient;

            // 원 LDW 의 trd_no(원거래번호) 조회 — 노티 기록에서.
            const { data: notiRow } = await admin
              .from("payment_notifications")
              .select("trd_no")
              .eq("mcht_trd_no", chargeTrdNo)
              .maybeSingle();
            const orgTrdNo = (notiRow as { trd_no?: string | null } | null)?.trd_no ?? "";
            if (!orgTrdNo) {
              return Response.json(
                { error: "NOTI_NOT_FOUND", message: "해당 충전의 원거래번호(노티)를 찾을 수 없어요." },
                { status: 404 },
              );
            }

            // 선차감(begin) — 원자적. 실패 시 잔액 변화 없음.
            const beginRes = await admin.rpc("cash_charge_cancel_begin", {
              p_user: uid,
              p_charge_trd_no: chargeTrdNo,
              p_amount: amountKrw,
            });
            if (beginRes.error) {
              const msg = beginRes.error.message ?? "";
              const known = BEGIN_KNOWN.find((k) => msg.includes(k));
              return Response.json(
                { error: known ?? "CANCEL_BEGIN_FAILED", message: known ?? msg, stage: "begin" },
                { status: known === "CANCEL_IN_PROGRESS" ? 409 : 400 },
              );
            }
            const ledgerId = beginRes.data as string;

            // PG 취소 호출 — 예외/실패도 finalize(false)로 보상 복원.
            let outcome: ApiCancelOutcome | null = null;
            let success = false;
            try {
              outcome = await callApiCancel(orgTrdNo, amountKrw);
              success = outcome.outStatCd === "0021";
            } catch (pgErr) {
              console.error("[api/hecto/cancel-tx] charge-cancel PG error", pgErr);
              success = false;
            }
            const pgResult = outcome
              ? `${outcome.outStatCd}|${outcome.outRsltCd}|${outcome.outRsltMsg}`.slice(0, 480)
              : "PG_EXCEPTION";

            const finRes = await admin.rpc("cash_charge_cancel_finalize", {
              p_ledger_id: ledgerId,
              p_success: success,
              p_pg_result: pgResult,
            });
            if (finRes.error) {
              console.error("[api/hecto/cancel-tx] finalize error", finRes.error);
              return Response.json(
                {
                  error: "CANCEL_FINALIZE_FAILED",
                  message: finRes.error.message ?? "",
                  stage: "finalize",
                  ledgerId,
                  outStatCd: outcome?.outStatCd ?? "",
                },
                { status: 500 },
              );
            }

            return Response.json(
              {
                mode: "cash_charge_cancel",
                chargeTrdNo,
                orgTrdNo,
                ledgerId,
                outStatCd: outcome?.outStatCd ?? "",
                outRsltCd: outcome?.outRsltCd ?? "",
                outRsltMsg: outcome?.outRsltMsg ?? "",
                cnclAmt: outcome?.cnclAmt ?? "",
                blcAmt: outcome?.blcAmt ?? "",
                finalized: success ? "confirmed" : "reversed",
              },
              { status: 200 },
            );
          }

          // ───────── 모드 1: 일반 취소(orgTrdNo 직접) — v1.6 무변경 ─────────
          const orgTrdNo = (body.orgTrdNo ?? "").trim();
          if (!orgTrdNo) {
            return Response.json(
              { error: "INVALID_ORG_TRD_NO", message: "원거래번호(orgTrdNo)가 필요해요." },
              { status: 400 },
            );
          }
          const outcome = await callApiCancel(orgTrdNo, amountKrw);
          return Response.json(
            {
              httpStatus: outcome.httpStatus,
              cancelMchtTrdNo: outcome.cancelMchtTrdNo,
              outStatCd: outcome.outStatCd,
              outRsltCd: outcome.outRsltCd,
              outRsltMsg: outcome.outRsltMsg,
              cnclAmt: outcome.cnclAmt,
              blcAmt: outcome.blcAmt,
              raw: outcome.raw,
            },
            { status: outcome.ok ? 200 : 502 },
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
