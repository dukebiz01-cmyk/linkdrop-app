import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Phone,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { CardShell } from "@/components/cards/CardShell";
import type { CardConfig } from "@/components/cards/types";
import { WIZARD_PRIMARY_BUTTON_CLASS } from "@/components/create-wizard-button-styles";
import { StepBadge } from "@/components/create/StepBadge";
import {
  FACILITY_TARGET_OPTIONS,
  QUICK_TEMPLATES,
  RESERVATION_CELL_TONE,
  RESERVATION_DATE_STATUS_LABEL,
  RESERVATION_DATE_STATUS_OPTIONS,
  RESERVATION_DESTS,
  RESERVATION_TYPE_OPTIONS,
  buildMonthGrid,
  buildReservationCustomerMessage,
  formatReservationDate,
  isoForDay,
  makeSingleReservationItem,
  reservationButtonName,
  reservationCellStatusLabel,
  reservationPreviewHeadline,
  reservationStep3GateReason,
  reservationSummaryLine,
  thisWeekendIsos,
  todayIso,
  upcomingWeekdayIsos,
  type QuickTemplateId,
} from "@/components/create/step3/reservation-helpers";
import type {
  ReservationDateItem,
  ReservationDateStatus,
  Step3FieldState,
} from "@/components/create/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// 예약 Step 3 — 고객 미리보기 카드 (현재 state 로 라이브 갱신).
export function ReservationPreviewCard({ fields }: { fields: Step3FieldState }) {
  const placeName =
    fields.placeName.trim() ||
    (fields.facilityTarget === "직접 입력" && fields.facilityCustom.trim()
      ? fields.facilityCustom.trim()
      : "내 캠핑장·펜션");
  const headline = reservationPreviewHeadline(fields);
  const benefit = fields.reservationDates.map((d) => d.eventTitle).filter(Boolean)[0];
  const buttonName = fields.reservationDest
    ? reservationButtonName(fields.reservationDest)
    : "예약하기";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2563EB] bg-[#EFF6FF]/40 p-4 ring-1 ring-[#2563EB]/25">
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-2 py-0.5 text-[10px] font-semibold tracking-ko text-white">
        <Calendar className="size-3" strokeWidth={2} />
        공식 예약 안내
      </span>
      <p className="mt-3 text-sm font-semibold tracking-ko text-text-muted">{placeName}</p>
      <p className="mt-1 text-lg font-extrabold leading-snug tracking-ko text-text-strong">
        {headline}
      </p>
      {benefit ? (
        <p className="mt-1 text-sm font-medium tracking-ko text-[#2563EB]">{benefit}</p>
      ) : (
        <p className="mt-1 text-sm font-medium tracking-ko text-text-subtle">
          혜택·강조 문구를 더하면 더 눈에 띄어요
        </p>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <span className="flex min-h-[44px] items-center justify-center rounded-lg bg-[#2563EB] px-2 text-xs font-bold tracking-ko text-white">
          {buttonName}
        </span>
        <span className="flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-border bg-white px-2 text-xs font-semibold tracking-ko text-text-strong">
          <Phone className="size-3.5" strokeWidth={2} />
          전화 문의
        </span>
        <span className="flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-white px-2 text-xs font-semibold tracking-ko text-text-strong">
          길찾기
        </span>
      </div>
    </div>
  );
}

// 작은 칩 그리드 — 보조 선택용.
export function ReservationChipGrid({
  options,
  value,
  onSelect,
  cols = 3,
}: {
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  cols?: 2 | 3;
}) {
  return (
    <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={cn(
              "flex min-h-[44px] items-center justify-center gap-1 rounded-lg px-2 text-center text-xs font-semibold tracking-ko transition-colors",
              active
                ? "border-2 border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                : "border border-border bg-bg text-text-strong hover:border-text-muted",
            )}
          >
            {active && <Check className="size-3 shrink-0" strokeWidth={2.5} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// 캘린더 — 월간 그리드. 빈 칸 클릭 시 날짜 추가, 선택 칸 클릭 시 편집.
export function ReservationCalendar({
  fields,
  selectedIso,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  onDayClick,
}: {
  fields: Step3FieldState;
  selectedIso: string | null;
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayClick: (iso: string) => void;
}) {
  const cells = buildMonthGrid(viewYear, viewMonth);
  const today = todayIso();
  const byIso = new Map<string, ReservationDateItem>();
  for (const item of fields.reservationDates) {
    const iso = item.dates[0];
    if (iso) byIso.set(iso, item);
  }
  const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="rounded-2xl border border-border bg-bg p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="이전 달"
          className="flex size-11 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-text-muted"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
        </button>
        <p className="text-sm font-bold tracking-ko text-text-strong">
          {viewYear}년 {viewMonth + 1}월
        </p>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="다음 달"
          className="flex size-11 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-text-muted"
        >
          <ArrowLeft className="size-4 rotate-180" strokeWidth={2} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {weekdayLabels.map((w) => (
          <span
            key={w}
            className="py-1 text-center text-[11px] font-semibold tracking-ko text-text-subtle"
          >
            {w}
          </span>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <span key={`empty-${idx}`} aria-hidden />;
          const iso = isoForDay(viewYear, viewMonth, day);
          const item = byIso.get(iso);
          const isSelected = selectedIso === iso;
          const isPast = iso < today;
          // 과거 날짜는 비활성 — 이미 추가된 항목은 편집/삭제용으로 클릭을 허용.
          // 오늘(isPast === false)은 그대로 선택 가능.
          const isDisabled = isPast && !item;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDayClick(iso)}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-start gap-0.5 rounded-lg border p-1 text-center transition-colors",
                item
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : "border-border bg-bg hover:border-text-muted",
                isSelected && "ring-2 ring-[#2563EB] ring-offset-1",
                isDisabled && "cursor-not-allowed opacity-45 hover:border-border",
              )}
            >
              <span
                className={cn(
                  "text-xs font-bold tracking-ko",
                  item ? "text-[#2563EB]" : "text-text-strong",
                )}
              >
                {day}
              </span>
              {item && (
                <span
                  className={cn(
                    "rounded px-1 py-0.5 text-[10px] font-bold leading-none tracking-ko",
                    RESERVATION_CELL_TONE[item.status],
                  )}
                >
                  {reservationCellStatusLabel(item)}
                </span>
              )}
              {item?.eventTitle && (
                <span className="max-w-full truncate text-[9px] font-medium leading-tight tracking-ko text-text-muted">
                  {item.eventTitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
        빈자리를 눌러 표시하세요. 표시한 날짜를 다시 누르면 상태를 바꿀 수 있어요.
      </p>
    </div>
  );
}

// 날짜 설정 패널 — 캘린더에서 날짜를 누르면 열린다.
type DateSheetScope = "this" | "all" | "weekend";

export function ReservationDateSheet({
  iso,
  item,
  weekendIsos,
  onApply,
  onRemove,
  onClose,
}: {
  iso: string;
  item: ReservationDateItem | null;
  weekendIsos: string[];
  onApply: (
    patch: {
      status: ReservationDateStatus;
      remainingCount?: number;
      eventTitle?: string;
      memo?: string;
    },
    scope: DateSheetScope,
  ) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ReservationDateStatus>(item?.status ?? "available");
  const [remaining, setRemaining] = useState(
    item?.remainingCount ? String(item.remainingCount) : "",
  );
  const [eventTitle, setEventTitle] = useState(item?.eventTitle ?? "");
  const [memo, setMemo] = useState(item?.memo ?? "");
  const [scope, setScope] = useState<DateSheetScope>("this");

  function handleApply() {
    const parsed = parseInt(remaining, 10);
    onApply(
      {
        status,
        remainingCount:
          remaining.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
        eventTitle: eventTitle.trim() || undefined,
        memo: memo.trim() || undefined,
      },
      scope,
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#2563EB] bg-bg p-4 ring-1 ring-[#2563EB]/25">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-bold tracking-ko text-text-strong">
          {formatReservationDate(iso)} 설정
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex size-8 shrink-0 items-center justify-center text-text-subtle hover:text-text-muted"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div>
        <span className="text-xs font-semibold tracking-ko text-text-strong">상태</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {RESERVATION_DATE_STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "min-h-[44px] rounded-lg border px-3 text-xs font-semibold tracking-ko transition-colors",
                status === s
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                  : "border-border bg-bg text-text-strong hover:border-text-muted",
              )}
            >
              {RESERVATION_DATE_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-semibold tracking-ko text-text-strong">
          남은 자리·객실 (선택)
        </span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={remaining}
          onChange={(e) => setRemaining(e.target.value)}
          placeholder="예: 2"
          className="mt-2 h-12 rounded-lg"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold tracking-ko text-text-strong">
          혜택·강조 문구 (선택)
        </span>
        <Input
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value.slice(0, 30))}
          placeholder="예: 장작 1망 제공 / 수영장 운영 / 평일 할인"
          className="mt-2 h-12 rounded-lg"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold tracking-ko text-text-strong">짧은 메모 (선택)</span>
        <Input
          value={memo}
          onChange={(e) => setMemo(e.target.value.slice(0, 30))}
          placeholder="예: 반려견 동반 가능 / 2팀 한정 / 계곡 사이트"
          className="mt-2 h-12 rounded-lg"
        />
      </label>

      <div>
        <span className="text-xs font-semibold tracking-ko text-text-strong">적용 범위</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(
            [
              ["this", "이 날짜만 적용"],
              ["all", "선택한 날짜 모두 적용"],
              ["weekend", "이번 주말 적용"],
            ] as [DateSheetScope, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              disabled={id === "weekend" && weekendIsos.length === 0}
              className={cn(
                "min-h-[44px] rounded-lg border px-2 text-center text-[11px] font-semibold leading-tight tracking-ko transition-colors disabled:opacity-40",
                scope === id
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                  : "border-border bg-bg text-text-strong hover:border-text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {item && (
          <button
            type="button"
            onClick={onRemove}
            className="min-h-[44px] flex-1 rounded-lg border border-border bg-bg text-sm font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
          >
            날짜 빼기
          </button>
        )}
        <button
          type="button"
          onClick={handleApply}
          className="min-h-[44px] flex-1 rounded-lg bg-[#2563EB] text-sm font-semibold tracking-ko text-white"
        >
          적용하기
        </button>
      </div>
    </div>
  );
}

// 예약 목적 Step 3 — 캘린더 중심 화면. 캠핑장·펜션·글램핑 사장님용.
// WHY: 캘린더가 메인. 어떤 예약을 알릴지·시설·예약 버튼 연결은 보조.
export function Step3ReservationCards({
  fields,
  onFieldsChange,
  onReservationDatesChange,
  onNext,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  onReservationDatesChange: (
    updater: (prev: ReservationDateItem[]) => ReservationDateItem[],
  ) => void;
  onNext: () => void;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [placeInfoOpen, setPlaceInfoOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [perDateLinkOpen, setPerDateLinkOpen] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const weekendIsos = useMemo(() => thisWeekendIsos(), []);
  const selectedItem = selectedIso
    ? (fields.reservationDates.find((d) => d.dates[0] === selectedIso) ?? null)
    : null;
  const selectedDest = RESERVATION_DESTS.find((d) => d.id === fields.reservationDest) ?? null;
  const gateReason = reservationStep3GateReason(fields);

  // Card assembly — 섹션 #2 예약 유형. (Batch 3 — 향후 status 동적화 예정)
  const reservationTypeCardConfig: CardConfig = {
    id: "reservation_type",
    type: "purpose",
    required: true,
    enabled: true,
    position: 2,
    status: "needs_confirmation",
    data: {},
    label: "예약 유형",
  };

  // Card assembly — 섹션 #3 장소/객실 정보. (Batch 3 — 향후 status 동적화 예정)
  const placeCardConfig: CardConfig = {
    id: "place",
    type: "map",
    required: false,
    enabled: true,
    position: 3,
    status: "needs_confirmation",
    data: {},
    label: "장소/객실 정보",
  };

  // Card assembly — 섹션 #4 예약 캘린더. 선택 날짜가 있으면 completed.
  const calendarCardConfig: CardConfig = {
    id: "calendar",
    type: "calendar",
    required: true,
    enabled: true,
    position: 4,
    status: fields.reservationDates.length > 0 ? "completed" : "needs_confirmation",
    data: { dateCount: fields.reservationDates.length },
    label: "예약 날짜 설정",
  };

  // Card assembly — 섹션 #7 예약 버튼 연결. dest 선택 시 completed.
  const actionButtonCardConfig: CardConfig = {
    id: "action_button",
    type: "action_button",
    required: true,
    enabled: true,
    position: 7,
    status: fields.reservationDest ? "completed" : "needs_confirmation",
    data: { dest: fields.reservationDest, link: fields.bookingLink },
    label: "예약 버튼 연결",
  };

  // Card assembly — 섹션 #8 고객 메시지. AI 추천 메시지 카드 (ai_suggested).
  const messageCardConfig: CardConfig = {
    id: "message",
    type: "message",
    required: false,
    enabled: true,
    position: 8,
    status: "ai_suggested",
    data: { message: fields.shareMessage ?? "" },
    ai_suggested: true,
    label: "고객 메시지",
  };

  // Card assembly — 섹션 #6 빠른 입력 추천. AI 추천 카드.
  const quickTemplateCardConfig: CardConfig = {
    id: "quick_template",
    type: "message",
    required: false,
    enabled: true,
    position: 6,
    status: "ai_suggested",
    data: {},
    ai_suggested: true,
    label: "빠른 입력 추천",
  };

  // Card assembly — 섹션 #9 고급 설정. 필드 하나라도 입력되어 있으면 completed.
  const hasAdvancedData = Boolean(
    fields.checkInTime ||
      fields.checkOutTime ||
      fields.baseGuests ||
      fields.maxGuests ||
      fields.facilityDetail ||
      fields.cautionNote,
  );
  const advancedCardConfig: CardConfig = {
    id: "advanced",
    type: "hours",
    required: false,
    enabled: true,
    position: 9,
    status: hasAdvancedData ? "completed" : "ai_suggested",
    data: { advancedOpen },
    ai_suggested: !hasAdvancedData,
    label: "고급 설정",
  };

  // 날짜를 누르면 설정 시트가 캘린더 아래에 열린다 — 시트 상단이 보이도록 스크롤한다.
  // WHY: block:"start" 로 시트 제목부터 노출 — 하단 고정 CTA 에 시트가 가리지 않도록.
  useEffect(() => {
    if (selectedIso) {
      sheetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedIso]);

  // stay 템플릿 안전망 — fields.reservationType 이 비어 있으면 실제 fields 에 기본값 주입.
  // createEmptyStep3Fields 의 default 가 어떤 이유로든 통과 안 된 경우에도 게이트가 막히지 않게.
  // WHY: gate fallback 이 아니라 진짜 state 에 써야 active 칩 표시·debug 표시·gate 가 모두 일치한다.
  useEffect(() => {
    if (fields.reservationVertical === "stay" && !fields.reservationType) {
      onFieldsChange({ reservationType: "빈자리/취소자리" });
    }
  }, [fields.reservationVertical, fields.reservationType, onFieldsChange]);

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }
  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  // 캘린더 칸 클릭 — 빈 날이면 날짜 추가, 이미 선택된 날이면 해제.
  // WHY: 같은 날짜를 다시 누르면 reservationDates 에서 제거하고 편집 시트도 닫는다.
  //      편집은 "선택한 날짜" 목록의 "수정" 버튼으로 진입한다.
  function handleDayClick(iso: string) {
    const exists = fields.reservationDates.some((d) => d.dates[0] === iso);
    if (exists) {
      onReservationDatesChange((prev) => prev.filter((d) => d.dates[0] !== iso));
      setSelectedIso(null);
      return;
    }
    onReservationDatesChange((prev) => [...prev, makeSingleReservationItem(iso)]);
    setSelectedIso(iso);
  }

  // 날짜 설정 패널 적용 — 적용 범위에 따라 한 날짜/전체/주말에 patch.
  function applyDateSheet(
    patch: {
      status: ReservationDateStatus;
      remainingCount?: number;
      eventTitle?: string;
      memo?: string;
    },
    scope: DateSheetScope,
  ) {
    onReservationDatesChange((prev) => {
      const targets =
        scope === "all"
          ? new Set(prev.map((d) => d.dates[0]))
          : scope === "weekend"
            ? new Set(weekendIsos)
            : new Set(selectedIso ? [selectedIso] : []);
      let next = prev.map((d) =>
        targets.has(d.dates[0])
          ? {
              ...d,
              status: patch.status,
              remainingCount: patch.remainingCount,
              eventTitle: patch.eventTitle,
              memo: patch.memo,
            }
          : d,
      );
      // 주말 적용인데 주말 날짜가 아직 없으면 새로 추가한다.
      if (scope === "weekend") {
        const have = new Set(next.map((d) => d.dates[0]));
        for (const iso of weekendIsos) {
          if (!have.has(iso)) {
            next = [
              ...next,
              makeSingleReservationItem(iso, {
                status: patch.status,
                remainingCount: patch.remainingCount,
                eventTitle: patch.eventTitle,
                memo: patch.memo,
              }),
            ];
          }
        }
      }
      return next;
    });
    setSelectedIso(null);
  }

  function removeSelectedDate() {
    if (!selectedIso) return;
    onReservationDatesChange((prev) => prev.filter((d) => d.dates[0] !== selectedIso));
    setSelectedIso(null);
  }

  // 빠른 입력 템플릿 적용.
  function applyQuickTemplate(id: QuickTemplateId) {
    if (id === "weekend_cancel") {
      const count =
        typeof window !== "undefined"
          ? window.prompt("이번 주말 남은 자리(팀) 수를 입력하세요", "2")
          : "2";
      const parsed = count ? parseInt(count, 10) : NaN;
      const remainingCount = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      onReservationDatesChange((prev) => {
        const have = new Set(prev.map((d) => d.dates[0]));
        const next = prev.map((d) =>
          weekendIsos.includes(d.dates[0])
            ? { ...d, status: "few_left" as ReservationDateStatus, remainingCount }
            : d,
        );
        for (const iso of weekendIsos) {
          if (!have.has(iso)) {
            next.push(makeSingleReservationItem(iso, { status: "few_left", remainingCount }));
          }
        }
        return next;
      });
      return;
    }
    if (id === "weekday_open") {
      const isos = upcomingWeekdayIsos();
      onReservationDatesChange((prev) => {
        const have = new Set(prev.map((d) => d.dates[0]));
        const next = [...prev];
        for (const iso of isos) {
          if (!have.has(iso)) {
            next.push(makeSingleReservationItem(iso, { status: "available" }));
          }
        }
        return next;
      });
      return;
    }
    if (id === "pension_one") {
      onReservationDatesChange((prev) =>
        prev.map((d, i) =>
          i === prev.length - 1
            ? { ...d, status: "few_left" as ReservationDateStatus, remainingCount: 1 }
            : d,
        ),
      );
      return;
    }
    if (id === "group_ok") {
      onReservationDatesChange((prev) =>
        prev.map((d) => ({ ...d, status: "inquiry" as ReservationDateStatus })),
      );
      return;
    }
    const benefit = id === "pool" ? "수영장 운영" : "장작 쿠폰 제공";
    if (selectedIso) {
      onReservationDatesChange((prev) =>
        prev.map((d) => (d.dates[0] === selectedIso ? { ...d, eventTitle: benefit } : d)),
      );
    } else {
      onReservationDatesChange((prev) =>
        prev.map((d, i) => (i === prev.length - 1 ? { ...d, eventTitle: benefit } : d)),
      );
    }
  }

  // 공용 카드 구조 — 업종(reservationVertical)별 분기. 이번 작업은 stay 만 구현하고,
  // 그 외 업종은 다음 단계에서 세부 설정을 지원한다(fallback). stay 흐름은 그대로 유지.
  if (fields.reservationVertical !== "stay") {
    return (
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-2">
        <StepBadge n={3} />
        <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">
          예약 캘린더를 설정해 주세요
        </h1>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm font-medium leading-relaxed tracking-ko text-text-muted">
            이 예약 유형은 다음 단계에서 세부 설정을 지원합니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    // min-h-0 — flex 자식이 콘텐츠 높이로 커지지 않게 해 본문이 내부 스크롤되도록 한다.
    //          이게 없으면 페이지 전체가 스크롤되고 sticky 하단 CTA 가 본문을 덮는다.
    <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-2">
      <StepBadge n={3} />
      <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">
        예약 캘린더를 설정해 주세요
      </h1>
      <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
        고객에게 보여줄 날짜, 남은 자리, 혜택, 예약 버튼을 캘린더에서 표시합니다.
      </p>

      <div className="mt-6 space-y-6">
        {/* 1. 라이브 고객 미리보기 */}
        <ReservationPreviewCard fields={fields} />

        {/* 2. 어떤 예약을 알릴까요 — 보조 */}
        <CardShell config={reservationTypeCardConfig}>
          <p className="text-sm font-semibold tracking-ko text-text-strong">
            어떤 예약을 알릴까요?
          </p>
          <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
            가장 가까운 종류를 골라주세요.
          </p>
          <div className="mt-3">
            <ReservationChipGrid
              options={RESERVATION_TYPE_OPTIONS}
              value={fields.reservationType}
              onSelect={(v) => onFieldsChange({ reservationType: v })}
            />
          </div>
        </CardShell>

        {/* 3. 어느 사이트/객실 — 보조 */}
        <CardShell config={placeCardConfig}>
          <p className="text-sm font-semibold tracking-ko text-text-strong">
            어느 사이트/객실인가요?
          </p>
          <div className="mt-3">
            <ReservationChipGrid
              options={FACILITY_TARGET_OPTIONS}
              value={fields.facilityTarget}
              onSelect={(v) => onFieldsChange({ facilityTarget: v })}
            />
          </div>
          {fields.facilityTarget === "직접 입력" && (
            <Input
              value={fields.facilityCustom}
              onChange={(e) => onFieldsChange({ facilityCustom: e.target.value })}
              placeholder="예: A구역 파쇄석 / 20평 펜션 / 단체 바비큐 객실"
              className="mt-2 h-12 rounded-lg"
            />
          )}
          <button
            type="button"
            onClick={() => setPlaceInfoOpen((v) => !v)}
            className="mt-3 text-xs font-semibold tracking-ko text-[#2563EB]"
          >
            {placeInfoOpen ? "시설 정보 닫기" : "시설 정보 수정"}
          </button>
          {placeInfoOpen && (
            <div className="mt-3 space-y-3 rounded-2xl border border-border bg-surface p-4">
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">장소명</span>
                <Input
                  value={fields.placeName}
                  onChange={(e) => onFieldsChange({ placeName: e.target.value })}
                  placeholder="예: 모래재 캠핑장"
                  className="mt-2 h-11 rounded-lg"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">주소</span>
                <Input
                  value={fields.placeAddress}
                  onChange={(e) => onFieldsChange({ placeAddress: e.target.value })}
                  placeholder="도로명 주소"
                  className="mt-2 h-11 rounded-lg"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">전화번호</span>
                <Input
                  type="tel"
                  value={fields.placePhone}
                  onChange={(e) => onFieldsChange({ placePhone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="mt-2 h-11 rounded-lg"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  지도 링크 (선택)
                </span>
                <Input
                  type="url"
                  value={fields.placeMapUrl}
                  onChange={(e) => onFieldsChange({ placeMapUrl: e.target.value })}
                  placeholder="https://map.naver.com/..."
                  className="mt-2 h-11 rounded-lg"
                />
              </label>
            </div>
          )}
        </CardShell>

        {/* 4. 캘린더 — 메인 UI */}
        <CardShell config={calendarCardConfig}>
          <div className="flex items-center gap-2">
            <p className="text-base font-bold tracking-ko text-text-strong">예약 가능 날짜</p>
            <span className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold tracking-ko text-text-muted">
              선택 사항
            </span>
          </div>
          <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
            선택하지 않아도 예약 버튼만으로 진행할 수 있어요.
          </p>
          <div className="mt-3">
            <ReservationCalendar
              fields={fields}
              selectedIso={selectedIso}
              viewYear={viewYear}
              viewMonth={viewMonth}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              onDayClick={handleDayClick}
            />
          </div>

          {/* 5. 날짜 설정 패널 — 날짜 클릭 시에만 */}
          {selectedIso && (
            <div ref={sheetRef} className="mt-3">
              <ReservationDateSheet
                key={selectedIso}
                iso={selectedIso}
                item={selectedItem}
                weekendIsos={weekendIsos}
                onApply={applyDateSheet}
                onRemove={removeSelectedDate}
                onClose={() => setSelectedIso(null)}
              />
            </div>
          )}

          {/* 선택한 날짜 요약 — 캘린더 아래 목록. 행마다 "수정"(시트 열기) 과 "선택 해제"(삭제) 두 액션. */}
          {fields.reservationDates.length > 0 && (
            <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold tracking-ko text-text-strong">
                선택한 날짜 ({fields.reservationDates.length})
              </p>
              <ul className="mt-2 space-y-1">
                {[...fields.reservationDates]
                  .sort((a, b) => (a.dates[0] ?? "").localeCompare(b.dates[0] ?? ""))
                  .map((item) => (
                    <li key={item.id}>
                      <div className="flex w-full items-center gap-1 rounded-lg px-1 transition-colors hover:bg-bg">
                        <button
                          type="button"
                          onClick={() => setSelectedIso(item.dates[0] ?? null)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-1 py-2 text-left text-xs font-medium tracking-ko text-text-strong"
                        >
                          <span className="min-w-0 truncate">{reservationSummaryLine(item)}</span>
                          <span className="shrink-0 text-[11px] font-semibold text-[#2563EB]">
                            수정
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onReservationDatesChange((prev) => prev.filter((d) => d.id !== item.id))
                          }
                          aria-label="이 날짜 선택 해제"
                          className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg hover:text-intent-danger"
                        >
                          <X className="size-4" strokeWidth={2} />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </CardShell>

        {/* 6. 빠른 입력 템플릿 — 작게 */}
        <CardShell
          config={quickTemplateCardConfig}
          onDismiss={() => {
            /* placeholder */
          }}
        >
          <p className="text-xs font-semibold tracking-ko text-text-subtle">빠른 입력</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyQuickTemplate(t.id)}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-border bg-bg px-3 text-xs font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
              >
                <Plus className="size-3" strokeWidth={2} />
                {t.label}
              </button>
            ))}
          </div>
        </CardShell>

        {/* 7. 예약 버튼 연결 */}
        <CardShell config={actionButtonCardConfig}>
          <p className="text-base font-bold tracking-ko text-text-strong">
            예약 버튼은 어디로 연결할까요?
          </p>
          <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
            고객이 버튼을 누르면 이동할 곳을 정하세요.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {RESERVATION_DESTS.map((dest) => {
              const active = fields.reservationDest === dest.id;
              return (
                <li key={dest.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onFieldsChange({
                        reservationDest: dest.id,
                        bookingLink: dest.id === "phone" ? fields.placePhone : "",
                      })
                    }
                    className={cn(
                      "flex min-h-[44px] w-full items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-semibold tracking-ko transition-colors",
                      active
                        ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#2563EB]/25"
                        : "border-border bg-bg text-text-strong hover:border-text-muted",
                    )}
                  >
                    {dest.label}
                  </button>
                </li>
              );
            })}
          </ul>
          {selectedDest?.inputLabel && (
            <label className="mt-3 block">
              <span className="text-xs font-semibold tracking-ko text-text-strong">
                {selectedDest.inputLabel}
              </span>
              <Input
                type={selectedDest.inputType}
                value={fields.bookingLink}
                onChange={(e) => onFieldsChange({ bookingLink: e.target.value })}
                placeholder={selectedDest.placeholder}
                className="mt-2 h-12 rounded-lg"
              />
            </label>
          )}
          {fields.reservationDest && (
            <p className="mt-2 text-xs font-medium tracking-ko text-text-muted">
              버튼 이름: {reservationButtonName(fields.reservationDest)}
            </p>
          )}
          {selectedDest && selectedDest.kind !== "link" && (
            <p className="mt-2 text-xs font-medium tracking-ko text-intent-warning">
              전화/문자 문의는 Phase 2 에서 지원 예정 — 지금은 받는 사람 화면 버튼이 비활성으로
              표시됩니다.
            </p>
          )}
          <button
            type="button"
            onClick={() => setPerDateLinkOpen((v) => !v)}
            className="mt-3 text-xs font-semibold tracking-ko text-[#2563EB]"
          >
            {perDateLinkOpen ? "날짜별 링크 닫기" : "날짜별 예약 링크 다르게 설정하기"}
          </button>
          {perDateLinkOpen && (
            <div className="mt-2 rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-medium leading-relaxed tracking-ko text-text-muted">
                날짜마다 다른 예약 링크가 필요하면 Drop을 만든 뒤 수정에서 날짜별로 연결할 수
                있어요. 지금은 위에서 고른 한 곳으로 모든 날짜가 연결됩니다.
              </p>
            </div>
          )}
        </CardShell>

        {/* 8. 고객 메시지 */}
        <CardShell
          config={messageCardConfig}
          onDismiss={() => onFieldsChange({ shareMessage: "" })}
        >
          <p className="text-base font-bold tracking-ko text-text-strong">
            고객에게 보낼 문구를 확인해 주세요
          </p>
          <textarea
            ref={messageRef}
            value={fields.shareMessage}
            onChange={(e) => onFieldsChange({ shareMessage: e.target.value.slice(0, 200) })}
            rows={4}
            placeholder="예: 이번 주말 취소자리 2팀 나왔어요. 장작 1망 무료로 드려요."
            className="mt-3 block w-full resize-none rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                onFieldsChange({ shareMessage: buildReservationCustomerMessage(fields) })
              }
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-bg text-xs font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
            >
              <Sparkles className="size-3.5" strokeWidth={2} />
              문구 다시 만들기
            </button>
            <button
              type="button"
              onClick={() => messageRef.current?.focus()}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-border bg-bg text-xs font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
            >
              수정하기
            </button>
          </div>
        </CardShell>

        {/* 9. 더 자세히 만들기 — 접힘 기본 */}
        <CardShell config={advancedCardConfig}>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-border bg-bg px-4 text-sm font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
          >
            공식 예약 안내를 더 자세히 만들기
            <Plus
              className={cn("size-4 transition-transform", advancedOpen && "rotate-45")}
              strokeWidth={2}
            />
          </button>
          {advancedOpen && (
            <div className="mt-3 space-y-3 rounded-2xl border border-border bg-surface p-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-semibold tracking-ko text-text-strong">
                    입실 시간
                  </span>
                  <Input
                    type="time"
                    value={fields.checkInTime}
                    onChange={(e) => onFieldsChange({ checkInTime: e.target.value })}
                    className="mt-2 h-11 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold tracking-ko text-text-strong">
                    퇴실 시간
                  </span>
                  <Input
                    type="time"
                    value={fields.checkOutTime}
                    onChange={(e) => onFieldsChange({ checkOutTime: e.target.value })}
                    className="mt-2 h-11 rounded-lg"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-semibold tracking-ko text-text-strong">
                    기준 인원
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={fields.baseGuests}
                    onChange={(e) => onFieldsChange({ baseGuests: e.target.value })}
                    placeholder="예: 4"
                    className="mt-2 h-11 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold tracking-ko text-text-strong">
                    최대 인원
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={fields.maxGuests}
                    onChange={(e) => onFieldsChange({ maxGuests: e.target.value })}
                    placeholder="예: 6"
                    className="mt-2 h-11 rounded-lg"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  반려견 가능 여부
                </span>
                <div className="mt-2 flex gap-2">
                  {[
                    [true, "가능"],
                    [false, "불가"],
                  ].map(([val, label]) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => onFieldsChange({ petAllowed: val as boolean })}
                      className={cn(
                        "min-h-[44px] flex-1 rounded-lg border text-xs font-semibold tracking-ko transition-colors",
                        fields.petAllowed === val
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                          : "border-border bg-bg text-text-strong hover:border-text-muted",
                      )}
                    >
                      {label as string}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  객실/사이트 상세 설명
                </span>
                <textarea
                  value={fields.facilityDetail}
                  onChange={(e) => onFieldsChange({ facilityDetail: e.target.value })}
                  rows={2}
                  placeholder="예: 파쇄석 바닥, 전기 사용 가능, 계곡 바로 앞"
                  className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">주의사항</span>
                <textarea
                  value={fields.cautionNote}
                  onChange={(e) => onFieldsChange({ cautionNote: e.target.value })}
                  rows={2}
                  placeholder="예: 밤 10시 이후 정숙, 화기 사용 주의"
                  className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  쿠폰 사용 조건
                </span>
                <Input
                  value={fields.couponCondition}
                  onChange={(e) => onFieldsChange({ couponCondition: e.target.value })}
                  placeholder="예: 평일 예약 시 장작 1망 제공"
                  className="mt-2 h-11 rounded-lg"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  행사/이벤트 상세
                </span>
                <textarea
                  value={fields.eventDetail}
                  onChange={(e) => onFieldsChange({ eventDetail: e.target.value })}
                  rows={2}
                  placeholder="예: 토요일 저녁 7시 물놀이, 8시 마술쇼"
                  className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  운영자 메모 (고객 비공개)
                </span>
                <Input
                  value={fields.operatorNote}
                  onChange={(e) => onFieldsChange({ operatorNote: e.target.value })}
                  placeholder="예: 단골 손님 우선 안내"
                  className="mt-2 h-11 rounded-lg"
                />
              </label>
            </div>
          )}
        </CardShell>

        {/* CTA 게이트 문구 — 첫 미충족 조건 안내 */}
        <div
          className={cn(
            "rounded-2xl border p-4",
            gateReason
              ? "border-intent-warning/30 bg-intent-warning-bg"
              : "border-intent-success/30 bg-intent-success-bg",
          )}
        >
          <p
            className={cn(
              "flex items-center gap-2 text-sm font-semibold tracking-ko",
              gateReason ? "text-intent-warning" : "text-intent-success",
            )}
          >
            {gateReason ? (
              <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
            ) : (
              <Check className="size-4 shrink-0" strokeWidth={2} />
            )}
            {gateReason ?? "다음으로"}
          </p>
        </div>

        {/* Step 3 CTA — fixed/sticky overlay 아님. 본문 흐름 안의 일반 블록 CTA로,
            모든 카드 아래에 위치한다. 스크롤 끝에서 보이며 콘텐츠를 덮지 않는다. */}
        <div className="space-y-3 pt-2">
          <ActionButton
            type="button"
            disabled={gateReason !== null}
            onClick={onNext}
            className={WIZARD_PRIMARY_BUTTON_CLASS}
          >
            다음
          </ActionButton>
        </div>
      </div>
    </main>
  );
}
