import { useNavigate } from "@tanstack/react-router";
import { Sparkles, Users, ChevronRight, ArrowRight, TrendingUp, Bell } from "lucide-react";
import { PerformanceBanner } from "@/components/home/PerformanceBanner";
// P6-8(형님 확정 A안) — 홈 AI 표면 1개: 링고AI 셸(가이드 상시 + 성과 진단 접힘·lazy).
//   P6-7 이식분(CreatorCoachCard)은 셸 내부로 수렴 — 이 파일 직접 import 제거.
import { LingoAiHomeCard } from "@/components/home/LingoAiHomeCard";
import { HomeActivitySegment } from "@/components/home/HomeActivitySegment";
import { ShareCardTile } from "@/components/home/ShareCardTile";
import { SectionHeader } from "@/components/home/v4-bits";
import type { DropFeedItem } from "@/components/home-page";
import { reshareDrop } from "@/lib/reshare-drop";

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
  /** 구독자 수 — maker_follows active count(성과 타일용). */
  subscriberCount: number;
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
  serverNow,
  onGoResults,
  onGoReservations,
  onGoProposals,
}: {
  isBusiness: boolean;
  merchant: MerchantHomeData | null;
  user: UserHomeData | null;
  /** 1-C-2(L6) — 홈 loader 1회 공급 서버 기준시각(타일 타이머 offset 보정). */
  serverNow?: string;
  onGoResults: () => void;
  onGoReservations: () => void;
  onGoProposals: () => void;
}) {
  const navigate = useNavigate();
  // 유저 홈(비사업자) — 성과 배너 + 활동 세그먼트(내 공유 | 구독). 상인은 아래 merchant 홈.
  //   추천영상→탐색·받은쿠폰→나 탭 이관(유저홈에서 제거). 빈상태는 세그먼트가 자체 처리.
  if (!isBusiness || !merchant) {
    const followedDrops = user?.followedDrops ?? [];
    const sentDrops = user?.sentDrops ?? [];
    // 추천 카드 — loader(getDiscoverDrops)에서 이미 옴. 새 데이터 배선 0. 최신순 단일(HOT 토글은 Phase3).
    const recommendedDrops = user?.recommendedDrops ?? [];
    return (
      <div className="mx-auto max-w-md space-y-6 bg-white px-4 pt-6 pb-24">
        {/* 헤더 — V4 로고마크 + 워드마크(+ 태그라인). 유저홈은 🔔 없음. */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#0F172A] shadow-[0_4px_12px_rgba(15,23,42,0.18)]">
              <span className="text-[17px] font-bold text-white">L</span>
            </span>
            <div>
              <p className="text-[18px] font-bold leading-tight text-[#0F172A]">LinkDrop</p>
              <p className="text-[11.5px] text-[#64748B]">링크는 목적을 만나 행동이 된다</p>
            </div>
          </div>
        </header>

        {/* 성과 배너 — 이번 달 내 성과(placeholder, 데이터 배선 추후). 순수 ADDITIVE 최상단. */}
        <PerformanceBanner conversionCount={0} dropyAmount={0} />

        {/* 오늘 공유하기 좋은 카드 — 추천 영상(있을 때만) 2열 그리드. 카드=공유(카톡 재공유)·열기.
            빈 박스 방지(L12 원칙) — 없으면 섹션 자체 숨김. */}
        {recommendedDrops.length > 0 ? (
          <section>
            <SectionHeader icon={TrendingUp} title="오늘 공유하기 좋은" badge="NEW" />
            <div className="grid grid-cols-2 gap-3">
              {recommendedDrops.map((drop) => (
                <ShareCardTile
                  key={drop.shareUuid}
                  drop={drop}
                  // Phase 0 — 홈 뱃지 주입(탐색 explore.tsx 와 동일 소스 drop.intent). 3종 락.
                  purpose={drop.intent}
                  // P7c FEED-1 — 내/남 구분 칩(feed-queries 산출).
                  isMine={drop.isMine}
                  // 1-C-2 — 마감 타이머(피드 expiresAt + loader serverNow).
                  expiresAt={drop.expiresAt}
                  serverNow={serverNow}
                  // 1-C-3 — 파생 재고(1-B-2 배치값, L4).
                  remainingStock={drop.remainingStock}
                  // SM-3 — 확산 규모.
                  shareCount={drop.shareCount}
                  onShare={() =>
                    void reshareDrop({
                      shareUuid: drop.shareUuid,
                      title: drop.title,
                      imageUrl: drop.videoThumbnailUrl,
                      purpose: drop.intent,
                    })
                  }
                  onClick={() =>
                    void navigate({ to: "/d/$shareUuid", params: { shareUuid: drop.shareUuid } })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* 활동 세그먼트 — 내 공유 / 구독 토글. 빈상태 자체 처리. */}
        <HomeActivitySegment
          sentDrops={sentDrops}
          followedDrops={followedDrops}
          serverNow={serverNow}
        />
      </div>
    );
  }

  // 상인 홈 — 유저홈과 동일 언어(성과 3타일 + 추천 그리드 + 활동 세그먼트). 피드 데이터는 user 로 옴(loader 비즈 분기).
  //   관리(새예약 목록·명함)는 /partner 로 이관 → 홈은 🔔 배지·매장명 줄로 축약. 제안은 컴팩트 유지(액션은 /partner).
  const recommendedDrops = user?.recommendedDrops ?? [];
  const sentDrops = user?.sentDrops ?? [];
  const followedDrops = user?.followedDrops ?? [];

  return (
    <div className="mx-auto max-w-md space-y-6 bg-white px-4 pt-6 pb-24">
      {/* 헤더 — V4 로고마크 + 워드마크 + 매장명(파란 도트) + 🔔(pending 새예약 빨간 배지, 0이면 숨김, 클릭→/partner/reservations). */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#0F172A] shadow-[0_4px_12px_rgba(15,23,42,0.18)]">
            <span className="text-[17px] font-bold text-white">L</span>
          </span>
          <div>
            <p className="text-[18px] font-bold leading-tight text-[#0F172A]">LinkDrop</p>
            <p className="flex items-center gap-1 text-[11.5px] text-[#64748B]">
              <span className="size-1.5 rounded-full bg-[#2563EB]" />
              {merchant.partnerName || "내 매장"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoReservations}
          aria-label="새 예약"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#EAEEF3] bg-white text-[#0F172A] transition-colors hover:bg-[#F1F5F9] active:scale-95"
        >
          <Bell className="size-[18px]" strokeWidth={2} />
          {merchant.newReservationsCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#EF4444] px-1 text-[10px] font-bold text-white">
              {merchant.newReservationsCount}
            </span>
          ) : null}
        </button>
      </header>

      {/* 성과 스탯 3타일 — 전환·적립·구독자. */}
      <PerformanceBanner conversionCount={0} dropyAmount={0} subscriberCount={merchant.subscriberCount} />

      {/* P6-8 — AI 한 지붕: 링고AI 셸 1개(가이드 상시 + 성과 진단 접힘). AI 박스 2겹 소멸.
          ★TodayAiCard 컴포넌트 0터치 — 셸에 콘텐츠 주입만(크롬 중화는 셸 래퍼 담당). */}
      <LingoAiHomeCard
        guideSlot={<TodayAiCard guide={merchant.guide} onGoResults={onGoResults} />}
      />

      {/* 제안 (있으면, 컴팩트) — 액션(수락/거절)은 /partner. 스타일만 V4 톤. */}
      {merchant.proposals.length > 0 ? (
        <section>
          <SectionHeader icon={Users} title="새 제안" badge={merchant.proposals.length} />
          <ul className="space-y-2">
            {merchant.proposals.map((p) => (
              <li
                key={p.connectionId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8EDF3] bg-white px-4 py-3"
              >
                <p className="min-w-0 truncate text-sm font-bold tracking-ko text-[#0F172A]">
                  {p.name}
                </p>
                <button
                  type="button"
                  onClick={onGoProposals}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg border border-[#E8EDF3] bg-white px-3 text-sm font-semibold tracking-ko text-[#0F172A] transition-colors hover:bg-[#F1F5F9]"
                >
                  보기
                  <ChevronRight className="size-4 text-[#94A3B8]" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 오늘 공유하기 좋은 카드 — 추천 영상(있을 때만) 2열 그리드. 유저홈과 동일. 빈 박스 방지(L12) — 없으면 숨김. */}
      {recommendedDrops.length > 0 ? (
        <section>
          <SectionHeader icon={TrendingUp} title="오늘 공유하기 좋은" badge="NEW" />
          <div className="grid grid-cols-2 gap-3">
            {recommendedDrops.map((drop) => (
              <ShareCardTile
                key={drop.shareUuid}
                drop={drop}
                // Phase 0 — 홈 뱃지 주입(탐색과 동일 소스 drop.intent). 3종 락.
                purpose={drop.intent}
                // P7c FEED-1 — 내/남 구분 칩(feed-queries 산출).
                isMine={drop.isMine}
                // 1-C-2 — 마감 타이머(피드 expiresAt + loader serverNow).
                expiresAt={drop.expiresAt}
                serverNow={serverNow}
                // 1-C-3 — 파생 재고(1-B-2 배치값, L4).
                remainingStock={drop.remainingStock}
                // SM-3 — 확산 규모.
                shareCount={drop.shareCount}
                onShare={() =>
                  void reshareDrop({
                    shareUuid: drop.shareUuid,
                    title: drop.title,
                    imageUrl: drop.videoThumbnailUrl,
                    purpose: drop.intent,
                  })
                }
                onClick={() =>
                  void navigate({ to: "/d/$shareUuid", params: { shareUuid: drop.shareUuid } })
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* 활동 세그먼트 — 내 공유 / 구독 토글. 빈상태 자체 처리. */}
      <HomeActivitySegment
        sentDrops={sentDrops}
        followedDrops={followedDrops}
        serverNow={serverNow}
      />
    </div>
  );
}
