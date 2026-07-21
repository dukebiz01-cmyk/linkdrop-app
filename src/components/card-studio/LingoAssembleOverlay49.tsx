import { Pointer } from "lucide-react"
import { LingoAvatar } from "@/components/brand/LingoMascot"

export interface AssembleStep {
  label: string
  note: string
}

/**
 * 링고AI 조립 연출 오버레이 — 카드 본체 위에 레이어드.
 *  - 링고 아바타가 카드 위를 따라다니며 말풍선으로 현재 단계를 설명
 *  - 손가락(Pointer)이 카드를 톡톡 두드리며 "여기 넣는 중" 지시
 *  - 카드 본체는 건드리지 않고(포인터 이벤트 통과) 그 위에 얹힘
 *
 * 부모(히어로 카드 컨테이너)는 relative 여야 하며, 이 오버레이는 absolute inset-0.
 */
export function LingoAssembleOverlay({
  active,
  steps,
  step,
  accent,
  onSkip,
}: {
  active: boolean
  steps: AssembleStep[]
  step: number
  accent: string
  onSkip: () => void
}) {
  if (!active || steps.length === 0) return null

  const total = steps.length
  const current = Math.min(step, total - 1)
  const cur = steps[current]

  // 손가락이 단계마다 카드의 다른 지점을 가리키도록 앵커를 순환
  const ANCHORS = [
    { left: "30%", top: "46%" },
    { left: "62%", top: "58%" },
    { left: "44%", top: "70%" },
    { left: "68%", top: "38%" },
    { left: "36%", top: "62%" },
  ]
  const anchor = ANCHORS[current % ANCHORS.length]

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {/* 카드 포커스 링 — 본체를 가리지 않는 은은한 강조 */}
      <span
        className="absolute inset-0 rounded-[26px] animate-pulse-subtle"
        style={{ boxShadow: `0 0 0 2px ${accent}, 0 0 0 8px ${accent}22` }}
        aria-hidden="true"
      />

      {/* 손가락 지시 + 물결 */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
        style={{ left: anchor.left, top: anchor.top }}
      >
        <span className="relative flex items-center justify-center">
          <span
            className="lingo-ripple absolute h-10 w-10 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
          <span
            className="lingo-ripple absolute h-10 w-10 rounded-full"
            style={{ backgroundColor: accent, animationDelay: "0.5s" }}
            aria-hidden="true"
          />
          <span className="lingo-tap relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-4px_rgba(15,23,42,0.5)]">
            <Pointer className="h-[18px] w-[18px]" strokeWidth={2.25} style={{ color: accent }} />
          </span>
        </span>
      </div>

      {/* 링고 아바타 + 말풍선 — 카드 상단에 떠서 따라다님 */}
      <div className="lingo-hover absolute left-2 right-2 top-2 flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <LingoAvatar size={40} background="solid" />
        </span>
        <div
          key={current}
          className="lingo-bubble-in relative min-w-0 flex-1 rounded-2xl bg-white p-3 shadow-[0_14px_34px_-12px_rgba(15,23,42,0.42),0_0_0_1px_rgba(15,23,42,0.05)]"
        >
          {/* 말풍선 꼬리 */}
          <span className="absolute -left-1.5 top-3 h-3 w-3 rotate-45 bg-white" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              링고AI · 조립 중
            </span>
            <span className="text-[10.5px] font-bold tabular-nums text-[#94A3B8]">
              {current + 1} / {total}
            </span>
          </div>
          <p className="relative mt-1.5 text-[13px] font-bold leading-tight text-[#0F172A] [word-break:keep-all]">
            {cur.label}
          </p>
          {cur.note && (
            <p className="relative mt-1 text-[11.5px] font-medium leading-relaxed text-[#64748B] [word-break:keep-all] text-pretty">
              {cur.note}
            </p>
          )}

          {/* 진행 도트 */}
          <div className="relative mt-2 flex items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === current ? 16 : 6,
                  backgroundColor: i <= current ? accent : "#E2E8F0",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 건너뛰기 — 유일하게 탭 가능한 요소 */}
      <button
        onClick={onSkip}
        className="pointer-events-auto absolute bottom-2 right-2 rounded-full bg-[#0F172A]/80 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-transform active:scale-95"
      >
        건너뛰기
      </button>
    </div>
  )
}
