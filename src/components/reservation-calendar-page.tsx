import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { WIZARD_SECONDARY_BUTTON_CLASS } from "@/components/create-wizard-button-styles";
import {
  MOCK_RESERVATION_CAMPGROUND_INFO,
  MOCK_RESERVATION_DEFAULTS,
  type ReservationCampgroundInfo,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type {
  ReservationCampgroundInfo,
  ReservationCampgroundFacilities,
  ReservationCampgroundFacilityGroup,
} from "@/lib/mock-data";

export function CampgroundInfoCard({ info }: { info: ReservationCampgroundInfo }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <section
      data-testid="campground-info-card"
      data-source={info.source}
      data-expanded={showDetails}
      className="w-full max-w-full rounded-2xl border border-border bg-surface p-4"
    >
      <h3 className="text-sm font-bold tracking-ko text-text-strong">캠핑장 정보</h3>
      <p className="mt-2 text-base font-extrabold leading-snug tracking-ko text-text-strong">
        {info.name}
      </p>
      <p className="mt-1 text-sm font-medium tracking-ko text-text-muted">
        {info.region} · {info.concept}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {info.highlightBadges.map((badge) => (
          <span
            key={badge}
            className="inline-flex max-w-full rounded-lg border border-border bg-bg px-2 py-1 text-xs font-semibold tracking-ko text-text-strong"
          >
            {badge}
          </span>
        ))}
      </div>

      <button
        type="button"
        aria-expanded={showDetails}
        data-testid="campground-facilities-toggle"
        className={cn(
          WIZARD_SECONDARY_BUTTON_CLASS,
          "mt-3 h-11 min-h-[44px] text-sm font-bold",
        )}
        onClick={() => setShowDetails((open) => !open)}
      >
        {showDetails ? "시설 정보 닫기" : "시설 정보 보기"}
      </button>

      {showDetails && (
        <div
          data-testid="campground-facilities-detail"
          className="mt-3 w-full max-w-full space-y-4 rounded-xl border border-border bg-bg p-3"
        >
          {info.facilityGroups.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-bold tracking-ko text-text-strong">{group.title}</p>
              <ul className="mt-2 space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={`${group.title}-${item.label}`}
                    className="text-sm font-medium tracking-ko text-text-strong"
                  >
                    <span className="text-text-muted">{item.label}</span>
                    <span className="text-text-strong">: {item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="border-t border-border pt-3 text-xs font-medium leading-relaxed tracking-ko text-text-subtle">
            {info.sourceLabel} · {info.sourceNote}
          </p>
        </div>
      )}
    </section>
  );
}

export type ReservationSelection = {
  checkIn: Date | undefined;
  checkOut: Date | undefined;
  nights: number;
  adults: number;
  children: number;
  pets: boolean;
};

const GUEST_MAX = 10;

const GUEST_STEPPER_BUTTON_CLASS = cn(
  "inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#E5E7EB] bg-white",
  "text-text-strong transition-colors hover:border-[#D4D4D4] hover:bg-[#FAFAFA]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:bg-[#F5F5F5] disabled:text-[#A3A3A3]",
);

function GuestStepperRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="shrink-0 text-sm font-semibold tracking-ko text-text-strong">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} 감소`}
          disabled={value <= min}
          className={GUEST_STEPPER_BUTTON_CLASS}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="size-4" strokeWidth={2} />
        </button>
        <span className="min-w-[48px] text-center text-sm font-bold tabular-nums tracking-ko text-text-strong">
          {value}명
        </span>
        <button
          type="button"
          aria-label={`${label} 증가`}
          disabled={value >= max}
          className={GUEST_STEPPER_BUTTON_CLASS}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export type ReservationSecondaryAction = "phone" | "sms" | "directions";

export interface ReservationCalendarPageProps {
  partnerName: string;
  campgroundInfo?: ReservationCampgroundInfo;
  onCheckAvailability?: (selection: ReservationSelection) => void;
  onSecondaryAction?: (action: ReservationSecondaryAction) => void;
  className?: string;
}

const RESERVATION_PRIMARY_ENABLED = cn(
  "inline-flex h-14 min-h-[56px] w-full max-w-full items-center justify-center rounded-2xl border-0 px-6",
  "text-base font-bold tracking-ko text-white",
  "bg-[var(--ld-primary,#2563EB)] hover:bg-[#1D4ED8]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2",
);

const RESERVATION_PRIMARY_DISABLED = cn(
  "inline-flex h-14 min-h-[56px] w-full max-w-full cursor-not-allowed items-center justify-center rounded-2xl border-0 px-6",
  "text-base font-bold tracking-ko text-[#A3A3A3]",
  "bg-[#E5E7EB] hover:bg-[#E5E7EB]",
);

const RESERVATION_CALENDAR_CLASS_NAMES = {
  root: "w-full max-w-full",
  months: "relative w-full max-w-full",
  month: "flex w-full max-w-full flex-col gap-2",
  nav: "flex w-full items-center justify-between px-1",
  month_caption:
    "flex h-10 w-full items-center justify-center text-sm font-bold tracking-ko text-text-strong",
  caption_label: "text-sm font-bold",
  table: "w-full max-w-full border-collapse",
  weekdays: "grid w-full grid-cols-7",
  weekday:
    "flex aspect-square items-center justify-center text-center text-[0.7rem] font-semibold text-text-muted",
  week: "mt-1 grid w-full grid-cols-7",
  day: "relative aspect-square p-0 text-center",
  range_start: "rounded-l-lg bg-[#2563EB]",
  range_end: "rounded-r-lg bg-[#2563EB]",
  range_middle: "rounded-none bg-[#EFF6FF]",
  today: "font-bold text-[#2563EB]",
  outside: "text-text-subtle opacity-40",
  disabled: "text-text-disabled opacity-40",
};

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatKoDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

/** 체크아웃 − 체크인 일수 = 숙박 박수 (5/18~5/24 → 6박) */
function calcNights(checkIn?: Date, checkOut?: Date): number {
  if (!checkIn || !checkOut) return 0;
  const from = startOfDay(checkIn).getTime();
  const to = startOfDay(checkOut).getTime();
  if (to <= from) return 0;
  return Math.round((to - from) / 86400000);
}

function toCalendarRange(checkIn?: Date, checkOut?: Date): DateRange | undefined {
  if (!checkIn) return undefined;
  return { from: checkIn, to: checkOut };
}

function buildSummaryContent(selection: ReservationSelection): {
  dateLine: string;
  stayLine: string | null;
} {
  if (!selection.checkOut) {
    return {
      dateLine: "체크아웃 날짜를 선택해 주세요.",
      stayLine: null,
    };
  }
  const dateLine = `${formatKoDate(selection.checkIn!)} 체크인 · ${formatKoDate(selection.checkOut)} 체크아웃`;
  const petsPart = selection.pets ? " · 반려견 동반" : "";
  const stayLine = `${selection.nights}박 · 성인 ${selection.adults}명 · 소인 ${selection.children}명${petsPart}`;
  return { dateLine, stayLine };
}

/**
 * 체크인 → 체크아웃 2단계 선택, 숙박일수 자동 계산.
 * WHY: 박수 수동 선택은 날짜 범위와 충돌 — Phase 1은 range만 사용.
 */
function applyRangeSelection(next: DateRange | undefined): {
  checkIn: Date | undefined;
  checkOut: Date | undefined;
} {
  if (!next?.from) {
    return { checkIn: undefined, checkOut: undefined };
  }

  const clicked = startOfDay(next.from);
  const nextTo = next.to ? startOfDay(next.to) : undefined;

  if (!nextTo) {
    return { checkIn: clicked, checkOut: undefined };
  }

  if (nextTo.getTime() < clicked.getTime()) {
    return { checkIn: nextTo, checkOut: undefined };
  }

  if (nextTo.getTime() === clicked.getTime()) {
    return { checkIn: clicked, checkOut: undefined };
  }

  return { checkIn: clicked, checkOut: nextTo };
}

/**
 * 예약(reservation) 목적 — Phase 1 외부 예약 링크용 캘린더 UI.
 */
export function ReservationCalendarPage({
  campgroundInfo = MOCK_RESERVATION_CAMPGROUND_INFO,
  onCheckAvailability,
  onSecondaryAction,
  className,
}: ReservationCalendarPageProps) {
  const [checkIn, setCheckIn] = useState<Date | undefined>(() =>
    parseLocalDate(MOCK_RESERVATION_DEFAULTS.checkIn),
  );
  const [checkOut, setCheckOut] = useState<Date | undefined>(() =>
    parseLocalDate(MOCK_RESERVATION_DEFAULTS.checkOut),
  );
  const [adults, setAdults] = useState(MOCK_RESERVATION_DEFAULTS.adults);
  const [children, setChildren] = useState(MOCK_RESERVATION_DEFAULTS.children);
  const [pets, setPets] = useState(MOCK_RESERVATION_DEFAULTS.pets);
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);

  const nights = calcNights(checkIn, checkOut);
  const calendarRange = toCalendarRange(checkIn, checkOut);

  const selection: ReservationSelection = useMemo(
    () => ({
      checkIn,
      checkOut,
      nights,
      adults,
      children,
      pets,
    }),
    [checkIn, checkOut, nights, adults, children, pets],
  );

  const canCheck = Boolean(checkIn && checkOut && nights >= 1 && adults >= 1);
  const { dateLine, stayLine } = buildSummaryContent(selection);
  const defaultMonth = checkIn ?? parseLocalDate(MOCK_RESERVATION_DEFAULTS.checkIn);

  function handleRangeSelect(next: DateRange | undefined) {
    const applied = applyRangeSelection(next);
    setCheckIn(applied.checkIn);
    setCheckOut(applied.checkOut);
  }

  useEffect(() => {
    setCheckFeedback(null);
  }, [checkIn, checkOut, adults, children, pets]);

  return (
    <div className={cn("w-full max-w-full space-y-4", className)}>
      <CampgroundInfoCard info={campgroundInfo} />

      <p className="text-xs font-medium tracking-ko text-text-subtle">
        날짜를 두 번 눌러 체크인·체크아웃을 선택하세요
      </p>

      <div className="w-full max-w-full overflow-hidden rounded-2xl border border-border bg-bg p-4">
        <Calendar
          mode="range"
          selected={calendarRange}
          onSelect={handleRangeSelect}
          defaultMonth={defaultMonth}
          numberOfMonths={1}
          showOutsideDays
          disabled={{ before: parseLocalDate("2026-05-01") }}
          className="w-full max-w-full p-0 [--cell-size:2.25rem] [&_.rdp-day_button]:mx-auto [&_.rdp-day_button]:flex [&_.rdp-day_button]:aspect-square [&_.rdp-day_button]:h-full [&_.rdp-day_button]:w-full [&_.rdp-day_button]:items-center [&_.rdp-day_button]:justify-center [&_.rdp-day_button]:rounded-lg [&_.rdp-day_button]:text-sm [&_.rdp-range_start_.rdp-day_button]:bg-[#2563EB] [&_.rdp-range_start_.rdp-day_button]:text-white [&_.rdp-range_end_.rdp-day_button]:bg-[#2563EB] [&_.rdp-range_end_.rdp-day_button]:text-white [&_.rdp-range_middle_.rdp-day_button]:bg-[#EFF6FF] [&_.rdp-range_middle_.rdp-day_button]:text-[#2563EB]"
          classNames={RESERVATION_CALENDAR_CLASS_NAMES}
        />
      </div>

      <div className="w-full max-w-full space-y-3 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold tracking-ko text-text-strong">인원</p>
        <GuestStepperRow
          label="성인"
          value={adults}
          min={1}
          max={GUEST_MAX}
          onChange={setAdults}
        />
        <GuestStepperRow
          label="소인"
          value={children}
          min={0}
          max={GUEST_MAX}
          onChange={setChildren}
        />
        <label className="flex min-h-[44px] items-center gap-2 border-t border-border pt-3 text-sm font-medium text-text-strong">
          <input
            type="checkbox"
            checked={pets}
            onChange={(e) => setPets(e.target.checked)}
            className="size-4 shrink-0 rounded border-border accent-[#2563EB]"
          />
          반려견 동반
        </label>
      </div>

      <div className="rounded-2xl border border-[#2563EB]/30 bg-[#EFF6FF]/50 px-4 py-4">
        <p className="text-xs font-bold tracking-ko text-[#2563EB]">선택한 예약</p>
        <p className="mt-2 text-base font-bold leading-snug tracking-ko text-text-strong">{dateLine}</p>
        {stayLine && (
          <p className="mt-1 text-sm font-semibold tracking-ko text-text-strong">{stayLine}</p>
        )}
      </div>

      <button
        type="button"
        disabled={!canCheck}
        data-testid="cta-reservation-check"
        className={canCheck ? RESERVATION_PRIMARY_ENABLED : RESERVATION_PRIMARY_DISABLED}
        onClick={() => {
          if (!canCheck) return;
          onCheckAvailability?.(selection);
          setCheckFeedback(`${dateLine} · ${stayLine} 조건으로 예약 가능 여부를 확인합니다.`);
        }}
      >
        예약 가능 여부 확인
      </button>

      {checkFeedback && (
        <p className="text-sm font-medium leading-relaxed tracking-ko text-text-muted">{checkFeedback}</p>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-ko text-text-subtle">다른 방법으로 문의</p>
        <div className="grid min-w-0 grid-cols-3 gap-2">
          {(
            [
              ["phone", "전화", "cta-reservation-phone"],
              ["sms", "문자", "cta-reservation-sms"],
              ["directions", "길찾기", "cta-reservation-directions"],
            ] as const
          ).map(([action, label, testId]) => (
            <button
              key={action}
              type="button"
              data-testid={testId}
              className={cn(WIZARD_SECONDARY_BUTTON_CLASS, "h-11 min-h-[44px] px-2 text-xs font-bold")}
              onClick={() => onSecondaryAction?.(action)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
