"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  Clock,
  Users,
  Check,
  CalendarDays,
  Sparkles,
  Ban,
} from "lucide-react";
import { ReservationCalendarPageDemo } from "@/components/reservation-calendar-page";

// ============================================================
// 메이커 예약 설정 — 날짜 지정 · 잔여 자리 · 시간대 생성
// WHY: 예약관리에 소비자용 캘린더만 있었고, 사장님이 예약 가능일/정원/
//      시간대를 만드는 도구가 없었음. 설정 + 미리보기를 한 화면에서 제공.
// ============================================================

const ACCENT = "#2563EB";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type TimeSlot = {
  id: string;
  start: string; // "14:00"
  capacity: number;
  booked: number;
};

type DayConfig = {
  open: boolean;
  useSlots: boolean;
  capacity: number; // 종일 기준 정원
  booked: number; // 이미 예약된 수
  price: number;
  slots: TimeSlot[];
};

function keyOf(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function makeSlot(start: string, capacity = 4): TimeSlot {
  return { id: `${start}-${Math.random().toString(36).slice(2, 7)}`, start, capacity, booked: 0 };
}

function defaultConfig(): DayConfig {
  return { open: true, useSlots: false, capacity: 5, booked: 0, price: 80000, slots: [] };
}

export function ReservationSetupPage() {
  const [mode, setMode] = useState<"setup" | "preview">("setup");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, DayConfig>>({});
  const [saved, setSaved] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // --- 캘린더 그리드 ---
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [currentMonth]);

  const selectedDate = useMemo(() => {
    if (!selectedKey) return null;
    const [y, m, d] = selectedKey.split("-").map(Number);
    return new Date(y, m, d);
  }, [selectedKey]);

  const selectedConfig = selectedKey ? configs[selectedKey] : null;

  // --- 통계 ---
  const stats = useMemo(() => {
    let openDays = 0;
    let totalSpots = 0;
    Object.values(configs).forEach((c) => {
      if (!c.open) return;
      openDays += 1;
      totalSpots += c.useSlots ? c.slots.reduce((s, sl) => s + sl.capacity, 0) : c.capacity;
    });
    return { openDays, totalSpots };
  }, [configs]);

  // --- 조작 ---
  const setConfig = (key: string, updater: (prev: DayConfig) => DayConfig) => {
    setConfigs((prev) => ({ ...prev, [key]: updater(prev[key] ?? defaultConfig()) }));
    setSaved(false);
  };

  const selectDate = (date: Date) => {
    if (date < today) return;
    const key = keyOf(date);
    setSelectedKey(key);
    if (!configs[key]) setConfigs((prev) => ({ ...prev, [key]: defaultConfig() }));
  };

  // 요일 일괄 오픈 (놓치기 쉬운 편의 기능)
  const bulkOpen = (which: "weekday" | "weekend" | "all") => {
    setConfigs((prev) => {
      const next = { ...prev };
      calendarDays.forEach((date) => {
        if (!date || date < today) return;
        const dow = date.getDay();
        const match =
          which === "all" || (which === "weekend" ? dow === 0 || dow === 6 : dow >= 1 && dow <= 5);
        if (match) next[keyOf(date)] = { ...defaultConfig(), ...next[keyOf(date)], open: true };
      });
      return next;
    });
    setSaved(false);
  };

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  if (mode === "preview") {
    return (
      <div className="min-h-screen bg-white">
        <ModeToggle mode={mode} setMode={setMode} />
        <ReservationCalendarPageDemo />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-32">
      <ModeToggle mode={mode} setMode={setMode} />

      <main className="px-5 pt-4">
        {/* 요약 스트립 */}
        <section className="mb-4 flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white p-4">
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${ACCENT}14`, color: ACCENT }}
          >
            <CalendarDays className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#0A0A0A]">예약 가능일을 만들어보세요</p>
            <p className="mt-0.5 text-[12px] text-[#737373]">
              오픈 <b className="text-[#0A0A0A]">{stats.openDays}일</b> · 총 잔여{" "}
              <b className="text-[#0A0A0A]">{stats.totalSpots}자리</b>
            </p>
          </div>
        </section>

        {/* 요일 일괄 오픈 */}
        <section className="mb-4">
          <p className="mb-2 text-[12px] font-semibold text-[#525252]">빠른 오픈</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "weekday" as const, label: "주중 열기" },
              { key: "weekend" as const, label: "주말 열기" },
              { key: "all" as const, label: "이번 달 전체" },
            ].map((b) => (
              <button
                key={b.key}
                onClick={() => bulkOpen(b.key)}
                className="flex h-9 items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-3.5 text-[12.5px] font-medium text-[#525252] transition-colors hover:border-[#0A0A0A]"
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} strokeWidth={2.25} />
                {b.label}
              </button>
            ))}
          </div>
        </section>

        {/* 캘린더 */}
        <section className="rounded-2xl border border-[#ECECEC] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#525252] hover:bg-[#F5F5F5]"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-[15px] font-bold text-[#0A0A0A]">{monthLabel}</span>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#525252] hover:bg-[#F5F5F5]"
              aria-label="다음 달"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`py-1 text-center text-[11px] font-medium ${
                  i === 0 ? "text-[#EF4444]" : "text-[#A3A3A3]"
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((date, idx) => {
              if (!date) return <div key={`e-${idx}`} className="aspect-square" />;
              const key = keyOf(date);
              const cfg = configs[key];
              const isPast = date < today;
              const isSelected = key === selectedKey;
              const isOpen = cfg?.open;
              const remaining = cfg
                ? cfg.useSlots
                  ? cfg.slots.reduce((s, sl) => s + (sl.capacity - sl.booked), 0)
                  : cfg.capacity - cfg.booked
                : 0;
              const isClosed = cfg && !cfg.open;

              return (
                <div key={key} className="relative flex aspect-square items-center justify-center">
                  <button
                    onClick={() => selectDate(date)}
                    disabled={isPast}
                    className={`flex h-9 w-9 flex-col items-center justify-center rounded-full transition-colors ${
                      isSelected ? "text-white" : isPast ? "cursor-not-allowed text-[#D4D4D4]" : "text-[#0A0A0A] hover:bg-[#F5F5F5]"
                    }`}
                    style={isSelected ? { backgroundColor: ACCENT } : undefined}
                  >
                    <span className="text-[13px] font-medium leading-none">{date.getDate()}</span>
                    {!isSelected && isOpen && (
                      <span className="mt-0.5 text-[9px] font-bold leading-none" style={{ color: remaining > 0 ? ACCENT : "#EF4444" }}>
                        {remaining > 0 ? remaining : "마감"}
                      </span>
                    )}
                    {!isSelected && isClosed && (
                      <Ban className="mt-0.5 h-2.5 w-2.5 text-[#D4D4D4]" strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-[#F5F5F5] pt-3">
            <Legend color={ACCENT} label="오픈 (잔여)" />
            <Legend color="#EF4444" label="마감" />
            <Legend icon label="휴무" />
          </div>
        </section>

        {/* 선택일 설정 패널 */}
        {selectedDate && selectedConfig && (
          <section className="mt-4 rounded-2xl border border-[#ECECEC] bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold text-[#0A0A0A]">
                  {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({WEEKDAYS[selectedDate.getDay()]})
                </p>
                <p className="mt-0.5 text-[12px] text-[#737373]">예약 조건을 설정하세요</p>
              </div>
              {/* 예약 받기 토글 */}
              <button
                onClick={() => setConfig(selectedKey!, (p) => ({ ...p, open: !p.open }))}
                className="relative h-7 w-12 rounded-full transition-colors"
                style={{ backgroundColor: selectedConfig.open ? ACCENT : "#D4D4D4" }}
                aria-label="예약 받기"
              >
                <span
                  className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform"
                  style={{ transform: selectedConfig.open ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>

            {selectedConfig.open ? (
              <div className="mt-4 space-y-4">
                {/* 시간대 나누기 스위치 */}
                <div className="flex items-center justify-between rounded-xl bg-[#F7F7F8] px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={2.25} />
                    <span className="text-[13px] font-medium text-[#0A0A0A]">시간대 나누기</span>
                  </div>
                  <button
                    onClick={() =>
                      setConfig(selectedKey!, (p) => ({
                        ...p,
                        useSlots: !p.useSlots,
                        slots: !p.useSlots && p.slots.length === 0 ? [makeSlot("14:00"), makeSlot("18:00")] : p.slots,
                      }))
                    }
                    className="relative h-6 w-11 rounded-full transition-colors"
                    style={{ backgroundColor: selectedConfig.useSlots ? ACCENT : "#D4D4D4" }}
                    aria-label="시간대 나누기"
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                      style={{ transform: selectedConfig.useSlots ? "translateX(22px)" : "translateX(2px)" }}
                    />
                  </button>
                </div>

                {selectedConfig.useSlots ? (
                  /* 시간대별 정원 */
                  <div className="space-y-2">
                    <p className="text-[12px] font-semibold text-[#525252]">시간대 · 정원</p>
                    {selectedConfig.slots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-2 rounded-xl border border-[#EDEDED] p-2.5">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) =>
                            setConfig(selectedKey!, (p) => ({
                              ...p,
                              slots: p.slots.map((s) => (s.id === slot.id ? { ...s, start: e.target.value } : s)),
                            }))
                          }
                          className="rounded-lg border border-[#E5E5E5] bg-white px-2 py-1.5 text-[13px] font-medium text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                        />
                        <div className="ml-auto flex items-center gap-1.5">
                          <Stepper
                            value={slot.capacity}
                            min={1}
                            onChange={(v) =>
                              setConfig(selectedKey!, (p) => ({
                                ...p,
                                slots: p.slots.map((s) => (s.id === slot.id ? { ...s, capacity: v } : s)),
                              }))
                            }
                          />
                          <button
                            onClick={() =>
                              setConfig(selectedKey!, (p) => ({ ...p, slots: p.slots.filter((s) => s.id !== slot.id) }))
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A3] hover:bg-[#FEF2F2] hover:text-[#EF4444]"
                            aria-label="시간대 삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setConfig(selectedKey!, (p) => ({ ...p, slots: [...p.slots, makeSlot("12:00")] }))}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#D6D6D6] py-2.5 text-[13px] font-medium text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
                    >
                      <Plus className="h-4 w-4" />
                      시간대 추가
                    </button>
                  </div>
                ) : (
                  /* 종일 잔여 자리 */
                  <div className="flex items-center justify-between rounded-xl bg-[#F7F7F8] px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={2.25} />
                      <span className="text-[13px] font-medium text-[#0A0A0A]">잔여 자리</span>
                    </div>
                    <Stepper
                      value={selectedConfig.capacity}
                      min={1}
                      onChange={(v) => setConfig(selectedKey!, (p) => ({ ...p, capacity: v }))}
                    />
                  </div>
                )}

                {/* 1박 요금 */}
                <div className="flex items-center justify-between rounded-xl bg-[#F7F7F8] px-3.5 py-3">
                  <span className="text-[13px] font-medium text-[#0A0A0A]">요금 (1일)</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] text-[#737373]">₩</span>
                    <input
                      type="number"
                      value={selectedConfig.price}
                      min={0}
                      step={1000}
                      onChange={(e) => setConfig(selectedKey!, (p) => ({ ...p, price: Number(e.target.value) || 0 }))}
                      className="w-24 rounded-lg border border-[#E5E5E5] bg-white px-2 py-1.5 text-right text-[13px] font-semibold text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#F7F7F8] px-3.5 py-3 text-[12.5px] text-[#737373]">
                <Ban className="h-4 w-4 text-[#A3A3A3]" strokeWidth={2.25} />
                이 날은 휴무로 설정돼 예약을 받지 않아요
              </div>
            )}
          </section>
        )}
      </main>

      {/* 저장 바 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ECECEC] bg-white/95 px-5 py-3.5 backdrop-blur">
        <button
          onClick={() => setSaved(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition-transform active:scale-[0.99]"
          style={{ backgroundColor: saved ? "#16A34A" : ACCENT }}
        >
          {saved ? (
            <>
              <Check className="h-5 w-5" strokeWidth={2.5} />
              저장됐어요
            </>
          ) : (
            `예약 설정 저장 · ${stats.openDays}일 오픈`
          )}
        </button>
      </div>
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: "setup" | "preview"; setMode: (m: "setup" | "preview") => void }) {
  return (
    <div className="sticky top-0 z-20 bg-white px-5 pb-3 pt-3">
      <div className="flex gap-1.5 rounded-2xl bg-[#F1F5F9] p-1">
        {[
          { id: "setup" as const, label: "예약 설정" },
          { id: "preview" as const, label: "소비자 미리보기" },
        ].map((t) => {
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={`h-9 flex-1 rounded-xl text-[13px] font-bold transition-all ${
                active ? "bg-white text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.08)]" : "text-[#94A3B8]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-white p-0.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#525252] hover:bg-[#F5F5F5] disabled:opacity-30"
        aria-label="줄이기"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <span className="w-7 text-center text-[14px] font-bold tabular-nums text-[#0A0A0A]">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#525252] hover:bg-[#F5F5F5] disabled:opacity-30"
        aria-label="늘리기"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function Legend({ color, label, icon }: { color?: string; label: string; icon?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon ? (
        <Ban className="h-3 w-3 text-[#D4D4D4]" strokeWidth={2.5} />
      ) : (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="text-[11px] text-[#525252]">{label}</span>
    </div>
  );
}
