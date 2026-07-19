// InlineDatePicker — 인라인 자체 캘린더 (UI-4f · 자체 구현, Radix/외부 라이브러리 0).
//   월 헤더(◀ N년 N월 ▶) · 요일 그리드 · 오늘 이전 비활성 · 상한 = 오늘 +12개월.
//   mode="range": 첫 탭=시작(종료 대기) · 둘째 탭=종료(시작 이전 탭 = 시작 재지정 — 시작≤종료
//     강제) · 완성 후 재탭=새 시작. onChange 는 기간이 완성된 순간에만 호출(호출부 상태는 항상
//     완전한 기간 — 발행·저장 값에 반쪽 기간이 흐르지 않음).
//   mode="single": 탭 = 즉시 onChange(end 없음).
//   값은 ISO("YYYY-MM-DD") 문자열 — 저장·발행 포맷은 호출부 기존 포맷 그대로(이 컴포넌트는 UI만).
//   SSR: 오늘 계산은 마운트 후(new Date() 하이드레이션 불일치 방지 — 스튜디오 dateList 게이트와
//   동일 이유). 마운트 전엔 고정 높이 자리표시만.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
/** 요약줄 표기 — "N월 N일 (요)". */
const fmtKo = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
};

export function InlineDatePicker({
  mode,
  startIso,
  endIso = null,
  onChange,
  accent,
  summaryLabel,
}: {
  mode: "range" | "single";
  /** 선택값(ISO "YYYY-MM-DD") — single 은 startIso 만 사용. */
  startIso: string | null;
  endIso?: string | null;
  /** range 완성 시 (start, end) · single 시 (day, null). ISO 문자열. */
  onChange: (startIso: string, endIso: string | null) => void;
  accent: string;
  /** 하단 요약줄 접두 — 예: "판매기간" → "판매기간: 7월 18일 (토) ~ 7월 24일 (금)". */
  summaryLabel: string;
}) {
  // 오늘(ISO)·커서(연/월) — 마운트 후 확정.
  const [todayIso, setTodayIso] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  // range 진행 상태 — 시작만 찍힌 반쪽 기간(완성 전엔 onChange 미발화).
  const [pendingStart, setPendingStart] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTodayIso(isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate()));
    const anchor = startIso ?? isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const [ay, am] = anchor.split("-").map(Number);
    setCursor({ y: ay, m: am });
    // 마운트 1회 — 이후 커서는 사용자 내비게이션 소유.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!todayIso || !cursor) {
    return <div className="h-[280px] rounded-xl bg-[#F4F4F5]" aria-hidden="true" />;
  }

  const [ty, tm, td] = todayIso.split("-").map(Number);
  // 상한 = 오늘 +12개월(같은 날짜 — 문자열 비교 전용, 실존하지 않는 2/29 도 비교엔 무해).
  const maxIso = isoOf(ty + 1, tm, td);
  const prevDisabled = cursor.y === ty && cursor.m === tm;
  const nextDisabled = cursor.y === ty + 1 && cursor.m === tm;

  const moveMonth = (delta: 1 | -1) => {
    setCursor((c) => {
      if (!c) return c;
      let y = c.y;
      let m = c.m + delta;
      if (m === 0) { m = 12; y -= 1; }
      if (m === 13) { m = 1; y += 1; }
      return { y, m };
    });
  };

  const daysInMonth = new Date(cursor.y, cursor.m, 0).getDate();
  const firstDow = new Date(cursor.y, cursor.m - 1, 1).getDay();

  // 표시용 선택값 — pending 중엔 반쪽 시작만 강조.
  const dispStart = pendingStart ?? startIso;
  const dispEnd = pendingStart ? null : mode === "range" ? endIso : null;
  const hasBand = !!dispStart && !!dispEnd && dispStart !== dispEnd;

  const tap = (dayIso: string) => {
    if (mode === "single") {
      onChange(dayIso, null);
      return;
    }
    if (pendingStart) {
      if (dayIso < pendingStart) setPendingStart(dayIso); // 시작 이전 탭 = 시작 재지정
      else {
        onChange(pendingStart, dayIso);
        setPendingStart(null);
      }
    } else {
      setPendingStart(dayIso); // 첫 탭 = 새 시작(종료 대기)
    }
  };

  // 요약줄.
  const summary =
    mode === "single"
      ? `${summaryLabel}: ${dispStart ? fmtKo(dispStart) : "날짜 선택"}`
      : pendingStart
        ? `${summaryLabel}: ${fmtKo(pendingStart)} ~ 종료일 선택`
        : dispStart && endIso
          ? `${summaryLabel}: ${fmtKo(dispStart)} ~ ${fmtKo(endIso)}`
          : `${summaryLabel}: 날짜 선택`;

  return (
    <div className="rounded-xl bg-[#F4F4F5] p-3">
      {/* 월 헤더 — ◀ N년 N월 ▶ */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={prevDisabled}
          onClick={() => moveMonth(-1)}
          aria-label="이전 달"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#525252] transition-colors active:scale-95 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <span className="text-[13px] font-bold tabular-nums text-[#0A0A0A]">
          {cursor.y}년 {cursor.m}월
        </span>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={() => moveMonth(1)}
          aria-label="다음 달"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#525252] transition-colors active:scale-95 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
      {/* 요일 행 */}
      <div className="mt-2 grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <span key={w} className="flex h-6 items-center justify-center text-[11px] font-semibold text-[#8A8A8A]">
            {w}
          </span>
        ))}
      </div>
      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstDow }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayIso = isoOf(cursor.y, cursor.m, day);
          const disabled = dayIso < todayIso || dayIso > maxIso;
          const isStart = dayIso === dispStart;
          const isEnd = dayIso === dispEnd;
          const endpoint = isStart || isEnd;
          const inBand = hasBand && dayIso >= dispStart! && dayIso <= dispEnd!;
          const isToday = dayIso === todayIso;
          return (
            <div
              key={dayIso}
              className="relative flex h-9 items-center justify-center"
              style={
                inBand
                  ? {
                      backgroundColor: `${accent}1A`,
                      borderTopLeftRadius: isStart ? 9999 : 0,
                      borderBottomLeftRadius: isStart ? 9999 : 0,
                      borderTopRightRadius: isEnd ? 9999 : 0,
                      borderBottomRightRadius: isEnd ? 9999 : 0,
                    }
                  : undefined
              }
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => tap(dayIso)}
                aria-label={fmtKo(dayIso)}
                aria-pressed={endpoint}
                className="relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors active:scale-95 disabled:opacity-30"
                style={
                  endpoint
                    ? { backgroundColor: accent, color: "#FFFFFF" }
                    : {
                        color: inBand ? "#0A0A0A" : "#525252",
                        boxShadow: isToday && !disabled ? `inset 0 0 0 1px ${accent}` : undefined,
                      }
                }
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
      {/* 요약줄 */}
      <p className="mt-2 border-t border-[#E5E5E5] pt-2 text-[12px] font-bold tabular-nums text-[#0A0A0A]">
        {summary}
      </p>
    </div>
  );
}
