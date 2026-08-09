// ════════════════════════════════════════════════════════════════════════════
// studio-contract — 스튜디오 계약 단일 소스(순수함수·상수 전용).
//
// 목적: 49 스튜디오와 신규 트랙이 "같은 숫자·같은 규칙"을 쓰도록 계약을 한 곳에 모은다.
//   현재 gb 산식은 CardStudioPage49.tsx:1338 과 ProductRegisterForm49.tsx:486 에 2벌 복제돼
//   있고, 드로피 배타 저장 규칙은 49:1787 / commerce/ProductRegisterForm.tsx:678 에 2벌 있다.
//   이 모듈이 3번째 복제본이 아니라 "정본 후보"가 되도록 각 함수 위에 원 정본 위치를 명기한다.
//
// 락: React import 금지(순수 모듈 — 렌더·상태 무관). 부수효과 0. DOM 접근 0.
//     이 파일은 아직 어느 화면에도 배선되지 않았다 — 기존 동작 무영향(P0 신설분).
// ════════════════════════════════════════════════════════════════════════════

// ── 드로피(공유 보상) 상한 ──────────────────────────────────────────────────
/** 드로피 rate 상한(비율). 정본: src/lib/adapters.ts:213 (`data.dropy_rate <= 0.2`). */
export const DROPY_RATE_CAP = 0.2;
/** 드로피 rate 상한(정수 %). 정본: CardStudioPage49.tsx:1534 (`if (n > 20) return;`). */
export const DROPY_PCT_MAX = 20;

// ── 모일수록 할인(gb) 단계표 산식 상수 ──────────────────────────────────────
/** 단계 수량 임계 후보. 정본: CardStudioPage49.tsx:1342. */
export const GB_QTY_CANDIDATES = [3, 10, 20, 30, 50, 100] as const;
/** 단계당 가격 체감률(7% — 지시 범위 5~10% 내 고정값). 정본: CardStudioPage49.tsx:1346. */
export const GB_DECAY = 0.07;
/** 단계 가격 하한(원). 정본: CardStudioPage49.tsx:1346. */
export const GB_PRICE_FLOOR = 100;
/** 제안 최대 단계 수. 정본: CardStudioPage49.tsx:1342 (`.slice(0, 4)`). */
const GB_MAX_TIERS = 4;

/**
 * 모일수록 단계표 제안 — [결정적 산식 · AI 생성 숫자 아님].
 * 정본: CardStudioPage49.tsx:1338-1348 (복제본 ProductRegisterForm49.tsx:486-497).
 *
 * 규칙(정본 그대로):
 *   · 임계 후보 중 stockN 이하만 채택(사다리 천장 — 초과 임계는 제안 자체 제외) · 앞에서부터 최대 4단계
 *   · 후보 0개 = stockN 단일 단계 폴백
 *   · price = max(100, floor(base × (1 − 0.07×(i+1)) / 100) × 100)  ← 백원 단위 절사
 *   · base <= 0 || stockN <= 0 → [] (제안 없음)
 * 제안일 뿐 — 확정은 사장님.
 */
export function buildGbProposal(baseKrw: number, stockN: number): { qty: string; price: string }[] {
  if (!Number.isFinite(baseKrw) || !Number.isFinite(stockN)) return [];
  if (baseKrw <= 0 || stockN <= 0) return [];
  const cands = GB_QTY_CANDIDATES.filter((q) => q <= stockN).slice(0, GB_MAX_TIERS);
  const qtys: number[] = cands.length > 0 ? [...cands] : [stockN];
  return qtys.map((q, i) => ({
    qty: String(q),
    price: String(
      Math.max(GB_PRICE_FLOOR, Math.floor((baseKrw * (1 - GB_DECAY * (i + 1))) / 100) * 100),
    ),
  }));
}

/**
 * 단계표 행 파싱 — 문자열 입력 → 정수.
 * 정본: CardStudioPage49.tsx:1357-1362 (`parsedGbDraft`) — 숫자 외 문자 제거 후 floor, 실패 = 0.
 */
