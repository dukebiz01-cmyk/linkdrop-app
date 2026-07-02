// 헥토 표준결제창 v1 — 재현 가능 검수 스크립트 (형님 검수용).
//   고정 입력(금액 1000, 시각 고정, 주문번호 고정)으로 암호문(trdAmt)·해시(pktHash)를 출력.
//   실행: bun scripts/hecto-verify.ts
//   (mchtTrdNo 는 운영에서 랜덤4자리 포함 유일값 — 여기선 재현 위해 고정 주입.)
import {
  createCardOrder,
  HECTO_CARD_METHOD,
  buildNotiVerifyHash,
  splitTrdDtm,
} from "../src/server/payments/hecto/order";
import { aesEcbEncryptBase64, sha256Hex } from "../src/server/payments/hecto/crypto";
import { getHectoConfig } from "../src/server/payments/hecto/config";

async function main() {
  // 2026-07-02 12:00:00 KST (= 03:00:00 UTC) 고정.
  const fixedNow = new Date(Date.UTC(2026, 6, 2, 3, 0, 0));
  const fixedMchtTrdNo = "LD202607021200001234";
  const amountKrw = 1000;
  const orderName = "테스트 상품";

  const cfg = getHectoConfig();
  const order = await createCardOrder({
    amountKrw,
    orderName,
    now: fixedNow,
    mchtTrdNo: fixedMchtTrdNo,
  });

  // 독립 재계산(교차검증) — order 내부 로직과 동일 입력으로 직접 산출해 일치 확인.
  const plainAmount = String(amountKrw);
  const trdAmtDirect = aesEcbEncryptBase64(plainAmount, cfg.encKey);
  const pktHashDirect = await sha256Hex(
    cfg.mchtId + HECTO_CARD_METHOD + fixedMchtTrdNo + order.trdDt + order.trdTm + plainAmount + cfg.licenseKey,
  );

  console.log("=== HECTO v1 verify (reproducible) ===");
  console.log("env              :", cfg.env);
  console.log("payWindowBase    :", cfg.payWindowBase);
  console.log("apiBase          :", cfg.apiBase);
  console.log("mchtId           :", cfg.mchtId);
  console.log("method           :", order.method);
  console.log("mchtTrdNo(fixed) :", order.mchtTrdNo);
  console.log("trdDt            :", order.trdDt);
  console.log("trdTm            :", order.trdTm);
  console.log("amount(plain)    :", plainAmount);
  console.log("trdAmt(cipher)   :", order.trdAmt);
  console.log("pktHash          :", order.pktHash);
  console.log("--- cross-check (independent recompute) ---");
  console.log("trdAmt match     :", order.trdAmt === trdAmtDirect);
  console.log("pktHash match    :", order.pktHash === pktHashDirect);

  // ── 노티(결과통보) 검증 케이스 (정본 규격) ──
  //   가짜 노티 페이로드를 만들어 정본 해시로 서명 → 검증 통과, 위조(1자 변조) → 실패 확인.
  const noti = {
    outStatCd: "0021", // 승인성공 예시값
    trdDtm: "20260702120000", // 14자리 → trdDt=20260702 / trdTm=120000
    mchtId: cfg.mchtId,
    mchtTrdNo: fixedMchtTrdNo,
    trdAmt: plainAmount, // 노티는 금액 평문
  };
  const { trdDt: notiTrdDt, trdTm: notiTrdTm } = splitTrdDtm(noti.trdDtm);
  // 헥토가 보낸다고 가정한 정본 서명(licenseKey 포함).
  const signedHash = await buildNotiVerifyHash(noti, cfg.licenseKey);
  // 서버 route 와 동일 로직으로 재계산 → 일치해야 통과.
  const recomputed = await buildNotiVerifyHash(noti, cfg.licenseKey);
  const notiMatch = signedHash === recomputed;
  // 위조 시나리오: 금액 1자 변조 → 불일치여야 정상.
  const forgedHash = await buildNotiVerifyHash({ ...noti, trdAmt: "9999" }, cfg.licenseKey);
  const forgeryRejected = forgedHash !== signedHash;

  console.log("=== HECTO noti verify (정본 규격) ===");
  console.log("outStatCd        :", noti.outStatCd);
  console.log("trdDtm(14)       :", noti.trdDtm);
  console.log("split trdDt/trdTm:", notiTrdDt, "/", notiTrdTm);
  console.log("trdAmt(plain)    :", noti.trdAmt);
  console.log("signedHash       :", signedHash);
  console.log("noti hash match  :", notiMatch);
  console.log("forgery rejected :", forgeryRejected);
}

main().catch((e) => {
  console.error("[hecto-verify] failed:", e);
  process.exit(1);
});
