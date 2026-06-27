import { Sparkles, Calendar, Users, ChevronRight, ArrowRight } from "lucide-react";
import { StoreProfileCard } from "@/components/partner/StoreProfileCard";
import { PerformanceBanner } from "@/components/home/PerformanceBanner";
import { HomeActivitySegment } from "@/components/home/HomeActivitySegment";
import type { DropFeedItem } from "@/components/home-page";

// Slice 4a — 역할 홈 골격. 만들기 폼(HomePageV3) 대체: 홈 = 역할 랜딩 + 다이제스트.
//   카드 생성 진입은 스튜디오 탭으로 일원화 — 홈엔 "카드 만들기" CTA 없음(중복 제거).
//   상인 홈만 채우고(링고 매장 진단·새 예약·제안·명함), 유저 홈은 placeholder(4b에서 채움).
//   항목 없으면 블록 숨김(빈 박스 방지) · 한정 개수 · 무한스크롤 없음(끝 있음).

type GuideDiagnosis = {
  axis: string;
  severity: "high" | "medium" | "low" | "info";
  title: string;
  detail?: string;
};
type GuidePrescription = { priority: number; action: string; expected: string | null };
export type HomeGuide = {
  diagnosis: GuideDiagnosis[];
  prescriptions: GuidePrescription[];
} | null;

export type HomeReservation = {
  reservationId: string;
  customerName: string | null;
  dateLabel: string;
};
export type HomeProposal = { connectionId: string; name: string };

export type MerchantHomeData = {
  partnerName: string;
  partnerKind: string | null;
  address: string | null;
  tier: "biz" | "pb";
  guide: HomeGuide;
  newReservations: HomeReservation[];
  /** 배지용 pending 예약 총개수(newReservations 상위 N 와 별개). */
  newReservationsCount: number;
  proposals: HomeProposal[];
};

// Slice 4b — 유저(비사업자) 홈 데이터.
export type HomeCoupon = { claimCode: string; title: string; expiresAt: string | null };
export type UserHomeData = {
  expiringCoupons: HomeCoupon[];
  followedDrops: DropFeedItem[];
  /** 링고 추천 영상 — 공개 탐색 카드(getDiscoverDrops) 상위 N. (탐색 이관 — 유저홈 미사용, 데이터 보존) */
  recommendedDrops: DropFeedItem[];
  /** 내가 sender 로 공유한 카드(getSentDrops) — 활동 세그먼트 "내 공유" 탭. */
  sentDrops: DropFeedItem[];
};

const SEVERITY_RANK: Record<GuideDiagnosis["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};
const SEVERITY_LABEL: Record<GuideDiagnosis["severity"], string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
  info: "안내",
};

// 링고 매장 진단 — 매출관리 자동진단(캐시 = guide_history 최신 1행)에서 가장 급한 1개 + 액션.
//   재계산 없음(추가 RPC 0). 진단 없으면 "매출관리에서 진단 받기" 포인터.
function TodayAiCard({ guide, onGoResults }: { guide: HomeGuide; onGoResults: () => void }) {
  const topDiag =
    guide && guide.diagnosis.length > 0
      ? [...guide.diagnosis].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0]
      : null;
  const topAction =
    guide && guide.prescriptions.length > 0
      ? [...guide.prescriptions].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0].action
      : null;

  return (
    <section className="rounded-2xl bg-[#F5F5F5] p-4">
      <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
        <Sparkles className="size-4" strokeWidth={2} />
        링고AI 매장 진단
      </h2>

      {topDiag ? (
        <div className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white">
          <div className="min-w-0 px-4 py-4">
            <span className="text-[10px] font-semibold tracking-ko text-[#737373]">
              [{SEVERITY_LABEL[topDiag.severity]}]
            </span>
            <p className="mt-1 text-sm font-bold leading-snug tracking-ko text-[#0A0A0A]">
              {topDiag.title}
            </p>
            {topAction ? (
              <p className="mt-1.5 text-xs font-medium leading-relaxed tracking-ko text-[#737373]">
                → {topAction}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onGoResults}
              className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#0A0A0A] px-4 text-sm font-semibold tracking-ko text-white transition-colors hover:bg-[#171717]"
            >
              매출관리에서 보기
              <ArrowRight className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5">
          <p className="text-sm font-medium leading-relaxed tracking-ko text-[#737373]">
            아직 진단이 없어요. 매출관리에서 진단을 받아볼 여지가 있어요.
          </p>
          <button
            type="button"
            onClick={onGoResults}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#0A0A0A] px-4 text-sm font-semibold tracking-ko text-white transition-colors hover:bg-[#171717]"
          >
            매출관리에서 진단 받기
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        </div>
      )}
    </section>
  );
}

