import { RotateCw, TrendingUp } from "lucide-react";

// 공용 시세 어드바이저 — P5b(단위 헌법 1~3조) 표기 전면 교체.
//   구조: ①개당(또는 kg당) 헤드라인 → ②환산 근거 줄 → ③3열 고정 표(도매/인터넷/제외)
//        → ④내 판매단위 강조 → ⑤고정 참고 문구(모든 상태 공통).
//   P5d — 헤드라인 도매 우선(인터넷은 confidence ok·표본≥10일 때만 후보), 인터넷 범위는
//        p25~p75(대표값 median), 저신뢰 인터넷은 "표본 부족 · 참고만" 배지로 강등.
//   순수 presentational: props {priceBand, loading, composition} 만. invoke·state 는 호출부 몫.
//   §0: 생산자 가격 결정 참고용만 — 시세를 저장/손님 카드로 내보내지 않는다. 단정·권유 금지.
//   표기 규칙: 전 금액 백원 반올림 + "약" 접두.

// get-price-band 응답 소스(레거시 sources 배열 — P5b 표기는 아래 구조화 블록 사용).
export type PriceSource = {
  source: string;
  source_label: string;
  price_type: string;
  low: number;
  high: number;
  unit: string;
  rank_note: string;
  ref_date: string;
};

// P5a 구조화 블록 — base_unit=kg. 온라인 통계는 kg 환산가 기준으로만 산출.
export type WholesaleBlock = {
  min: number;
  max: number;
  avg: number;
  market_count: number;
  as_of: string;
};
export type OnlineBlock = {
  status: "ok" | "insufficient";
  min: number | null;
  max: number | null;
  avg: number | null;
  converted_count: number;
  excluded_count: number;
  as_of: string;
  // P5d 확장(옵셔널 — 구응답 호환): 사분위·신뢰도·순도/교차 가드 집계.
  confidence?: "ok" | "low";
  p25?: number | null;
  p75?: number | null;
  median?: number | null;
  filtered_count?: number;
  outlier_count?: number;
  cross_check?: "applied" | "unavailable";
};

// T3a-ⓑ — edge v16 ADDITIVE 축 블록. kg축=원/kg(리스팅 자기 정보 환산만) · unit축=원/개.
export type AxisBlock = {
  min: number | null;
  avg: number | null;
  max: number | null;
  n: number;
  excluded: number;
};

export type PriceBandResult = {
  status: "ok" | "no_data" | "unconfigured" | "error";
  item_code: string;
  item_name: string | null;
  sources: PriceSource[];
  cached: boolean;
  note?: string;
  // P5a 확장(옵셔널) — 구버전 응답(미배포·구캐시)엔 없음 → 표 대신 데이터 부족 표기.
  base_unit?: "kg";
  wholesale?: WholesaleBlock | null;
  online?: OnlineBlock | null;
  per_unit_weight_g?: number;
  unit_count?: number;
  // T3a-ⓑ ADDITIVE(edge v16) — 없으면 전부 기존 경로 폴백(회귀 0).
  online_axes?: { kg: AxisBlock; unit: AxisBlock } | null;
  kinds?: {
    retail?: string | null;
    wholesale?: Record<string, number>;
    online?: Record<string, number>;
  };
  retail_prev?: { day: number | null; month: number | null } | null;
};

// 내 판매 구성(등록폼 입력) — 개당 환산·내 판매단위 강조의 기준.
export type PriceComposition = {
  packType: string; // 박스/봉/망/기타
  unitCount: number;
  totalKg: number;
};

// 백원 반올림(단위 헌법 표기 규칙 — 호출부에서 "약" 접두와 함께 사용).
function fmtWonH(n: number): string {
  return (Math.round(n / 100) * 100).toLocaleString("ko-KR");
}

