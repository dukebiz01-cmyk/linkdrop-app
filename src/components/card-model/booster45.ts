// booster45 — 판매 부스터 v1 칩 산출(FIX-39). 순수 모듈(실측 가능 · ST2b 에서 /d 도 이 함수 소비).
//   진실경계 하드: 전부 실값 입력만 — 0·미설정 = 미렌더, 추정·부풀림 카피 0(§13 다크패턴 거부).
//   D-day·남은수량은 스냅샷 박제 금지 — todayIso 를 조회 시점에 주입해 매번 계산.
//   압박 카피 금지: "지금 안 사면"류 없음 — 사실 표시만.

export type BoosterChip45 = { kind: "stock" | "dday" | "orders" | "benefit"; label: string };

export type BoosterInput45 = {
  /** 한정 수량 실값(stock_limit). null/0/미설정 = 미렌더. */
  stockLimit?: number | null;
  /** 재고 소진 상태(잔여 0 — /d 의 remaining_stock 파생 등). true = "품절" 정직 표기. */
  soldOut?: boolean;
  /** 판매기간 마감일(yyyy-mm-dd). 미설정 = D-day 미렌더. */
  saleEndIso?: string | null;
  /** 조회 시점(yyyy-mm-dd) — 호출부가 주입(순수성 · 박제 방지). */
  todayIso: string;
  /** preorders 실집계 인원. 집계 경로 없음/0 = 미렌더("벌써 N명"류 부풀림 금지). */
  orderCount?: number | null;
  /** 실제 연결된 혜택만(없는 혜택 표시 금지). */
  benefits?: {
    coupon?: boolean;
    /** 실쿠폰 discount_value/unit 로 호출부가 조립(예: "10% 할인"). 없으면 null. */
    discountLabel?: string | null;
    freeShipping?: boolean;
  };
};

/** 마감 D-day 라벨 — 날짜 단위 차이(양수 D-N · 당일 D-day · 경과 = "판매 마감" 정직 표기). */
export function ddayLabel(saleEndIso: string, todayIso: string): string {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  };
  const diff = Math.round((toUtc(saleEndIso) - toUtc(todayIso)) / 86_400_000);
  if (diff > 0) return `마감 D-${diff}`;
  if (diff === 0) return "마감 D-day";
  return "판매 마감";
}

/** 부스터 칩 배열 — 빈 배열 = 스택 자체 미렌더. */
export function buildBoosterChips(i: BoosterInput45): BoosterChip45[] {
  const chips: BoosterChip45[] = [];
  // 남은수량 — 품절 상태 우선(정직 표기), 그 외엔 실값 >0 만.
  if (i.soldOut) {
    chips.push({ kind: "stock", label: "품절" });
  } else if (i.stockLimit != null && i.stockLimit > 0) {
    chips.push({ kind: "stock", label: `${i.stockLimit.toLocaleString("ko-KR")}개 남음` });
  }
  // D-day — 마감일 실존 시만.
  if (i.saleEndIso) {
    chips.push({ kind: "dday", label: ddayLabel(i.saleEndIso, i.todayIso) });
  }
  // 주문 N명 — 실집계 >0 만.
  if (i.orderCount != null && i.orderCount > 0) {
    chips.push({ kind: "orders", label: `주문 ${i.orderCount.toLocaleString("ko-KR")}명` });
  }
  // 혜택스택 — 실제 연결분만.
  if (i.benefits?.coupon) chips.push({ kind: "benefit", label: "쿠폰" });
  if (i.benefits?.discountLabel) chips.push({ kind: "benefit", label: i.benefits.discountLabel });
  if (i.benefits?.freeShipping) chips.push({ kind: "benefit", label: "무료배송" });
  return chips;
}