export function RoleHome({
  isBusiness,
  merchant,
  user,
  onGoResults,
  onGoReservations,
  onGoProposals,
}: {
  isBusiness: boolean;
  merchant: MerchantHomeData | null;
  user: UserHomeData | null;
  onGoResults: () => void;
  onGoReservations: () => void;
  onGoProposals: () => void;
}) {
  // 유저 홈(비사업자) — 성과 배너 + 활동 세그먼트(내 공유 | 구독). 상인은 아래 merchant 홈.
  //   추천영상→탐색·받은쿠폰→나 탭 이관(유저홈에서 제거). 빈상태는 세그먼트가 자체 처리.
  if (!isBusiness || !merchant) {
    const followedDrops = user?.followedDrops ?? [];
    const sentDrops = user?.sentDrops ?? [];
    return (
      <div className="mx-auto max-w-md space-y-6 px-6 pt-6 pb-4">
        <header>
          <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">LINKDROP</h1>
          <p className="mt-1.5 text-sm font-medium tracking-ko text-[#737373]">링크는 목적을 만나 행동이 된다</p>
        </header>

        {/* 성과 배너 — 이번 달 내 성과(placeholder, 데이터 배선 추후). 순수 ADDITIVE 최상단. */}
        <PerformanceBanner conversionCount={0} dropyAmount={0} />

        {/* 활동 세그먼트 — 내 공유 / 구독 토글. 빈상태 자체 처리. */}
        <HomeActivitySegment sentDrops={sentDrops} followedDrops={followedDrops} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 pt-6 pb-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">
          {merchant.partnerName || "내 매장"}
        </h1>
        <p className="mt-1 text-sm font-medium tracking-ko text-[#737373]">링고AI가 매장 운영을 도와요</p>
      </header>

      {/* 1. 링고 매장 진단 (항상 노출 — 진단 or 포인터) */}
      <TodayAiCard guide={merchant.guide} onGoResults={onGoResults} />

      {/* 2. 새 예약 (있으면) */}
      {merchant.newReservations.length > 0 ? (
        <section>
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
            <Calendar className="size-4" strokeWidth={2} />
            새 예약
            {merchant.newReservationsCount > 0 ? (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#0A0A0A] px-1.5 text-[11px] font-bold text-white">
                {merchant.newReservationsCount}
              </span>
            ) : null}
          </h2>
          <ul className="space-y-2">
            {merchant.newReservations.map((r) => (
              <li
                key={r.reservationId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-ko text-[#0A0A0A]">
                    {r.customerName?.trim() || "예약 손님"}
                  </p>
                  <p className="mt-0.5 text-xs font-medium tracking-ko text-[#737373]">
                    {r.dateLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onGoReservations}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm font-semibold tracking-ko text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
                >
                  확인
                  <ChevronRight className="size-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 3. 제안 (있으면) */}
      {merchant.proposals.length > 0 ? (
        <section>
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
            <Users className="size-4" strokeWidth={2} />새 제안 {merchant.proposals.length}
          </h2>
          <ul className="space-y-2">
            {merchant.proposals.map((p) => (
              <li
                key={p.connectionId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3"
              >
                <p className="min-w-0 truncate text-sm font-bold tracking-ko text-[#0A0A0A]">
                  {p.name}
                </p>
                <button
                  type="button"
                  onClick={onGoProposals}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm font-semibold tracking-ko text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
                >
                  보기
                  <ChevronRight className="size-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 4. 명함(작게) — StoreProfileCard 재사용. 쿠폰/구독 행은 생략(축소). */}
      <StoreProfileCard
        name={merchant.partnerName || "내 매장"}
        tier={merchant.tier}
        businessTypeLabel={null}
        partnerKind={merchant.partnerKind}
        address={merchant.address}
        activeCoupons={[]}
        note="내 매장 명함"
      />
    </div>
  );
}
