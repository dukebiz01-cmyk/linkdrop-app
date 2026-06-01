import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PartnerGuideSection } from "@/components/partner/PartnerGuideSection";

export type PartnerResults = {
  partner_id: string;
  range_days: number;
  drop_count: number;
  metrics: {
    clicks: number;
    unique_visitors: number;
    shares: number;
    reshares: number;
    phone_clicks: number;
    naver_handoff: number;
    internal_reservation_clicks: number;
    reservations_confirmed: number;
    coupon_claimed: number;
    coupon_redeemed: number;
    settlements: number;
  };
  conversion_rates: {
    click_to_reservation_click: number | null;
    claim_to_redeem: number | null;
    naver_handoff_return_rate: number | null;
  };
};

type Props = {
  partnerName: string;
  partnerId: string | null;
  range: 7 | 30 | 90;
  results: PartnerResults | null;
  onRangeChange: (range: 7 | 30 | 90) => void;
};

function numFmt(n: number | null | undefined): string {
  if (n == null) return "0";
  return n.toLocaleString("ko-KR");
}

function rateFmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

const RANGE_OPTIONS: Array<{ value: 7 | 30 | 90; label: string }> = [
  { value: 7, label: "7일" },
  { value: 30, label: "30일" },
  { value: 90, label: "90일" },
];

function MetricCard({
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
}: {
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
      <p className="text-xs font-medium tracking-ko text-[#737373]">{primaryLabel}</p>
      <p className="mt-1 truncate text-2xl font-extrabold tracking-ko text-[#0A0A0A]">
        {primaryValue}
      </p>
      {secondaryLabel ? (
        <p className="mt-3 text-[11px] font-medium tracking-ko text-[#A3A3A3]">
          <span>{secondaryLabel}</span>{" "}
          <span className="font-semibold text-[#525252]">{secondaryValue}</span>
        </p>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] py-2.5 last:border-0">
      <span className="text-sm font-medium tracking-ko text-[#525252]">{label}</span>
      <span className="text-sm font-bold tracking-ko text-[#0A0A0A]">{value}</span>
    </div>
  );
}

export function PartnerResultsPage({
  partnerName,
  partnerId,
  range,
  results,
  onRangeChange,
}: Props) {
  if (!partnerId) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] tracking-ko">
        <Header partnerName="" />
        <div className="mx-auto max-w-2xl px-5 pt-6">
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 text-center">
            <p className="text-sm font-medium tracking-ko text-[#737373]">
              매장 정보를 찾을 수 없어요.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const m = results?.metrics ?? null;

  return (
    <main className="min-h-screen bg-[#FAFAFA] tracking-ko">
      <Header partnerName={partnerName} />

      <div className="mx-auto max-w-2xl space-y-4 px-5 pt-4">
        {/* 기간 토글 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tracking-ko text-[#737373]">최근</span>
          <div className="inline-flex rounded-xl border border-[#E5E5E5] bg-white p-0.5">
            {RANGE_OPTIONS.map((r) => {
              const active = range === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => onRangeChange(r.value)}
                  className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold tracking-ko transition-colors ${
                    active
                      ? "bg-[#0A0A0A] text-white"
                      : "text-[#525252] hover:bg-[#FAFAFA]"
                  }`}
                  aria-pressed={active}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ① 핵심 4카드 */}
        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            primaryLabel="조회"
            primaryValue={numFmt(m?.clicks)}
            secondaryLabel="고유 방문자"
            secondaryValue={numFmt(m?.unique_visitors)}
          />
          <MetricCard
            primaryLabel="공유"
            primaryValue={numFmt(m?.shares)}
            secondaryLabel="재공유"
            secondaryValue={numFmt(m?.reshares)}
          />
          <MetricCard
            primaryLabel="예약 확정"
            primaryValue={numFmt(m?.reservations_confirmed)}
            secondaryLabel="쿠폰 사용"
            secondaryValue={numFmt(m?.coupon_redeemed)}
          />
          <MetricCard
            primaryLabel="정산"
            primaryValue={`${numFmt(m?.settlements)}건`}
          />
        </section>

        {/* ② 상세 지표 (#16 네이버 클릭 ≠ 확정 분리) */}
        <section className="rounded-2xl border border-[#E5E5E5] bg-white px-4 py-2">
          <DetailRow label="전화 클릭" value={numFmt(m?.phone_clicks)} />
          <DetailRow label="네이버 예약 클릭" value={numFmt(m?.naver_handoff)} />
          <DetailRow
            label="내부 예약 클릭"
            value={numFmt(m?.internal_reservation_clicks)}
          />
          <DetailRow label="쿠폰 발급" value={numFmt(m?.coupon_claimed)} />
        </section>

        {/* ③ 전환율 (null → "—") */}
        <section className="rounded-2xl border border-[#E5E5E5] bg-white px-4 py-2">
          <DetailRow
            label="조회 → 예약 클릭"
            value={rateFmt(results?.conversion_rates.click_to_reservation_click)}
          />
          <DetailRow
            label="쿠폰 발급 → 사용"
            value={rateFmt(results?.conversion_rates.claim_to_redeem)}
          />
        </section>

        {/* ④ 개선 가이드 */}
        <PartnerGuideSection partnerId={partnerId} range={range} />
      </div>
    </main>
  );
}

function Header({ partnerName }: { partnerName: string }) {
  return (
    <header className="border-b border-[#F1F5F9] bg-white px-5 py-4">
      <Link
        to="/partner"
        className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0A0A0A]"
      >
        <ArrowLeft className="size-3" strokeWidth={2} />
        매장 홈
      </Link>
      <h1 className="mt-1 text-lg font-bold tracking-ko text-[#0A0A0A]">
        {partnerName ? `${partnerName} 성과` : "매장 성과"}
      </h1>
    </header>
  );
}
