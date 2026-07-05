// scripts/cash-c3-test.ts — 충전취소 역분개 RPC 상태머신 검증 (CASH-c3, 형님 검수용).
//   전제: supabase CLI linked. begin/finalize/grant_cash_charge = service_role(=db query postgres) 직접 호출.
//     use_cash 만 auth.uid() 기반이라 jwt-claim 임퍼소네이션.
//   실행: bun scripts/cash-c3-test.ts
//   ⚠️ 실 PG(APICancel 0021/ST25) 왕복은 라우트(/api/hecto/cancel-tx, 세션 필요) 몫 → 하단 절차서 참고.
//     본 스크립트는 begin(선차감)→finalize(확정/보상복원)·미사용한도·동시성 = 원장/잔액 정합을 검증한다.
//   ⚠️ 테스트 유저의 paid_balance 를 0으로 드레인(use 'boost')해 결정적 베이스라인을 만든다(테스트 계정).
import { execFileSync } from "node:child_process";

function dbRun(sql: string): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf8" }) };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}
function field(sql: string, key: string): string {
  const { out } = dbRun(sql);
  const m = out.match(new RegExp(`"${key}":\\s*"?([^",\\n}]*)"?`));
  return m ? m[1].trim() : "";
}
function intField(sql: string, key: string): number {
  return Number.parseInt(field(sql, key) || "NaN", 10);
}
function paid(uid: string): number {
  return intField(
    `SELECT coalesce((SELECT paid_balance FROM public.cash_wallets WHERE user_id='${uid}'),0) AS p;`,
    "p",
  );
}
function total(uid: string): number {
  return intField(
    `SELECT coalesce((SELECT paid_balance+bonus_balance FROM public.cash_wallets WHERE user_id='${uid}'),0) AS t;`,
    "t",
  );
}
/** 특정 charge(ref_mcht_trd_no)의 charge_cancel 집계: net paid_delta·행수·memo 목록. */
function cancels(trd: string): { net: number; n: number; memos: string } {
  const base = `(SELECT id FROM public.cash_ledger WHERE entry_type='charge' AND ref_mcht_trd_no='${trd}' LIMIT 1)`;
  const sql = `SELECT coalesce(sum(paid_delta),0) AS net, count(*) AS n, coalesce(string_agg(memo,','),'') AS memos FROM public.cash_ledger WHERE entry_type='charge_cancel' AND ref_ledger_id=${base};`;
  return { net: intField(sql, "net"), n: intField(sql, "n"), memos: field(sql, "memos") };
}
function grant(uid: string, amt: number, trd: string) {
  dbRun(`SELECT public.grant_cash_charge('${uid}', ${amt}, '${trd}');`);
}
function begin(uid: string, trd: string, amt: number): { ok: boolean; lid: string; out: string } {
  const r = dbRun(`SELECT public.cash_charge_cancel_begin('${uid}', '${trd}', ${amt}) AS lid;`);
  const m = r.out.match(/"lid":\s*"([0-9a-fA-F-]+)"/);
  return { ok: r.ok && !!m, lid: m ? m[1] : "", out: r.out };
}
function finalize(lid: string, success: boolean, pg: string): { ok: boolean; out: string } {
  return dbRun(
    `SELECT public.cash_charge_cancel_finalize('${lid}', ${success ? "true" : "false"}, '${pg}');`,
  );
}
function useCash(uid: string, amt: number): { ok: boolean; out: string } {
  const sql = `BEGIN; SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: uid })}', true); SELECT public.use_cash('boost', ${amt}); COMMIT;`;
  return dbRun(sql);
}

