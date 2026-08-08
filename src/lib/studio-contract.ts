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

/**
 * 드로피 저장 payload — rate / fixed 배타(두 키 동시 반환 절대 금지).
 * 정본: commerce/ProductRegisterForm.tsx:350-355(고정 가드) · :674-682(배타 저장)
 *       및 CardStudioPage49.tsx:1750-1755 · :1787-1791.
 *
 * rate 모드: 정수 AND 1 <= ratePct <= DROPY_PCT_MAX → { dropy_rate: ratePct / 100 }, 아니면 {}
 * fixed 모드: /^\d{1,9}$/ AND n > 0 AND n <= priceNum → { dropy_fixed: n }, 아니면 {}
 *
 * ⚠️ 정본 대비 1점 강화: 49:1787 은 rate 모드에서 검증 없이 항상 `dropy_rate: ratePct/100` 을
 *   기록해 ratePct=0 이면 `dropy_rate: 0` 이 저장된다(adapters.ts:213 이 `> 0` 을 요구하므로
 *   수신은 미렌더 — 의미 없는 키). 여기서는 하한 1 을 두어 0 은 키 자체를 기록하지 않는다.
 *   상한 20 은 양쪽 동일. 배선 시 이 차이를 Duke 판정 대상으로 올릴 것.
 */
export function buildDropyPayload(
  mode: "rate" | "fixed",
  ratePct: number,
  fixedRaw: string,
  priceNum: number,
): { dropy_rate: number } | { dropy_fixed: number } | Record<string, never> {
  if (mode === "rate") {
    if (Number.isInteger(ratePct) && ratePct >= 1 && ratePct <= DROPY_PCT_MAX) {
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
