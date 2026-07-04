import { TrendingUp } from "lucide-react";

// 공용 시세 어드바이저 — P5b(단위 헌법 1~3조) 표기 전면 교체.
//   구조: ①개당(또는 kg당) 헤드라인 → ②환산 근거 줄 → ③3열 고정 표(도매/인터넷/제외)
//        → ④내 판매단위 강조 → ⑤고정 참고 문구(모든 상태 공통).
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

// 시세 어드바이저 — 농가 가격 결정 참고용(§0: 추천/단정 아님, 농가 결정).
export function PriceBandAdvisor({
  priceBand,
  loading,
  composition,
}: {
  priceBand: PriceBandResult | null;
  loading: boolean;
  composition?: PriceComposition | null;
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
  // unconfigured/error → 작은 안내만(등록 막지 않음).
  if (priceBand.status === "unconfigured" || priceBand.status === "error") {
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-[12px] font-medium tracking-ko text-text-subtle">
          시세 정보를 불러올 수 없어요.
        </p>
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
  // 헤드라인·내 판매단위의 kg 기준 밴드 — 인터넷(환산) 우선, 없으면 도매.
  const kgBand = o
    ? { min: o.min as number, max: o.max as number }
    : w
      ? { min: w.min, max: w.max }
      : null;

  // insufficient/no_data/구버전 응답 — 표 대신 정직 표기 + ⑤ 유지.
  if (!kgBand) {
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-[13px] font-medium leading-relaxed tracking-ko text-text-muted">
          비교 데이터 부족 — 이 품목은 아직 견줄 시세가 충분하지 않아요.
        </p>
        {excludedCount > 0 ? (
          <p className="text-[11px] font-medium tracking-ko text-text-subtle">
            구성(수량·중량) 불명 리스팅 {excludedCount}건은 비교에서 제외
          </p>
        ) : null}
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

      {/* ② 근거 줄 — 내 구성으로 환산했음을 명시(12px muted). 구성 없으면 생략. */}
      {hasPerUnit && composition ? (
        <p className="text-[12px] font-medium tracking-ko text-text-muted">
          개당 약 {Math.round(perUnitG as number).toLocaleString("ko-KR")}g 기준 · 내 구성(
          {composition.unitCount}개 · {composition.totalKg}kg)으로 환산한 값
        </p>
      ) : null}

      {/* ③ 3열 고정 표 — 64px/auto/118px, 고정 레이아웃, 전 셀 nowrap, 숫자 tabular. */}
      <table
        className="w-full border-collapse text-[12px] tracking-ko"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: 64 }} />
          <col />
          <col style={{ width: 118 }} />
        </colgroup>
        <tbody className="[&_td]:whitespace-nowrap [&_td]:py-2 [&_td]:align-baseline">
          {w ? (
            <tr className="border-t border-border">
              <td className="font-bold text-text-strong">도매</td>
              <td className="font-medium tabular-nums text-text-strong">
                kg당 약 {fmtWonH(w.min)}~{fmtWonH(w.max)}원 · 평균 약 {fmtWonH(w.avg)}원
              </td>
              <td className="text-right text-[11px] font-medium tabular-nums text-text-muted">
                {w.market_count}개 시장 · {fmtRefDate(w.as_of)}
              </td>
            </tr>
          ) : null}
          {o ? (
            <tr className="border-t border-border">
              <td className="font-bold text-text-strong">인터넷</td>
              <td className="font-medium tabular-nums text-text-strong">
                {hasPerUnit
                  ? `개당 약 ${fmtWonH(toUnit(o.min as number))}~${fmtWonH(toUnit(o.max as number))}원`
                  : `kg당 약 ${fmtWonH(o.min as number)}~${fmtWonH(o.max as number)}원`}{" "}
                · 환산가
              </td>
              <td className="text-right text-[11px] font-medium tabular-nums text-text-muted">
                {o.converted_count}건 환산 · {fmtRefDate(o.as_of)}
              </td>
            </tr>
          ) : null}
          {excludedCount > 0 ? (
            <tr className="border-t border-border">
              <td className="font-bold text-text-subtle">제외</td>
              <td colSpan={2} className="text-[11px] font-medium text-text-subtle">
                구성(수량·중량) 불명 리스팅 {excludedCount}건은 비교에서 제외
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* ④ 내 판매단위 강조 — 구성 입력이 있을 때만. 우측 정렬 금액. */}
      {composition ? (
        <div className="flex items-baseline justify-between gap-2 rounded-lg bg-surface px-3 py-2.5">
          <span className="shrink-0 text-xs font-semibold tracking-ko text-text-strong">
            {composition.unitCount}개들이 {composition.packType}
          </span>
          <span className="text-right text-sm font-bold tabular-nums tracking-ko text-text-strong">
            = 약 {fmtWonH(kgBand.min * composition.totalKg)}~
            {fmtWonH(kgBand.max * composition.totalKg)}원
          </span>
        </div>
      ) : null}

      {/* ⑤ 고정 문구 — 모든 상태 공통(§0: 권유·단정 금지). */}
      <NoticeLine />
    </div>
  );
}