function main() {
  const uid = field("SELECT user_id FROM public.cash_wallets ORDER BY updated_at DESC LIMIT 1;", "user_id");
  if (!uid) throw new Error("cash_wallets 유저 없음 — c1/c2 테스트로 지갑 생성 필요.");
  console.log("=== CASH-c3 test (충전취소 역분개 RPC) ===");
  console.log("uid    :", uid);

  // 베이스라인: 잔액 0으로 드레인.
  const t0 = total(uid);
  if (t0 > 0) useCash(uid, t0);
  console.log("baseline paid:", paid(uid), "(0 기대)");

  // (a) 충전 1000 → 즉시 취소 1000 (PG 0021 시뮬 = finalize true)
  const A = `LDWC3${Date.now()}A`;
  grant(uid, 1000, A);
  const bA = begin(uid, A, 1000);
  const fA = finalize(bA.lid, true, "0021|0000|ok");
  const cA = cancels(A);
  const aPass = bA.ok && fA.ok && paid(uid) === 0 && cA.n === 1 && cA.memos === "confirmed" && cA.net === -1000;
  console.log("\n(a) 충전1000→취소1000(confirmed)");
  console.log("   paid       :", paid(uid), "(0 기대) · cancel행:", cA.n, "memo:", cA.memos, "net:", cA.net);
  console.log("   → PASS     :", aPass);

  // (b) 충전1000→사용400→취소1000 거부(미사용 한도)→600 취소 성공
  const B = `LDWC3${Date.now()}B`;
  grant(uid, 1000, B); // paid 0→1000
  useCash(uid, 400); // paid 1000→600
  const bReject = begin(uid, B, 1000); // paid 600 < 1000 → INSUFFICIENT_PAID
  const paidAfterReject = paid(uid);
  const bB = begin(uid, B, 600); // 취소가능 1000≥600, paid 600≥600 → OK
  const fB = finalize(bB.lid, true, "0021|0000|ok");
  const cB = cancels(B);
  const bPass =
    !bReject.ok && bReject.out.includes("INSUFFICIENT_PAID") && paidAfterReject === 600 &&
    bB.ok && fB.ok && paid(uid) === 0 && cB.net === -600 && cB.memos === "confirmed";
  console.log("\n(b) 사용400 후 1000취소 거부→600취소");
  console.log("   1000거부   :", bReject.out.includes("INSUFFICIENT_PAID") ? "INSUFFICIENT_PAID ✓" : bReject.out.slice(0, 60), "· 불변 paid:", paidAfterReject);
  console.log("   600취소    :", cB.memos, "net:", cB.net, "· paid:", paid(uid), "(0 기대)");
  console.log("   → PASS     :", bPass);

  // (c) PG 실패 경로: 선차감 → finalize(false) → 보상 역분개 + 자동 복원
  const C = `LDWC3${Date.now()}C`;
  grant(uid, 1000, C); // paid 0→1000
  const bC = begin(uid, C, 1000); // paid 1000→0 (선차감)
  const paidPending = paid(uid);
  const fC = finalize(bC.lid, false, "ST25|fail|already_cancelled"); // 실패 → reversal
  // 원 pending 행(bC.lid)→failed, 보상 reversal 행은 ref_ledger_id=bC.lid(원 취소행)로 연결(복식).
  const pendingMemo = field(`SELECT memo FROM public.cash_ledger WHERE id='${bC.lid}';`, "memo");
  const revSql = `SELECT count(*) AS n, coalesce(sum(paid_delta),0) AS net FROM public.cash_ledger WHERE entry_type='charge_cancel' AND ref_ledger_id='${bC.lid}' AND memo='reversal';`;
  const revN = intField(revSql, "n");
  const revNet = intField(revSql, "net");
  const cPass =
    bC.ok && paidPending === 0 && fC.ok && paid(uid) === 1000 &&
    pendingMemo === "failed" && revN === 1 && revNet === 1000;
  console.log("\n(c) PG실패→보상복원");
  console.log("   선차감 후 paid:", paidPending, "(0) · 복원 후 paid:", paid(uid), "(1000 기대)");
  console.log("   원취소행→", pendingMemo, "(failed) · reversal행:", revN, "net:", revNet, "(1 / +1000 기대)");
  console.log("   → PASS     :", cPass);

  // (d) 동시성: pending 중 재시도 → CANCEL_IN_PROGRESS
  const D = `LDWC3${Date.now()}D`;
  grant(uid, 1000, D); // paid 1000→2000
  const bD1 = begin(uid, D, 500); // pending
  const bD2 = begin(uid, D, 500); // pending 존재 → 거부
  const dPass = bD1.ok && !bD2.ok && bD2.out.includes("CANCEL_IN_PROGRESS");
  finalize(bD1.lid, true, "0021|0000|ok"); // 정리(pending 해소)
  console.log("\n(d) 이중취소 동시성");
  console.log("   2차 begin  :", bD2.out.includes("CANCEL_IN_PROGRESS") ? "CANCEL_IN_PROGRESS ✓" : bD2.out.slice(0, 60));
  console.log("   → PASS     :", dPass);

  const allPass = aPass && bPass && cPass && dPass;
  console.log("\n=== RESULT:", allPass ? "ALL PASS ✅" : "FAIL ❌", "===");
  console.log(
    "\n[절차서] 실 PG 왕복(0021/ST25)은 세션 필요 → /hecto-test '충전 취소' 섹션:",
    "\n  1) 충전하기로 실 결제(LDW)·노티 0021 수신 → 2) 충전 취소 섹션에서 그 LDW 선택·취소 →",
    "\n  3) PG 0021 이면 finalized=confirmed·잔액 감소 / ST25(옛 자동취소건)면 reversed·잔액 원복 확인.",
  );
  if (!allPass) process.exit(1);
}

main();
