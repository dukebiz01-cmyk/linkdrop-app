// scripts/hecto-noti-idem-test.ts — v2 노티 원장 멱등 검증 자동화 (형님 검수용).
//   전제: dev 서버가 http://localhost:8080 에서 /api/hecto/noti 를 서빙하고,
//         .env.local(SUPABASE_SECRET_KEY/SUPABASE_URL)이 로딩돼 원장 INSERT 가 가능해야 한다.
//   실행: bun scripts/hecto-noti-idem-test.ts
//   검증 3종:
//     (a) 정본 서명 payload 를 동일하게 2회 POST → 둘 다 HTTP 200 "OK"
//     (b) supabase db query 로 해당 mcht_trd_no 1행 · received_count=2 확인
//     (c) 금액 1자 변조 payload POST → 400 · 행수/received_count 불변
import { execFileSync } from "node:child_process";
import { buildNotiVerifyHash } from "../src/server/payments/hecto/order";
import { getHectoConfig } from "../src/server/payments/hecto/config";

const BASE = process.env.HECTO_NOTI_TEST_BASE ?? "http://localhost:8080";

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

/** supabase db query --linked 출력에서 정수 컬럼값 추출(JSON 프리티프린트 → 정규식). */
function dbScalar(sql: string, key: string): number {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql], {
    encoding: "utf8",
  });
  const m = out.match(new RegExp(`"${key}":\\s*"?(-?\\d+)"?`));
  if (!m) throw new Error(`db query 결과에서 ${key} 추출 실패:\n${out}`);
  return Number.parseInt(m[1], 10);
}

async function main() {
  const cfg = getHectoConfig();
  const mchtTrdNo = `LDNOTI${Date.now()}`;
  const base = {
    outStatCd: "0021",
    trdDtm: "20260703120000",
    mchtId: cfg.mchtId,
    mchtTrdNo,
    trdAmt: "1000", // 노티는 금액 평문
    trdNo: `STFP_TEST_${mchtTrdNo}`,
    method: "CARD",
  };
  // 정본 서명(licenseKey 포함) — noti.ts 의 buildNotiVerifyHash 와 동일 조합.
  const pktHash = await buildNotiVerifyHash(
    {
      outStatCd: base.outStatCd,
      trdDtm: base.trdDtm,
      mchtId: base.mchtId,
      mchtTrdNo: base.mchtTrdNo,
      trdAmt: base.trdAmt,
    },
    cfg.licenseKey,
  );
  const goodPayload = { ...base, pktHash };

  const countSql = `SELECT count(*) AS n, coalesce(max(received_count),0) AS rc FROM public.payment_notifications WHERE mcht_trd_no = '${mchtTrdNo}';`;

  console.log("=== HECTO v2 noti idempotency test ===");
  console.log("base             :", BASE);
  console.log("mchtTrdNo        :", mchtTrdNo);
  console.log("pktHash          :", pktHash);

  // (a) 동일 정본 2회 POST → 둘 다 OK
  const r1 = await postNoti(goodPayload);
  const r2 = await postNoti(goodPayload);
  const aPass = r1.status === 200 && r1.text === "OK" && r2.status === 200 && r2.text === "OK";
  console.log("\n(a) 정본 2회 POST");
  console.log("   1st            :", r1.status, r1.text);
  console.log("   2nd            :", r2.status, r2.text);
  console.log("   → PASS         :", aPass);

  // (b) 원장 1행 · received_count=2
  const nAfter = dbScalar(countSql, "n");
  const rcAfter = dbScalar(countSql, "rc");
  const bPass = nAfter === 1 && rcAfter === 2;
  console.log("\n(b) 원장 조회 (mcht_trd_no 기준)");
  console.log("   row count(n)   :", nAfter);
  console.log("   received_count :", rcAfter);
  console.log("   → PASS         :", bPass);

  // (c) 금액 1자 변조(서명은 정본 유지) → 400 · 행/카운트 불변
  const tampered = { ...goodPayload, trdAmt: "9999" }; // pktHash 는 1000 서명 그대로 → 서버 재계산 불일치
  const r3 = await postNoti(tampered);
  const nTamper = dbScalar(countSql, "n");
  const rcTamper = dbScalar(countSql, "rc");
  const cPass = r3.status === 400 && nTamper === 1 && rcTamper === 2;
  console.log("\n(c) 금액 변조 POST(위조)");
  console.log("   status/body    :", r3.status, r3.text);
  console.log("   row count(n)   :", nTamper, "(불변 기대 1)");
  console.log("   received_count :", rcTamper, "(불변 기대 2)");
  console.log("   → PASS         :", cPass);

  const allPass = aPass && bPass && cPass;
  console.log("\n=== RESULT:", allPass ? "ALL PASS ✅" : "FAIL ❌", "===");
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error("[hecto-noti-idem-test] failed:", e);
  process.exit(1);
});
