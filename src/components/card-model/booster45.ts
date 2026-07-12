// booster45 — 판매 부스터 v1 칩 산출(FIX-39). 순수 모듈(실측 가능 · ST2b 에서 /d 도 이 함수 소비).
//   진실경계 하드: 전부 실값 입력만 — 0·미설정 = 미렌더, 추정·부풀림 카피 0(§13 다크패턴 거부).
//   D-day·남은수량은 스냅샷 박제 금지 — todayIso 를 조회 시점에 주입해 매번 계산.
//   압박 카피 금지: "지금 안 사면"류 없음 — 사실 표시만.

export type BoosterChip45 = { kind: "stock" | "dday" | "orders" | "benefit"; label: string };

export type BoosterInput45 = {
  /** 한정 수량 실값(stock_limit). null/0/미설정 = 미렌더. */
  stockLimit?: number | null;
  /** FIX-45c — 남은수량 단위 라벨(판매 구성 동기화: '박스'/'망'/'kg' 등). 미주입 = '개'(하위호환). */
  stockUnitLabel?: string | null;
  /** 재고 소진 상태(잔여 0 — /d 의 remaining_stock 파생 등). true = "품절" 정직 표기. */
  soldOut?: boolean;
  /** 판매기간 마감일(yyyy-mm-dd). 미설정 = D-day 미렌더. */
  saleEndIso?: string | null;
  /** 조회 시점(yyyy-mm-dd) — 호출부가 주입(순수성 · 박제 방지). */
  todayIso: string;
  /** preorders 실집계 인원. 집계 경로 없음/0 = 미렌더("벌써 N명"류 부풀림 금지). */
  orderCount?: number | null;
  /** FIX-40 — 공동구매 활성 시 true: 주문 칩을 진행률(GroupBuyView45)이 대체 — 이중 표기 방지. */
  groupBuyActive?: boolean;
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

/** FIX-45c — 남은수량 단위 라벨 파생(순수 · 스튜디오/ST2b /d 공용): 기존 저장 키
 *  sale_unit(+fresh 는 pack_type 스냅샷)만 읽어 표기 라벨로 번역 — 신규 저장 키 0.
 *  weight='kg' / fresh box=pack_type(박스·망·봉·포대·묶음) / 그 외 판매단위 라벨 / 기본 '개'. */
export function stockUnitLabelFrom(
  saleUnit?: string | null,
  packType?: string | null,
): string {
  if (saleUnit === "weight") return "kg";
  if (saleUnit === "box" && packType) return packType;
  // 가공품·공산품 판매단위 라벨(폼 UNIT_LABELS 와 동일 값 — 순수 모듈이라 상수 자체 보유).
  const map: Record<string, string> = {
    pack: "팩",
    bottle: "병",
    bag: "봉지",
    can: "캔",
    box: "박스",
    sack: "포대",
    set: "세트",
  };
  return (saleUnit && map[saleUnit]) || "개";
}

/** 부스터 칩 배열 — 빈 배열 = 스택 자체 미렌더. */
export function buildBoosterChips(i: BoosterInput45): BoosterChip45[] {
  const chips: BoosterChip45[] = [];
  // 남은수량 — 품절 상태 우선(정직 표기), 그 외엔 실값 >0 만.
  if (i.soldOut) {
    chips.push({ kind: "stock", label: "품절" });
  } else if (i.stockLimit != null && i.stockLimit > 0) {
    // FIX-45c — 단위 = 판매 구성 라벨(미주입 '개'). 값(stock_limit)은 구성 단위 개수 그대로(변환 0).
    chips.push({
      kind: "stock",
      label: `${i.stockLimit.toLocaleString("ko-KR")}${i.stockUnitLabel || "개"} 남음`,
    });
  }
  // D-day — 마감일 실존 시만.
  if (i.saleEndIso) {
    chips.push({ kind: "dday", label: ddayLabel(i.saleEndIso, i.todayIso) });
  }
  // 주문 N명 — 실집계 >0 만. 공동구매 활성 시엔 진행률이 같은 숫자를 표기 — 칩 생략(중복 방지).
  if (!i.groupBuyActive && i.orderCount != null && i.orderCount > 0) {
    chips.push({ kind: "orders", label: `주문 ${i.orderCount.toLocaleString("ko-KR")}명` });
  }
  // 혜택스택 — 실제 연결분만.
  if (i.benefits?.coupon) chips.push({ kind: "benefit", label: "쿠폰" });
  if (i.benefits?.discountLabel) chips.push({ kind: "benefit", label: i.benefits.discountLabel });
  if (i.benefits?.freeShipping) chips.push({ kind: "benefit", label: "무료배송" });
  return chips;
}

// ── FIX-40 — 공동구매 v1 표시 산출(순수 · ST2b /d 공용) ─────────────────────────
//   정산 무접촉(v1 락): 달성/미달 판정·차액 환불·재결제 자동화 없음(판매자 수동 운영).
//   미달 자동 취소 없음 — 기본가 진행 + 구매자 취소권(고지 고정 문구). 압박 카피 0(§13).

export type GroupBuyInput45 = {
  /** 목표 인원(≥2 아니면 전체 null — 폼 유효성과 동일 가드). */
  targetN: number;
  /** 달성 시 할인가(>0). 기본가 대비 검증은 폼 몫 — 여기선 표시만. */
  achievedPriceKrw: number;
  /** preorders 실집계 참여 인원 — null = 집계 입력 없음 → 진행률 줄 미렌더(가짜 집계 금지). */
  joinedCount?: number | null;
};

export type GroupBuyView45 = {
  /** "N명 모이면 ○○원" — 사실(숫자·조건)만. */
  offerLine: string;
  /** "참여 M명 / 목표 N명" — 실집계 있을 때만(null = 미렌더). */
  progressLine: string | null;
  /** 필수 고지(§13 — 참여 시점 선명 노출, 문구 고정). */
  noticeLine: string;
  /** 취소 경로 정직 표기 — 구매자 셀프 취소 플로우 부재(READ 판정) → 매장 문의 안내. */
  cancelLine: string;
};

export function buildGroupBuyView(i: GroupBuyInput45): GroupBuyView45 | null {
  if (!Number.isFinite(i.targetN) || i.targetN < 2) return null;
  if (!Number.isFinite(i.achievedPriceKrw) || i.achievedPriceKrw <= 0) return null;
  return {
    offerLine:
      `${i.targetN.toLocaleString("ko-KR")}명 모이면 ` +
      `${i.achievedPriceKrw.toLocaleString("ko-KR")}원`,
    progressLine:
      i.joinedCount != null
        ? `참여 ${i.joinedCount.toLocaleString("ko-KR")}명 / 목표 ${i.targetN.toLocaleString("ko-KR")}명`
        : null,
    noticeLine:
      "목표 인원이 안 모이면 기본가로 진행됩니다. 원치 않으면 발송 전에 취소할 수 있어요.",
    cancelLine: "취소는 매장에 문의해 주세요.",
  };
}
