// price-position45 — 내 가격 위치 1줄(FIX-45 보완 b). 순수 모듈(실측 가능).
//   시세 밴드 실값과 단위 정규화 비교만 — 정규화 실패(구성 없음 등) = 미렌더(억지 환산 금지).
//   사실만 표시: 권유·경고·판단 문구 0("너무 비싸요" 류 금지). 표기 = 백원 반올림(구 폼 규칙).

export type PricePositionInput = {
  /** 내 판매가(구성 단위 총액). null/0 = 전부 미렌더. */
  myPriceKrw: number | null;
  /** 내 구성 총중량(kg) — kg 정규화 기준. null = kg 비교 미렌더. */
  totalKg: number | null;
  /** 내 구성 입수(개) — 개당 정규화 기준. */
  unitCount: number | null;
  /** '개' 단위가 의미 있는 판매 방식인지(무게 단위 판매 = false — 구 폼 countMeaningful 동일). */
  countMeaningful: boolean;
  /** 도매 평균(원/kg) — get-price-band wholesale.avg 실값. */
  wholesaleAvgKg: number | null;
  /** 인터넷 개당 평균(원/개) — online_axes.unit.avg 실값. */
  onlineUnitAvg: number | null;
  /** 인터넷 kg당 평균(원/kg) — online_axes.kg.avg 또는 구응답 online.avg 실값. */
  onlineKgAvg: number | null;
};

const won = (n: number) => n.toLocaleString("ko-KR");

/** 차액(백원 반올림) → "±N원" 조각. 반올림 결과 0 = "차이가 100원 미만" 정직 표기. */
function diffLine(prefix: string, unitLabel: string, my: number, ref: number): string {
  const d = Math.round((my - ref) / 100) * 100;
  if (d === 0) return `${prefix}과 ${unitLabel} 차이가 100원 미만이에요`;
  return `${prefix}보다 ${unitLabel} ${d > 0 ? "+" : "−"}${won(Math.abs(d))}원`;
}

/** 위치 1줄들 — 빈 배열 = 미렌더. 도매(kg) → 인터넷(개당 우선, 폴백 kg) 순. */
export function buildPricePositionLines(i: PricePositionInput): string[] {
  const out: string[] = [];
  if (i.myPriceKrw == null || i.myPriceKrw <= 0) return out;
  if (i.wholesaleAvgKg != null && i.totalKg != null && i.totalKg > 0) {
    out.push(diffLine("도매 평균", "kg당", i.myPriceKrw / i.totalKg, i.wholesaleAvgKg));
  }
  if (i.onlineUnitAvg != null && i.countMeaningful && i.unitCount != null && i.unitCount >= 1) {
    out.push(diffLine("인터넷 평균", "개당", i.myPriceKrw / i.unitCount, i.onlineUnitAvg));
  } else if (i.onlineKgAvg != null && i.totalKg != null && i.totalKg > 0) {
    out.push(diffLine("인터넷 평균", "kg당", i.myPriceKrw / i.totalKg, i.onlineKgAvg));
  }
  return out;
}
