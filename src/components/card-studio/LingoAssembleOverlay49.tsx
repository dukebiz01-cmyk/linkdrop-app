import { useEffect, useRef, useState } from "react"
import { LingoAvatar } from "@/components/brand/LingoMascot"

export interface AssembleStep {
  label: string
  note: string
  /** UI-5-T1c — 실좌표 지목 대상. document 의 [data-assemble-anchor="{anchor}"] 를 실측해 스포트라이트·포인터 배치.
   *  미지정/미발견 시 전체 딤 + 말풍선만(엉뚱한 곳 지목 금지). */
  anchor?: string
}

/**
 * 링고AI 조립 연출 오버레이 — UI-5-T1f 무대화(딤 + 컷아웃 스포트라이트).
 *  - active 동안 페이지 스크롤 잠금(body overflow hidden, 종료 시 원복 · 정상/건너뛰기 공통).
 *  - 대상 rect 를 실측 → 그 위치에 구멍(radius 12) + box-shadow 9999px 로 주변만 딤(단일 딤).
 *    구멍 가장자리 ring rgba(29,78,216,0.55). 같은 대상 연속 스텝은 스포트라이트 유지, 말풍선만 교체.
 *  - 마커(손가락)·말풍선·건너뛰기는 딤 위(z-76)에서만 렌더. 마커 배색은 딤 대비 고정(흰 채움+잉크 윤곽).
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

  // 대상 rect(뷰포트 기준) — 스포트라이트 구멍·마커·말풍선 배치의 단일 공급원.
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // UI-5-T1f(4a) — active 동안 스크롤 잠금. 종료(정상/건너뛰기 = active=false)·언마운트 시 원복(try-finally 등가).
  useEffect(() => {
    if (!active) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [active])

  useEffect(() => {
    if (!active || !cur) {
      setRect(null)
      return
    }
    let cancelled = false

    const el = cur.anchor
      ? (document.querySelector(`[data-assemble-anchor="${cur.anchor}"]`) as HTMLElement | null)
      : null

    // 폴백: 앵커 미지정/미발견 → 전체 딤(rect=null) + 말풍선만(오지목 금지).
    if (!el) {
      setRect(null)
      return
    }

    const measure = () => {
      if (cancelled) return
      const r = el.getBoundingClientRect()
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height })
    }

    // 대상이 화면 밖이면: 스크롤 잠금 잠깐 해제 → scrollIntoView → 320ms 뒤 측정 → 재잠금.
    const r0 = el.getBoundingClientRect()
    const offscreen = r0.top < 56 || r0.bottom > window.innerHeight - 56
    if (offscreen) {
      document.body.style.overflow = ""
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      const t = setTimeout(() => {
        measure()
        document.body.style.overflow = "hidden"
      }, 320)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
    }
    measure()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, current, cur?.anchor])

  if (!active || total === 0 || !cur) return null

  const vh = typeof window !== "undefined" ? window.innerHeight : 0
  // 대상이 화면 위쪽이면 말풍선을 아래로(스포트라이트와 미겹침).
  const centerY = rect ? rect.y + rect.h / 2 : vh / 2
  const below = centerY < vh / 2
  // 마커: 손끝(좌상단 -35°)이 대상 중심에 닿도록 오프셋(+10/+14).
  const markerX = rect ? rect.x + rect.w / 2 + 10 : 0
  const markerY = rect ? rect.y + rect.h / 2 + 14 : 0

  return (
    <div className="fixed inset-0 z-[70]">
      <style>{`
        @keyframes lingo-marker-tap{0%{transform:translate(0,0)}50%{transform:translate(-1.7px,-2.5px)}100%{transform:translate(0,0)}}
      `}</style>

      {/* 딤 — 컷아웃 스포트라이트(단일). rect 있으면 구멍+블루 링, 없으면 전체 딤. */}
      {rect ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: rect.x - 6,
            top: rect.y - 6,
            width: rect.w + 12,
            height: rect.h + 12,
            borderRadius: 12,
            boxShadow: "0 0 0 2px rgba(29,78,216,0.55), 0 0 0 9999px rgba(10,14,22,0.55)",
            transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: "rgba(10,14,22,0.55)" }} aria-hidden="true" />
      )}

      {/* 코치 마커 — 딤 위. 받침 원=흰 채움+#16161D 테두리 2px+shadow-xl / 손가락=흰 채움+#16161D 윤곽. */}
      {rect && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: markerX, top: markerY }}
        >
          <span
            key={current}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#16161D] bg-white shadow-xl"
            style={{ animation: "lingo-marker-tap 0.3s ease 0.5s" }}
          >
            <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
              {/* 검지를 좌상단(-35°)으로 뻗은 포인팅 핸드: 흰 채움 + #16161D 2.5 윤곽(딤 위 최대 대비). */}
              <g transform="rotate(-35 20 20)" fill="#FFFFFF" stroke="#16161D" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
                <rect x="16.5" y="4" width="7" height="19" rx="3.5" />
                <path d="M12.5 19 C12.5 16.2 14.5 15 16.5 15 L24 15 C27 15 29.5 17.2 29.5 21 L29.5 29 C29.5 33 26.8 35 23 35 L18 35 C14.5 35 12.5 32.2 12.5 29 Z" />
                <path d="M12.5 21.5 C10 21.5 8.5 23.5 9.4 26 C10.2 28 12.4 28.4 13.4 26.5 L14.2 24 C14.7 22.7 13.8 21.5 12.5 21.5 Z" />
              </g>
            </svg>
          </span>
        </div>
      )}

      {/* 말풍선 — 딤 위 흰 카드(shadow-xl). 스포트라이트 반대편(위/아래), 구멍과 미겹침. */}
      <div
        key={`bubble-${current}`}
        className="absolute left-1/2 w-[min(88vw,340px)] -translate-x-1/2 rounded-2xl bg-white p-3 shadow-xl [box-shadow:0_20px_50px_-12px_rgba(10,14,22,0.6),0_0_0_1px_rgba(255,255,255,0.06)]"
        style={
          rect
            ? below
              ? { top: Math.min(rect.y + rect.h + 20, vh - 150) }
              : { bottom: Math.min(vh - rect.y + 20, vh - 150) }
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

      {/* 건너뛰기 — 딤 위 z-76 우하단 상시(유일 탭 가능). */}
      <button
        onClick={onSkip}
        className="absolute bottom-6 right-4 z-[76] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#16161D] shadow-lg backdrop-blur-sm transition-transform active:scale-95"
      >
        건너뛰기
      </button>
    </div>
  )
}
