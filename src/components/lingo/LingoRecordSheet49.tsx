// UI-5-T3-L2 — 링고 기록실 시트(구 플로팅 패널 완전 대체 · 직접 구현 — Radix Sheet/Dialog/Drawer 금지 #418).
//   비모달 채택(E4d 재판정): 딤 없음 · 뒤 화면 터치 허용 — E4c "손 우선" 철학(딤 = 화면 잠식)과 정합,
//   시트를 열어둔 채 카드·설정 영역을 보며 대화 가능(동행 UX). 발행 거울 시트는 모달 유지(오발행 방지 — 별개).
//   z-[55] = 발행바(z-50) 위 · 거울 시트(z-[60]) 아래. 닫기 = X·행동 칩·E4c 양보(호출부 소관).
//   셸 전용(상태 무보유): 로그·입력 컴포저는 children/footer 로 호출부(CardStudioPage49) 상태 그대로 수용.
import type { ReactNode, Ref } from "react";
import { X, MessageCircle, Sparkles } from "lucide-react";

export function LingoRecordSheet49({
  open,
  onClose,
  log,
  footer,
  logRef,
  headerAction,
  subHeader,
}: {
  open: boolean;
  onClose: () => void;
  /** 대화 로그 영역(시트 본문 스크롤 1개 — 자동 스크롤은 호출부 logRef effect 소관). */
  log: ReactNode;
  /** 하단 고정 입력 컴포저. */
  footer: ReactNode;
  logRef?: Ref<HTMLDivElement>;
  /** UI-5-T3-L3 — 헤더 우측 액션 슬롯(스피커 토글 등 · 닫기 X 앞). */
  headerAction?: ReactNode;
  /** UI-5-T4-D2 — 헤더 아래 보조 줄(예: 연출 다시 보기 — 시트 내부라 상시 화면 추가물 0 · T-D 상한 준수). */
  subHeader?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] animate-slide-up">
      <div className="mx-auto flex max-h-[72vh] w-full max-w-md flex-col rounded-t-3xl bg-white [box-shadow:0_-16px_48px_-16px_rgba(15,23,42,0.35),0_0_0_1px_#E8E8EC]">
        {/* 드래그 핸들 장식(하단 고정 시트 — 이동 기능 없음 · 구 패널 이동 핸들 폐지) */}
        <div className="flex justify-center pb-1 pt-2.5" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-[#E0E0E0]" />
        </div>
        {/* 헤더 — 구 패널 헤더 이관(아이콘·타이틀·부제·닫기) */}
        <div className="flex items-center gap-2.5 px-4 pb-2">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
            <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
            <Sparkles className="absolute -right-0.5 -top-0.5 h-[11px] w-[11px]" strokeWidth={2.5} fill="currentColor" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-tight text-[#0A0A0A]">링고AI 기록실</p>
            <p className="text-[11px] font-medium text-[#9A9A9A]">입력하거나 말하면 카드를 편집해드려요</p>
          </div>
          {headerAction}
          <button
            aria-label="닫기"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] transition-transform active:scale-90"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        {subHeader && <div className="px-4 pb-2">{subHeader}</div>}
        {/* 대화 로그 — 시트 본문 유일 스크롤 */}
        <div ref={logRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-2">
          {log}
        </div>
        {/* 입력 컴포저 — 하단 고정 */}
        <div className="border-t border-[#F0F0F2] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">{footer}</div>
      </div>
    </div>
  );
}
