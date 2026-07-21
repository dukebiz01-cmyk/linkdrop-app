import { useEffect, useRef, useState } from "react"
import { LingoAvatar } from "@/components/brand/LingoMascot"

export interface AssembleStep {
  label: string
  note: string
  /** UI-5-T1c — 실좌표 지목 대상. document 의 [data-assemble-anchor="{anchor}"] 를 실측해 포인터 배치.
   *  미지정/미발견 시 포인터를 숨기고 말풍선만 진행(엉뚱한 곳 지목 금지). */
  anchor?: string
}

/**
 * 링고AI 조립 연출 오버레이 — UI-5-T1c 실좌표 앵커 방식.
 *  - 뷰포트 고정(fixed) 레이어. 스텝마다 대상 앵커를 querySelector→getBoundingClientRect 로 실측.
 *  - 코치 마커(브랜드 블루 원 + 흰 포인터) 를 대상 중심에 배치, 대상엔 파란 링 임시 강조.
 *  - 대상이 화면 밖이면 먼저 scrollIntoView 후 300ms 뒤 배치. 못 찾으면 포인터 숨김(말풍선만).
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
  const total = steps.length
  const current = Math.min(Math.max(0, step), Math.max(0, total - 1))
  const cur: AssembleStep | undefined = steps[current]

  // 실측 포인터 좌표(뷰포트 기준). below = 대상이 화면 위쪽 → 말풍선을 아래로.
  const [marker, setMarker] = useState<{ x: number; y: number; below: boolean } | null>(null)
  const highlightedRef = useRef<HTMLElement | null>(null)

  function clearHighlight() {
    const el = highlightedRef.current
    if (el) {
      el.style.boxShadow = el.dataset.prevShadow ?? ""
      el.style.transition = el.dataset.prevTransition ?? ""
      delete el.dataset.prevShadow
      delete el.dataset.prevTransition
      highlightedRef.current = null
    }
  }

  useEffect(() => {
    if (!active || !cur) {
      clearHighlight()
      setMarker(null)
      return
    }
    let cancelled = false
    clearHighlight()

    const el = cur.anchor
      ? (document.querySelector(`[data-assemble-anchor="${cur.anchor}"]`) as HTMLElement | null)
      : null

    // 폴백: 앵커 미지정/미발견 → 포인터 숨김(말풍선만 진행, 엉뚱한 곳 지목 금지).
    if (!el) {
      setMarker(null)
      return
    }

    const place = () => {
      if (cancelled) return
      const r = el.getBoundingClientRect()
      // 대상 강조 — 임시 파란 링(#1D4ED8 계열 저채도 + offset 상당의 boxShadow).
      if (highlightedRef.current !== el) {
        el.dataset.prevShadow = el.style.boxShadow
        el.dataset.prevTransition = el.style.transition
        el.style.transition = "box-shadow 0.25s ease"
        // UI-5-T1d — 대상 강조 링: #1D4ED8 계열 저채도(0.25~0.35).
        el.style.boxShadow = "0 0 0 2px #FFFFFF, 0 0 0 4px rgba(29,78,216,0.35), 0 0 0 9px rgba(29,78,216,0.16)"
        highlightedRef.current = el
      }
      setMarker({
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        below: r.top + r.height / 2 < window.innerHeight / 2,
      })
    }

    // 대상이 화면 밖이면 먼저 스크롤(중앙) 후 300ms 뒤 배치 — 지목 전에 화면이 따라감.
    const r0 = el.getBoundingClientRect()
    const offscreen = r0.top < 56 || r0.bottom > window.innerHeight - 56
    if (offscreen) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      const t = setTimeout(place, 300)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
    }
    place()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, current, cur?.anchor])

  // 언마운트/비활성 시 강조 확실히 해제.
  useEffect(() => () => clearHighlight(), [])

  if (!active || total === 0 || !cur) return null

  const vh = typeof window !== "undefined" ? window.innerHeight : 0

  return (
    <div className="pointer-events-none fixed inset-0 z-[76]">
      {/* UI-5-T1d — 짚는 모션: 이동(0.5s) 완료 후 검지 방향(좌상단)으로 3px 전진→복귀(0.3s).
          물결 = 링고 손길(#1D4ED8) 저채도(opacity 0.32→0). */}
      <style>{`
        @keyframes lingo-marker-tap{0%{transform:translate(0,0)}50%{transform:translate(-1.7px,-2.5px)}100%{transform:translate(0,0)}}
        @keyframes lingo-coach-ripple{0%{transform:scale(0.5);opacity:0.32}100%{transform:scale(2.1);opacity:0}}
      `}</style>
      {/* 코치 마커 — 실좌표 배치(손끝이 대상 중심에 닿도록 +10/+14 오프셋). 이동 transition 0.5s. */}
      {marker && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: marker.x + 10, top: marker.y + 14 }}
        >
          <span className="relative flex items-center justify-center">
            {/* 물결(링고 손길 · #1D4ED8, 저채도) */}
            <span
              className="absolute h-11 w-11 rounded-full bg-[#1D4ED8]"
              style={{ animation: "lingo-coach-ripple 1.1s cubic-bezier(0.19,1,0.22,1) infinite" }}
              aria-hidden="true"
            />
            <span
              className="absolute h-11 w-11 rounded-full bg-[#1D4ED8]"
              style={{ animation: "lingo-coach-ripple 1.1s cubic-bezier(0.19,1,0.22,1) 0.55s infinite" }}
              aria-hidden="true"
            />
            {/* 받침 원(흰색+#12233D 테두리 2px) + 커스텀 검지 손가락 SVG(#12233D). key={current}=스텝마다 탭. */}
            <span
              key={current}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#12233D] bg-white shadow-lg"
              style={{ animation: "lingo-marker-tap 0.3s ease 0.5s" }}
            >
              <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
                {/* 검지를 좌상단(-35°)으로 뻗은 포인팅 핸드: 검지 캡슐 + 말아쥔 주먹 + 엄지 (3패스). */}
                <g transform="rotate(-35 20 20)" fill="#12233D">
                  <rect x="16.5" y="4" width="7" height="19" rx="3.5" />
                  <path d="M12.5 19 C12.5 16.2 14.5 15 16.5 15 L24 15 C27 15 29.5 17.2 29.5 21 L29.5 29 C29.5 33 26.8 35 23 35 L18 35 C14.5 35 12.5 32.2 12.5 29 Z" />
                  <path d="M12.5 21.5 C10 21.5 8.5 23.5 9.4 26 C10.2 28 12.4 28.4 13.4 26.5 L14.2 24 C14.7 22.7 13.8 21.5 12.5 21.5 Z" />
                </g>
              </svg>
            </span>
          </span>
        </div>
      )}

      {/* 말풍선 — 포인터와 겹치지 않게 대상 반대편(위/아래 자동). 마커 없으면 상단 고정. */}
      <div
        key={current}
        className="lingo-bubble-in absolute left-1/2 w-[min(88vw,340px)] -translate-x-1/2 rounded-2xl bg-white p-3 shadow-[0_14px_34px_-12px_rgba(15,23,42,0.42),0_0_0_1px_rgba(15,23,42,0.05)]"
        style={
          marker
            ? marker.below
              ? { top: Math.min(marker.y + 44, vh - 150) }
              : { bottom: Math.min(vh - marker.y + 44, vh - 150) }
            : { top: 88 }
        }
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0">
            <LingoAvatar size={36} background="solid" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
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
            <p className="mt-1.5 text-[13px] font-bold leading-tight text-[#0F172A] [word-break:keep-all]">
              {cur.label}
            </p>
            {cur.note && (
              <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-[#64748B] [word-break:keep-all] text-pretty">
                {cur.note}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{ width: i === current ? 16 : 6, backgroundColor: i <= current ? accent : "#E2E8F0" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 건너뛰기 — 유일하게 탭 가능한 요소 */}
      <button
        onClick={onSkip}
        className="pointer-events-auto absolute bottom-6 right-4 rounded-full bg-[#0F172A]/80 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-transform active:scale-95"
      >
        건너뛰기
      </button>
    </div>
  )
}
