import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Toaster } from "@/components/ui/sonner";
import { getSupabase } from "@/lib/supabase";

type SlotRow = {
  slot_date: string;
  slot_time: string | null;
  max_capacity: number;
  current_bookings: number;
  is_blocked: boolean;
  calendar_mode: string;
};

// v7.1 — 매장별 캘린더. dropId 제거. calendar_mode 는 매장 단일이라
// 'date_range' 고정 (시간형은 Phase 2 — 메모리 #28).
type Props = {
  partnerId: string;
  partnerName: string | null;
  // embedded=true: 시트 안에 들어갈 콘텐츠만 렌더(풀페이지 <main>/<header> 껍데기 제거).
  // 미지정/false: 기존 풀페이지 동작 그대로.
  embedded?: boolean;
  // F4-6 S2 — 일괄 설정 섹션 게이트. 기본 off: 단독 페이지·49만 opt-in,
  // 45 는 미전달 무변 (embedded 만으로는 45/49 구분 불가 — 별도 prop 필수).
  bulkSetup?: boolean;
};

const MIN_CAPACITY = 1;
const MAX_CAPACITY = 100;
const CALENDAR_MODE = "date_range" as const;
// F4-6 — bulk_upsert_reservation_slots 의 서버 상한 (p_end - p_start <= 92) 거울.
const BULK_MAX_DAYS = 92;
// ISO 요일 규약 (RPC p_weekdays 와 동일): 1=월 … 7=일.
const BULK_WEEKDAYS = [
  { iso: 1, label: "월" },
  { iso: 2, label: "화" },
  { iso: 3, label: "수" },
  { iso: 4, label: "목" },
  { iso: 5, label: "금" },
  { iso: 6, label: "토" },
  { iso: 7, label: "일" },
] as const;

