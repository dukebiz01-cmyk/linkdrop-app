import { useEffect, useRef, useState } from "react"
import { LingoAvatar } from "@/components/brand/LingoMascot"

export interface AssembleStep {
  label: string
  note: string
  /** UI-5-T1c — 실좌표 지목 대상. document 의 [data-assemble-anchor="{anchor}"] 를 실측해 스포트라이트·포인터 배치.
   *  미지정/미발견 시 전체 딤 + 말풍선만(엉뚱한 곳 지목 금지). */
  anchor?: string
}

// UI-5-T1j(2) — 종료 요약 데이터(딤 유지한 채 말풍선 → 요약 카드).
export interface AssembleSummary {
  count: number
  items: { label: string; value: string; needsConfirm: boolean }[]
}

/**
 * 링고AI 조립 연출 오버레이 — UI-5-T1f 무대화(딤 + 컷아웃 스포트라이트).
 *  - active 동안 페이지 스크롤 잠금(body overflow hidden, 종료 시 원복 · 정상/건너뛰기 공통).
 *  - 대상 rect 를 실측 → 그 위치에 구멍(radius 12) + box-shadow 9999px 로 주변만 딤(단일 딤).
 *    구멍 가장자리 ring rgba(29,78,216,0.55). 같은 대상 연속 스텝은 스포트라이트 유지, 말풍선만 교체.
 *  - 마커(게임형 화살표)·말풍선·건너뛰기는 딤 위(z-76)에서만 렌더. 마커 = 흰 채움+#16161D 윤곽+drop-shadow(딤 대비).
 */
