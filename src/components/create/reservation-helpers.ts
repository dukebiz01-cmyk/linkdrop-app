import type {
  PlaceCandidate,
  ReservationDateItem,
  ReservationDateStatus,
  ReservationSummary,
  Step3FieldState,
} from "@/components/create/types";

// 예약 목적 — 장소 검색 후보. searchPlaces 결과 단위.
// 장소 검색 API raw 결과 → PlaceCandidate 정규화.
// TODO: Naver Local Search 응답 스키마에 맞춰 필드 매핑 확정.
export function normalizePlaceResult(raw: {
  title?: string;
  address?: string;
  roadAddress?: string;
  telephone?: string;
  link?: string;
}): PlaceCandidate {
  return {
    name: (raw.title ?? "").replace(/<[^>]+>/g, "").trim(),
    address: (raw.roadAddress || raw.address || "").trim(),
    phone: (raw.telephone ?? "").trim(),
    mapUrl: raw.link ?? "",
    source: "네이버 지역검색",
  };
}

// 장소명으로 장소 후보를 검색한다.
// TODO: /api/place-search (Naver Local Search) 연동. 현재는 API 미연결이라
//       빈 결과를 반환한다 — 더미 리스트로 대체하지 않으며, 호출부는 빈 결과 시
//       직접 입력 fallback 을 노출한다.
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  // TODO: const res = await fetch(`/api/place-search?q=${encodeURIComponent(trimmed)}`);
  //       const json = (await res.json()) as { items?: unknown[] };
  //       return (json.items ?? []).map((it) => normalizePlaceResult(it as never));
  return [];
}

// 예약 목적 — 받는 사람이 누를 예약 버튼의 연결 목적지 선택지.
// kind 는 버튼 이름 자동 결정용 (link→예약하기 / phone→전화 문의 / sms→문자 문의 / kakao→카카오톡 문의 / none→문의하기).
export type ReservationDestKind = "link" | "phone" | "sms" | "kakao" | "none";

export const RESERVATION_DESTS: {
  id: string;
  label: string;
  inputLabel: string | null;
  placeholder: string;
  inputType: string;
  kind: ReservationDestKind;
}[] = [
  {
    id: "naver",
    label: "네이버 예약",
    inputLabel: "네이버 예약 링크 주소",
    placeholder: "https://booking.naver.com/...",
    inputType: "url",
    kind: "link",
  },
  {
    // 자체 예약 — 캠핏·땡큐캠핑·홈페이지 등 외부 예약 링크를 모두 포함한다.
    id: "self",
    label: "자체 예약",
    inputLabel: "예약 링크 주소 (캠핏·땡큐캠핑·홈페이지 등)",
    placeholder: "https://...",
    inputType: "url",
    kind: "link",
  },
  {
    id: "phone",
    label: "전화 문의",
    inputLabel: "전화번호",
    placeholder: "010-0000-0000",
    inputType: "tel",
    kind: "phone",
  },
  {
    id: "sms",
    label: "문자 문의",
    inputLabel: "휴대폰 번호",
    placeholder: "010-0000-0000",
    inputType: "tel",
    kind: "sms",
  },
];

// 예약 버튼 연결 종류 → 받는 사람 화면의 예약 버튼 이름.
export function reservationButtonName(destId: string): string {
  const dest = RESERVATION_DESTS.find((d) => d.id === destId);
  if (!dest) return "문의하기";
  switch (dest.kind) {
    case "link":
      return "예약하기";
    case "phone":
      return "전화 문의";
    case "sms":
      return "문자 문의";
    case "kakao":
      return "카카오톡 문의";
    default:
      return "문의하기";
  }
}

// 예약 가능 날짜 상태 → 한글 라벨.
export const RESERVATION_DATE_STATUS_LABEL: Record<ReservationDateStatus, string> = {
  available: "예약 가능",
  few_left: "잔여 자리",
  almost_full: "마감 임박",
  closed: "마감",
  inquiry: "문의 필요",
};

export const RESERVATION_DATE_STATUS_OPTIONS: ReservationDateStatus[] = [
  "available",
  "few_left",
  "almost_full",
  "closed",
  "inquiry",
];

// "2026-05-24" → "5월 24일 토". 파싱 실패 시 원본 반환.
export function formatReservationDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`;
}

// 날짜 항목 고유 id.
export function makeReservationDateId(): string {
  return `rd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 메이커 예약 가능 날짜 → 공유 URL 전달용 base64url(JSON) 인코딩.