function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthRange(month: Date): { from: string; to: string } {
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function PartnerCalendarPage({
  partnerId,
  partnerName,
  embedded = false,
  bulkSetup = false,
}: Props) {
  const router = useRouter();
  const supabase = getSupabase();

  // SSR ↔ 클라 hydration mismatch 차단: Calendar(react-day-picker) 는
  // 내부에서 toLocaleDateString() 등 시스템 locale 의존 출력을 data-* 에
  // 박는다 (ui/calendar.tsx L157). Cloudflare Workers SSR(UTC/en-US) 과
  // 브라우저(KST/ko-KR) 가 달라 React #418 발생 → 달력이 클라이언트 렌더
  // 직후 폐기되어 빈 카드로 보임. mounted 플래그로 클라 마운트 후에만
  // 렌더해 SSR 출력과 분리한다. ※ Phase B 에서 절대 제거 금지.
  const [mounted, setMounted] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const [capacity, setCapacity] = useState<number>(1);
  const [isBlocked, setIsBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // F4-6 S2 — 일괄 설정 상태 (bulkSetup=true 에서만 렌더/사용).
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");
  const [bulkDays, setBulkDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [bulkCapacity, setBulkCapacity] = useState<number>(1);
  const [bulkApplying, setBulkApplying] = useState(false);
  // 확인 게이트: null=비표시, number=범위 내 기존 마킹 일수(덮어쓰기 경고).
  const [bulkConfirmCount, setBulkConfirmCount] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, SlotRow>();
    for (const s of slots) {
      // date_range 모드 → slot_time NULL → 날짜 단일 키.
      if (s.slot_time === null) map.set(s.slot_date, s);
    }
    return map;
  }, [slots]);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = monthRange(monthCursor);
      // #17 — auth.getSession hydrate 후 RPC.
      await supabase.auth.getSession();
      const { data, error } = await supabase.rpc("get_partner_slots", {
        p_partner_id: partnerId,
        p_from: from,
        p_to: to,
      });
      if (error) {
        console.error("[PartnerCalendarPage] get_partner_slots failed:", error);
        toast.error("슬롯 조회에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setSlots([]);
        return;
      }
      const rows = (Array.isArray(data) ? data : []) as SlotRow[];
      setSlots(rows);
    } finally {
      setLoading(false);
    }
  }, [partnerId, monthCursor, supabase]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // 날짜 선택 시 기존 슬롯 값으로 입력값 초기화.
  useEffect(() => {
    if (!selectedDate) return;
    const iso = toIsoDate(selectedDate);
    const existing = slotsByDate.get(iso);
    if (existing) {
      setCapacity(existing.max_capacity);
      setIsBlocked(existing.is_blocked);
    } else {
      setCapacity(1);
      setIsBlocked(false);
    }
  }, [selectedDate, slotsByDate]);

  const markedDates = useMemo(
    () => Array.from(slotsByDate.keys()).map((iso) => parseIsoDate(iso)),
    [slotsByDate],
  );
  const blockedDates = useMemo(
    () =>
      Array.from(slotsByDate.values())
        .filter((s) => s.is_blocked)
        .map((s) => parseIsoDate(s.slot_date)),
    [slotsByDate],
  );

  async function handleSave() {
    if (!selectedDate) return;
    if (capacity < MIN_CAPACITY || capacity > MAX_CAPACITY) {
      toast.error(`자리수는 ${MIN_CAPACITY}~${MAX_CAPACITY} 사이여야 해요.`);
      return;
    }

    setSaving(true);
    try {
      await supabase.auth.getSession();
      const { error } = await supabase.rpc("upsert_reservation_slot", {
        p_partner_id: partnerId,
        p_slot_date: toIsoDate(selectedDate),
        p_calendar_mode: CALENDAR_MODE,
        p_slot_time: null,
        p_max_capacity: capacity,
        p_is_blocked: isBlocked,
      });
      if (error) {
        console.error("[PartnerCalendarPage] upsert_reservation_slot failed:", error);
        toast.error("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success(isBlocked ? "이 날짜를 차단했어요." : "가능한 날로 저장했어요.");
      await loadSlots();
      router.invalidate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedDate) return;
    const iso = toIsoDate(selectedDate);
    const existing = slotsByDate.get(iso);
    if (!existing) return;
    if (existing.current_bookings > 0) {
      toast.error("이미 예약이 들어온 날은 마킹을 해제할 수 없어요.");
      return;
    }

    setDeleting(true);
    try {
      await supabase.auth.getSession();
      const { error } = await supabase.rpc("delete_reservation_slot", {
        p_partner_id: partnerId,
        p_slot_date: iso,
        p_slot_time: null,
      });
      if (error) {
        console.error("[PartnerCalendarPage] delete_reservation_slot failed:", error);
        toast.error("해제에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("이 날짜의 마킹을 해제했어요.");
      setSelectedDate(undefined);
      await loadSlots();
      router.invalidate();
    } finally {
      setDeleting(false);
    }
  }

  // F4-6 S2 — 일괄 적용. skipConfirm=false: 기존 마킹 수 계산 → N>0 이면
  // 확인 게이트만 열고 반환. skipConfirm=true(게이트의 [덮어쓰고 적용]): RPC 1회.
  async function handleBulkApply(skipConfirm: boolean) {
    if (!bulkStart || !bulkEnd) {
      toast.error("시작일과 종료일을 선택해 주세요.");
      return;
    }
    const spanDays = Math.round(
      (parseIsoDate(bulkEnd).getTime() - parseIsoDate(bulkStart).getTime()) / 86_400_000,
    );
    if (spanDays < 0) {
      toast.error("종료일이 시작일보다 빨라요.");
      return;
    }
    if (spanDays > BULK_MAX_DAYS) {
      toast.error(`한 번에 최대 ${BULK_MAX_DAYS}일(약 3개월)까지 설정할 수 있어요.`);
      return;
    }
    if (bulkDays.length === 0) {
      toast.error("요일을 하나 이상 선택해 주세요.");
      return;
    }

    setBulkApplying(true);
    try {
      await supabase.auth.getSession();

      if (!skipConfirm) {
        // 덮어쓰기 확인 게이트 — 범위 내 기존 마킹(선택 요일·date_range 행) 계산.
        const { data, error } = await supabase.rpc("get_partner_slots", {
          p_partner_id: partnerId,
          p_from: bulkStart,
          p_to: bulkEnd,
        });
        if (error) {
          console.error("[PartnerCalendarPage] get_partner_slots (bulk pre-check) failed:", error);
          toast.error("기존 설정 확인에 실패했어요. 잠시 후 다시 시도해 주세요.");
          return;
        }
        const rows = (Array.isArray(data) ? data : []) as SlotRow[];
        const existing = rows.filter(
          (r) => r.slot_time === null && bulkDays.includes(isoWeekday(parseIsoDate(r.slot_date))),
        ).length;
        if (existing > 0) {
          setBulkConfirmCount(existing);
          return;
        }
      }

      const { data, error } = await supabase.rpc("bulk_upsert_reservation_slots", {
        p_partner_id: partnerId,
        p_start: bulkStart,
        p_end: bulkEnd,
        p_weekdays: [...bulkDays].sort((a, b) => a - b),
        p_max_capacity: bulkCapacity,
      });
      if (error) {
        console.error("[PartnerCalendarPage] bulk_upsert_reservation_slots failed:", error);
        toast.error("일괄 적용에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const r = (data ?? {}) as { applied?: number; overwritten?: number; protected?: number };
      const parts = [`${r.applied ?? 0}일 적용`];
      if ((r.overwritten ?? 0) > 0) parts.push(`${r.overwritten}일 덮어씀`);
      if ((r.protected ?? 0) > 0) parts.push(`${r.protected}일 예약 보호`);
      toast.success(parts.join(" · "));
      setBulkConfirmCount(null);
      await loadSlots();
      router.invalidate();
    } finally {
      setBulkApplying(false);
    }
  }

  const selectedIso = selectedDate ? toIsoDate(selectedDate) : null;
  const existingSlot = selectedIso ? slotsByDate.get(selectedIso) : undefined;
  const hasBookings = (existingSlot?.current_bookings ?? 0) > 0;

  // 캘린더 본체 — 풀페이지/시트(embedded) 두 모드가 공유(껍데기 main/header 만 분기).
  const body = (
    <>
      <div className="px-5 pt-4 space-y-4">
        <section className="rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          {mounted ? (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={monthCursor}
              onMonthChange={setMonthCursor}
              modifiers={{
                marked: markedDates,
                blocked: blockedDates,
              }}
              modifiersClassNames={{
                // 카카오식 — 연한 초록 배경 + 진한 초록 글자 + 얇은 초록 ring.
                // v7.2 셀 통일: 모든 modifier rounded-lg.
                marked:
                  "[&_button]:!bg-[#F5F5F5] [&_button]:!text-[#0A0A0A] [&_button]:!font-bold [&_button]:!ring-1 [&_button]:!ring-inset [&_button]:!ring-[#D4D4D4] [&_button]:!rounded-lg",
                blocked:
                  "[&_button]:!bg-[#F1F5F9] [&_button]:!text-[#A3A3A3] [&_button]:!font-medium [&_button]:!rounded-lg",
                // 오늘 = 연한 초록 ring-2 + 배경 없음. shadcn bg-accent(보라)
                // 를 !important 로 덮음. data-today 셀렉터는 DayButton 에
                // 출력 안 되므로 [&_button] 직접 적용. v7.2 — rounded-lg 통일.
                today:
                  "[&_button]:!bg-transparent [&_button]:!text-[#0A0A0A] [&_button]:!font-bold [&_button]:!ring-2 [&_button]:!ring-inset [&_button]:!ring-[#0A0A0A] [&_button]:!rounded-lg",
              }}
              // v7.2 — ui/calendar.tsx 에 selected 키 명시 X → react-day-picker
              // default 가 td 에 보라 입힘. user classNames.selected 명시로
              // 차단 (range_start/end/middle 잡은 것과 같은 원리).
              // day_button = Button(ghost variant) hover:bg-accent(보라) 차단.
              classNames={{
                selected: "!bg-transparent rounded-lg",
                day_button: "hover:!bg-[#F5F5F5] hover:!text-[#0A0A0A]",
              }}
              // v7.2 — 선택 셀(data-selected-single) = 진한 초록 채움 + 흰 글자
              // + rounded-lg. 검정 ring 폐기 (셀 모양/색 통일).
              className="w-full [&_button[data-selected-single=true]]:!bg-[#0A0A0A] [&_button[data-selected-single=true]]:!text-white [&_button[data-selected-single=true]]:!rounded-lg"
              disabled={loading}
            />
          ) : (
            // SSR placeholder — hydration 까지 동일 height 유지 (layout 쉬프트 차단)
            <div
              aria-hidden
              className="h-[296px] w-full rounded-xl bg-[#F8FAFC]"
            />
          )}
          <div className="mt-3 flex items-center gap-3 text-[11px] text-[#64748B]">
            <span className="inline-flex items-center gap-1">
              <span className="size-3 rounded-md bg-[#F5F5F5] ring-1 ring-inset ring-[#D4D4D4]" />
              가능
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-3 rounded-md bg-[#F1F5F9] ring-1 ring-inset ring-[#E5E7EB]" />
              차단
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-3 rounded-md border border-[#E5E7EB]" />
              미설정
            </span>
          </div>
        </section>

        {/* F4-6 S2 — 일괄 설정 (bulkSetup 게이트 · 접이식 · 달력↔개별 편집 사이).
            개별 편집과 공존: 적용 후 loadSlots 재조회 → 날짜 클릭 개별 수정 그대로. */}
        {bulkSetup ? (
          <section className="rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <button
              type="button"
              onClick={() => setBulkOpen((o) => !o)}
              className="flex w-full min-h-[44px] items-center justify-between px-5 py-4"
            >
              <span className="text-left">
                <span className="block text-sm font-bold text-[#0F172A]">일괄 설정</span>
                <span className="mt-0.5 block text-xs text-[#64748B]">
                  기간과 요일을 골라 한 번에 마킹해요
                </span>
              </span>
              <ChevronDown
                className={`size-4 text-[#64748B] transition-transform ${bulkOpen ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
            </button>

            {bulkOpen ? (
              <div className="space-y-4 border-t border-[#F1F5F9] px-5 py-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-[#475569]">
                    기간 (최대 {BULK_MAX_DAYS}일)
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={bulkStart}
                      onChange={(e) => {
                        setBulkStart(e.target.value);
                        setBulkConfirmCount(null);
                      }}
                      disabled={bulkApplying}
                      className="h-11 min-h-[44px] min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#0F172A] disabled:opacity-40"
                    />
                    <span className="text-xs text-[#94A3B8]">~</span>
                    <input
                      type="date"
                      value={bulkEnd}
                      onChange={(e) => {
                        setBulkEnd(e.target.value);
                        setBulkConfirmCount(null);
                      }}
                      disabled={bulkApplying}
                      className="h-11 min-h-[44px] min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#0F172A] disabled:opacity-40"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-[#475569]">반복 요일</p>
                  <div className="flex gap-1">
                    {BULK_WEEKDAYS.map((d) => {
                      const active = bulkDays.includes(d.iso);
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => {
                            setBulkDays((prev) =>
                              prev.includes(d.iso)
                                ? prev.filter((n) => n !== d.iso)
                                : [...prev, d.iso],
                            );
                            setBulkConfirmCount(null);
                          }}
                          disabled={bulkApplying}
                          className={
                            active
                              ? "min-h-[44px] flex-1 rounded-lg bg-[#0A0A0A] text-sm font-bold text-white disabled:opacity-40"
                              : "min-h-[44px] flex-1 rounded-lg border border-[#E5E7EB] bg-white text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-40"
                          }
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-[#475569]">
                    자리수 ({MIN_CAPACITY}~{MAX_CAPACITY})
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkCapacity((n) => Math.max(MIN_CAPACITY, n - 1))}
                      disabled={bulkCapacity <= MIN_CAPACITY || bulkApplying}
                      className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC] disabled:opacity-40"
                    >
                      <Minus className="size-4 text-[#0A0A0A]" strokeWidth={2} />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={MIN_CAPACITY}
                      max={MAX_CAPACITY}
                      value={bulkCapacity}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) {
                          setBulkCapacity(
                            Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(n))),
                          );
                        }
                      }}
                      disabled={bulkApplying}
                      className="h-11 w-20 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white text-center text-lg font-bold text-[#0F172A] disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={() => setBulkCapacity((n) => Math.min(MAX_CAPACITY, n + 1))}
                      disabled={bulkCapacity >= MAX_CAPACITY || bulkApplying}
                      className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC] disabled:opacity-40"
                    >
                      <Plus className="size-4 text-[#0A0A0A]" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {bulkConfirmCount !== null ? (
                  // 덮어쓰기 확인 게이트 — 인라인 패널 (Radix 미사용).
                  <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                    <p className="text-sm font-semibold leading-relaxed text-[#0F172A] [word-break:keep-all]">
                      기존 설정 {bulkConfirmCount}일을 덮어써요 — 예약 있는 날은 자리수를
                      지켜요
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBulkConfirmCount(null)}
                        disabled={bulkApplying}
                        className="flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleBulkApply(true)}
                        disabled={bulkApplying}
                        className="flex-1 min-h-[44px] rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {bulkApplying ? "적용 중…" : "덮어쓰고 적용"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleBulkApply(false)}
                    disabled={bulkApplying}
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {bulkApplying ? "적용 중…" : "한번에 적용"}
                  </button>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {selectedDate ? (
          <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-4">
            <div>
              <p className="text-sm font-bold text-[#0F172A]">
                {selectedDate.toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}{" "}
                설정
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[#0F172A]">
                현재 설정:{" "}
                {existingSlot ? (
                  existingSlot.is_blocked ? (
                    <span className="text-[#A3A3A3]">차단됨</span>
                  ) : (
                    <span className="text-base font-bold text-[#0A0A0A]">
                      {existingSlot.max_capacity}자리
                    </span>
                  )
                ) : (
                  <span className="text-[#94A3B8]">미설정</span>
                )}
              </p>
              {existingSlot ? (
                <p className="mt-1 text-xs text-[#64748B]">
                  현재 {existingSlot.current_bookings}/{existingSlot.max_capacity}팀 예약됨
                </p>
              ) : (
                <p className="mt-1 text-xs text-[#64748B]">아직 마킹되지 않았어요.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-[#475569] mb-2">자리수 (1~100)</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCapacity((n) => Math.max(MIN_CAPACITY, n - 1))}
                  disabled={capacity <= MIN_CAPACITY || isBlocked}
                  className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC] disabled:opacity-40"
                >
                  <Minus className="size-4 text-[#0A0A0A]" strokeWidth={2} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_CAPACITY}
                  max={MAX_CAPACITY}
                  value={capacity}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) {
                      setCapacity(Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(n))));
                    }
                  }}
                  disabled={isBlocked}
                  className="w-20 h-11 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white text-center text-lg font-bold text-[#0F172A] disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setCapacity((n) => Math.min(MAX_CAPACITY, n + 1))}
                  disabled={capacity >= MAX_CAPACITY || isBlocked}
                  className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC] disabled:opacity-40"
                >
                  <Plus className="size-4 text-[#0A0A0A]" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsBlocked(false)}
                className={
                  !isBlocked
                    ? "flex-1 min-h-[44px] rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white"
                    : "flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                }
              >
                가능
              </button>
              <button
                type="button"
                onClick={() => setIsBlocked(true)}
                className={
                  isBlocked
                    ? "flex-1 min-h-[44px] rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white"
                    : "flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                }
              >
                차단
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              {existingSlot ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving || hasBookings}
                  title={hasBookings ? "이미 예약이 들어온 날은 해제할 수 없어요." : undefined}
                  className="flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
                >
                  마킹 해제
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || deleting}
                className="flex-1 min-h-[44px] rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-6 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <p className="text-sm text-[#64748B]">
              날짜를 선택하면 자리수를 설정할 수 있어요.
            </p>
          </section>
        )}
      </div>

      <Toaster richColors position="top-center" />
    </>
  );

  // embedded: 시트 콘텐츠만(여백만). 풀페이지 껍데기/헤더/뒤로가기 없음.
  if (embedded) {
    return <div className="px-1 pb-2">{body}</div>;
  }

  // 풀페이지(기존 동작 100% 보존) — min-h-screen <main> + 헤더(뒤로가기) + body.
  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9] flex items-center gap-3">
        <Link
          to="/partner"
          className="flex size-10 min-h-[44px] min-w-[44px] items-center justify-center -ml-2"
        >
          <ArrowLeft className="size-5 text-[#0A0A0A]" strokeWidth={2} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[#0F172A] truncate">예약 캘린더</h1>
          {partnerName ? (
            <p className="mt-0.5 text-xs text-[#64748B] truncate">{partnerName}</p>
          ) : null}
        </div>
      </header>
      {body}
    </main>
  );
}
