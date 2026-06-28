import { BarChart3, Coins, Users } from "lucide-react";

/**
 * PerformanceBanner — 홈 최상단 "이번 달 내 성과" 배너(표시 전용).
 *
 * placeholder 단계: 데이터 배선 추후. 지금은 호출부가 0을 주입(RPC 0).
 * subscriberCount 주면 3번째 타일 "구독자 N"(상인홈). 미주입이면 기존 2타일(유저홈 영향 0).
 * 색은 하드코딩 신규 0 — 유저홈 형제 섹션이 이미 쓰는 className 그대로 재사용
 *   (카드 = border-[#E5E5E5] bg-white, 강조 = text-[#0A0A0A], 보조 = text-[#737373]).
 * 60대 친화: 무채색·큰 숫자·이모지 0·Lucide 아이콘(전환=chart, 적립=coin, 구독자=users).
 */
export function PerformanceBanner({
  conversionCount = 0,
  dropyAmount = 0,
  subscriberCount,
}: {
  conversionCount?: number;
  dropyAmount?: number;
  subscriberCount?: number;
}) {
  const showSubscriber = subscriberCount !== undefined;
  return (
    <section className="rounded-xl border-[0.5px] border-[#E5E5E5] bg-white p-4">
      <p className="text-xs font-semibold tracking-ko text-[#737373]">이번 달 내 성과</p>

      <div className={`mt-3 grid gap-[10px] ${showSubscriber ? "grid-cols-3" : "grid-cols-2"}`}>
        {/* 전환 */}
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-ko text-[#737373]">
            <BarChart3 className="size-4" strokeWidth={2} />
            전환
          </p>
          <p className="mt-1 text-[27px] font-medium leading-none tracking-ko text-[#0A0A0A]">
            {conversionCount}
            <span className="ml-1 text-sm font-medium tracking-ko text-[#737373]">건</span>
          </p>
        </div>

        {/* 적립 */}
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-ko text-[#737373]">
            <Coins className="size-4" strokeWidth={2} />
            적립
          </p>
          <p className="mt-1 text-[27px] font-medium leading-none tracking-ko text-[#0A0A0A]">
            {dropyAmount}
            <span className="ml-1 text-sm font-medium tracking-ko text-[#737373]">dropy</span>
          </p>
        </div>

        {/* 구독자 (상인홈 전용 — subscriberCount 주입 시) */}
        {showSubscriber ? (
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-ko text-[#737373]">
              <Users className="size-4" strokeWidth={2} />
              구독자
            </p>
            <p className="mt-1 text-[27px] font-medium leading-none tracking-ko text-[#0A0A0A]">
              {subscriberCount}
              <span className="ml-1 text-sm font-medium tracking-ko text-[#737373]">명</span>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