export function LingoAssembleOverlay({
  active,
  steps,
  step,
  accent,
  onSkip,
  summary,
  onUndo,
  onConfirm,
}: {
  active: boolean
  steps: AssembleStep[]
  step: number
  accent: string
  onSkip: () => void
  summary?: AssembleSummary | null
  onUndo?: () => void
  onConfirm?: () => void
}) {
  const total = steps.length
  const current = Math.min(Math.max(0, step), Math.max(0, total - 1))
  const cur: AssembleStep | undefined = steps[current]

  // 대상 rect(뷰포트 기준) — 스포트라이트 구멍·마커·말풍선 배치의 단일 공급원.
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // UI-5-T1f(4a)·T1j(2) — 연출/요약 동안 스크롤 잠금(요약 카드도 딤 유지). 원복 = 확인/되돌리기/언마운트.
  useEffect(() => {
    if (!active && !summary) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [active, summary])

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

  if (!summary && (!active || total === 0 || !cur)) return null

  const vh = typeof window !== "undefined" ? window.innerHeight : 0
  // 대상이 화면 위쪽이면 말풍선을 아래로(스포트라이트와 미겹침).
  const centerY = rect ? rect.y + rect.h / 2 : vh / 2
  const below = centerY < vh / 2
  // UI-5-T1i — 게임형 화살표 배치. 화살촉 끝(로컬 24,6 = 회전 기준 24,24 대비 (0,-18))이 대상에 닿게.
  //   3방향 자동 반전: 기본 우하단→좌상단(angle=-135) / 우측 치우침(x>0.6vw) → 좌하단→우상단(135,
  //   화면 밖 잘림 방지) / 하단 근접(y>0.7vh) → 상단→아래(180). 화살촉 끝 = 배치 기준점(대상 안쪽 8px).
  const vw = typeof window !== "undefined" ? window.innerWidth : 0
  let arrowAngle = -135
  let tipX = 0
  let tipY = 0
  if (rect) {
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    if (cy > vh * 0.7) {
      arrowAngle = 180 // 상단 바깥 → 아래로 지목
      tipX = cx
      tipY = rect.y + 8
    } else if (cx > vw * 0.6) {
      arrowAngle = 135 // 좌하단 바깥 → 우상단 지목
      tipX = rect.x + 8
      tipY = rect.y + rect.h - 8
    } else {
      arrowAngle = -135 // 우하단 바깥 → 좌상단 지목
      tipX = rect.x + rect.w - 8
      tipY = rect.y + rect.h - 8
    }
  }
  // 화살촉 끝 오프셋 = 회전된 (0,-18)·(44/48 스케일). 마커 중심(div left/top) = tip − 그 오프셋.
  const AR = (arrowAngle * Math.PI) / 180
  const ARS = 44 / 48
  const arrowTipOffX = 18 * Math.sin(AR) * ARS
  const arrowTipOffY = -18 * Math.cos(AR) * ARS
  const markerX = rect ? tipX - arrowTipOffX : 0
  const markerY = rect ? tipY - arrowTipOffY : 0

  return (
    <div className="fixed inset-0 z-[70]">
      <style>{`
        @keyframes lingo-arrow-nudge{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
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

      {/* UI-5-T1i — 코치 마커: 게임형 화살표 단독(받침 원 제거) + drop-shadow(딤 위 최대 대비).
          화살촉 끝이 대상 지목. 지목 강조 = 화살표가 지목 방향(로컬 위=화살촉)으로 ~4px 전진→복귀
          (1.1s ease-in-out infinite · 스포트라이트 링과 리듬 맞춤). */}
      {rect && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: markerX, top: markerY }}
        >
          <svg
            viewBox="0 0 48 48"
            width="44"
            height="44"
            style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))" }}
            aria-hidden="true"
          >
            <g transform={`rotate(${arrowAngle} 24 24)`}>
              <path
                d="M24 6 L36 26 L28 26 L28 40 L20 40 L20 26 L12 26 Z"
                fill="#FFFFFF"
                stroke="#16161D"
                strokeWidth="2.5"
                strokeLinejoin="round"
                style={{ animation: "lingo-arrow-nudge 1.1s ease-in-out infinite" }}
              />
            </g>
          </svg>
        </div>
      )}

      {/* 말풍선 + 스텝 체크리스트 — 연출 중(!summary)만. 딤 위 흰 카드, 스포트라이트 반대편(위/아래). */}
      {!summary && (
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
              {cur && (
                <p className="mt-1.5 text-[13px] font-bold leading-tight text-[#0F172A] [word-break:keep-all]">
                  {cur.label}
                </p>
              )}
              {cur?.note && (
                <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-[#64748B] [word-break:keep-all] text-pretty">
                  {cur.note}
                </p>
              )}
              {/* UI-5-T1j(1) — 스텝 체크리스트(진행 도트 대체). 구분선 위 8px. 완료 ✓ 잉크 / 진행 ⟳ 블루 / 대기 ○ 회색. */}
              <div className="mt-2 flex flex-col gap-1 border-t border-[#EEF0F3] pt-2">
                {steps.map((s, i) => {
                  const st = i < current ? "done" : i === current ? "doing" : "todo"
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[11px] font-semibold [word-break:keep-all]"
                      style={{ color: st === "done" ? "#16161D" : st === "doing" ? "#1D4ED8" : "#B4B4BC" }}
                    >
                      <span className="w-3 shrink-0 text-center">{st === "done" ? "✓" : st === "doing" ? "⟳" : "○"}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {s.label}
                        {st === "doing" ? " 중…" : ""}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UI-5-T1j(2) — 종료 요약 카드(딤 유지). 항목별 채운 값 / 숫자 계열 확인 줄 + [되돌리기]·[확인]. */}
      {summary && (
        <div className="absolute left-1/2 top-1/2 w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 [box-shadow:0_24px_60px_-16px_rgba(10,14,22,0.7)]">
          <div className="flex items-center gap-2">
            <LingoAvatar size={32} background="solid" />
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              링고AI · 조립 완료
            </span>
          </div>
          <p className="mt-2.5 text-[15px] font-extrabold text-[#0F172A]">{summary.count}가지를 채워 뒀어요</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {summary.items.map((it, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-[12px] font-semibold [word-break:keep-all]"
                style={{ color: it.needsConfirm ? "#C2410C" : "#16161D" }}
              >
                <span className="w-3 shrink-0 text-center">{it.needsConfirm ? "○" : "✓"}</span>
                {it.needsConfirm ? (
                  <span className="min-w-0 flex-1">{it.label}은 대표님이 정해 주세요</span>
                ) : (
                  <span className="min-w-0 flex-1">
                    {it.label}
                    {it.value ? <span className="font-medium text-[#64748B]"> — {it.value}</span> : null}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3.5 flex gap-2">
            <button
              onClick={onUndo}
              className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-[#E8E8EC] bg-white text-[13px] font-bold text-[#525252] transition-transform active:scale-[0.98]"
            >
              ↩ 전체 되돌리기
            </button>
            <button
              onClick={onConfirm}
              className="flex h-10 flex-[1.4] items-center justify-center rounded-xl text-[13px] font-bold text-white transition-transform active:scale-[0.98]"
              style={{ backgroundColor: "#16161D" }}
            >
              확인했어요
            </button>
          </div>
        </div>
      )}

      {/* 건너뛰기 — 연출 중(!summary)에만. 딤 위 z-76 우하단. */}
      {!summary && (
        <button
          onClick={onSkip}
          className="absolute bottom-6 right-4 z-[76] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#16161D] shadow-lg backdrop-blur-sm transition-transform active:scale-95"
        >
          건너뛰기
        </button>
      )}
    </div>
  )
}