function parseGbRow(r: { qty: string; price: string }): { qty: number; price: number } {
  return {
    qty: Math.floor(Number(r.qty.replace(/[^0-9]/g, ""))) || 0,
    price: Math.floor(Number(r.price.replace(/[^0-9]/g, ""))) || 0,
  };
}

/**
 * 단계표 전체 유효성 — 하나라도 어긋나면 true(= 확정 불가).
 * 정본: CardStudioPage49.tsx:1350-1356 (`gbRowInvalid` 행 단위)를 배열 단위로 집약.
 *
 * 행 규칙(정본 그대로):
 *   · qty > 0 && price > 0
 *   · qty 순오름차순(i>0 이면 이전 행보다 커야 함)
 *   · price 순내림차순(i>0 이면 이전 행보다 작아야 함)
 *   · 마지막 행 qty <= stockN (사다리 천장 · stockN > 0 일 때만 적용)
 *
 * 빈 배열 = true(무효). 근거: 49 의 모든 호출부가 `rows.length === 0 || rows.some(...)`
 *   (:1385 · :7778) 또는 `length > 0 && every(...)`(:1462 · :1807) 로 빈 배열을 무효 취급한다 —
 *   행 단위 함수에는 없던 판정이지만 호출부 4곳 전부의 실제 계약이라 여기서 흡수한다.
 */
export function gbRowsInvalid(rows: { qty: string; price: string }[], stockN: number): boolean {
  if (rows.length === 0) return true;
  const parsed = rows.map(parseGbRow);
  return parsed.some((r, i) => {
    if (r.qty <= 0 || r.price <= 0) return true;
    if (i > 0 && (r.qty <= parsed[i - 1].qty || r.price >= parsed[i - 1].price)) return true;
    if (i === parsed.length - 1 && stockN > 0 && r.qty > stockN) return true;
    return false;
  });
}

/**
 * 금액 입력 파싱 — [신규 정본] "3만원 → 3원" 절삭 사고 차단.
 *
 * 배경: 구 동작(CardStudioPage49.tsx:1522 `v.replace(/[^0-9]/g, "")`)은 "3만원"에서 숫자만
 *   훑어 3 으로 저장했고, "삼만원"은 빈 문자열이 되어 무언 실패(silent no-op)했다.
 *   여기서는 자동 환산을 하지 않는다 — 되물음(재질문)용 실패 사유만 돌려준다.
 *
 * 규칙:
 *   1) trim → 콤마·공백 제거 → 끝의 "원" 1회 제거
 *   2) 남은 문자열이 비면 → { ok:false, reason:"empty" }
 *   3) /^\d+$/ 아니면(한글 단위 "만"·"천" 등 포함) → { ok:false, reason:"mixed" }
 *      ※ 자동 환산 절대 금지 — 호출부가 "숫자로만 적어 주세요" 되물음을 담당한다.
 *   4) 통과 → { ok:true, value:Number(...) }
 */
export function parseKrwInput(
  raw: string,
): { ok: true; value: number } | { ok: false; reason: "empty" | "mixed" } {
  const stripped = raw.trim().replace(/[,\s]/g, "");
  const body = stripped.endsWith("원") ? stripped.slice(0, -1) : stripped;
  if (body === "") return { ok: false, reason: "empty" };
  if (!/^\d+$/.test(body)) return { ok: false, reason: "mixed" };
  return { ok: true, value: Number(body) };
}

// ── 한 문장 파서(C-매직) ────────────────────────────────────────────────────
/** 수량 단위(한글) — 뒤에 한글이 더 붙으면 단위로 보지 않는다("10개입"의 "개" 등). */
const QTY_UNITS = ["박스", "세트", "개", "봉", "팩", "병"] as const;
/** 한글 배수 단위 — 붙으면 그 조각은 실패(자동 환산 절대 금지). */
const MULT_UNITS = ["만", "천", "억"] as const;
/** name 에서 걷어낼 접두어 — 지시서 명시분만(임의 확장 금지). */
const NAME_STRIP_WORDS = ["나눔"] as const;

export type OneLinerResult = {
  name: string | null;
  priceKrw: number | null;
  qty: number | null;
  droppyPct: number | null;
  missing: ("name" | "price" | "qty" | "droppy")[];
  ambiguous: boolean;
};

