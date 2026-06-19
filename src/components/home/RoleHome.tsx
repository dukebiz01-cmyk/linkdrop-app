import { Sparkles, Calendar, Users, ChevronRight, ArrowRight, Ticket, Send } from "lucide-react";
import { StoreProfileCard } from "@/components/partner/StoreProfileCard";
import { DropFeedCard } from "@/components/drop-feed-card";
import type { DropFeedItem } from "@/components/home-page";
import { reshareDrop } from "@/lib/reshare-drop";

// Slice 4a — 역할 홈 골격. 만들기 폼(HomePageV3) 대체: 홈 = 역할 랜딩 + 다이제스트.
//   카드 생성 진입은 스튜디오 탭으로 일원화 — 홈엔 "카드 만들기" CTA 없음(중복 제거).
//   상인 홈만 채우고(오늘의 AI·새 예약·제안·명함), 유저 홈은 placeholder(4b에서 채움).
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
  /** 내가(로그인 유저가) sender 로 공유한 카드 — 공유 중심 유저홈 1차. */
  sentDrops: DropFeedItem[];
};

function expiryLabel(iso: string | null): string {
  if (!iso) return "곧 만료";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "곧 만료";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}.${day}까지`;
}

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
const SEVERITY_STRIP: Record<GuideDiagnosis["severity"], string> = {
  high: "bg-[#0A0A0A]",
  medium: "bg-[#737373]",
  low: "bg-[#A3A3A3]",
  info: "bg-[#D4D4D4]",
};

// 오늘의 AI — 매출관리 자동진단(캐시 = guide_history 최신 1행)에서 가장 급한 1개 + 액션.
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
    <section>
      <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
        <Sparkles className="size-4" strokeWidth={2} />
        오늘의 AI
      </h2>

      {topDiag ? (
        <div className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white">
          <div className="flex">
            <span className={`w-1 shrink-0 ${SEVERITY_STRIP[topDiag.severity]}`} aria-hidden />
            <div className="min-w-0 flex-1 px-4 py-4">
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
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5">
          <p className="text-sm font-medium leading-relaxed tracking-ko text-[#737373]">
            아직 진단이 없어요. 매출관리에서 진단을 받아볼 여지가 있어요.
          </p>
          <button
            type="button"
            onClick={onGoResults}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-4 text-sm font-semibold tracking-ko text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
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
  onOpenCoupon,
  onOpenDrop,
}: {
  isBusiness: boolean;
  merchant: MerchantHomeData | null;
  user: UserHomeData | null;
  onGoResults: () => void;
  onGoReservations: () => void;
  onGoProposals: () => void;
  onOpenCoupon: (claimCode: string) => void;
  onOpenDrop: (shareUuid: string) => void;
}) {
  // 유저 홈(비사업자) — 곧 쓸 혜택 + 구독 메이커 새 카드. 상인은 아래 merchant 홈.
  if (!isBusiness || !merchant) {
    const coupons = user?.expiringCoupons ?? [];
    const followedDrops = user?.followedDrops ?? [];
    const sentDrops = user?.sentDrops ?? [];
    const bothEmpty =
      coupons.length === 0 && followedDrops.length === 0 && sentDrops.length === 0;
    return (
      <div className="mx-auto max-w-md space-y-6 px-6 pt-6 pb-4">
        <header>
          <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">홈</h1>
          <p className="mt-1 text-sm font-medium tracking-ko text-[#737373]">
            곧 쓸 혜택과 구독한 메이커의 새 카드를 모았어요.
          </p>
        </header>

        {/* 1. 곧 쓸 혜택 (있으면) */}
        {coupons.length > 0 ? (
          <section>
            <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
              <Ticket className="size-4" strokeWidth={2} />곧 쓸 혜택 {coupons.length}
            </h2>
            <ul className="space-y-2">
              {coupons.map((c) => (
                <li
                  key={c.claimCode}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold tracking-ko text-[#0A0A0A]">
                      {c.title}
                    </p>
                    <p className="mt-0.5 text-xs font-medium tracking-ko text-[#737373]">
                      {expiryLabel(c.expiresAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCoupon(c.claimCode)}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg bg-[#0A0A0A] px-3 text-sm font-semibold tracking-ko text-white transition-colors hover:bg-[#171717]"
                  >
                    사용하기
                    <ChevronRight className="size-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 2. 내가 공유한 카드 (있으면) — 공유 중심 유저홈. 카드에서 바로 재공유(reshareDrop). */}
        {sentDrops.length > 0 ? (
          <section>
            <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
              <Send className="size-4" strokeWidth={2} />내가 공유한 카드
            </h2>
            <div className="space-y-3">
              {sentDrops.map((drop) => (
                <DropFeedCard
                  key={drop.shareUuid}
                  {...drop}
                  onClick={() => onOpenDrop(drop.shareUuid)}
                  onCtaClick={() => onOpenDrop(drop.shareUuid)}
                  onShare={() =>
                    void reshareDrop({
                      shareUuid: drop.shareUuid,
                      title: drop.title,
                      imageUrl: drop.videoThumbnailUrl,
                      purpose: drop.intent,
                    })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* 3. 구독 메이커 새 카드 (있으면) */}
        {followedDrops.length > 0 ? (
          <section>
            <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
              <Sparkles className="size-4" strokeWidth={2} />구독한 메이커 새 카드
            </h2>
            <div className="space-y-3">
              {followedDrops.map((drop) => (
                <DropFeedCard
                  key={drop.shareUuid}
                  {...drop}
                  onClick={() => onOpenDrop(drop.shareUuid)}
                  onCtaClick={() => onOpenDrop(drop.shareUuid)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* 둘 다 비면 가벼운 안내 */}
        {bothEmpty ? (
          <p className="rounded-2xl border border-[#E5E5E5] bg-white p-5 text-sm font-medium leading-relaxed tracking-ko text-[#737373]">
            영상 링크 하나로 카드를 만들어 친구에게 보내보세요.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 pt-6 pb-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">
          {merchant.partnerName || "내 매장"}
        </h1>
        <p className="mt-1 text-sm font-medium tracking-ko text-[#737373]">오늘의 매장 소식</p>
      </header>

      {/* 1. 오늘의 AI (항상 노출 — 진단 or 포인터) */}
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
