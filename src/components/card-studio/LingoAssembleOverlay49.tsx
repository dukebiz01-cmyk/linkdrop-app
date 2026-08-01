import { useEffect, useRef, useState } from "react"
// UI-5-T7-L6b 후속 — 구판 brand/LingoMascot(물방울판) 폐선에 따른 신정본 교체. 두 소비처(36/32
//   solid) 모두 spin 미사용이라 시그니처 동일 — 조립 연출(딤·체크리스트·요약 카드) 무접촉.
import { LingoAvatar } from "@/components/brand/lingo-mascot"

export interface AssembleStep {
  label: string
  note: string
  /** UI-5-T1c — 실좌표 지목 대상. document 의 [data-assemble-anchor="{anchor}"] 를 실측해 스포트라이트·포인터 배치.
   *  미지정/미발견 시 전체 딤 + 말풍선만(엉뚱한 곳 지목 금지). */
  anchor?: string
  /** UI-5-T4-D1 — 스텝 2종: watch(기본 · 관람) / do(수행 — 스포트라이트 구멍만 탭 가능, 실 버튼 onClick 발화). */
  kind?: "watch" | "do"
}

// UI-5-T1j(2)·T1k — 종료 요약 데이터. id = 이동 대상 블록(칩 탭 → onEditField).
export interface AssembleSummary {
  count: number
  // select = 선택 필요(구간 등) → 확인 문구 "골라 주세요" / 그 외 숫자 = "정해 주세요".
  items: { id: string; label: string; value: string; needsConfirm: boolean; select?: boolean }[]
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
  onEditField,
  feedback,
}: {
  active: boolean
  steps: AssembleStep[]
  step: number
  accent: string
  onSkip: () => void
  summary?: AssembleSummary | null
  onUndo?: () => void
  onConfirm?: () => void
  onEditField?: (blockId: string) => void
  /** UI-5-T4-D1 — do 스텝 수행 직후 마이크로 피드백("잘하셨어요!" 0.8s — 호출부 타이머 소관). */
  feedback?: string | null
}) {
  const total = steps.length
  const current = Math.min(Math.max(0, step), Math.max(0, total - 1))
  const cur: AssembleStep | undefined = steps[current]
  const isDo = active && cur?.kind === "do" // D1 — 수행형 스텝(구멍만 탭 가능).

  // 대상 rect(뷰포트 기준) — 스포트라이트 구멍·마커·말풍선 배치의 단일 공급원.
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  // UI-5-T1k(A) — 요약 카드 "고칠게 있어요" 편집 칩 뷰 토글. 새 요약이 열리면 초기화.
  const [showEdit, setShowEdit] = useState(false)
  useEffect(() => {
    setShowEdit(false)
  }, [summary])
  // UI-5-T4-D1(3) — 오탭 카운터(스텝 전이 시 리셋): 3회 오탭 = 화살표 펄스 증폭 1회(힌트 강조).
  const [missTaps, setMissTaps] = useState(0)
  const [hintBoost, setHintBoost] = useState(false)
  useEffect(() => {
    setMissTaps(0)
    setHintBoost(false)
  }, [current, active])
  const onMissTap = () => {
    setMissTaps((n) => {
      const next = n + 1
      if (next >= 3 && !hintBoost) {
        setHintBoost(true)
        setTimeout(() => setHintBoost(false), 1400) // 증폭 1회 후 원복.
      }
      return next
    })
  }

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
    /* UI-5-T4-D1(2) — 히트 구조: 루트 pointer-events-none(자체 차단 0) + 자식이 명시적으로 히트 소유.
       watch = 투명 전면 블로커 1장(기존 관람형 차단 동일) / do = "딤 4분할 패널" 기법 — 스포트라이트
       구멍 사방(상·하·좌·우)에만 투명 히트 패널을 깔아 오탭을 흡수하고, 구멍 영역은 오버레이 요소
       자체가 없어 탭이 그대로 아래 실 버튼에 도달(실 onClick 발화 — 가짜 시뮬레이션 0).
       시각 딤은 기존 box-shadow 컷아웃(포인터 무관)이 그대로 담당 — 시각·히트 분리. */
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <style>{`
        @keyframes lingo-arrow-nudge{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      `}</style>

      {/* 딤 — 컷아웃 스포트라이트(단일 · 시각 전용). rect 있으면 구멍+블루 링, 없으면 전체 딤. */}
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

      {/* D1(2) — 히트 레이어: watch(또는 요약) = 전면 블로커 / do = 4분할 패널(구멍만 통과). */}
      {(!isDo || summary || !rect) && (active || summary) && (
        <div className="pointer-events-auto absolute inset-0" onClick={isDo && !summary ? onMissTap : undefined} aria-hidden="true" />
      )}
      {isDo && !summary && rect && (
        <>
          {/* 상·하·좌·우 투명 히트 패널 — 구멍(rect±6px)만 비워 실 버튼 탭 통과. 오탭 = 흡수 + 카운트. */}
          <div className="pointer-events-auto absolute" style={{ left: 0, top: 0, right: 0, height: Math.max(0, rect.y - 6) }} onClick={onMissTap} aria-hidden="true" />
          <div className="pointer-events-auto absolute" style={{ left: 0, top: rect.y + rect.h + 6, right: 0, bottom: 0 }} onClick={onMissTap} aria-hidden="true" />
          <div className="pointer-events-auto absolute" style={{ left: 0, top: Math.max(0, rect.y - 6), width: Math.max(0, rect.x - 6), height: rect.h + 12 }} onClick={onMissTap} aria-hidden="true" />
          <div className="pointer-events-auto absolute" style={{ left: rect.x + rect.w + 6, top: Math.max(0, rect.y - 6), right: 0, height: rect.h + 12 }} onClick={onMissTap} aria-hidden="true" />
        </>
      )}

      {/* D1 — 수행 마이크로 피드백("잘하셨어요!" — 0.8s 호출부 타이머). */}
      {feedback && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-5 py-3 text-[15px] font-extrabold tracking-ko text-[#16161D] [box-shadow:0_20px_50px_-12px_rgba(10,14,22,0.6)]">
          ✓ {feedback}
        </div>
      )}

      {/* UI-5-T1i — 코치 마커: 게임형 화살표 단독(받침 원 제거) + drop-shadow(딤 위 최대 대비).
          화살촉 끝이 대상 지목. 지목 강조 = 화살표가 지목 방향(로컬 위=화살촉)으로 ~4px 전진→복귀
          (1.1s ease-in-out infinite · 스포트라이트 링과 리듬 맞춤). */}
      {rect && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: markerX, top: markerY }}
        >
          <svg
            viewBox="0 0 48 48"
            width="44"
            height="44"
            style={{
              filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
              // D1(3) — 3회 오탭 힌트: 펄스 증폭 1회(스케일 확대 + 리듬 가속 · 1.4s 후 원복).
              ...(hintBoost ? { transform: "scale(1.3)" } : {}),
              transition: "transform 0.2s ease-out",
            }}
            aria-hidden="true"
          >
            <g transform={`rotate(${arrowAngle} 24 24)`}>
              <path
                d="M24 6 L36 26 L28 26 L28 40 L20 40 L20 26 L12 26 Z"
                fill="#FFFFFF"
                stroke="#16161D"
                strokeWidth="2.5"
                strokeLinejoin="round"
                style={{ animation: `lingo-arrow-nudge ${hintBoost ? "0.45s" : "1.1s"} ease-in-out infinite` }}
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
        <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 [box-shadow:0_24px_60px_-16px_rgba(10,14,22,0.7)]">
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

          {!showEdit ? (
            /* 기본 요약 리스트 */
            <div className="mt-2 flex flex-col gap-1.5">
              {summary.items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-[12px] font-semibold [word-break:keep-all]"
                  style={{ color: it.needsConfirm ? "#C2410C" : "#16161D" }}
                >
                  <span className="w-3 shrink-0 text-center">{it.needsConfirm ? "○" : "✓"}</span>
                  {it.needsConfirm ? (
                    <span className="min-w-0 flex-1">
                      {it.label}은 대표님이 {it.select ? "골라" : "정해"} 주세요
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1">
                      {it.label}
                      {it.value ? <span className="font-medium text-[#64748B]"> — {it.value}</span> : null}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* UI-5-T1k(A2·A3) — 고칠게 있어요: 탭 칩(44px). 확인 필요(주황) 최상단 고정 + 힌트(장식). */
            <>
              <p className="mt-2 text-[11px] font-semibold text-[#8A8A8A]">고칠 항목을 골라 주세요</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[...summary.items]
                  .sort((a, b) => Number(b.needsConfirm) - Number(a.needsConfirm))
                  .map((it, i) => (
                    <button
                      key={i}
                      onClick={() => onEditField?.(it.id)}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[12px] font-bold transition-transform active:scale-95"
                      style={
                        it.needsConfirm
                          ? { color: "#C2410C", backgroundColor: "#FFF4EC", boxShadow: "inset 0 0 0 1px #FDBA74" }
                          : { color: "#16161D", backgroundColor: "#F1F2F4", boxShadow: "inset 0 0 0 1px #E8E8EC" }
                      }
                    >
                      <span>{it.needsConfirm ? "●" : "✎"}</span>
                      {it.label}
                    </button>
                  ))}
              </div>
              <p className="mt-2 text-[11px] font-medium text-[#94A3B8] [word-break:keep-all]">
                말로 고치셔도 돼요 — 예: “쿠폰 2천원으로 바꿔줘”
              </p>
            </>
          )}

          {/* UI-5-T1k(A1) — 버튼 3개: 전체 되돌리기 / 고칠게 있어요(칩 토글) / 좋아요, 확인. */}
          <div className="mt-3.5 flex gap-2">
            <button
              onClick={onUndo}
              className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-[#E8E8EC] bg-white text-[12px] font-bold text-[#525252] transition-transform active:scale-[0.98]"
            >
              ↩ 되돌리기
            </button>
            <button
              onClick={() => setShowEdit((v) => !v)}
              aria-pressed={showEdit}
              className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border text-[12px] font-bold transition-transform active:scale-[0.98]"
              style={
                showEdit
                  ? { color: "#1D4ED8", borderColor: "#C7D7FB", backgroundColor: "#EEF3FE" }
                  : { color: "#525252", borderColor: "#E8E8EC", backgroundColor: "#FFFFFF" }
              }
            >
              ✎ 고칠게 있어요
            </button>
            <button
              onClick={onConfirm}
              className="flex h-10 flex-1 items-center justify-center rounded-xl text-[12px] font-bold text-white transition-transform active:scale-[0.98]"
              style={{ backgroundColor: "#16161D" }}
            >
              좋아요, 확인
            </button>
          </div>
        </div>
      )}

      {/* 건너뛰기 — 연출 중(!summary)에만. 딤 위 z-76 우하단. */}
      {!summary && (
        <button
          onClick={onSkip}
          className="pointer-events-auto absolute bottom-6 right-4 z-[76] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#16161D] shadow-lg backdrop-blur-sm transition-transform active:scale-95"
        >
          건너뛰기
        </button>
      )}
    </div>
  )
}