/**
 * 한 문장 → 재료 조각 파서. [결정적 · AI 0 · 부수효과 0 · React 0]
 *
 * 정본 원칙(전 규칙 공통): **애매하면 읽지 않고 되묻는다(§0 NUMBER_CRITICAL).**
 *
 * 규칙:
 *  1) 콤마·공백 정규화. 숫자 토큰의 역할은 **뒤따르는 단위로만** 판정한다 —
 *     원=가격 · 개/박스/봉/세트/팩/병/kg=수량 · %/프로=몫.
 *     ※ 애매하면 읽지 않고 되묻는다(§0 NUMBER_CRITICAL).
 *  2) "만/천/억" 등 한글 배수 단위가 붙은 숫자는 **그 조각 실패** 처리한다(자동 환산 절대 금지 —
 *     parseKrwInput 과 동일 원칙: "3만원"을 30000 으로 지어내지 않는다).
 *     ※ 애매하면 읽지 않고 되묻는다(§0 NUMBER_CRITICAL).
 *  3) 단위 없는 숫자는 **전부 무시**하고 missing 에 반영한다 — 정확히 1개여도 가격 후보로
 *     채택하지 않는다. 단위 없는 숫자가 2개 이상이면 ambiguous=true(추측 금지 신호).
 *     ※ 애매하면 읽지 않고 되묻는다(§0 NUMBER_CRITICAL).
 *  4) name = 숫자·단위 토큰과 "나눔" 류 접두어를 걷어낸 잔여 텍스트. 빈 문자열이면 null.
 *     ※ 애매하면 읽지 않고 되묻는다(§0 NUMBER_CRITICAL).
 *  5) 부수효과 0 · React 0. 같은 역할이 2번 나오면 **첫 번째만** 채택한다(뒤 값은 무시).
 *
 * 단위 경계: 한글 단위 뒤에 한글이 이어지면 단위로 보지 않는다("10개입"의 "개", "1병원"의 "병").
 *   → 그 숫자는 단위 없는 숫자로 떨어져 규칙 3 이 적용된다(오독보다 되물음이 안전).
 */
export function parseOneLiner(raw: string): OneLinerResult {
  const text = raw.replace(/,/g, "").replace(/\s+/g, " ").trim();
  let priceKrw: number | null = null;
  let qty: number | null = null;
  let droppyPct: number | null = null;
  let unitlessCount = 0;
  const consumed: { start: number; end: number }[] = [];

  const isHangul = (ch: string | undefined) => !!ch && /[가-힣]/.test(ch);
  const isLatin = (ch: string | undefined) => !!ch && /[A-Za-z]/.test(ch);

  const numRe = /\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(text)) !== null) {
    const numStart = m.index;
    let i = numStart + m[0].length;
    if (text[i] === " ") i += 1; // 숫자와 단위 사이 공백 1칸 허용.

    // 배수 단위 우선 판정 — 붙어 있으면 그 조각은 실패(값 미채택).
    //   뒤따르는 역할 단위까지 함께 걷어낸다("3만원" → 전부 제거: name 에 "원"만 남는 것 방지).
    const mult = MULT_UNITS.find((u) => text.startsWith(u, i));
    if (mult) {
      let end = i + mult.length;
      const tail = ["원", "%", "프로", "kg", ...QTY_UNITS].find((u) => text.startsWith(u, end));
      if (tail) end += tail.length;
      consumed.push({ start: numStart, end });
      continue; // 값 미채택 → 해당 역할은 missing 으로 남는다.
    }

    const value = Number(m[0]);
    // 가격 — "원"
    if (text.startsWith("원", i) && !isHangul(text[i + 1])) {
      if (priceKrw == null) priceKrw = Math.floor(value);
      consumed.push({ start: numStart, end: i + 1 });
      continue;
    }
    // 몫 — "%" | "프로"
    if (text.startsWith("%", i)) {
      if (droppyPct == null) droppyPct = value;
      consumed.push({ start: numStart, end: i + 1 });
      continue;
    }
    if (text.startsWith("프로", i) && !isHangul(text[i + 2])) {
      if (droppyPct == null) droppyPct = value;
      consumed.push({ start: numStart, end: i + 2 });
      continue;
    }
    // 수량 — kg(라틴) + 한글 단위
    if (text.startsWith("kg", i) && !isLatin(text[i + 2])) {
      if (qty == null) qty = Math.floor(value); // 정수부만.
      consumed.push({ start: numStart, end: i + 2 });
      continue;
    }
    const qUnit = QTY_UNITS.find((u) => text.startsWith(u, i) && !isHangul(text[i + u.length]));
    if (qUnit) {
      if (qty == null) qty = Math.floor(value);
      consumed.push({ start: numStart, end: i + qUnit.length });
      continue;
    }
    // 단위 없음 — 규칙 3: 값으로 채택하지 않고 세기만 한다.
    //   name 에서도 걷어내지 않는다 — 읽지 않은 숫자는 이름의 일부일 수 있다("찰옥수수 10개입").
    //   값으로 읽은 토큰만 제거하는 것이 규칙 4 의 의도(오독 잔해로 이름을 깨뜨리지 않는다).
    unitlessCount += 1;
  }

  // 규칙 4 — 숫자·단위 구간과 접두어를 걷어낸 잔여 텍스트.
  let rest = "";
  let cursor = 0;
  for (const c of consumed) {
    rest += text.slice(cursor, c.start);
    cursor = c.end;
  }
  rest += text.slice(cursor);
  for (const w of NAME_STRIP_WORDS) rest = rest.split(w).join(" ");
  const nameRaw = rest.replace(/[.,·/\\|~\-–—:;]+/g, " ").replace(/\s+/g, " ").trim();
  // 이름은 글자를 하나라도 포함해야 한다 — 숫자·기호만 남으면 이름이 아니다("25000 50" 등).
  const name = nameRaw && /[가-힣A-Za-z]/.test(nameRaw) ? nameRaw : null;

  const missing: OneLinerResult["missing"] = [];
  if (!name) missing.push("name");
  if (priceKrw == null) missing.push("price");
  if (qty == null) missing.push("qty");
  if (droppyPct == null) missing.push("droppy");

  return { name, priceKrw, qty, droppyPct, missing, ambiguous: unitlessCount >= 2 };
}

