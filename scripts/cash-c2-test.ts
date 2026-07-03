// scripts/cash-c2-test.ts — 캐시 사용(차감) 검증 자동화 (CASH-c2, 형님 검수용).
//   전제: supabase CLI linked. use_cash 는 auth.uid() 기반이라 유저 컨텍스트를 jwt claim 임퍼소네이션으로 재현.
//   실행: bun scripts/cash-c2-test.ts
//   검증:
//     (a) 정상 차감 → 원장 'use' 1행 증가 · 잔액 정확 감소
//     (b) 잔액 부족 → INSUFFICIENT_CASH · 원장/잔액 불변
//     (c) INVALID_SKU 거부 · 불변
//     (d) 보안: 세션 없음(auth.uid() null) 차감 시도 → UNAUTHORIZED · anon EXECUTE 미부여
import { execFileSync } from "node:child_process";

const USE_AMOUNT = 100;

function dbRaw(sql: string): string {
  return execFileSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf8" });
}
function balances(uid: string): { paid: number; bonus: number; total: number } {
  const out = dbRaw(
    `SELECT coalesce((SELECT paid_balance FROM public.cash_wallets WHERE user_id='${uid}'),0) AS paid, coalesce((SELECT bonus_balance FROM public.cash_wallets WHERE user_id='${uid}'),0) AS bonus;`,
  );
  const paid = Number(out.match(/"paid":\s*"?(-?\d+)"?/)?.[1] ?? "NaN");
  const bonus = Number(out.match(/"bonus":\s*"?(-?\d+)"?/)?.[1] ?? "NaN");
  return { paid, bonus, total: paid + bonus };
}
function useCount(uid: string): number {
  const out = dbRaw(
    `SELECT count(*) AS n FROM public.cash_ledger WHERE user_id='${uid}' AND entry_type='use';`,
  );
  return Number(out.match(/"n":\s*"?(\d+)"?/)?.[1] ?? "NaN");
}
/** use_cash 를 유저(jwt sub) 또는 무세션(uid=null)으로 호출. 성공=ok, RAISE=!ok+메시지. */
function useCashAs(
  uid: string | null,
  sku: string,
  amount: number,
): { ok: boolean; out: string } {
  const claim = uid
    ? `SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: uid })}', true);`
    : "";
  const sql = `BEGIN; ${claim} SELECT public.use_cash('${sku}', ${amount}); COMMIT;`;
  try {
    return { ok: true, out: execFileSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf8" }) };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function main() {
  // 잔액 있는 지갑 1개(c1 충전분). 없으면 c1 테스트 먼저 실행 필요.
  const uidOut = dbRaw(
    "SELECT user_id FROM public.cash_wallets WHERE (paid_balance+bonus_balance) >= 200 ORDER BY paid_balance DESC LIMIT 1;",
  );
  const uid = uidOut.match(/"user_id":\s*"([0-9a-fA-F-]+)"/)?.[1];
  if (!uid) throw new Error("잔액≥200 지갑 없음 — cash-c1-test 로 먼저 충전 필요.");

  console.log("=== CASH-c2 test (사용/차감 + 보안) ===");
  console.log("uid    :", uid);

  // (a) 정상 차감
  const b0 = balances(uid);
  const u0 = useCount(uid);
  const a = useCashAs(uid, "boost", USE_AMOUNT);
  const b1 = balances(uid);
  const u1 = useCount(uid);
  const aPass = a.ok && u1 === u0 + 1 && b0.total - b1.total === USE_AMOUNT;
  console.log("\n(a) 정상 차감 boost", USE_AMOUNT);
  console.log("   use원장행 :", u0, "→", u1, "(기대 +1)");
  console.log("   총잔액    :", b0.total, "→", b1.total, "(기대 -" + USE_AMOUNT + ")");
  console.log("   → PASS    :", aPass);

  // (b) 잔액 부족
  const big = b1.total + 1_000_000;
  const b = useCashAs(uid, "boost", big);
  const b2 = balances(uid);
  const u2 = useCount(uid);
  const bPass = !b.ok && b.out.includes("INSUFFICIENT_CASH") && u2 === u1 && b2.total === b1.total;
  console.log("\n(b) 잔액 부족", big);
  console.log("   에러       :", b.out.includes("INSUFFICIENT_CASH") ? "INSUFFICIENT_CASH ✓" : b.out.slice(0, 80));
  console.log("   불변       :", u2 === u1 && b2.total === b1.total);
  console.log("   → PASS    :", bPass);

  // (c) INVALID_SKU
  const c = useCashAs(uid, "not_a_sku", USE_AMOUNT);
  const u3 = useCount(uid);
  const b3 = balances(uid);
  const cPass = !c.ok && c.out.includes("INVALID_SKU") && u3 === u2 && b3.total === b2.total;
  console.log("\n(c) INVALID_SKU");
  console.log("   에러       :", c.out.includes("INVALID_SKU") ? "INVALID_SKU ✓" : c.out.slice(0, 80));
  console.log("   → PASS    :", cPass);

  // (d) 보안: 무세션(auth.uid null) → UNAUTHORIZED + anon EXECUTE 미부여
  const d = useCashAs(null, "boost", 1);
  const grantOut = dbRaw(
    "SELECT grantee FROM information_schema.role_routine_grants WHERE routine_name='use_cash';",
  );
  const anonGranted = /"grantee":\s*"anon"/.test(grantOut);
  const b4 = balances(uid);
  const dPass = !d.ok && d.out.includes("UNAUTHORIZED") && !anonGranted && b4.total === b3.total;
  console.log("\n(d) 보안(무세션 차감 시도 + anon grant)");
  console.log("   무세션 결과 :", d.out.includes("UNAUTHORIZED") ? "UNAUTHORIZED ✓" : d.out.slice(0, 80));
  console.log("   anon EXECUTE:", anonGranted, "(기대 false)");
  console.log("   구조        : use_cash 는 p_user 없음 → auth.uid() 강제, 타인 지갑 차감 불가");
  console.log("   → PASS    :", dPass);

  const allPass = aPass && bPass && cPass && dPass;
  console.log("\n=== RESULT:", allPass ? "ALL PASS ✅" : "FAIL ❌", "===");
  if (!allPass) process.exit(1);
}

main();
