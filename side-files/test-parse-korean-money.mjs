// FIX-D13-1 — parseKoreanMoney / findKoreanMoney 합격 판정 테스트.
//
// 실행: node side-files/test-parse-korean-money.mjs
// 원본(src/lib/studio-contract.ts)을 TypeScript 컴파일러로 그대로 트랜스파일해 불러온다 —
// 손으로 옮겨 적은 사본이 아니라 **실소스**를 검증한다(사본 드리프트 0).
// 이 파일은 앱 번들에 포함되지 않는다(side-files = 빌드 대상 밖).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(here, "..", "src", "lib", "studio-contract.ts");
const source = readFileSync(srcPath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(outputText, "utf8").toString("base64")
);
const { parseKoreanMoney, findKoreanMoney } = mod;

let pass = 0;
const fails = [];
const rows = [];

function record(group, input, expect, actual, ok, note) {
  rows.push({ group, input, expect, actual, ok, note: note ?? "" });
  if (ok) pass++;
  else fails.push(`${group} | "${input}" | 기대=${expect} | 실제=${actual}`);
}

/** 수용 기대 — 정확한 원 값까지 일치해야 통과. */
function accepts(input, won, opts) {
  const r = parseKoreanMoney(input, opts);
  const actual = r.ok ? String(r.won) : `거부(${r.reason})`;
  record("parseKoreanMoney/수용", input, String(won), actual, r.ok && r.won === won);
}

/** 거부 기대 — 사유 문구는 표에 남기되 판정은 ok===false 만 본다. */
function rejects(input, opts) {
  const r = parseKoreanMoney(input, opts);
  const actual = r.ok ? String(r.won) : `거부(${r.reason})`;
  record("parseKoreanMoney/거부", input, "거부", actual, !r.ok);
}

/** 문장 스캔 — won 과 잘라낸 구간 문자열까지 함께 검증. */
function finds(text, won, span, opts) {
  const r = findKoreanMoney(text, opts);
  const cut = r ? text.slice(r.start, r.end) : null;
  const actual = r ? `${r.won} / "${cut}"` : "null";
  record("findKoreanMoney", text, `${won} / "${span}"`, actual, !!r && r.won === won && cut === span);
}

function findsNull(text, opts) {
  const r = findKoreanMoney(text, opts);
  const actual = r ? `${r.won} / "${text.slice(r.start, r.end)}"` : "null";
  record("findKoreanMoney", text, "null", actual, r === null);
}

// ── S2 §1 — parseKoreanMoney 수용 ──────────────────────────────────────────
accepts("삼만원", 30000);
accepts("만오천원", 15000);
accepts("오천원", 5000);
accepts("십오만원", 150000);
accepts("오만원", 50000);
accepts("백만원", 1000000);
accepts("십만원", 100000);
accepts("이천원", 2000);
accepts("구천원", 9000);
accepts("오백원", 500);
accepts("천원", 1000);
accepts("만원", 10000);
accepts("3만원", 30000);
accepts("3만5천원", 35000);
accepts("삼 만 원", 30000);
accepts("30000원", 30000);

// ── S2 §2 — parseKoreanMoney 거부 ──────────────────────────────────────────
rejects("1억5천"); // 기본 opts — "원" 없는 배수 표현.
rejects("1억5천원"); // 상한 1억 초과.
rejects("3만"); // 기본 opts — "원" 없음.
rejects("3만원쯤"); // 어림 꼬리.
rejects("수백만원"); // 어림 머리.
rejects("삼사만원"); // 단자리 어림 인접.
rejects("2~3만원"); // 범위.
rejects("천천히"); // V1b 오발동 5건 ①
rejects("만들기"); //                ②
rejects("강원도"); //                ③
rejects("원산지"); //                ④
rejects("만두"); //                  ⑤
rejects(""); // 빈 문자열.

// ── S2 §3 — opts 검증 ─────────────────────────────────────────────────────
accepts("3만", 30000, { allowBareMultiplier: true });

// ── S2 §4 — findKoreanMoney ───────────────────────────────────────────────
finds("한박스에 삼만원", 30000, "삼만원");
finds("삼만원에 팔게요", 30000, "삼만원");
finds("고구마 한박스 삼만원", 30000, "삼만원");
finds("1박스에 3만원", 30000, "3만원");
findsNull("천천히 보내주세요");
findsNull("만들기");
findsNull("강원도");
findsNull("원산지");
findsNull("만두");
findsNull("고구마 30000원 100박스"); // 한글 숫자 없음 — 기존 parseOneLiner 영역.
findsNull("3만원쯤");
findsNull("수백만원");
findsNull("삼사만원");
finds("만원짜리 상자", 10000, "만원"); // 환산은 정확히 — 채택 여부는 2차 소비처 결정.

// ── 출력 ──────────────────────────────────────────────────────────────────
const w = (s, n) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].length));
console.log(w("결과", 6) + w("그룹", 24) + w("입력", 26) + w("기대", 22) + "실제");
console.log("-".repeat(110));
for (const r of rows) {
  console.log(w(r.ok ? "PASS" : "FAIL", 6) + w(r.group, 24) + w(`"${r.input}"`, 26) + w(r.expect, 22) + r.actual);
}
console.log("-".repeat(110));
console.log(`통과 ${pass}/${rows.length}`);
if (fails.length) {
  console.log("\n실패 목록:");
  for (const f of fails) console.log("  " + f);
  process.exit(1);
}
console.log("전건 통과 — 커밋 조건 충족.");
