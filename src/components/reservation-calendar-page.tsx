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
import type {
  ReservationDateItem,
  ReservationDateStatus,
} from "@/components/create-drop-wizard";
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
  /** 메이커가 Create Wizard 에서 보낸 예약 가능 날짜 — 달력 마킹·상세 목록용. */
  makerAvailableDates?: ReservationDateItem[];
  onCheckAvailability?: (selection: ReservationSelection) => void;
  onSecondaryAction?: (action: ReservationSecondaryAction) => void;
  /**
   * 재공유(re-share) 수신자 화면 여부. true 면 날짜·인원·반려견 편집 UI 를 숨기고
   * 메이커가 확정한 정보를 고정 카드로 표시한다. 첫 수신자(parentShareId·shareDepth·ref
   * URL 마커 없음) 는 기존 편집 가능 UI 를 그대로 사용.
   */
  readOnly?: boolean;
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
  // 셀 레벨 배경 색칠은 제거 — 강한 색은 버튼 레벨 data-attr 셀렉터로 통일 관리.
  range_start: "rounded-l-lg",
  range_end: "rounded-r-lg",
  range_middle: "rounded-none",
  today: "font-bold text-[#2563EB]",
  outside: "text-text-subtle opacity-40",
  disabled: "text-[#A3A3A3]",
};

// 수신자 선택(체크인/체크아웃/range middle) 시각 — shadcn 기본은 bg-primary(BLACK)/
// bg-accent(INDIGO PURPLE) 라 강한 색이 떠 보인다. 받는 사람 화면의 시각 언어와 맞지
// 않으므로 모두 연한 파란색 + 테두리로 통일한다. 메이커가 보낸 가능 날짜와는 시각
// 언어를 분리 — 가능 날짜는 modifier 의 얇은 ring 으로만, 선택은 채움 + ring 으로.
const CALENDAR_BUTTON_OVERRIDE = cn(
  "[&_button[data-selected-single=true]]:!bg-[#2563EB]/15",
  "[&_button[data-selected-single=true]]:!text-[#2563EB]",
  "[&_button[data-selected-single=true]]:!ring-2",
  "[&_button[data-selected-single=true]]:!ring-inset",
  "[&_button[data-selected-single=true]]:!ring-[#2563EB]",
  "[&_button[data-range-start=true]]:!bg-[#2563EB]",
  "[&_button[data-range-start=true]]:!text-white",
  "[&_button[data-range-end=true]]:!bg-[#2563EB]",
  "[&_button[data-range-end=true]]:!text-white",
  "[&_button[data-range-middle=true]]:!bg-[#2563EB]/5",
  "[&_button[data-range-middle=true]]:!text-text-strong",
);

// 메이커 가능 날짜 — "선택 가능한 후보"임을 약하게 표시. 채움/긴 바 금지.
// 얇은 ring 만 — 수신자 선택의 채움과 시각 분리.
const MAKER_OPEN_CLASS = "rounded-md ring-1 ring-inset ring-[#15803D]/40";
const MAKER_WARN_CLASS = "rounded-md ring-1 ring-inset ring-[#B45309]/40";

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
  if (!selection.checkIn) {
    return { dateLine: "예약할 날짜를 선택해 주세요.", stayLine: null };
  }
  if (!selection.checkOut) {
    return { dateLine: "체크아웃 날짜를 선택해 주세요.", stayLine: null };
  }
  const dateLine = `${formatKoDate(selection.checkIn)} 체크인 · ${formatKoDate(selection.checkOut)} 체크아웃`;
  const petsPart = selection.pets ? " · 반려견 동반" : "";
  const stayLine = `${selection.nights}박 · 성인 ${selection.adults}명 · 소인 ${selection.children}명${petsPart}`;
  return { dateLine, stayLine };
}

// ── 메이커 예약 가능 날짜 (makerAvailableDates) — 마킹·상세 목록 헬퍼 ───────────
// WHY: create-drop-wizard 의 포맷터를 import 하면 wizard 번들 전체가 /d 로 딸려온다.
//      수신자 화면용으로 표시 로직만 가볍게 재구현한다(타입만 import).