/**
 * 드로피 저장 payload — rate / fixed 배타(두 키 동시 반환 절대 금지).
 * 정본: commerce/ProductRegisterForm.tsx:350-355(고정 가드) · :674-682(배타 저장)
 *       및 CardStudioPage49.tsx:1750-1755 · :1787-1791.
 *
 * rate 모드: 정수 AND 0 <= ratePct <= DROPY_PCT_MAX → { dropy_rate: ratePct / 100 }, 아니면 {}
 * fixed 모드: /^\d{1,9}$/ AND n > 0 AND n <= priceNum → { dropy_fixed: n }, 아니면 {}
 *
 * 정본 일치(0 허용) + 음수 가드: 49:1787 은 rate 모드에서 검증 없이 항상 `dropy_rate: ratePct/100`
 *   을 기록하므로 ratePct=0 이면 `dropy_rate: 0` 이 저장된다 — 여기도 하한 0 으로 맞춰 그 동작을
 *   그대로 승계한다(보상 0% = 대표님의 정당한 선택 · S0 원칙 동형). 수신 렌더는 adapters.ts:213
 *   이 `> 0` 을 요구해 0 은 미렌더 — 저장은 되되 표시만 안 되는 정본 그대로의 상태다.
 *   음수·소수만 차단(정본에 없던 유일한 방어 — 키 자체를 기록하지 않는다). 상한 20 은 양쪽 동일.
 */
export function buildDropyPayload(
  mode: "rate" | "fixed",
  ratePct: number,
  fixedRaw: string,
  priceNum: number,
): { dropy_rate: number } | { dropy_fixed: number } | Record<string, never> {
  if (mode === "rate") {
    if (Number.isInteger(ratePct) && ratePct >= 0 && ratePct <= DROPY_PCT_MAX) {
      return { dropy_rate: ratePct / 100 };
    }
    return {};
  }
  const t = fixedRaw.trim();
  if (!/^\d{1,9}$/.test(t)) return {};
  const n = Number(t);
  if (n > 0 && n <= priceNum) return { dropy_fixed: n };
  return {};
}