// WHY: DB 영속화 없이 reservationDates 를 /d 수신자 화면 달력까지 전달한다.
//      디코더는 src/lib/public-drop-page.tsx 의 decodeReservationDates.
export function encodeReservationDates(items: ReservationDateItem[]): string {
  if (items.length === 0) return "";
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(items));
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "";
  }
}

// 기간 박 수 — endDate - startDate(일). 잘못된 입력이면 0.
export function reservationRangeNights(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  return Math.round((e - s) / 86_400_000);
}

// "2026-05-18","2026-05-20" → "5월 18일~20일" (같은 달이면 끝은 일자만).
export function formatReservationRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${start}~${end}`;
  const sm = s.getMonth() + 1;
  const em = e.getMonth() + 1;
  const endPart = sm === em ? `${e.getDate()}일` : `${em}월 ${e.getDate()}일`;
  return `${sm}월 ${s.getDate()}일~${endPart}`;
}

// ["2026-05-18","2026-05-21"] → "5월 18일, 21일" (달이 바뀔 때만 달 표기).
export function formatReservationDateList(dates: string[]): string {
  let lastMonth = -1;
  return dates
    .map((iso) => {
      const d = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(d.getTime())) return iso;
      const m = d.getMonth() + 1;
      const part = m === lastMonth ? `${d.getDate()}일` : `${m}월 ${d.getDate()}일`;
      lastMonth = m;
      return part;
    })
    .join(", ");
}

// 날짜 항목의 날짜 부분 라벨.
export function reservationItemDateLabel(item: ReservationDateItem): string {
  if (item.mode === "range" && item.startDate && item.endDate) {
    return formatReservationRange(item.startDate, item.endDate);
  }
  if (item.mode === "multiple") return formatReservationDateList(item.dates);
  return item.dates[0] ? formatReservationDate(item.dates[0]) : "";
}

// 날짜 항목의 기간 부분 라벨 — "1박 가능" / "N박 가능" / "선택 가능".
export function reservationItemSpanLabel(item: ReservationDateItem): string {
  if (item.mode === "range") {
    const n = item.nights ?? 0;
    return n > 0 ? `${n}박 가능` : "기간 가능";
  }
  if (item.mode === "multiple") return "선택 가능";
  return "1박 가능";
}

// 날짜 항목의 상태 부분 라벨 — few_left + 잔여수면 "잔여 N자리".
export function reservationItemStatusLabel(item: ReservationDateItem): string {
  if (item.status === "few_left" && item.remainingCount && item.remainingCount > 0) {
    return `잔여 ${item.remainingCount}자리`;
  }
  return RESERVATION_DATE_STATUS_LABEL[item.status];
}

// 날짜 항목 한 줄 라벨 — "5월 24일 토 · 1박 가능 · 잔여 2자리".
export function reservationItemFullLabel(item: ReservationDateItem): string {
  return [
    reservationItemDateLabel(item),
    reservationItemSpanLabel(item),
    reservationItemStatusLabel(item),
  ]
    .filter(Boolean)
    .join(" · ");
}

// 예약 URL 정규화 — 사용자가 "https://" 없이 "booking.naver.com/x" 처럼 입력해도
// 받는 사람 화면의 new URL() 파싱이 성공하도록 https:// 를 prepend 한다.
// 이미 http(s) 가 있으면 그대로 유지. 빈/공백은 빈 문자열 반환.
export function normalizeReservationUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// 예약 Step 3 입력값 → ReservationSummary (Step 4/5·공유 데이터로 전달).
export function buildReservationSummary(fields: Step3FieldState): ReservationSummary {
  const dest = RESERVATION_DESTS.find((d) => d.id === fields.reservationDest) ?? null;
  const destValue = fields.bookingLink.trim();
  return {
    placeName: fields.placeName.trim(),
    placeAddress: fields.placeAddress.trim(),
    placePhone: fields.placePhone.trim(),
    placeMapUrl: fields.placeMapUrl.trim(),
    destKind: fields.reservationDest,
    destLabel: dest?.label ?? "",
    destValue,
    // 예약 버튼: 연결 방식만 골랐으면 노출. URL·번호 값(bookingLink)은 선택 사항이며
    // 메이커가 나중에 채울 수 있다. Step 4/5 미리보기는 dest 선택을 기준으로 판단한다.
    hasReserveButton: Boolean(dest),
    hasPhoneButton: fields.placePhone.trim().length > 0,
    hasMapButton: fields.placeMapUrl.trim().length > 0,
    dates: fields.reservationDates,
  };
}

// =============================================================================
// 예약 목적 Step 3 — 캘린더 헬퍼
// =============================================================================

// 캘린더 1칸 — ISO 날짜 + 그날에 묶인 예약 가능 항목(없으면 미선택).
export function isoForDay(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// 오늘 ISO (로컬 기준).
export function todayIso(): string {
  const d = new Date();
  return isoForDay(d.getFullYear(), d.getMonth(), d.getDate());
}

// 이번 주(또는 다음 주) 토·일 ISO. 토요일이 지났으면 다음 주말.
export function thisWeekendIsos(): string[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dow = now.getDay(); // 0=일 ... 6=토
  // 이번 주 토요일까지 남은 일수. 토/일이면 다가오는 주말.
  let toSat = (6 - dow + 7) % 7;
  if (dow === 0) toSat = 6; // 일요일이면 다음 토요일
  const sat = new Date(now);
  sat.setDate(now.getDate() + toSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return [
    isoForDay(sat.getFullYear(), sat.getMonth(), sat.getDate()),
    isoForDay(sun.getFullYear(), sun.getMonth(), sun.getDate()),
  ];
}

// 앞으로 14일 내 평일(월~금) ISO 목록 (최대 5개).
export function upcomingWeekdayIsos(): string[] {
  const out: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 14 && out.length < 5; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      out.push(isoForDay(d.getFullYear(), d.getMonth(), d.getDate()));
    }
  }
  return out;
}

// 한 달 그리드 채우기 — 앞쪽 빈칸(null) + 1..말일.
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// 캘린더 칸에 표시할 짧은 상태 라벨 — few_left+잔여수면 "잔여 N".
export function reservationCellStatusLabel(item: ReservationDateItem): string {
  if (item.status === "few_left") {
    return item.remainingCount && item.remainingCount > 0 ? `잔여 ${item.remainingCount}` : "잔여";
  }
  // 좁은 7열 셀(≈40px)에 맞춰 2~3자 — 전체 라벨은 셀 아래 요약/설정 시트에서 본다.
  if (item.status === "available") return "가능";
  if (item.status === "almost_full") return "임박";
  if (item.status === "inquiry") return "문의";
  return "마감";
}

// 선택한 날짜 요약 한 줄 — "5/24 토 - 잔여 2팀, 장작 쿠폰". 캘린더 아래 목록용.
export function reservationSummaryLine(item: ReservationDateItem): string {
  const iso = item.dates[0] ?? "";
  const dt = new Date(`${iso}T00:00:00`);
  const wd = ["일", "월", "화", "수", "목", "금", "토"];
  const datePart = Number.isNaN(dt.getTime())
    ? iso
    : `${dt.getMonth() + 1}/${dt.getDate()} ${wd[dt.getDay()]}`;
  const statusPart =
    item.status === "few_left" && item.remainingCount && item.remainingCount > 0
      ? `잔여 ${item.remainingCount}팀`
      : RESERVATION_DATE_STATUS_LABEL[item.status];
  const extra = [statusPart, item.eventTitle].filter(Boolean).join(", ");
  return `${datePart} - ${extra}`;
}

// 캘린더 칸 상태별 색 — intent 토큰 chip 톤만 사용.
export const RESERVATION_CELL_TONE: Record<ReservationDateStatus, string> = {
  available: "bg-intent-success-bg text-intent-success",
  few_left: "bg-intent-warning-bg text-intent-warning",
  almost_full: "bg-intent-warning-bg text-intent-warning",
  inquiry: "bg-intent-info-bg text-intent-info",
  closed: "bg-surface text-text-subtle",
};

// 어떤 예약을 알릴지 — 빠른 템플릿 칩.
export const RESERVATION_TYPE_OPTIONS = [
  "빈자리/취소자리",
  "주말 예약",
  "펜션 객실",
  "단체 문의",
  "수영장/행사",
  "일반 예약",
];

// 어느 사이트/객실인지 — 시설 대상 옵션.
export const FACILITY_TARGET_OPTIONS = [
  "전체",
  "캠핑 사이트",
  "펜션 객실",
  "글램핑/카라반",
  "직접 입력",
];

// 빠른 입력 템플릿 — 캘린더 옆 작은 칩.
export type QuickTemplateId =
  | "weekend_cancel"
  | "weekday_open"
  | "pension_one"
  | "group_ok"
  | "pool"
  | "firewood";

export const QUICK_TEMPLATES: { id: QuickTemplateId; label: string }[] = [
  { id: "weekend_cancel", label: "이번 주말 취소자리" },
  { id: "weekday_open", label: "평일 빈자리" },
  { id: "pension_one", label: "펜션 객실 1개" },
  { id: "group_ok", label: "단체 문의 가능" },
  { id: "pool", label: "수영장 운영" },
  { id: "firewood", label: "장작 쿠폰 제공" },
];

// 캘린더 날짜 1건을 single 모드 ReservationDateItem 으로 만든다.
// WHY: 데이터 계약 — 캘린더 선택 날짜는 mode:"single", dates:[iso].
export function makeSingleReservationItem(
  iso: string,
  patch?: Partial<Omit<ReservationDateItem, "id" | "mode" | "dates">>,
): ReservationDateItem {
  return {
    id: makeReservationDateId(),
    mode: "single",
    dates: [iso],
    status: "available",
    ...patch,
  };
}

// reservationType + 선택 날짜 → 미리보기 헤드라인.
export function reservationPreviewHeadline(fields: Step3FieldState): string {
  const dates = fields.reservationDates;
  const fewLeft = dates.find((d) => d.status === "few_left");
  if (fewLeft && fields.reservationType.includes("주말")) {
    const n = fewLeft.remainingCount;
    return n && n > 0 ? `이번 주말 취소자리 ${n}팀` : "이번 주말 취소자리";
  }
  if (fewLeft) {
    const n = fewLeft.remainingCount;
    return n && n > 0 ? `남은 자리 ${n}팀` : "취소자리 안내";
  }
  if (dates.length > 0) {
    const first = dates
      .map((d) => d.dates[0])
      .filter(Boolean)
      .sort()[0];
    return first ? `${formatReservationDate(first)} 예약 받아요` : "예약 안내";
  }
  if (fields.reservationType) return `${fields.reservationType} 안내`;
  return "예약 안내";
}

// reservationType + 선택 날짜 → AI 고객 안내 문구.
export function buildReservationCustomerMessage(fields: Step3FieldState): string {
  const place = fields.placeName.trim() || "저희 캠핑장";
  const dates = [...fields.reservationDates].sort((a, b) =>
    (a.dates[0] ?? "").localeCompare(b.dates[0] ?? ""),
  );
  const dateText =
    dates.length > 0
      ? dates
          .slice(0, 3)
          .map((d) => (d.dates[0] ? formatReservationDate(d.dates[0]) : ""))
          .filter(Boolean)
          .join(", ")
      : "";
  const benefit = dates.map((d) => d.eventTitle).filter(Boolean)[0];
  const lines: string[] = [];
  lines.push(
    fields.reservationType
      ? `${place} ${fields.reservationType} 안내드려요.`
      : `${place} 예약 안내드려요.`,
  );
  if (dateText) lines.push(`${dateText} 예약 가능합니다.`);
  if (benefit) lines.push(`${benefit}`);
  lines.push("아래 버튼으로 바로 예약하거나 문의해 주세요.");
  return lines.join("\n");
}

// 예약 Step 3 — 첫 미충족 조건을 한국어로 반환. 모두 충족이면 null.
// WHY: canProceed() 와 동일한 규칙. CTA 게이트 문구와 진행 가능 여부를 한 곳에서 계산.
export function reservationStep3GateReason(fields: Step3FieldState): string | null {
  if (!fields.reservationType) return "어떤 예약을 알릴지 선택해 주세요";
  if (!fields.facilityTarget) return "사이트나 객실을 선택해 주세요";
  if (fields.facilityTarget === "직접 입력" && !fields.facilityCustom.trim()) {
    return "사이트나 객실을 선택해 주세요";
  }
  // 캘린더 날짜·날짜상태는 선택 사항이다. 비어 있어도 다음으로 진행 가능.
  // 예약 버튼 연결만 필수 — 날짜 없이도 예약 버튼만으로 흐름이 닫힌다.
  if (!fields.reservationDest) return "예약 버튼 연결을 선택해 주세요";
  return null;
}

export function canProceedReservationStep3(fields: Step3FieldState): boolean {
  return reservationStep3GateReason(fields) === null;
}