// DR2-ⓑ 4-A 소매 단위 파서 — KAMIS retail 의 unit("1kg"/"100g" 류)만 kg 계수로 환산.
//   무게 단위가 아니면(개·포기 등) null → 소매 점·행 미표시(생비교 금지 §0 — 정직 미표시).
function parseUnitToKg(unit: string): number | null {
  const m = /^\s*([\d.,]+)\s*(kg|㎏|g)\s*$/i.exec(unit);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2].toLowerCase() === "g" ? n / 1000 : n;
}

// DR2-ⓑ 4점 앵커 — 값 크기 순 배치용 점 모델. glyph 는 고정(도매● ▲내가격 ◇인터넷 ○소매).
type AnchorPoint = { key: string; glyph: string; label: string; value: number };
// "2026-07-03" → "7/3"
function fmtRefDate(iso: string): string {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return m > 0 && d > 0 ? `${m}/${d}` : iso;
}

// ⑤ 고정 문구 — 모든 상태에서 항상. 권유·단정 표현 금지(§0).
const NOTICE = "참고용 정보입니다. 가격은 시장 변동률과 품종·등급에 따라 다를 수 있습니다.";

function NoticeLine() {
  return (
    <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">{NOTICE}</p>
  );
}

// DR2-ⓑ ②C — 수동 재조회(정적 버튼 · 스핀 없음, 로딩 표시는 기존 "시세 조회 중…"이 담당).
function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-bg px-3 text-xs font-semibold tracking-ko text-text-muted hover:border-text-muted"
    >
      <RotateCw className="size-3.5" strokeWidth={2} />
      다시 조회
    </button>
  );
}

