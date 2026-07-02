// POST /api/hecto/noti — 헥토 승인결과 통보(noti) 수신 (백엔드만).
//   1) form 파싱 → 2) 노티 정본 규격으로 무결성 해시 재계산·대조(위조 차단) →
//   3) 일치 시 Content-Type text/plain + 본문 "OK"(헥토 재전송 중단 규약), 불일치 시 미처리(400 plain).
//   결과는 구조화 console 로그만(DB 기록은 v2).
//
// 노티 정본 규격(v1.1 확정):
//   - 수신 trdDtm(14자리 yyyyMMddHHmmss)을 trdDt(앞8)/trdTm(뒤6)으로 분해.
//   - 검증 해시 = SHA256( outStatCd + trdDt + trdTm + mchtId + mchtTrdNo + trdAmt평문 + licenseKey ).
//     (요청 해시와 필드 구성/순서가 다름. licenseKey 는 서버 설정값 — 노티로 수신하지 않음.)
import { createFileRoute } from "@tanstack/react-router";
import { getHectoConfig } from "@/server/payments/hecto/config";
import { buildNotiVerifyHash, splitTrdDtm } from "@/server/payments/hecto/order";

function pick(form: FormData, ...names: string[]): string {
  for (const n of names) {
    const v = form.get(n);
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

export const Route = createFileRoute("/api/hecto/noti")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const fields: Record<string, string> = {};
          for (const [k, v] of form.entries()) {
            if (typeof v === "string") fields[k] = v;
          }

          const outStatCd = pick(form, "outStatCd");
          const trdDtm = pick(form, "trdDtm");
          const mchtId = pick(form, "mchtId");
          const mchtTrdNo = pick(form, "mchtTrdNo");
          const trdAmt = pick(form, "trdAmt"); // 노티는 금액 평문 전달
          const received = pick(form, "pktHash", "hashData", "hash");

          const cfg = getHectoConfig();
          const computed = await buildNotiVerifyHash(
            { outStatCd, trdDtm, mchtId, mchtTrdNo, trdAmt },
            cfg.licenseKey,
          );
          const matched = received.length > 0 && received === computed;
          const { trdDt, trdTm } = splitTrdDtm(trdDtm);

          console.log(
            JSON.stringify({
              tag: "[api/hecto/noti]",
              env: cfg.env,
              outStatCd,
              mchtId,
              mchtTrdNo,
              trdDt,
              trdTm,
              hashMatched: matched,
              receivedHashPresent: received.length > 0,
              fieldKeys: Object.keys(fields),
            }),
          );

          if (!matched) {
            // 위조/불일치 → 미처리(재전송 중단 OK 미응답, plain text).
            return new Response("HASH_MISMATCH", {
              status: 400,
              headers: { "content-type": "text/plain; charset=utf-8" },
            });
          }

          // 성공 수신 확인 → 헥토 재전송 중단을 위해 본문 "OK"(대문자 정확히).
          return new Response("OK", {
            status: 200,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        } catch (e) {
          console.error("[api/hecto/noti]", e);
          return new Response("ERROR", {
            status: 500,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
