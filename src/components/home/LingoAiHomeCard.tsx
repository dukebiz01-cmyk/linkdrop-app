import { useState, type ReactNode } from "react";
import { Sparkles, ChevronDown, Lightbulb } from "lucide-react";
import { CreatorCoachCard } from "@/components/creator-coach-card";

/**
 * LingoAiHomeCard — 홈 AI 한 지붕 셸 (P6-8, 형님 확정 A안).
 *
 * 표면 1개: 헤더 "링고AI" + 상단(오늘 가이드 = TodayAiCard 콘텐츠 주입, 항상 노출)
 *   + 디바이더 + 하단 "성과 진단" 접힘(기본 접힘, 펼침 시점에만 CreatorCoachCard 마운트).
 * ★ 내부 컴포넌트 로직 0터치 — 셸이 감싸기만. 2겹 테두리 방지: 셸 테두리 하나,
 *   주입된 자식의 자체 카드 크롬(rounded/bg/p/h2)은 래퍼 유틸 셀렉터로 시각 중화(자식 파일 무수정).
 * ★ lazy — 접힘 상태에선 코치가 마운트되지 않아 generate-feedback Edge 미발화(홈 로딩 비용 0).
 */
export function LingoAiHomeCard({ guideSlot }: { guideSlot: ReactNode }) {
  const [open, setOpen] = useState(false);
  // S22 — 전구 점등: 세션 내 "펼쳐서 결과 수신됨" 신호(판정 b — 코치는 로컬 상태뿐이라
  //   접힘 상태 프리체크 불가·전체 로드 발화는 P6-8 lazy 붕괴라 금지). 수신 후엔 유지
  //   (해제하면 b 체계에선 전구가 다시 켜질 수 없어 정보 소실 — 준비됨 상태 표시가 자연).
  const [resultReady, setResultReady] = useState(false);
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white">
      {/* 헤더 — 무채색·간결(기존 토큰, 새 장식 0). */}
      <div className="flex items-center gap-1.5 px-4 pt-4">
        <Sparkles className="size-4 text-[#0A0A0A]" strokeWidth={2} />
        <h2 className="text-sm font-bold tracking-ko text-[#0A0A0A]">링고AI</h2>
      </div>

      {/* 상단 — 오늘 가이드(TodayAiCard). 자식 크롬 중화: 배경·패딩·자체 h2 숨김(셸 헤더로 대체). */}
      <div className="px-4 pb-4 pt-3 [&>section]:rounded-none [&>section]:bg-transparent [&>section]:p-0 [&>section>h2]:hidden">
        {guideSlot}
      </div>

      {/* 디바이더 — 얇게 1개(두 섹션 사이). */}
      <div className="h-px bg-[#EDEDED]" />

      {/* 하단 — 성과 진단 접힘(기본 접힘 = 한 줄 헤드라인만). */}
      {/* S22 정렬 — 표준 아코디언 행: [전구][라벨] 좌측 그룹(헤더·가이드와 px-4 라인 일치) + [chevron] 우측. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-h-[44px] items-center justify-between px-4 text-sm font-semibold tracking-ko text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
      >
        <span className="flex items-center gap-1.5">
          {/* S22 전구 — 점등은 색 변화만: 펄스·애니메이션 금지(L7 최종판 정합). */}
          <Lightbulb
            className={`size-4 ${resultReady ? "fill-[#FEF08A] text-[#EAB308]" : "text-[#A3A3A3]"}`}
            strokeWidth={2}
          />
          성과 진단 보기
        </span>
        <ChevronDown
          className={`size-4 text-[#A3A3A3] transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {open ? (
        // 펼침 시점 마운트(lazy) — 코치 자체 크롬(shadow/rounded/p)만 중화, 내부 헤더(기간 토글)는 유지.
        <div className="px-4 pb-4 [&>section]:rounded-none [&>section]:bg-transparent [&>section]:p-0 [&>section]:shadow-none">
          <CreatorCoachCard onLoaded={(ok) => ok && setResultReady(true)} />
        </div>
      ) : null}
    </section>
  );
}
