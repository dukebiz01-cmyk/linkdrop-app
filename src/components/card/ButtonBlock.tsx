import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * ButtonBlock — 거울 카드의 공유 버튼-블록 primitive (presentational).
 *
 * 닫힌 버튼 + 탭하면 그 자리(인라인)에서 expandedContent 를 펼친다. 스튜디오 미리보기
 * (preview)와 손님 /d(live)가 같은 primitive 를 렌더 = 닫힌 버튼이 구조적으로 동일(거울).
 * 펼친 내용물만 두 층(live=실캘린더 / preview=정적 안내)으로 달라진다.
 *
 * ★ 시트/모달 절대 금지: Radix Dialog/Sheet/Drawer 미사용. 순수 인라인 div + useState.
 * ★ SSR 안전: 초기 상태 deterministic(defaultExpanded=false → 서버·클라 동일 닫힘).
 *    펼침은 사용자 탭(클라) 후만 일어나 하이드레이션 mismatch 0.
 *
 * 스타일: CardActionButton 미감과 통일(bg-white/12 + backdrop-blur, navy 위 큰 탭 타깃,
 *    min-h ≈ 56px, 60대 친화). 글씨색은 부모 text-white 상속 의존(자체 색 강제 안 함).
 *    특정 hex 미사용 — 무채색(흰 알파) + 포인트 톤 유지.
 */
export function ButtonBlock({
  label,
  icon,
  expandedContent,
  onClick,
  defaultExpanded = false,
  light = false,
  showCollapseFooter = false,
}: {
  /** 버튼 글씨 (예: "예약 날짜 선택") */
  label: string;
  /** Lucide 라인 아이콘 (예: Calendar) */
  icon?: ReactNode;
  /** 펼쳤을 때 인라인으로 보일 내용 (없으면 펼침 없는 터미널 버튼) */
  expandedContent?: ReactNode;
  /** expandedContent 없을 때 = 탭하면 이 액션 발화 (연락 같은 터미널용) */
  onClick?: () => void;
  /** 기본 false (닫힘) — 서버·클라 동일 시작 상태 */
  defaultExpanded?: boolean;
  /** 라이트 카드(밝은 셸)면 무채색 흰알파 대신 라이트 토큰(기본 false = 기존 다크 불변). */
  light?: boolean;
  /** S15 — true면 펼친 내용 하단에 "접기" 버튼(긴 캘린더용). 기본 false=무행동. */
  showCollapseFooter?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // expandedContent 있으면 펼침형, 없으면 onClick 터미널형.
  const expandable = expandedContent != null;

  function handleClick() {
    if (expandable) {
      setExpanded((v) => !v);
    } else {
      onClick?.();
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={expandable ? expanded : undefined}
        className={`flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl ${light ? "border border-[#E5E5E5] bg-[#FAFAFA]" : "bg-white/12"} px-4 py-2 text-base font-bold backdrop-blur transition-colors ${light ? "hover:bg-[#F5F5F5]" : "hover:bg-white/20"}`}
      >
        {icon}
        <span>{label}</span>
        {expandable ? (
          <ChevronDown
            className={`size-5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        ) : null}
      </button>
      {/* 인라인 펼침 — 시트 아님. 사용자 탭(클라) 후에만 렌더 = SSR/하이드레이션 안전. */}
      {expandable && expanded ? (
        <div>
          {expandedContent}
          {/* S15 — 긴 콘텐츠 하단 접기(시설정보 접기 패턴 동일 톤). stopPropagation 로 상위 클릭 재토글 차단. */}
          {showCollapseFooter ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface text-sm font-bold tracking-ko text-text-muted transition-colors hover:border-text-muted hover:text-text-strong"
            >
              <ChevronUp className="size-4" strokeWidth={2} />
              접기
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