// 시세 어드바이저 — 농가 가격 결정 참고용(§0: 추천/단정 아님, 농가 결정).
export function PriceBandAdvisor({
  priceBand,
  loading,
  composition,
  compositionLabel,
  myPriceKrw,
  onRefresh,
  onAdjustPrice,
}: {
  priceBand: PriceBandResult | null;
  loading: boolean;
  composition?: PriceComposition | null;
  /** DR2-ⓑ ① 선언문 기반 라벨 — 있으면 근거줄·판매단위 강조에서 괄호 축약 대신 사용. */
  compositionLabel?: string | null;
  /** DR2-ⓑ ② 내 가격(구성 단위 판매가) — 4점 앵커·격차 문구용. 없으면 앵커 미표시. */
  myPriceKrw?: number | null;
  /** DR2-ⓑ ②C — [↻ 다시 조회](정적 버튼). */
  onRefresh?: () => void;
  /** DR2-ⓑ ②B — "시세 참고해 판매가 조정하기" → 판매가 입력 포커스 스크롤. */
  onAdjustPrice?: () => void;
}) {
  if (loading) {
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-sm font-medium tracking-ko text-text-muted">시세 조회 중…</p>
        <NoticeLine />
      </div>
    );
  }
  if (!priceBand) return null;
  // unconfigured/error → 작은 안내만(등록 막지 않음). C: 재조회 탈출구 제공.
  if (priceBand.status === "unconfigured" || priceBand.status === "error") {
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-[12px] font-medium tracking-ko text-text-subtle">
          시세 정보를 불러올 수 없어요.
        </p>
        {onRefresh ? <RefreshButton onRefresh={onRefresh} /> : null}
        <NoticeLine />
      </div>
    );
  }

  const w = priceBand.wholesale ?? null;
  const o =
    priceBand.online && priceBand.online.status === "ok" && priceBand.online.min != null
      ? priceBand.online
      : null;
  const excludedCount = priceBand.online?.excluded_count ?? 0;
  const filteredCount = priceBand.online?.filtered_count ?? 0;
  // P5d 인터넷 신뢰 판정 — confidence "low" 아님 + 표본 ≥10. 구응답(confidence 없음)은 표본만.
  const onlineTrusted = o != null && o.confidence !== "low" && o.converted_count >= 10;
  // DR2-fix1 F4 — 인터넷가 = 네이버 유사상품 실판매가 분포의 최저·평균·최고 3값(사분위→교체).
  const oBand = o ? { min: o.min as number, max: o.max as number } : null;
  const oAvg = o ? o.avg : null;
  // 헤드라인·내 판매단위의 kg 기준 밴드 — P5d 역전: 도매 우선, 인터넷은 신뢰될 때만 후보.
  const kgBand = w ? { min: w.min, max: w.max } : onlineTrusted && oBand ? oBand : null;
  // DR2-ⓑ 4-A 소매 — legacy sources 의 retail 행을 kg당 환산(무게 단위 파싱 가능분만·아니면 미표시).
  const retailSrc = priceBand.sources.find((s) => s.price_type === "retail") ?? null;
  const retailUnitKg = retailSrc ? parseUnitToKg(retailSrc.unit) : null;
  const retailKg =
    retailSrc && retailUnitKg != null && retailSrc.low > 0
      ? { min: retailSrc.low / retailUnitKg, max: retailSrc.high / retailUnitKg }
      : null;
  // 제외 줄 — 다른 상품(순도 필터) + 구성 불명, 둘 다 정직 표기(§0).
  const exclusionParts = [
    filteredCount > 0 ? `다른 상품(가공품 등) ${filteredCount}건` : null,
    excludedCount > 0 ? `구성 불명 ${excludedCount}건` : null,
  ].filter(Boolean);
  const exclusionLine =
    exclusionParts.length > 0 ? `${exclusionParts.join(" · ")}은 비교에서 제외` : null;

  // insufficient/no_data/구버전 응답 — 표 대신 정직 표기 + ⑤ 유지.
  if (!kgBand) {
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-[13px] font-medium leading-relaxed tracking-ko text-text-muted">
          비교 데이터 부족 — 이 품목은 아직 견줄 시세가 충분하지 않아요.
        </p>
        {exclusionLine ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">{exclusionLine}</p>
        ) : null}
        {onRefresh ? <RefreshButton onRefresh={onRefresh} /> : null}
        <NoticeLine />
      </div>
    );
  }

  // 개당 환산 기준 — 폼 구성 입력 우선, 없으면 서버 에코(per_unit_weight_g).
  const perUnitG = composition
    ? (composition.totalKg * 1000) / composition.unitCount
    : (priceBand.per_unit_weight_g ?? null);
  const hasPerUnit = perUnitG != null && perUnitG > 0;
  const toUnit = (kgWon: number) => kgWon * ((perUnitG as number) / 1000);

  // DR2-ⓑ ② 4점 앵커 — 내 구성 단위(한 판매 단위) 환산값으로만 같은-단위 비교(생비교 금지 §0).
  //   구성·내 가격 둘 다 있어야 성립 → 없으면 정직 미표시. 값 크기 순 정렬 배치.
  const totalKg = composition ? composition.totalKg : null;

  // T3a-ⓑ [1] 이원축 소비 — unit축(개당가) 우선, kg축 병기. 구응답(axes 없음)은 기존 o 폴백.
  const axes = priceBand.online_axes ?? null;
  const unitAxis = axes && axes.unit.n > 0 && axes.unit.avg != null ? axes.unit : null;
  const kgAxisBlk = axes && axes.kg.n > 0 && axes.kg.avg != null ? axes.kg : null;
  // 개당 번역 가능성 — packType "단위"(무게 단위 판매)는 '개' 의미가 없어 개당 축 번역 제외.
  const countMeaningful =
    composition != null && composition.unitCount >= 1 && composition.packType !== "단위";
  // ◇인터넷 앵커 값 — 번역 가능한 축 우선: unit축×내 개수 → kg축×내 kg → 구응답 oAvg×내 kg.
  //   전부 불가 → 점 생략(표 행만 — 생비교 금지).
  const internetAnchorValue =
    unitAxis && countMeaningful
      ? (unitAxis.avg as number) * (composition as PriceComposition).unitCount
      : kgAxisBlk && totalKg != null && totalKg > 0
        ? (kgAxisBlk.avg as number) * totalKg
        : o && oAvg != null && totalKg != null && totalKg > 0
          ? oAvg * totalKg
          : null;
  // T3a-ⓑ [3] — 품종 분포 상위 5(태그별 n) · 소매 품종 라벨("밤(10kg)"→"밤·10kg").
  const onlineKindsTop = Object.entries(priceBand.kinds?.online ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const retailKindLabel = (() => {
    const k = priceBand.kinds?.retail;
    if (!k) return null;
    const m = /^(.+?)\((.+)\)$/.exec(k.trim());
    return m ? `${m[1].trim()}·${m[2].trim()}` : k.trim();
  })();
  // T3a-ⓑ [4] — 1개월 전 대비(사실만 · 예측 어휘 0). dpr 단위는 소매 unit 과 동일 → kg 환산 병행.
  const prevMonth = priceBand.retail_prev?.month ?? null;
  const prevMonthKg = prevMonth != null && retailUnitKg != null ? prevMonth / retailUnitKg : null;
  const prevPct =
    prevMonth != null && prevMonth > 0 && retailSrc != null
      ? Math.round(((retailSrc.high - prevMonth) / prevMonth) * 100)
      : null;

  const anchorPoints: AnchorPoint[] = [];
  if (totalKg != null && totalKg > 0 && myPriceKrw != null && myPriceKrw > 0) {
    if (w) {
      anchorPoints.push({ key: "wholesale", glyph: "●", label: "도매", value: w.avg * totalKg });
    }
    anchorPoints.push({ key: "mine", glyph: "▲", label: "내 가격", value: myPriceKrw });
    // F4/T3a-ⓑ — ◇인터넷 점 = 번역 가능한 축의 평균값(3값 상세는 표 행에 — 바 라벨 과밀 금지).
    if (internetAnchorValue != null) {
      anchorPoints.push({ key: "online", glyph: "◇", label: "인터넷", value: internetAnchorValue });
    }
    if (retailKg) {
      anchorPoints.push({
        key: "retail",
        glyph: "○",
        label: "소매",
        value: ((retailKg.min + retailKg.max) / 2) * totalKg,
      });
    }
  }
  anchorPoints.sort((a, b) => a.value - b.value);
  const showAnchor = anchorPoints.length >= 2; // 내 가격 + 최소 1소스
  const aMin = showAnchor ? anchorPoints[0].value : 0;
  const aSpan = showAnchor ? Math.max(anchorPoints[anchorPoints.length - 1].value - aMin, 1) : 1;
  // 위치 %(8~92 패딩). 근접(14%p 미만) 시 라벨 두 줄 교차 배치(겹침 처리 · 정적).
  const positioned = anchorPoints.map((p) => ({ ...p, pos: 8 + ((p.value - aMin) / aSpan) * 84 }));
  const labelRows: number[] = [];
  {
    let lastPos = -100;
    let lastRow = 1;
    for (const p of positioned) {
      const row = p.pos - lastPos < 14 ? (lastRow === 0 ? 1 : 0) : 0;
      labelRows.push(row);
      lastPos = p.pos;
      lastRow = row;
    }
  }
  // 격차 문구 2축 — 순수 산수(권유 어휘 0). 도매축 = 평균 대비 차액 / 인터넷축 = 밴드 위치 사실.
  const wholesaleTotal = totalKg != null && totalKg > 0 && w ? w.avg * totalKg : null;
  const gapWholesale =
    wholesaleTotal != null && myPriceKrw != null && myPriceKrw > 0
      ? myPriceKrw - wholesaleTotal
      : null;
  // T3a-ⓑ — 인터넷 격차축도 ◇와 동일한 축 선택으로 일반화(unit축×개수 → kg축×kg → 구응답).
  const internetBandTotal =
    unitAxis && countMeaningful && unitAxis.min != null && unitAxis.max != null
      ? {
          min: unitAxis.min * (composition as PriceComposition).unitCount,
          max: unitAxis.max * (composition as PriceComposition).unitCount,
        }
      : kgAxisBlk &&
          kgAxisBlk.min != null &&
          kgAxisBlk.max != null &&
          totalKg != null &&
          totalKg > 0
        ? { min: kgAxisBlk.min * totalKg, max: kgAxisBlk.max * totalKg }
        : o && oBand && totalKg != null && totalKg > 0
          ? { min: oBand.min * totalKg, max: oBand.max * totalKg }
          : null;
  const onlineRelation =
    internetBandTotal && myPriceKrw != null && myPriceKrw > 0
      ? myPriceKrw < internetBandTotal.min
        ? "인터넷 시세보다 낮아요"
        : myPriceKrw > internetBandTotal.max
          ? "인터넷 시세보다 높아요"
          : "인터넷 시세와 나란해요"
      : null;
  // T3a-ⓑ [2] 박스 번역층 — 순수 산수 1줄씩(구성 미상이면 전부 생략 · 권유 어휘 0).
  const translationLines: string[] = [];
  if (composition && totalKg != null && totalKg > 0) {
    if (unitAxis && countMeaningful) {
      translationLines.push(
        `내 구성(${composition.unitCount}개들이)으로 치면 인터넷 평균 약 ${fmtWonH((unitAxis.avg as number) * composition.unitCount)}원 상당`,
      );
    } else if (kgAxisBlk) {
      translationLines.push(
        `내 구성(${totalKg}kg)으로 치면 인터넷 평균 약 ${fmtWonH((kgAxisBlk.avg as number) * totalKg)}원 상당`,
      );
    } else if (o && oAvg != null) {
      translationLines.push(
        `내 구성(${totalKg}kg)으로 치면 인터넷 평균 약 ${fmtWonH(oAvg * totalKg)}원 상당`,
      );
    }
    if (w) {
      translationLines.push(
        `내 구성(${totalKg}kg)으로 치면 도매 평균 약 ${fmtWonH(w.avg * totalKg)}원 상당`,
      );
    }
    if (retailKg) {
      translationLines.push(
        `내 구성(${totalKg}kg)으로 치면 소매 약 ${fmtWonH(((retailKg.min + retailKg.max) / 2) * totalKg)}원 상당`,
      );
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="size-4 text-text-strong" strokeWidth={2} />
        <span className="text-sm font-bold tracking-ko text-text-strong">시세 참고 정보</span>
      </div>

      {/* ① 헤드라인 — 개당(구성 있을 때) / kg당(없을 때). 26px. */}
      <p className="text-[26px] font-bold leading-tight tabular-nums tracking-ko text-text-strong">
        {hasPerUnit
          ? `개당 약 ${fmtWonH(toUnit(kgBand.min))}~${fmtWonH(toUnit(kgBand.max))}원`
          : `kg당 약 ${fmtWonH(kgBand.min)}~${fmtWonH(kgBand.max)}원`}
      </p>

      {/* ② 근거 줄 — 내 구성으로 환산했음을 명시(12px muted). 구성 없으면 생략.
          DR2-ⓑ: compositionLabel 있으면 선언문 라벨 사용(괄호 축약 노출 제거). */}
      {hasPerUnit && composition ? (
        <p className="text-[12px] font-medium tracking-ko text-text-muted">
          개당 약 {Math.round(perUnitG as number).toLocaleString("ko-KR")}g 기준 ·{" "}
          {compositionLabel ?? `내 구성(${composition.unitCount}개 · ${composition.totalKg}kg)`}{" "}
          기준으로 환산한 값
        </p>
      ) : null}

      {/* ③ STUDIO-fix1 G2 — 컴팩트 정식 표(문장형 나열 → 숫자 전용 셀).
          행 = 도매/소매/인터넷(개당)/인터넷(kg당·n 있을 때만) · 열 = 최저|평균|최고|기준(N건·날짜).
          셀 안 문장 금지 — 숫자만(tabular 우측 정렬), 축 라벨은 행 머리("kg당"/"개당") 아래 줄.
          "약"·단위는 표 아래 캡션 1회. 320~375px 한 행 한 줄(가로 스크롤 금지 — 숫자 11px·기준 10px).
          문장류(제외·표본부족·품종·소매 기준·1개월 대비)는 전폭 캡션 블록으로 이동. */}
      <table className="w-full border-collapse tracking-ko" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 52 }} />
          <col />
          <col />
          <col />
          <col style={{ width: 60 }} />
        </colgroup>
        <thead>
          <tr className="text-[10px] font-semibold text-text-subtle">
            <th className="pb-1 text-left font-semibold" scope="col">
              {" "}
            </th>
            <th className="pb-1 text-right font-semibold" scope="col">
              최저
            </th>
            <th className="pb-1 text-right font-semibold" scope="col">
              평균
            </th>
            <th className="pb-1 text-right font-semibold" scope="col">
              최고
            </th>
            <th className="pb-1 text-right font-semibold" scope="col">
              기준
            </th>
          </tr>
        </thead>
        <tbody className="[&_td]:py-2 [&_td]:align-baseline">
          {w ? (
            <tr className="border-t border-border">
              <td className="whitespace-nowrap">
                <span className="text-[12px] font-bold text-text-strong">도매</span>
                <span className="block text-[10px] font-medium text-text-subtle">kg당</span>
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(w.min)}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(w.avg)}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(w.max)}
              </td>
              <td className="text-right text-[10px] font-medium tabular-nums text-text-muted">
                <span className="block">{w.market_count}개 시장</span>
                <span className="block">{fmtRefDate(w.as_of)}</span>
              </td>
            </tr>
          ) : null}
          {/* 소매 — kg당 환산(상·중품 low~high · 평균 열은 중간값, 캡션에 명시). */}
          {retailSrc && retailKg ? (
            <tr className="border-t border-border">
              <td className="whitespace-nowrap">
                <span className="text-[12px] font-bold text-text-strong">소매</span>
                <span className="block text-[10px] font-medium text-text-subtle">kg당</span>
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(retailKg.min)}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH((retailKg.min + retailKg.max) / 2)}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(retailKg.max)}
              </td>
              <td className="text-right text-[10px] font-medium tabular-nums text-text-muted">
                <span className="block">{retailSrc.rank_note}</span>
                <span className="block">{fmtRefDate(retailSrc.ref_date)}</span>
              </td>
            </tr>
          ) : null}
          {/* T3a-ⓑ [1] — 인터넷 이원축: 개당(실값) / kg당(백원 반올림). 구응답은 kg당 행 폴백. */}
          {unitAxis ? (
            <tr className="border-t border-border">
              <td className="whitespace-nowrap">
                <span className="text-[12px] font-bold text-text-strong">인터넷</span>
                <span className="block text-[10px] font-medium text-text-subtle">개당</span>
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {(unitAxis.min as number).toLocaleString("ko-KR")}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {(unitAxis.avg as number).toLocaleString("ko-KR")}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {(unitAxis.max as number).toLocaleString("ko-KR")}
              </td>
              <td className="text-right text-[10px] font-medium tabular-nums text-text-muted">
                <span className="block">{unitAxis.n}건</span>
                {priceBand.online?.as_of ? (
                  <span className="block">{fmtRefDate(priceBand.online.as_of)}</span>
                ) : null}
              </td>
            </tr>
          ) : null}
          {kgAxisBlk ? (
            <tr className="border-t border-border">
              <td className="whitespace-nowrap">
                <span className="text-[12px] font-bold text-text-strong">인터넷</span>
                <span className="block text-[10px] font-medium text-text-subtle">kg당</span>
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(kgAxisBlk.min as number)}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(kgAxisBlk.avg as number)}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(kgAxisBlk.max as number)}
              </td>
              <td className="text-right text-[10px] font-medium tabular-nums text-text-muted">
                <span className="block">{kgAxisBlk.n}건</span>
                {priceBand.online?.as_of ? (
                  <span className="block">{fmtRefDate(priceBand.online.as_of)}</span>
                ) : null}
              </td>
            </tr>
          ) : null}
          {!unitAxis && !kgAxisBlk && o && oBand && oAvg != null ? (
            <tr className="border-t border-border">
              <td className="whitespace-nowrap">
                <span className="text-[12px] font-bold text-text-strong">인터넷</span>
                <span className="block text-[10px] font-medium text-text-subtle">kg당</span>
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(oBand.min)}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(oAvg)}
              </td>
              <td className="whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-text-strong">
                {fmtWonH(oBand.max)}
              </td>
              <td className="text-right text-[10px] font-medium tabular-nums text-text-muted">
                <span className="block">{o.converted_count}건</span>
                <span className="block">{fmtRefDate(o.as_of)}</span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* G2 캡션 블록 — 문장은 전폭 캡션에서만(셀 안 금지). 단위·약 표기 1회. */}
      <div className="space-y-1">
        <p className="text-[10px] font-medium tracking-ko text-text-subtle">
          단위: 원 · kg당 값은 백원 반올림(약) · 소매 평균은 상·중품 중간값 · 참고용
        </p>
        {/* T3a-ⓑ [3] — 품종 구성 공개(분리 앵커 아님 · T3b 예고석). */}
        {onlineKindsTop.length > 0 ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">
            품종 포함: {onlineKindsTop.map(([k, n]) => `${k} ${n}`).join(" · ")}
          </p>
        ) : null}
        {/* T3a-ⓑ [3] — 소매 조사 품종 기준(retail_kind). */}
        {retailKg && retailKindLabel ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">
            소매 기준: {retailKindLabel}
          </p>
        ) : null}
        {/* T3a-ⓑ [4] — 1개월 전 대비(사실만 · 예측 어휘 0). */}
        {retailKg && prevMonthKg != null && prevPct != null ? (
          <p className="text-[11px] font-medium tabular-nums tracking-ko text-text-muted">
            소매 1개월 전 kg당 약 {fmtWonH(prevMonthKg)}원 (
            {prevPct === 0 ? "변동 없음" : prevPct > 0 ? `+${prevPct}%` : `−${Math.abs(prevPct)}%`})
          </p>
        ) : null}
        {/* P5d 강등 — 구응답 폴백 행의 표본 부족 표시(캡션으로 이동). */}
        {!unitAxis && !kgAxisBlk && o && !onlineTrusted ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">
            인터넷: 표본 부족 · 참고만
          </p>
        ) : null}
        {exclusionLine ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">{exclusionLine}</p>
        ) : null}
        {/* DR2-fix1 F4ⓒ — 데이터 없는 소스 침묵 금지(도매·인터넷·소매 동일 원칙). */}
        {!w ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">
            도매가: 표시할 시세가 없어요
          </p>
        ) : null}
        {!(unitAxis || kgAxisBlk || (o && oBand && oAvg != null)) ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">
            인터넷가: 표시할 유사상품이 없어요
          </p>
        ) : null}
        {!retailKg ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">
            소매가: 표시할 시세가 없어요
          </p>
        ) : null}
      </div>

      {/* DR2-ⓑ 4점 앵커 — 정적 위치 바(도매● ▲내가격 ◇인터넷 ○소매 · 값 크기 순). */}
      {showAnchor ? (
        <div className="space-y-1 pt-1">
          <div className="relative h-6">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
            {positioned.map((p) => (
              <span
                key={p.key}
                style={{ left: `${p.pos}%` }}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] ${
                  p.key === "mine" ? "text-accent" : "text-text-muted"
                }`}
              >
                {p.glyph}
              </span>
            ))}
          </div>
          {/* F1 — 가장자리 라벨은 중앙정렬 대신 안쪽 정렬(카드 밖 이탈·이웃 텍스트 포개짐 방지). */}
          <div className="relative h-9 text-[10px] font-medium tabular-nums tracking-ko text-text-muted">
            {positioned.map((p, i) => (
              <span
                key={p.key}
                style={{ left: `${p.pos}%`, top: labelRows[i] === 1 ? 16 : 0 }}
                className={`absolute whitespace-nowrap ${
                  p.pos < 18 ? "" : p.pos > 82 ? "-translate-x-full" : "-translate-x-1/2"
                } ${p.key === "mine" ? "font-semibold text-text-strong" : ""}`}
              >
                {p.label} 약 {fmtWonH(p.value)}원
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* 격차 문구 2축 — 순수 산수(권유 어휘 0). */}
      {gapWholesale != null ? (
        <p className="text-[12px] font-medium tabular-nums tracking-ko text-text-strong">
          {gapWholesale > 0
            ? `도매(평균)보다 +${fmtWonH(gapWholesale)}원이 생산자님 몫`
            : gapWholesale < 0
              ? `도매(평균)보다 약 ${fmtWonH(-gapWholesale)}원 낮은 가격이에요`
              : `도매(평균)와 같은 가격이에요`}
        </p>
      ) : null}
      {onlineRelation ? (
        <p className="text-[12px] font-medium tracking-ko text-text-muted">{onlineRelation}</p>
      ) : null}

      {/* T3a-ⓑ [2] 박스 번역층 — "내 구성으로 치면 …원 상당"(순수 산수 · 구성 미상 생략). */}
      {translationLines.length > 0 ? (
        <div className="space-y-1">
          {translationLines.map((line) => (
            <p
              key={line}
              className="text-[11px] font-medium tabular-nums tracking-ko text-text-muted"
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {/* ④ 내 판매단위 강조 — 구성 입력이 있을 때만. 우측 정렬 금액.
          DR2-ⓑ: compositionLabel 있으면 선언문 라벨(괄호 축약·모드 불일치 라벨 제거). */}
      {composition ? (
        <div className="flex items-baseline justify-between gap-2 rounded-lg bg-surface px-3 py-2.5">
          <span className="shrink-0 text-xs font-semibold tracking-ko text-text-strong">
            {compositionLabel ?? `${composition.unitCount}개들이 ${composition.packType}`}
          </span>
          <span className="text-right text-sm font-bold tabular-nums tracking-ko text-text-strong">
            = 약 {fmtWonH(kgBand.min * composition.totalKg)}~
            {fmtWonH(kgBand.max * composition.totalKg)}원
          </span>
        </div>
      ) : null}

      {/* DR2-ⓑ ②B/C — 판매가 조정 이동 · 수동 재조회(둘 다 정적 버튼).
          DR2-fix1 F1 — 버튼 독립 행 분리(한 행 flex 병치가 375px 협착·포개짐 유발 → 세로 스택). */}
      {onAdjustPrice || onRefresh ? (
        <div className="space-y-2">
          {onAdjustPrice ? (
            <button
              type="button"
              onClick={onAdjustPrice}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-3 text-xs font-semibold tracking-ko text-text-strong hover:border-text-muted"
            >
              시세 참고해 판매가 조정하기
            </button>
          ) : null}
          {onRefresh ? <RefreshButton onRefresh={onRefresh} /> : null}
        </div>
      ) : null}

      {/* ⑤ 고정 문구 — 모든 상태 공통(§0: 권유·단정 금지). */}
      <NoticeLine />
    </div>
  );
}