const MAKER_STATUS_LABEL: Record<ReservationDateStatus, string> = {
  available: "여유",
  few_left: "잔여 자리",
  almost_full: "마감 임박",
  closed: "마감",
  inquiry: "문의 필요",
};

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function makerDateFromIso(iso: string): Date | null {
  const [y, m, d] = (iso ?? "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function isoFromDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// 한 항목이 차지하는 모든 ISO 날짜 (range 는 시작~끝 전체).
function isoListForItem(item: ReservationDateItem): string[] {
  if (item.mode === "range" && item.startDate && item.endDate) {
    const s = makerDateFromIso(item.startDate);
    const e = makerDateFromIso(item.endDate);
    if (!s || !e) return [];
    const out: string[] = [];
    for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
      out.push(isoFromDate(d));
    }
    return out;
  }
  if (item.mode === "multiple") return item.dates;
  return item.dates.slice(0, 1);
}

// 항목 1건의 날짜 라벨 — single "5월 24일 토" · range "5월 18일~20일" · multiple "5월 18일, 21일".
function makerItemDateLabel(item: ReservationDateItem): string {
  if (item.mode === "range" && item.startDate && item.endDate) {
    const s = makerDateFromIso(item.startDate);
    const e = makerDateFromIso(item.endDate);
    if (!s || !e) return `${item.startDate}~${item.endDate}`;
    const sm = s.getMonth() + 1;
    const em = e.getMonth() + 1;
    const endPart = sm === em ? `${e.getDate()}일` : `${em}월 ${e.getDate()}일`;
    return `${sm}월 ${s.getDate()}일~${endPart}`;
  }
  if (item.mode === "multiple") {
    let lastMonth = -1;
    return item.dates
      .map((iso) => {
        const d = makerDateFromIso(iso);
        if (!d) return iso;
        const m = d.getMonth() + 1;
        const part = m === lastMonth ? `${d.getDate()}일` : `${m}월 ${d.getDate()}일`;
        lastMonth = m;
        return part;
      })
      .join(", ");
  }
  const d = makerDateFromIso(item.dates[0] ?? "");
  if (!d) return item.dates[0] ?? "";
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY_KO[d.getDay()]}`;
}

// 항목 상태 라벨 — few_left + 잔여수면 "잔여 N자리".
function makerItemStatusLabel(item: ReservationDateItem): string {
  if (item.status === "few_left" && item.remainingCount && item.remainingCount > 0) {
    return `잔여 ${item.remainingCount}자리`;
  }
  return MAKER_STATUS_LABEL[item.status];
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
// Dispatcher — readOnly 여부에 따라 ReadOnlyReservationCard / EditableReservationCard.
// hooks 충돌(rules-of-hooks) 방지를 위해 각 모드의 hooks 를 각자 함수에 격리한다.
export function ReservationCalendarPage(props: ReservationCalendarPageProps) {
  if (props.readOnly) {
    return (
      <ReadOnlyReservationCard
        campgroundInfo={props.campgroundInfo ?? MOCK_RESERVATION_CAMPGROUND_INFO}
        makerAvailableDates={props.makerAvailableDates ?? []}
        onCheckAvailability={props.onCheckAvailability}
        onSecondaryAction={props.onSecondaryAction}
        className={props.className}
      />
    );
  }
  return <EditableReservationCard {...props} />;
}

function EditableReservationCard({
  campgroundInfo = MOCK_RESERVATION_CAMPGROUND_INFO,
  makerAvailableDates = [],
  onCheckAvailability,
  onSecondaryAction,
  className,
}: ReservationCalendarPageProps) {
  // 수신자가 선택한 날짜 — 메이커 예약 가능 날짜와 별개 상태. mock 으로 미리 채우지 않는다.
  const [checkIn, setCheckIn] = useState<Date | undefined>(undefined);
  const [checkOut, setCheckOut] = useState<Date | undefined>(undefined);
  const [adults, setAdults] = useState<number>(MOCK_RESERVATION_DEFAULTS.adults);
  const [children, setChildren] = useState<number>(MOCK_RESERVATION_DEFAULTS.children);
  const [pets, setPets] = useState<boolean>(MOCK_RESERVATION_DEFAULTS.pets);
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

  // 메이커 예약 가능 날짜 → 달력 마킹용 Date 배열 (상태별 분류) + 최초 날짜.
  const hasMakerDates = makerAvailableDates.length > 0;
  const {
    makerOpenDates,
    makerWarnDates,
    makerClosedDates,
    earliestMakerDate,
    openSet,
    warnSet,
  } = useMemo(() => {
    const open: Date[] = [];
    const warn: Date[] = [];
    const closed: Date[] = [];
    let earliest: Date | null = null;
    for (const item of makerAvailableDates) {
      for (const iso of isoListForItem(item)) {
        const d = makerDateFromIso(iso);
        if (!d) continue;
        if (item.status === "closed") closed.push(d);
        else if (item.status === "almost_full") warn.push(d);
        else open.push(d);
        if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
      }
    }
    return {
      makerOpenDates: open,
      makerWarnDates: warn,
      makerClosedDates: closed,
      earliestMakerDate: earliest,
      openSet: new Set(open.map(isoFromDate)),
      warnSet: new Set(warn.map(isoFromDate)),
    };
  }, [makerAvailableDates]);

  const defaultMonth =
    checkIn ?? earliestMakerDate ?? parseLocalDate(MOCK_RESERVATION_DEFAULTS.checkIn);

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
          disabled={(date: Date) => {
            const t = startOfDay(date).getTime();
            const today = startOfDay(new Date()).getTime();
            if (t < today) return true;
            // 체크아웃 선택 중 (체크인 선택 완료 상태)
            if (checkIn && !checkOut) {
              return t <= startOfDay(checkIn).getTime();
            }
            // 체크인 선택 중: 메이커 whitelist
            if (hasMakerDates) {
              return !openSet.has(isoFromDate(date)) && !warnSet.has(isoFromDate(date));
            }
            return false;
          }}
          modifiers={{ makerOpen: makerOpenDates, makerWarn: makerWarnDates }}
          modifiersClassNames={{
            makerOpen: MAKER_OPEN_CLASS,
            makerWarn: MAKER_WARN_CLASS,
          }}
          className={cn("w-full max-w-full p-0 [--cell-size:2.25rem]", CALENDAR_BUTTON_OVERRIDE)}
          classNames={RESERVATION_CALENDAR_CLASS_NAMES}
        />
      </div>

      {hasMakerDates && (
        <div className="w-full max-w-full space-y-2 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-bold tracking-ko text-text-strong">
            메이커가 보낸 예약 가능 날짜
          </p>
          <p className="text-xs font-medium leading-relaxed tracking-ko text-text-muted">
            원하는 날짜를 선택해 예약 가능 여부를 확인하세요.
          </p>
          <ul className="space-y-2">
            {makerAvailableDates.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-bg p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold tracking-ko text-text-strong">
                    {makerItemDateLabel(item)}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold tracking-ko",
                      item.status === "closed"
                        ? "bg-surface text-text-subtle"
                        : item.status === "almost_full"
                          ? "bg-intent-warning-bg text-intent-warning"
                          : "bg-intent-success-bg text-intent-success",
                    )}
                  >
                    {makerItemStatusLabel(item)}
                  </span>
                </div>
                {item.eventTitle && (
                  <p className="mt-1 text-xs font-semibold tracking-ko text-text-strong">
                    {item.eventTitle}
                  </p>
                )}
                {item.eventDescription && (
                  <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                    {item.eventDescription}
                  </p>
                )}
                {item.memo && (
                  <p className="mt-1 text-[11px] font-medium tracking-ko text-text-subtle">
                    {item.memo}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
            최종 예약 가능 여부는 예약처에서 확인해 주세요.
          </p>
        </div>
      )}

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
        네이버 예약하기
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

// ── Re-share 수신자 — read-only 카드 ─────────────────────────────────────────
// 재공유된 /d 화면 (parentShareId·shareDepth·ref URL 마커 감지 시) 사용.
// 메이커가 확정한 정보만 고정 표시. 날짜·인원·반려견 편집 불가.
function ReadOnlyReservationCard({
  campgroundInfo,
  makerAvailableDates,
  onCheckAvailability,
  onSecondaryAction,
  className,
}: {
  campgroundInfo: ReservationCampgroundInfo;
  makerAvailableDates: ReservationDateItem[];
  onCheckAvailability?: (selection: ReservationSelection) => void;
  onSecondaryAction?: (action: ReservationSecondaryAction) => void;
  className?: string;
}) {
  const hasMakerDates = makerAvailableDates.length > 0;
  const { makerOpenDates, makerWarnDates, makerClosedDates, earliestMakerDate } = useMemo(() => {
    const open: Date[] = [];
    const warn: Date[] = [];
    const closed: Date[] = [];
    let earliest: Date | null = null;
    for (const item of makerAvailableDates) {
      for (const iso of isoListForItem(item)) {
        const d = makerDateFromIso(iso);
        if (!d) continue;
        if (item.status === "closed") closed.push(d);
        else if (item.status === "almost_full") warn.push(d);
        else open.push(d);
        if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
      }
    }
    return {
      makerOpenDates: open,
      makerWarnDates: warn,
      makerClosedDates: closed,
      earliestMakerDate: earliest,
    };
  }, [makerAvailableDates]);

  const defaultMonth = earliestMakerDate ?? parseLocalDate(MOCK_RESERVATION_DEFAULTS.checkIn);

  // 시그니처 유지를 위한 stub — 수신자 선택값 없음 → 메이커 기본값으로 채워서 전달.
  const readonlySelection: ReservationSelection = {
    checkIn: undefined,
    checkOut: undefined,
    nights: 0,
    adults: MOCK_RESERVATION_DEFAULTS.adults,
    children: MOCK_RESERVATION_DEFAULTS.children,
    pets: MOCK_RESERVATION_DEFAULTS.pets,
  };

  const guestSummary = `성인 ${MOCK_RESERVATION_DEFAULTS.adults}명 · 소인 ${MOCK_RESERVATION_DEFAULTS.children}명 · 반려견 ${MOCK_RESERVATION_DEFAULTS.pets ? "동반 가능" : "동반 불가"}`;

  return (
    <div className={cn("w-full max-w-full space-y-4", className)}>
      <CampgroundInfoCard info={campgroundInfo} />

      <div
        className="w-full max-w-full overflow-hidden rounded-2xl border border-border bg-bg p-4"
        aria-label="메이커가 확정한 예약 가능 날짜 (재공유 · 읽기 전용)"
      >
        <div className="pointer-events-none select-none" aria-disabled="true">
          <Calendar
            mode="single"
            defaultMonth={defaultMonth}
            numberOfMonths={1}
            showOutsideDays
            disabled={hasMakerDates ? makerClosedDates : undefined}
            modifiers={{ makerOpen: makerOpenDates, makerWarn: makerWarnDates }}
            modifiersClassNames={{
              makerOpen: MAKER_OPEN_CLASS,
              makerWarn: MAKER_WARN_CLASS,
            }}
            className={cn("w-full max-w-full p-0 [--cell-size:2.25rem]", CALENDAR_BUTTON_OVERRIDE)}
            classNames={RESERVATION_CALENDAR_CLASS_NAMES}
          />
        </div>
        <p className="mt-2 text-[11px] font-medium tracking-ko text-text-subtle">
          재공유된 화면이라 날짜를 변경할 수 없어요. 초록색 칸이 예약 가능한 날짜예요.
        </p>
      </div>

      {hasMakerDates && (
        <div className="w-full max-w-full space-y-2 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-bold tracking-ko text-text-strong">
            메이커가 보낸 예약 가능 날짜
          </p>
          <ul className="space-y-2">
            {makerAvailableDates.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-bg p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold tracking-ko text-text-strong">
                    {makerItemDateLabel(item)}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold tracking-ko",
                      item.status === "closed"
                        ? "bg-surface text-text-subtle"
                        : item.status === "almost_full"
                          ? "bg-intent-warning-bg text-intent-warning"
                          : "bg-intent-success-bg text-intent-success",
                    )}
                  >
                    {makerItemStatusLabel(item)}
                  </span>
                </div>
                {item.eventTitle && (
                  <p className="mt-1 text-xs font-semibold tracking-ko text-text-strong">
                    {item.eventTitle}
                  </p>
                )}
                {item.eventDescription && (
                  <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                    {item.eventDescription}
                  </p>
                )}
                {item.memo && (
                  <p className="mt-1 text-[11px] font-medium tracking-ko text-text-subtle">
                    {item.memo}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="w-full max-w-full rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold tracking-ko text-text-strong">예약 인원</p>
        <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">{guestSummary}</p>
      </div>

      <button
        type="button"
        data-testid="cta-reservation-check"
        className={RESERVATION_PRIMARY_ENABLED}
        onClick={() => onCheckAvailability?.(readonlySelection)}
      >
        예약하기
      </button>

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
