import { TrendingUp, Store, Truck, Globe, Tags } from "lucide-react";

// 공용 시세 어드바이저 — partner.products.new 내부 정의에서 무변경 추출(S4-1).
//   순수 presentational: props {priceBand, loading} 만 받음. get-price-band invoke·state 는 호출부(부모) 몫.
//   §0: 생산자 가격 결정 참고용만 — 시세를 저장/손님 카드로 내보내지 않는다.

// get-price-band 응답(STEP4-A). sources 배열 = 다중소스(KAMIS 소매 + 추후 도매/인터넷).
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
export type PriceBandResult = {
  status: "ok" | "no_data" | "unconfigured" | "error";
  item_code: string;
  item_name: string | null;
  sources: PriceSource[];
  cached: boolean;
  note?: string;
};

function fmtWon(n: number): string {
  return n.toLocaleString("ko-KR");
}
// "2026-06-23" → "06/23"
function fmtRefDate(iso: string): string {
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  return m && d ? `${m}/${d}` : iso;
}

// 포장단위 → kg 수 (kg당 환산용). "kg"=1, "10kg(그물망 3포기)"=10, "개"·환산불가=null.
function kgPerUnit(unit: string): number | null {
  if (unit === "kg") return 1;
  const m = unit.match(/([\d.]+)\s*kg/i);
  return m ? Number(m[1]) : null;
}
// rank_note "… 평균 1,930원/kg" → 1930. 평균 표기 없으면(소매 등급) null.
function parseAvg(rankNote: string): number | null {
  const m = rankNote.match(/평균\s*([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}
// price_type → 구분 라벨 + 아이콘. (소매=KAMIS / 도매=경락 / 인터넷=네이버)
const SOURCE_KIND_META: Record<string, { label: string; Icon: typeof Store }> = {
  retail: { label: "소매", Icon: Store },
  wholesale: { label: "도매", Icon: Truck },
  online: { label: "인터넷", Icon: Globe },
};

// KAMIS 소매 시세 어드바이저 — 농가 가격 결정 참고용(§0: 추천/단정 아님, 농가 결정).
//   다중소스 대비 sources.map(4-B 도매·4-C 인터넷 추가되면 자동으로 여러 줄).
export function PriceBandAdvisor({
  priceBand,
  loading,
}: {
  priceBand: PriceBandResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-sm font-medium tracking-ko text-text-muted">시세 조회 중…</p>
      </div>
    );
  }
  if (!priceBand) return null;
  // unconfigured/error → 작은 안내만(등록 막지 않음).
  if (priceBand.status === "unconfigured" || priceBand.status === "error") {
    return (
      <div className="mt-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-[12px] font-medium tracking-ko text-text-subtle">
          시세 정보를 불러올 수 없어요.
        </p>
      </div>
    );
  }
  // no_data(옥수수 등 미조사) → 담담한 회색 안내.
  if (priceBand.status === "no_data" || priceBand.sources.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-[13px] font-medium leading-relaxed tracking-ko text-text-muted">
          이 품목은 KAMIS 시세 정보가 없어요 (시세 미조사 품목).
        </p>
      </div>
    );
  }
  // ok — (1)3개 소스 표(kg 통일) + (2)도매↔직거래 격차 박스 + (3)수급 맥락. §0: 생산자 참고용.
  const rows = priceBand.sources.map((s) => {
    const kgCount = kgPerUnit(s.unit);
    const lowKg = kgCount ? Math.round(s.low / kgCount) : null;
    const highKg = kgCount ? Math.round(s.high / kgCount) : null;
    // avg 는 단위가 정확히 "kg"(도매·인터넷 kg) 일 때만 kg당으로 신뢰(소매·개 단위는 제외).
    const avgKg = s.unit === "kg" ? parseAvg(s.rank_note) : null;
    return { s, lowKg, highKg, avgKg };
  });
  const wholesale = rows.find((r) => r.s.price_type === "wholesale");
  const online = rows.find((r) => r.s.price_type === "online");
  // 격차 = 도매·인터넷 둘 다 kg 평균 있고, 직거래가 더 높을 때만(graceful).
  const showGap =
    wholesale?.avgKg != null && online?.avgKg != null && online.avgKg > wholesale.avgKg;
  const gap = showGap ? (online!.avgKg as number) - (wholesale!.avgKg as number) : 0;

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="size-4 text-text-strong" strokeWidth={2} />
        <span className="text-sm font-bold tracking-ko text-text-strong">시세 참고 정보</span>
      </div>

      {/* (1) 3개 소스 표 — 구분 | 시세 | 출처. kg 통일(소매는 포장단위 ÷ kg수). */}
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
        {rows.map(({ s, lowKg, highKg, avgKg }) => {
          const meta = SOURCE_KIND_META[s.price_type];
          const Icon = meta?.Icon ?? Tags;
          const priceText =
            lowKg != null
              ? `${fmtWon(lowKg)}~${fmtWon(highKg as number)}원/kg`
              : `${fmtWon(s.low)}~${fmtWon(s.high)}원${s.unit ? `/${s.unit}` : ""}`;
          return (
            <li key={`${s.source}-${s.price_type}`} className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold tracking-ko text-text-strong">
                  <Icon className="size-4 text-text-muted" strokeWidth={2} />
                  {meta?.label ?? s.source_label}
                </span>
                <span className="text-right text-base font-bold tabular-nums tracking-ko text-text-strong">
                  {priceText}
                  {avgKg != null ? (
                    <span className="ml-1.5 text-xs font-medium text-text-muted">
                      평균 {fmtWon(avgKg)}
                    </span>
                  ) : null}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed tracking-ko text-text-subtle">
                {s.rank_note} · {fmtRefDate(s.ref_date)} 기준
              </p>
            </li>
          );
        })}
      </ul>

      {/* (2) 도매↔직거래 격차 박스 — 도매·인터넷 둘 다(kg) 있고 직거래가 더 높을 때만. */}
      {showGap ? (
        <div className="rounded-lg border border-action bg-bg p-3">
          <p className="text-sm font-bold tracking-ko text-text-strong">
            직거래하면 생산자님의 몫이 커져요
          </p>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed tracking-ko text-text-muted">
            도매상에 넘기면{" "}
            <span className="font-bold tabular-nums text-text-strong">
              {fmtWon(wholesale!.avgKg as number)}원/kg
            </span>{" "}
            → 직거래하면{" "}
            <span className="font-bold tabular-nums text-text-strong">
              {fmtWon(online!.avgKg as number)}원/kg
            </span>
          </p>
          <p className="mt-1 text-[13px] font-bold tabular-nums tracking-ko text-action">
            차이 {fmtWon(gap)}원/kg = 유통이 가져가던 몫
          </p>
        </div>
      ) : null}

      {/* (3) 수급 맥락 + §0 — 가격 추천/단정 아님, 농가가 직접 결정. */}
      <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
        제철엔 물량 몰려 도매가 낮아져요. 정성껏 키운 만큼, 직거래로 제값 받으세요.
      </p>
      <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
        ※ 내 판매가는 직접 정하세요. 신품종·유기농·한정수량은 더 받을 수 있어요.
      </p>
    </div>
  );
}
