// scripts/cash-c1-test.ts — 캐시 지갑 c1(충전 발행) 검증 자동화 (형님 검수용).
//   전제: dev 서버 http://localhost:8080 서빙 + .env.local(SUPABASE_SECRET_KEY) 로딩 + supabase CLI linked.
//   실행: bun scripts/cash-c1-test.ts
//   검증:
//     (a) LDW 정본 노티 2회 POST → 둘 다 OK · cash_ledger charge 1행 · paid_balance 델타 = 금액 1회분(멱등)
//     (b) LD(일반) 노티 → 캐시 발행 0(분기 검증) · 잔액 불변
//     (c) 금액 변조 LDW 노티 → 400 · 캐시(행/잔액) 불변
import { execFileSync } from "node:child_process";
import { buildNotiVerifyHash } from "../src/server/payments/hecto/order";
import { getHectoConfig } from "../src/server/payments/hecto/config";

const BASE = process.env.HECTO_NOTI_TEST_BASE ?? "http://localhost:8080";
const AMOUNT = 1000;
const TRD_DTM = "20260703120000";

function encodeForm(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function postNoti(fields: Record<string, string>): Promise<{ status: number; text: string }> {
  const res = await fetch(`${BASE}/api/hecto/noti`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: encodeForm(fields),
  });
  return { status: res.status, text: (await res.text()).trim() };
}

function dbRaw(sql: string): string {
  return execFileSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf8" });
}
function dbField(sql: string, key: string): string {
  const out = dbRaw(sql);
  const m = out.match(new RegExp(`"${key}":\\s*"?([^",\\n}]*)"?`));
  if (!m) throw new Error(`db query 결과에서 ${key} 추출 실패:\n${out}`);
  return m[1].trim();
}
function dbInt(sql: string, key: string): number {
  return Number.parseInt(dbField(sql, key), 10);
}

async function main() {
  const cfg = getHectoConfig();

  // 테스트 대상 = 기존 auth 유저 1명(FK 충족). 잔액은 델타로 측정(사전 잔액 무관).
  const uid = dbField("SELECT id FROM auth.users LIMIT 1;", "id");
  const balSql = `SELECT coalesce((SELECT paid_balance FROM public.cash_wallets WHERE user_id='${uid}'),0) AS bal;`;
  const ledgerCountSql = (mcht: string) =>
    `SELECT count(*) AS n FROM public.cash_ledger WHERE ref_mcht_trd_no='${mcht}' AND entry_type='charge';`;

  async function signedNoti(
    mchtTrdNo: string,
    trdAmt: string,
    extra: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    const pktHash = await buildNotiVerifyHash(
      { outStatCd: "0021", trdDtm: TRD_DTM, mchtId: cfg.mchtId, mchtTrdNo, trdAmt },
      cfg.licenseKey,
    );
    return {
      outStatCd: "0021",
      trdDtm: TRD_DTM,
      mchtId: cfg.mchtId,
      mchtTrdNo,
      trdAmt,
      trdNo: `STFP_TEST_${mchtTrdNo}`,
      pktHash,
      ...extra,
    };
  }

  console.log("=== CASH-c1 test (충전 발행 멱등) ===");
  console.log("base   :", BASE);
  console.log("uid    :", uid);

  // (a) LDW 정본 2회 → OK · ledger 1행 · 잔액 +금액 1회분
  const ldw = `LDW${Date.now()}`;
  const before = dbInt(balSql, "bal");
  const good = await signedNoti(ldw, String(AMOUNT), { mchtParam: `uid=${uid}` });
  const a1 = await postNoti(good);
  const a2 = await postNoti(good);
  const ledgerA = dbInt(ledgerCountSql(ldw), "n");
  const afterA = dbInt(balSql, "bal");
  const aPass =
    a1.status === 200 && a1.text === "OK" && a2.status === 200 && a2.text === "OK" &&
    ledgerA === 1 && afterA - before === AMOUNT;
  console.log("\n(a) LDW 정본 2회");
  console.log("   POST 1/2       :", a1.status, a1.text, "/", a2.status, a2.text);
  console.log("   ledger charge행 :", ledgerA, "(기대 1)");
  console.log("   잔액 델타       :", afterA - before, "(기대", AMOUNT + ")");
  console.log("   → PASS         :", aPass);

  // (b) LD 일반 노티 → 캐시 발행 0 · 잔액 불변
  const ld = `LD${Date.now()}b`;
  const beforeB = afterA;
  const b1 = await postNoti(await signedNoti(ld, String(AMOUNT)));
  const ledgerB = dbInt(ledgerCountSql(ld), "n");
  const afterB = dbInt(balSql, "bal");
  const bPass = b1.status === 200 && b1.text === "OK" && ledgerB === 0 && afterB === beforeB;
  console.log("\n(b) LD 일반 노티(분기)");
  console.log("   POST           :", b1.status, b1.text);
  console.log("   ledger charge행 :", ledgerB, "(기대 0)");
  console.log("   잔액 불변       :", afterB === beforeB, `(${beforeB} → ${afterB})`);
  console.log("   → PASS         :", bPass);

  // (c) LDW 금액 변조(서명은 1000, 전송 9999) → 400 · 캐시 불변
  const ldw2 = `LDW${Date.now()}c`;
  const beforeC = afterB;
  const forged = await signedNoti(ldw2, String(AMOUNT), { mchtParam: `uid=${uid}` });
  forged.trdAmt = "9999"; // 서명 불일치 유발
  const c1 = await postNoti(forged);
  const ledgerC = dbInt(ledgerCountSql(ldw2), "n");
  const afterC = dbInt(balSql, "bal");
  const cPass = c1.status === 400 && ledgerC === 0 && afterC === beforeC;
  console.log("\n(c) LDW 금액 변조(위조)");
  console.log("   POST           :", c1.status, c1.text);
  console.log("   ledger charge행 :", ledgerC, "(기대 0)");
  console.log("   잔액 불변       :", afterC === beforeC, `(${beforeC} → ${afterC})`);
  console.log("   → PASS         :", cPass);

  const allPass = aPass && bPass && cPass;
  console.log("\n=== RESULT:", allPass ? "ALL PASS ✅" : "FAIL ❌", "===");
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error("[cash-c1-test] failed:", e);
  process.exit(1);
});
