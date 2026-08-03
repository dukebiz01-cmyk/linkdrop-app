// UI-5-T7-W5e — 통합 판매 일정 달력(공유 부품): W5b-F2-A에서 폼(ProductRegisterForm49)에 만든
//   달력을 동작 무변 추출 — 소비처 = 폼(gb 모드) + 지휘 독(gb 경로 period 스텝). 신규 발명 0.
//   (a) 2칩 설계: [1 모집 마감](빨강 단일일) → [2 수확·발송/발송](초록/파랑 범위 2탭) · 요약 시간표
//   (품목 병기) · 순서 경고(차단 없음 · 기확정 문구). 렌더 관례 = reservation-calendar-page 읽기 참조.
//   기록은 전부 콜백 위임(onSetDeadline/onSetShipRange) — 데이터 키·규칙은 호출부 소관.
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export function GbScheduleCalendar({
  isFresh,
  productName,
  deadline,
  shipStart,
  shipEnd,
  onSetDeadline,
  onSetShipRange,
}: {
  isFresh: boolean;
  /** 요약 시간표 품목 병기(미입력 = 시간표만 · category 병기는 폭 기준 생략 확정 — W5b-F2-A 판단). */
  productName: string;
  /** 마감 확정분(초기 표시 소스 — 로컬 에코가 세션 내 최신 선택을 우선). null = 미확정. */
  deadline: string | null;
  shipStart: string | null;
  shipEnd: string | null;
  /** 미지정 = 마감 칩 비활성(죽은 입구 금지). */
  onSetDeadline?: (iso: string) => void;
  onSetShipRange: (start: string, end: string) => void;
}) {
  const [calStep, setCalStep] = useState<"deadline" | "ship">("deadline");
  const [localDeadline, setLocalDeadline] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const deadlineShown = localDeadline ?? deadline;
  const shipLabel = isFresh ? "수확·발송" : "발송";
  const shipColor = isFresh ? "#16A34A" : "#2563EB";
  const isoOf = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const md = (iso: string) => {
    const p = iso.split("-");
    return p[1] && p[2] ? `${Number(p[1])}/${Number(p[2])}` : iso;
  };
  const pickDay = (iso: string) => {
    if (calStep === "deadline") {
      if (!onSetDeadline) return;
      setLocalDeadline(iso);
      onSetDeadline(iso);
      setCalStep("ship");
      return;
    }
    // 범위 2탭: 시작 미확정/완결 범위/역방향 = 새 시작(=끝) · 시작 단일 상태에서 이후 탭 = 끝 확정.
    if (!shipStart || (shipEnd && shipEnd !== shipStart) || iso < shipStart) onSetShipRange(iso, iso);
    else onSetShipRange(shipStart, iso);
  };
  const shipRangeLabel =
    shipStart && shipEnd
      ? shipStart === shipEnd
        ? `${md(shipStart)} ${shipLabel}`
        : `${md(shipStart)}~${md(shipEnd)} ${shipLabel}`
      : null;
  const summary = (() => {
    const parts = [
      ...(deadlineShown ? [`${md(deadlineShown)} 마감`] : []),
      ...(shipRangeLabel ? [shipRangeLabel] : []),
    ];
    if (parts.length === 0) return null;
    const nm = productName.trim();
    return `${nm ? `${nm} — ` : ""}${parts.join(" → ")}`;
  })();
  const orderWarn = !!(deadlineShown && shipStart && shipStart < deadlineShown);

  return (
    <div className="space-y-2 rounded-xl bg-[#F8FAFC] p-3">
      {/* 순서 칩 — 현재 차례 강조 · 완료 칩 탭 = 재선택. */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setCalStep("deadline")}
          className="flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition-colors"
          style={
            calStep === "deadline"
              ? { backgroundColor: "#DC2626", color: "#fff" }
              : { backgroundColor: "#fff", color: deadlineShown ? "#DC2626" : "#8A8A8A", boxShadow: "inset 0 0 0 1px #E5E5E5" }
          }
        >
          {deadlineShown ? <Check className="h-3 w-3" strokeWidth={3} /> : null}1 모집 마감
        </button>
        <button
          type="button"
          onClick={() => setCalStep("ship")}
          className="flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition-colors"
          style={
            calStep === "ship"
              ? { backgroundColor: shipColor, color: "#fff" }
              : { backgroundColor: "#fff", color: shipRangeLabel ? shipColor : "#8A8A8A", boxShadow: "inset 0 0 0 1px #E5E5E5" }
          }
        >
          {shipRangeLabel ? <Check className="h-3 w-3" strokeWidth={3} /> : null}2 {shipLabel}
        </button>
      </div>
      {/* 월 내비 + 그리드(grid-cols-7 · 정방 셀 · rounded-lg). */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="flex size-8 items-center justify-center rounded-lg text-[#8A8A8A] active:bg-[#ECECEC]"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <span className="text-[12px] font-bold text-[#0A0A0A] tabular-nums">
          {calMonth.getFullYear()}년 {calMonth.getMonth() + 1}월
        </span>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="flex size-8 items-center justify-center rounded-lg text-[#8A8A8A] active:bg-[#ECECEC]"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
          <span key={w} className="flex aspect-square items-center justify-center text-[10px] font-semibold text-[#94A3B8]">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {(() => {
          const y = calMonth.getFullYear();
          const m = calMonth.getMonth();
          const lead = new Date(y, m, 1).getDay();
          const dim = new Date(y, m + 1, 0).getDate();
          const now = new Date();
          const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate());
          return [
            ...Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />),
            ...Array.from({ length: dim }, (_, i) => {
              const iso = isoOf(y, m, i + 1);
              const isDeadline = iso === deadlineShown;
              const inRange = !!(shipStart && shipEnd && iso >= shipStart && iso <= shipEnd);
              const isEdge = iso === shipStart || iso === shipEnd;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pickDay(iso)}
                  className={`relative aspect-square rounded-lg text-[12px] font-semibold tabular-nums transition-colors ${iso === todayIso && !isDeadline && !inRange ? "ring-1 ring-inset ring-[#CBD5E1]" : ""}`}
                  style={
                    isDeadline
                      ? { backgroundColor: "#DC2626", color: "#fff", fontWeight: 700 }
                      : isEdge
                        ? { backgroundColor: shipColor, color: "#fff", fontWeight: 700 }
                        : inRange
                          ? { backgroundColor: `${shipColor}22`, color: shipColor }
                          : { color: "#0A0A0A" }
                  }
                >
                  {i + 1}
                </button>
              );
            }),
          ];
        })()}
      </div>
      {/* 요약 시간표(품목 병기 — 선택 즉시 자동 생성). */}
      {summary && (
        <p className="rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-[#0A0A0A] tabular-nums [word-break:keep-all]">
          {summary}
        </p>
      )}
      {/* 순서 경고(차단 없음 — 기확정 문구). */}
      {orderWarn && (
        <p className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-[11.5px] font-semibold text-[#DC2626] [word-break:keep-all]">
          발송 시작이 모집 마감보다 빨라요. 공동구매는 마감 후 일괄 발송이 원칙이에요
        </p>
      )}
    </div>
  );
}
