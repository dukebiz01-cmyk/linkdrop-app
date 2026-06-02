import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Minus, Plus } from "lucide-react";
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
};

const MIN_CAPACITY = 1;
const MAX_CAPACITY = 100;
const CALENDAR_MODE = "date_range" as const;

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

export function PartnerCalendarPage({ partnerId, partnerName }: Props) {
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

  const selectedIso = selectedDate ? toIsoDate(selectedDate) : null;
  const existingSlot = selectedIso ? slotsByDate.get(selectedIso) : undefined;
  const hasBookings = (existingSlot?.current_bookings ?? 0) > 0;

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
                // 검정 채움(가독성 최악) 제거. 날짜 숫자 잘 읽힘.
                marked:
                  "[&_button]:!bg-[#f0fdf4] [&_button]:!text-[#15803d] [&_button]:!font-bold [&_button]:!ring-1 [&_button]:!ring-inset [&_button]:!ring-[#15803d]/40",
                blocked:
                  "[&_button]:!bg-[#F1F5F9] [&_button]:!text-[#A3A3A3] [&_button]:!font-medium",
              }}
              // shadcn 기본 bg-accent/bg-primary(보라/슬레이트) 가 today/range
              // 셀에서 보라처럼 나타남. CALENDAR_BUTTON_OVERRIDE 패턴 차용해
              // 셀렉트/오늘 색을 검정 톤으로 통일 (#15 디자인).
              className="w-full [&_button[data-selected-single=true]]:!bg-[#0A0A0A]/10 [&_button[data-selected-single=true]]:!text-[#0A0A0A] [&_button[data-selected-single=true]]:!ring-2 [&_button[data-selected-single=true]]:!ring-inset [&_button[data-selected-single=true]]:!ring-[#0A0A0A] [&_button[data-today=true]]:!bg-transparent [&_button[data-today=true]]:!text-[#0A0A0A] [&_button[data-today=true]]:!font-bold"
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
              <span className="size-3 rounded-md bg-[#f0fdf4] ring-1 ring-inset ring-[#15803d]/40" />
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
    </main>
  );
}
