import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Copy, MessageCircle, Check, Sparkles, ShieldCheck, Flag, Ticket, Gift } from "lucide-react";
import {
  AiPriceComparisonCard,
  type PriceOfferRow,
} from "@/components/ai-price-comparison-card";
import { ActionButton } from "@/components/ActionButton";
import { ErrorMessage } from "@/components/ErrorMessage";
import {
  WIZARD_PRIMARY_BUTTON_CLASS,
  WIZARD_SECONDARY_BUTTON_CLASS,
} from "@/components/create-wizard-button-styles";
import { PUBLIC_DROP_CTAS } from "@/components/public-drop-ctas";
import type { DropPurpose } from "@/lib/types";
import {
  MOCK_RESERVATION_CAMPGROUND_INFO,
  MOCK_RESERVATION_SECTION_GUIDE,
  type DropViewVariant,
  type ReservationCampgroundInfo,
} from "@/lib/mock-data";
import type {
  ReservationSecondaryAction,
  ReservationSelection,
} from "@/components/reservation-calendar-page";
import type { ReservationDateItem } from "@/components/create-drop-wizard";
import { YouTubeLiteEmbed } from "@/components/receiver/youtube-lite-embed";
import { parseVideoUrl } from "@/lib/video-metadata";
import { cn } from "@/lib/utils";
import { trackReceiverEvent } from "@/lib/event-tracking";
import {
  getBadgeLabel,
  getBadgeColor,
  type OfficialStatus,
} from "@/lib/helpers/drop-status";
import { AbuseReportSheet } from "@/components/abuse-report-sheet";

// ============================================================
// Types
// ============================================================

export type { DropViewVariant };

export interface InfoDropPageProps {
  videoThumbnailUrl: string;
  videoDurationSec: number;
  videoSourceLabel: "YouTube" | "Instagram";
  maker: { name: string; avatarUrl?: string; droppedAgo: string };
  makerMessage?: string;
  title: string;
  description: string;
  intent: "coupon" | "reservation" | "commerce" | "info" | "ticket" | "lead";
  /** v3 5목적 UI 분기 — purchase=구매(가격비교), lead=상담 폼 */
  variant?: DropViewVariant;
  productName?: string;
  brandGuess?: string;
  priceOffers?: PriceOfferRow[];
  local: {
    name: string;
    category: string;
    thumbnailUrl?: string;
    distance: string;
    address: string;
    statusLabel: string;
    phone?: string; // phase1-3: partners.contact_phone 연결
    hoursLabel?: string;
    rating?: number;
    reviewCount?: number;
    responseNote?: string;
    priceRange?: string;
  };
  creator: { channelName: string; channelUrl: string; avatarUrl?: string };
  /** AI 한 줄 요약 (없으면 description 사용) */
  aiSummary?: string;
  keyPoints?: string[];
  shareUrl?: string;
  /** 예약 목적 — 메이커가 보낸 예약 가능 날짜 (수신자 달력 마킹용). */
  reservationDates?: ReservationDateItem[];
  /**
   * 예약 목적 — 메이커가 설정한 예약 버튼 연결 URL.
   * 값이 있으면 "예약하기" CTA 활성, 클릭 시 onPrimaryAction 발화.
   * 빈 값/undefined 이면 CTA 비활성 + 안내 문구 노출.
   */
  reservationUrl?: string | null;
  /**
   * 재공유(re-share) 수신자 화면 여부. 부모 라우트가 URL 마커
   * (parentShareId · shareDepth · ref) 로 판별해 전달.
   * true 면 예약 캘린더가 read-only 카드로 전환된다.
   */
  isReshare?: boolean;
  /** 영상 원본 URL — youtube 인 경우 in-app embed 모달 활성 */
  videoSourceUrl?: string;
  onPrimaryAction?: () => void;
  onWatchOriginal?: () => void;
  onShare?: () => void;
  onCopyLink?: () => void | Promise<void>;
  onKakaoShare?: () => void | Promise<void>;
  onBack?: () => void;
  onSave?: () => void;
  onForward?: () => void;
  officialStatus: OfficialStatus;
  dropId: string;
  /** v7.1c — 매장별 예약 캘린더 연동용. 예약 드롭에서만 의미 있음 (정보 드롭 무관). */
  partnerId?: string | null;
  /** H1-d funnel — drop 의 partner active coupon (있으면). null/undefined 면 CTA 미노출.
   *  U1: 카드 표시용 conditions/valid_until 추가. id/title 외 옵셔널. */
  funnelCoupon?: {
    id: string;
    title: string;
    conditions?: { min_amount?: number; [k: string]: unknown } | null;
    valid_until?: string | null;
    coupon_type?: string | null;
    gift_item?: string | null;
  } | null;
  /** H1-d funnel — [예약 문의하고 쿠폰 받기] CTA 클릭. 부모가 로그인/폼/RPC 핸들 */
  onReserveAndClaim?: () => void;
}

const PURPOSE_CHIP_CLASS: Record<DropPurpose, string> = {
  정보: "bg-intent-info-bg text-intent-info",
  쿠폰: "bg-intent-warning-bg text-intent-warning",
  예약: "bg-intent-success-bg text-intent-success",
  구매: "bg-surface text-text-strong",
  상담: "bg-intent-danger-bg text-intent-danger",
};

/** variant별 공개 Drop 헤드라인 — mock title과 별도로 목적 UI 검증용. */
/** variant·CTA HTTP/Playwright 검증용 — UI/카피 변경 없음 */
const CTA_TEST_IDS: Record<DropViewVariant, Partial<Record<string, string>>> = {
  info: {},
  coupon: {
    coupon: "cta-coupon-save",
    "reserve-coupon": "cta-coupon-reserve",
  },
  reservation: {},
  purchase: {
    "price-compare": "cta-price-compare",
    seller: "cta-seller-link",
    share: "cta-purchase-share",
  },
  lead: {
    phone: "cta-lead-phone",
    sms: "cta-lead-sms",
    share: "cta-lead-share",
  },
};

function getCtaTestId(variant: DropViewVariant, ctaId: string): string | undefined {
  return CTA_TEST_IDS[variant]?.[ctaId];
}

/** v0 보조 공유 액션 — 예약 variant 하단 (Primary·Secondary보다 약함) */
const SHARE_ACTION_BUTTON_CLASS = cn(
  "inline-flex h-12 min-h-[48px] w-full min-w-0 items-center justify-center gap-1.5 rounded-xl",
  "border border-[#E5E7EB] bg-white px-2 text-sm font-semibold tracking-ko text-[#374151]",
  "transition-colors duration-150 hover:border-[#D4D4D4] hover:bg-[#FAFAFA]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2",
);

const VARIANT_PAGE_COPY: Record<
  DropViewVariant,
  { label: DropPurpose; sectionTitle: string; ctaHeading: string }
> = {
  info: {
    label: "정보",
    sectionTitle: "영상 핵심 정리",
    ctaHeading: "바로 실행하기",
  },
  coupon: {
    label: "쿠폰",
    sectionTitle: "혜택으로 손님 모으기",
    ctaHeading: "쿠폰 받기",
  },
  reservation: {
    label: "예약",
    sectionTitle: "날짜 선택과 예약 연결",
    ctaHeading: "예약 확인",
  },
  purchase: {
    label: "구매",
    sectionTitle: "AI 상품 찾기·가격비교",
    ctaHeading: "가격 비교",
  },
  lead: {
    label: "상담",
    sectionTitle: "문의·상담 받기",
    ctaHeading: "추가 문의",
  },
};

// ============================================================
// Helpers
// ============================================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function variantToIntent(variant: DropViewVariant): InfoDropPageProps["intent"] {
  const map: Record<DropViewVariant, InfoDropPageProps["intent"]> = {
    info: "info",
    coupon: "coupon",
    reservation: "reservation",
    purchase: "commerce",
    lead: "lead",
  };
  return map[variant];
}

function intentToVariant(intent: InfoDropPageProps["intent"]): DropViewVariant {
  if (intent === "commerce") return "purchase";
  if (intent === "lead") return "lead";
  if (intent === "coupon") return "coupon";
  if (intent === "reservation") return "reservation";
  return "info";
}

const DEFAULT_MAKER: InfoDropPageProps["maker"] = {
  name: "익명",
  droppedAgo: "방금 전",
};

const DEFAULT_LOCAL: InfoDropPageProps["local"] = {
  name: "매장",
  category: "공유된 정보",
  distance: "",
  address: "",
  statusLabel: "영업중",
  phone: "",
};

const DEFAULT_CREATOR: InfoDropPageProps["creator"] = {
  channelName: "채널",
  channelUrl: "#",
};

type ReservationCalendarProps = import("@/components/reservation-calendar-page").ReservationCalendarPageProps;

type SlotAvailableRow = {
  slot_date: string;
  slot_time: string | null;
  available: number;
};

/** react-day-picker — SSR 번들 로드 방지, 클라이언트에서만 동적 import */
function ReservationCalendarClient(props: {
  partnerName: string;
  campgroundInfo?: ReservationCampgroundInfo;
  makerAvailableDates?: ReservationDateItem[];
  readOnly?: boolean;
  /** v7.1 — 매장별 슬롯 가용일. partnerId 있으면 get_available_slots 호출해 modifier 로 표시. */
  partnerId?: string | null;
  onCheckAvailability?: (selection: ReservationSelection) => void;
  onSecondaryAction?: (action: ReservationSecondaryAction) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [Calendar, setCalendar] = useState<((p: ReservationCalendarProps) => React.JSX.Element) | null>(
    null,
  );
  const [partnerSlots, setPartnerSlots] = useState<SlotAvailableRow[]>([]);

  useEffect(() => {
    setMounted(true);
    import("@/components/reservation-calendar-page")
      .then((m) => setCalendar(() => m.ReservationCalendarPage))
      .catch((err) => console.error("[ReservationCalendarClient]", err));
  }, []);

  // v7.1 — partnerId 있을 때만 매장 슬롯 가용일 fetch (정보 드롭 회귀 0:
  // partnerId 가 undefined/null 이면 호출 자체 없음). 오늘 이후 행만 반환.
  useEffect(() => {
    if (!props.partnerId) return;
    let cancelled = false;
    (async () => {
      try {
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const { data, error } = await getSupabase().rpc("get_available_slots", {
          p_partner_id: props.partnerId,
          p_date: iso,
        });
        if (error) {
          console.error("[ReservationCalendarClient] get_available_slots failed:", error);
          return;
        }
        if (cancelled) return;
        const rows = (Array.isArray(data) ? data : []) as SlotAvailableRow[];
        // 자리 남은 슬롯만 표시 (available > 0). slot_time NULL = date_range 모드.
        setPartnerSlots(rows.filter((r) => r.available > 0));
      } catch (e) {
        console.error("[ReservationCalendarClient] fetch unexpected:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.partnerId]);

  const partnerSlotDates = useMemo(() => {
    return partnerSlots.map((r) => {
      const [y, m, d] = r.slot_date.split("-").map(Number);
      return new Date(y, m - 1, d);
    });
  }, [partnerSlots]);

  if (!mounted || !Calendar) {
    return (
      <section
        data-testid="variant-reservation"
        className="rounded-2xl border border-border bg-surface p-4"
      >
        <p className="text-sm font-medium text-text-subtle">예약 일정을 불러오는 중이에요.</p>
      </section>
    );
  }

  return (
    <section data-testid="variant-reservation" className="w-full max-w-full">
      <Calendar
        partnerName={props.partnerName}
        makerAvailableDates={props.makerAvailableDates}
        partnerSlotDates={partnerSlotDates}
        readOnly={props.readOnly}
        className="mx-0 mt-0 w-full max-w-full"
        onCheckAvailability={props.onCheckAvailability}
        onSecondaryAction={props.onSecondaryAction}
      />
    </section>
  );
}

// 예약 드롭 카드 탭 — [예약가능 캘린더 | 예약하기 | 쿠폰]. 정보 드롭은 기존 세로
// 구조 유지(이 컴포넌트 미사용). 빌링·자동차감 X 고지 = "예약하기" 탭에 1줄.
type ReservationTabKey = "calendar" | "reserve" | "coupon";

function ReservationCardTabs({
  hasCoupon,
  calendarPanel,
  reservePanel,
  couponPanel,
}: {
  hasCoupon: boolean;
  calendarPanel: React.ReactNode;
  reservePanel: React.ReactNode;
  couponPanel: React.ReactNode | null;
}) {
  const [tab, setTab] = useState<ReservationTabKey>("calendar");
  const tabs: { key: ReservationTabKey; label: string }[] = [
    { key: "calendar", label: "예약가능 캘린더" },
    { key: "reserve", label: "예약하기" },
  ];
  if (hasCoupon) tabs.push({ key: "coupon", label: "쿠폰" });

  // hasCoupon 이 false 가 되면 coupon 탭 선택을 calendar 로 되돌림.
  useEffect(() => {
    if (!hasCoupon && tab === "coupon") setTab("calendar");
  }, [hasCoupon, tab]);

  return (
    <section data-testid="reservation-tabs" className="space-y-4">
      <div
        role="tablist"
        aria-label="예약 카드 탭"
        className="flex gap-2 rounded-2xl border border-border bg-surface p-1"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`reservation-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 min-h-[44px] rounded-xl px-3 py-2 text-sm font-bold tracking-ko transition-colors",
                active
                  ? "bg-[#0A0A0A] text-white"
                  : "bg-transparent text-text-muted hover:text-text-strong",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        data-testid={`reservation-tabpanel-${tab}`}
        className="space-y-4"
      >
        {tab === "calendar" && calendarPanel}
        {tab === "reserve" && reservePanel}
        {tab === "coupon" && couponPanel}
      </div>
    </section>
  );
}

// WHY: 무로그인 lead 수집 — submitConsultationLead RPC는 Step 5 이후 연동.
function ConsultationLeadForm({ partnerName }: { partnerName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!name.trim() || !phone.trim() || !privacyAgreed) {
      setSubmitError("이름, 연락처, 개인정보 동의를 확인해 주세요.");
      return;
    }
    // TODO: Step 5 완료 후 submitConsultationLead({ dropId, name, phone, ... }) RPC로 교체
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section
        data-testid="variant-lead"
        className="rounded-2xl border border-border bg-intent-success-bg p-4"
      >
        <p className="text-sm font-semibold tracking-ko text-intent-success">
          상담 신청이 접수됐어요. 빠르게 연락드릴게요.
        </p>
      </section>
    );
  }

  return (
    <form
      data-testid="variant-lead"
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-4"
    >
      <h2 className="text-lg font-bold tracking-ko text-text-strong">상담 신청</h2>
      <p className="text-sm font-medium text-text-muted">{partnerName}</p>

      <label className="block">
        <span className="text-sm font-semibold text-text-strong">이름</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 block h-12 w-full rounded-lg border border-border bg-bg px-4 text-sm font-medium"
          placeholder="홍길동"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-text-strong">연락처</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-2 block h-12 w-full rounded-lg border border-border bg-bg px-4 text-sm font-medium"
          placeholder="010-0000-0000"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-text-strong">문의 내용</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium"
          placeholder="궁금한 점을 적어 주세요"
        />
      </label>
      <label className="flex items-start gap-2 text-sm font-medium text-text-muted">
        <input
          type="checkbox"
          checked={privacyAgreed}
          onChange={(e) => setPrivacyAgreed(e.target.checked)}
          className="mt-1 size-4 rounded border-border"
        />
        <span>개인정보 수집·이용에 동의합니다 (필수)</span>
      </label>
      <ErrorMessage message={submitError} />
      <ActionButton
        type="submit"
        data-testid="cta-lead-submit"
        className={cn("w-full", WIZARD_PRIMARY_BUTTON_CLASS)}
      >
        상담 신청하기
      </ActionButton>
    </form>
  );
}

// ============================================================
// Main Page Component — v3 무로그인 받은 사람 화면
// ============================================================

export function InfoDropPage({
  videoThumbnailUrl,
  videoDurationSec,
  videoSourceLabel,
  maker,
  makerMessage,
  title,
  description,
  intent,
  variant,
  productName,
  brandGuess,
  priceOffers,
  local,
  creator,
  aiSummary,
  keyPoints,
  shareUrl,
  funnelCoupon,
  onReserveAndClaim,
  reservationDates,
  reservationUrl,
  isReshare = false,
  videoSourceUrl,
  onPrimaryAction,
  onWatchOriginal,
  onShare,
  onCopyLink,
  onKakaoShare,
  officialStatus,
  dropId,
  partnerId,
}: InfoDropPageProps) {
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const parsedVideo = videoSourceUrl ? parseVideoUrl(videoSourceUrl) : null;
  const canEmbed = parsedVideo?.platform === "youtube";
  const isShorts = /\/shorts\//i.test(videoSourceUrl ?? "");

  const safeIntent = intent ?? "info";
  const resolvedVariant: DropViewVariant =
    variant && VARIANT_PAGE_COPY[variant] ? variant : intentToVariant(safeIntent);
  const pageCopy = VARIANT_PAGE_COPY[resolvedVariant] ?? VARIANT_PAGE_COPY.info;
  const purposeLabel = pageCopy.label;
  const safeMaker = {
    ...DEFAULT_MAKER,
    ...maker,
    name: maker?.name?.trim() || DEFAULT_MAKER.name,
  };
  const safeLocal = { ...DEFAULT_LOCAL, ...local, name: local?.name?.trim() || DEFAULT_LOCAL.name };
  const safeCreator = {
    ...DEFAULT_CREATOR,
    ...creator,
    channelName: creator?.channelName?.trim() || DEFAULT_CREATOR.channelName,
    channelUrl: creator?.channelUrl?.trim() || DEFAULT_CREATOR.channelUrl,
  };
  const safeTitle = title?.trim() || pageCopy.sectionTitle;
  const safeDescription = description?.trim() || "";
  const summaryLine = aiSummary?.trim() || safeDescription || pageCopy.sectionTitle;
  const points = keyPoints ?? [];
  // phase1-3: 전화번호 없는 매장 → phone/sms CTA 카드 숨김 (빈 tel: 노출 방지).
  // phase1 FIX: 활성 매장 쿠폰 없는 매장 → coupon/reserve-coupon CTA 카드 숨김
  //   (둘 다 funnelCoupon 기반 펀넬 시트 트리거이므로 funnelCoupon=null 이면 dead).
  const ctasRaw = PUBLIC_DROP_CTAS[resolvedVariant] ?? PUBLIC_DROP_CTAS.info;
  const hasPhone = Boolean(local?.phone?.trim());
  const hasFunnelCoupon = Boolean(funnelCoupon);
  const ctas = ctasRaw.filter((c) => {
    if ((c.id === "phone" || c.id === "sms") && !hasPhone) return false;
    if ((c.id === "coupon" || c.id === "reserve-coupon") && !hasFunnelCoupon) return false;
    return true;
  });
  const isReservation = resolvedVariant === "reservation";
  const reservationGuide = MOCK_RESERVATION_SECTION_GUIDE;
  const videoHeadline = isReservation ? safeTitle : pageCopy.sectionTitle;
  const safeThumb = videoThumbnailUrl?.trim() || "";
  const safeDuration = Number.isFinite(videoDurationSec) ? videoDurationSec : 0;
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  async function handleCopy() {
    setShareError(null);
    setCopyFeedback(null);
    if (onCopyLink) {
      await onCopyLink();
      setCopyFeedback("링크를 복사했어요.");
      return;
    }
    // 폴백 — 부모가 onCopyLink 를 주지 않으면 props.shareUrl(adapter가 만든 drop.how/{6자}
    // 단축 URL) 우선 사용. shareUrl 없을 때만 현재 페이지의 전체 URL(?r=, ?u= 포함)로 폴백.
    // B2-4: 재공유 흐름이 단축 URL을 거치게 하려면 shareUrl을 먼저 본다.
    const fallbackUrl =
      shareUrl ?? (typeof window !== "undefined" ? window.location.href : undefined);
    if (!fallbackUrl) return;
    try {
      await navigator.clipboard.writeText(fallbackUrl);
      setCopyFeedback("링크를 복사했어요.");
    } catch {
      setShareError("링크 복사에 실패했어요.");
    }
  }

  async function handleKakao() {
    setShareError(null);
    if (onKakaoShare) {
      await onKakaoShare();
      return;
    }
    onShare?.();
  }

  function handleCtaClick(ctaId: string) {
    if (ctaId === "copy-link") {
      void handleCopy();
      return;
    }
    if (ctaId === "share") {
      void handleKakao();
      return;
    }
    if (ctaId === "phone") {
      // phase1-3: mock 하드코딩 → 실제 partners.contact_phone. 번호 없으면 noop (빈 tel: 금지).
      const phoneRaw = safeLocal.phone?.replace(/[^0-9+]/g, "") ?? "";
      if (!phoneRaw) {
        console.warn("[InfoDropPage] phone CTA — partners.contact_phone 없음, noop");
        return;
      }
      trackReceiverEvent("phone_click", dropId);
      window.open(`tel:${phoneRaw}`, "_self");
      return;
    }
    if (ctaId === "sms") {
      // SMS는 별도 event_type 없음 — phone과 동일 트랙으로 흡수
      const phoneRaw = safeLocal.phone?.replace(/[^0-9+]/g, "") ?? "";
      if (!phoneRaw) {
        console.warn("[InfoDropPage] sms CTA — partners.contact_phone 없음, noop");
        return;
      }
      trackReceiverEvent("phone_click", dropId);
      window.open(`sms:${phoneRaw}`, "_self");
      return;
    }
    if (ctaId === "directions") {
      trackReceiverEvent("directions_click", dropId);
      const q = encodeURIComponent(safeLocal.address || safeLocal.name);
      window.open(`https://map.naver.com/v5/search/${q}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (ctaId === "price-compare") {
      document
        .querySelector('[data-testid="variant-purchase"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (ctaId === "seller" && resolvedVariant === "purchase") {
      onPrimaryAction?.();
      return;
    }
    if (ctaId === "coupon" || ctaId === "reserve-coupon") {
      // phase1 FIX: 둘 다 funnelCoupon 펀넬 시트(예약 INSERT + claim_coupon) 트리거.
      // onPrimaryAction(=네이버 reservation_url 핸드오프) 이 아니라 onReserveAndClaim
      // 으로 부른다. handleReserveAndClaim 이 funnelCoupon/userId 분기 + 로그인 폴백.
      onReserveAndClaim?.();
      return;
    }
    onPrimaryAction?.();
  }

  return (
    <div
      className={cn(
        "relative mx-auto min-h-screen w-full max-w-[480px] bg-white",
        // sticky 바 분리: 본문 inline footer 는 자연 스크롤, sticky 바 만 fixed.
        // sticky 바 = 12(pt) + 52(primary) + 12(pb) + safe-area ≈ 76px + safe-area.
        // 본문 마지막 ~ sticky 바 사이 안 겹치게 pb-[calc(5.5rem+safe-area)] (88px).
        // 정보/쿠폰 동일 (sticky 바 단일 버튼 1개).
        "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
      )}
      data-testid="public-drop-page"
      data-variant={resolvedVariant}
    >
      {/* 1. 상단 — 보낸 사람 */}
      <header className="px-6 pb-4 pt-8">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={safeMaker.avatarUrl} alt={safeMaker.name} />
            <AvatarFallback className="bg-surface text-sm font-semibold text-text-muted">
              {safeMaker.name.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
          <div>
            <p className="text-sm font-bold tracking-ko text-text-strong">
              {safeMaker.name}
              <span className="font-medium text-text-muted">님이 보냈어요</span>
            </p>
            <p className="text-xs font-medium tracking-ko text-text-subtle">
              LinkDrop으로 공유된 영상
            </p>
          </div>
          {(officialStatus === 'official' || officialStatus === 'user_shared') && (
            <div
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: getBadgeColor(officialStatus).bg,
                color: getBadgeColor(officialStatus).text,
                border: getBadgeColor(officialStatus).border
                  ? `0.5px solid ${getBadgeColor(officialStatus).border}`
                  : undefined,
              }}
            >
              {officialStatus === 'official' && (
                <ShieldCheck size={12} strokeWidth={2.5} />
              )}
              {getBadgeLabel(officialStatus)}
            </div>
          )}
        </div>
      </header>

      <div className="space-y-6 px-6" data-testid={`variant-${resolvedVariant}`}>
        {isReservation && (
          <section className="space-y-2" data-testid="reservation-header">
            <span
              className={cn(
                "inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold tracking-ko",
                PURPOSE_CHIP_CLASS[purposeLabel],
              )}
            >
              {pageCopy.label}
            </span>
            <h2 className="text-xl font-extrabold leading-snug tracking-ko text-text-strong">
              {pageCopy.sectionTitle}
            </h2>
            <p className="text-sm font-medium leading-relaxed tracking-ko text-text-muted">
              {reservationGuide}
            </p>
            <p className="text-xs font-medium text-text-subtle">{safeLocal.name}</p>
          </section>
        )}

        {/* 2. 영상 카드 — 유튜브: lite embed(facade→iframe), 그 외: 썸네일 + onWatchOriginal.
            세로(쇼츠) 영상은 max-h cap 으로 화면을 다 먹지 않게 (히어로 유지 + 하단
            CTA 도달성). 가로(16:9) 는 자연 비율이라 cap 영향 거의 없음. */}
        <section
          className={cn(
            "overflow-hidden rounded-2xl border border-border bg-bg",
            // 쇼츠(9:16) 만 width cap → 자식 aspect-[9/16] w-full 이 부모 width 따라
            // height 결정. 70vh × (9/16) ≈ 394px 폭이 viewport 높이 기준 cap.
            // (영상 전달력 우선 — primary CTA sticky 바로 분리해 도달성 별도 확보.)
            isShorts && "mx-auto w-full max-w-[calc(70vh*9/16)]",
          )}
        >
          {canEmbed && parsedVideo ? (
            <YouTubeLiteEmbed
              videoId={parsedVideo.videoId}
              thumbnailUrl={safeThumb}
              title={safeTitle}
              isShorts={isShorts}
              durationLabel={safeDuration > 0 ? formatDuration(safeDuration) : undefined}
              sourceLabel={videoSourceLabel}
            />
          ) : (
            <div className="relative aspect-video w-full bg-surface">
              <img src={safeThumb} alt={safeTitle} className="h-full w-full object-cover" />
              <span className="absolute right-3 top-3 rounded-lg bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
                {videoSourceLabel}
              </span>
              {safeDuration > 0 && (
                <span className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
                  {formatDuration(safeDuration)}
                </span>
              )}
              <button
                type="button"
                onClick={() => onWatchOriginal?.()}
                aria-label="영상 재생"
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-bg/95 shadow-soft">
                  <Play className="ml-0.5 size-6 fill-text-strong text-text-strong" strokeWidth={2} />
                </span>
              </button>
            </div>
          )}
          <div className="space-y-2 p-4">
            {!isReservation && (
              <span
                className={cn(
                  "inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold tracking-ko",
                  PURPOSE_CHIP_CLASS[purposeLabel],
                )}
              >
                {purposeLabel}
              </span>
            )}
            <h1 className="text-xl font-extrabold leading-snug tracking-ko text-text-strong">
              {videoHeadline}
            </h1>
            {!isReservation && (
              <p className="text-sm font-medium tracking-ko text-text-muted">{safeTitle}</p>
            )}
            <p className="text-xs font-medium text-text-subtle">{safeCreator.channelName}</p>
      </div>
        </section>

        {makerMessage && (
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium italic leading-relaxed tracking-ko text-text-muted">
            &quot;{makerMessage}&quot;
          </p>
        )}

        {/* 3. AI 요약 — 예약 variant는 캘린더 흐름에 집중 */}
        {!isReservation && (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" strokeWidth={2} />
              <h2 className="text-sm font-bold tracking-ko text-text-strong">AI 요약</h2>
            </div>
            <p className="mt-3 text-base font-semibold leading-relaxed tracking-ko text-text-strong">
              {summaryLine}
            </p>
            {points.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-border pt-4">
                {points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-strong"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 예약 드롭 카드 탭 — [예약가능 캘린더 | 예약하기 | 쿠폰]. 정보 드롭은 진입 X. */}
        {isReservation && (() => {
          const hasReservationDates =
            Array.isArray(reservationDates) && reservationDates.length > 0;
          const isGift = funnelCoupon?.coupon_type === "gift";
          const giftItem = funnelCoupon?.gift_item?.trim() || "";

          // v7.1 — partnerId 가 있으면 매장 슬롯 가용일도 표시(makerAvailableDates 와 공존).
          // makerAvailableDates 비어도 partnerId 있으면 캘린더 카드를 보여주어
          // 업주가 마킹한 날을 확인 가능.
          const showCalendar = hasReservationDates || Boolean(partnerId);
          const calendarPanel = showCalendar ? (
            <ReservationCalendarClient
              partnerName={safeLocal.name}
              campgroundInfo={MOCK_RESERVATION_CAMPGROUND_INFO}
              makerAvailableDates={reservationDates}
              partnerId={partnerId}
              readOnly={isReshare}
              onCheckAvailability={(_selection) => {
                if (!reservationUrl) return;
                const safe =
                  reservationUrl.startsWith("https://booking.naver.com") ||
                  reservationUrl.startsWith("https://naver.me") ||
                  reservationUrl.startsWith("tel:");
                if (safe) window.open(reservationUrl, "_blank", "noopener");
              }}
              onSecondaryAction={(action) => handleCtaClick(action)}
            />
          ) : (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-medium tracking-ko text-text-muted">
                업주가 아직 가능한 날짜를 마킹하지 않았어요. 아래 [예약하기] 탭으로 예약 문의를 보낼 수 있어요.
              </p>
            </section>
          );

          const reservePanel = (
            <div className="space-y-3">
              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-base font-bold tracking-ko text-text-strong">예약하기</h2>
                <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
                  {hasReservationDates
                    ? "원하는 날짜를 골라 예약을 진행할 수 있어요."
                    : "아래 버튼을 눌러 예약 문의를 보낼 수 있어요."}
                </p>
              </section>

              {reservationUrl || onPrimaryAction ? (
                <ActionButton
                  type="button"
                  data-testid="cta-reservation-tab"
                  onClick={() => onPrimaryAction?.()}
                  className={WIZARD_PRIMARY_BUTTON_CLASS}
                >
                  예약하기
                </ActionButton>
              ) : (
                <div className="space-y-2">
                  <ActionButton
                    type="button"
                    data-testid="cta-reservation-tab-disabled"
                    disabled
                    aria-disabled
                    className={WIZARD_PRIMARY_BUTTON_CLASS}
                  >
                    예약하기
                  </ActionButton>
                  <p className="text-xs font-medium tracking-ko text-text-muted">
                    예약 링크가 설정되지 않았습니다.
                  </p>
                </div>
              )}

              {/* 빌링 X 고지 — Duke 요구. 결제는 매장에서. */}
              <p
                data-testid="billing-notice"
                className="text-[11px] leading-relaxed tracking-ko text-text-subtle"
              >
                결제는 매장에서 직접 진행돼요. 자세한 내용은 매장에 문의해 주세요.
              </p>
            </div>
          );

          const couponPanel = funnelCoupon ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <div className="mb-3 flex items-center gap-2">
                  <Ticket className="size-5 text-[#0A0A0A]" strokeWidth={2} />
                  <span className="text-sm font-medium tracking-ko text-[#64748B]">
                    받을 수 있는 쿠폰
                  </span>
                </div>
                <p className="text-lg font-bold tracking-ko text-[#0F172A]">
                  {funnelCoupon.title}
                </p>
                {isGift && giftItem ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FAFAFA] px-3 py-1 text-sm font-bold tracking-ko text-[#0A0A0A]">
                    <Gift className="size-4" strokeWidth={2.2} />
                    {giftItem} 증정
                  </p>
                ) : (
                  typeof funnelCoupon.conditions?.min_amount === "number" && (
                    <p className="mt-2 text-sm font-medium tracking-ko text-[#64748B]">
                      {funnelCoupon.conditions.min_amount.toLocaleString("ko-KR")}원 이상 사용하실 때
                    </p>
                  )
                )}
                <p className="mt-1 text-sm font-medium tracking-ko text-[#64748B]">
                  {funnelCoupon.valid_until
                    ? `${new Date(funnelCoupon.valid_until).toLocaleDateString("ko-KR")}까지`
                    : "기간 제한 없음"}
                </p>
              </div>
              <p className="text-xs font-medium tracking-ko text-text-muted">
                예약 확정 시 쿠폰을 받을 수 있어요.
              </p>
            </div>
          ) : null;

          return (
            <ReservationCardTabs
              hasCoupon={Boolean(funnelCoupon)}
              calendarPanel={calendarPanel}
              reservePanel={reservePanel}
              couponPanel={couponPanel}
            />
          );
        })()}

        {resolvedVariant === "purchase" && (
          <section data-testid="variant-purchase">
            <AiPriceComparisonCard
              productName={productName ?? safeTitle}
              brandGuess={brandGuess}
              offers={priceOffers ?? []}
              className="mx-0 mt-0"
              onOfferClick={(_id) => {
                handleCtaClick("seller");
              }}
            />
          </section>
        )}

        {resolvedVariant === "lead" && <ConsultationLeadForm partnerName={safeLocal.name} />}

        {/* 4. 목적별 CTA — info는 하단 푸터(링크·카톡)만 */}
        {ctas.length > 0 && (
          <section>
            <h2 className="text-sm font-bold tracking-ko text-text-strong">{pageCopy.ctaHeading}</h2>
            <div className="mt-3 flex flex-col gap-2">
              {ctas.map((cta) => {
                const ctaTestId = getCtaTestId(resolvedVariant, cta.id);
                return cta.primary ? (
                  <ActionButton
                    key={`${resolvedVariant}-${cta.id}`}
                    type="button"
                    data-testid={ctaTestId}
                    onClick={() => handleCtaClick(cta.id)}
                    className={WIZARD_PRIMARY_BUTTON_CLASS}
                  >
                    {cta.label}
                  </ActionButton>
                ) : (
                  <button
                    key={`${resolvedVariant}-${cta.id}`}
                    type="button"
                    data-testid={ctaTestId}
                    onClick={() => handleCtaClick(cta.id)}
                    className={WIZARD_SECONDARY_BUTTON_CLASS}
                  >
                    {cta.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        </div>

      {/* 5a. 본문 inline footer — 링크복사 / 쿠폰드롭 카톡 secondary / 메이커유입 /
            FTC / 신고. sticky 아님 — 영상 다음 자연 스크롤 흐름. */}
      <section className="mx-auto w-full max-w-[480px] space-y-2 px-6 pt-4">
        {copyFeedback && (
          <p className="flex items-center gap-2 text-sm font-medium text-text-strong">
            <Check className="size-4 text-intent-success" strokeWidth={2} />
            {copyFeedback}
          </p>
        )}
        <ErrorMessage message={shareError} />

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E5] bg-white px-3 text-xs font-semibold tracking-ko text-[#525252] transition-colors hover:bg-[#FAFAFA]"
            aria-label="링크 복사"
          >
            <Copy className="size-3.5" strokeWidth={2} />
            링크 복사
          </button>
          {/* 쿠폰드롭만: 카톡 공유 secondary (claim 흐름 유지 + 공유 동선 보존) */}
          {isReservation && funnelCoupon && onReserveAndClaim ? (
            <button
              type="button"
              onClick={handleKakao}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E5] bg-white px-3 text-xs font-semibold tracking-ko text-[#525252] transition-colors hover:bg-[#FAFAFA]"
            >
              <MessageCircle className="size-3.5" strokeWidth={2} />
              카카오톡 공유
            </button>
          ) : null}
        </div>

        {videoSourceUrl && (
          <a
            href={`/create?url=${encodeURIComponent(videoSourceUrl)}`}
            className="block text-center text-xs font-medium tracking-ko text-[#737373] underline-offset-2 hover:text-[#0A0A0A] hover:underline"
          >
            나도 이런 정보 보내고 싶다면 →
          </a>
        )}

        <p className="text-center text-[10px] leading-tight tracking-ko text-[#A3A3A3]">
          본 콘텐츠는 LinkDrop 광고/제휴 안내가 적용됩니다. (FTC 권고 사항)
        </p>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsReportSheetOpen(true)}
            className="inline-flex items-center gap-1 bg-transparent text-[11px] text-[#A3A3A3] hover:text-[#525252]"
          >
            <Flag size={11} strokeWidth={2} />
            문제 신고
          </button>
        </div>
      </section>

      {/* 5b. sticky 하단 바 — primary 1개만. safe-area 패딩. 스크롤해도 항상 닿게. */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#E5E7EB] bg-white">
        <div className="mx-auto w-full max-w-[480px] px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {isReservation && funnelCoupon && onReserveAndClaim ? (
            <button
              type="button"
              onClick={onReserveAndClaim}
              className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#0A0A0A] px-4 text-base font-bold text-white"
            >
              <span className="truncate">예약 문의하고 쿠폰 받기</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleKakao}
              className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#0A0A0A] px-4 text-base font-bold text-white"
            >
              <MessageCircle className="size-5 shrink-0" strokeWidth={2} />
              <span className="truncate">카카오톡 공유</span>
            </button>
          )}
        </div>
      </div>
      <AbuseReportSheet
        isOpen={isReportSheetOpen}
        onClose={() => setIsReportSheetOpen(false)}
        dropId={dropId}
      />
    </div>
  );
}

// ============================================================
// Skeleton Variant
// ============================================================

export function InfoDropPageSkeleton() {
  return (
    <div className="relative min-h-screen bg-white pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white px-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </header>

      {/* Maker row */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Video */}
      <Skeleton className="aspect-video w-full" />

      {/* Title block */}
      <div className="px-5 py-6">
        <Skeleton className="mb-3 h-6 w-14 rounded-md" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="mt-2 h-8 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
      </div>

      {/* Local info card */}
      <div className="mx-5 mt-6 rounded-xl bg-[#FAFAFA] p-5">
        <div className="flex gap-4">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <div className="flex flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="my-4 border-t border-[#E5E5E5]" />
        <div className="grid grid-cols-2 gap-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Creator */}
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-[#F5F5F5] p-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Disclosure */}
      <Skeleton className="mx-5 mt-6 h-4 w-64" />

      {/* Floating bar */}
      <div className="fixed bottom-5 left-0 right-0 px-5">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex gap-1.5">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
          <Skeleton className="h-11 w-28 rounded-md" />
          <Skeleton className="h-11 flex-1 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Variant 1: Coupon (Cafe)
// ============================================================

export default function InfoDropPageCoupon() {
  return (
    <InfoDropPage
      videoThumbnailUrl="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=450&fit=crop"
      videoDurationSec={154}
      videoSourceLabel="YouTube"
      officialStatus="user_shared"
      dropId="mock-coupon"
      maker={{ name: "Duke", droppedAgo: "2시간 전" }}
      makerMessage="여기 진짜 분위기 좋더라. 너 좋아할 것 같아서 보내"
      title="서울숲 근처 숨은 브런치 카페 발견"
      description="서울숲역 3번 출구에서 도보 5분, 창가 자리에서 숲 뷰가 보이는 조용한 카페입니다. 시그니처 라떼가 맛있어요."
      intent="coupon"
      local={{
        name: "포레스트 커피",
        category: "카페 · 브런치",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=200&h=200&fit=crop",
        distance: "0.8km",
        address: "서울 성동구",
        statusLabel: "영업중",
        hoursLabel: "22:00까지",
        rating: 4.8,
        reviewCount: 127,
        responseNote: "카톡 응답 빠름",
        priceRange: "평균 8,000원",
      }}
      creator={{
        channelName: "카페투어 브이로그",
        channelUrl: "https://youtube.com/@cafetour",
      }}
    />
  );
}

// ============================================================
// Variant 2: Reservation (Camping)
// ============================================================

export function InfoDropPageReservation() {
  return (
    <InfoDropPage
      videoThumbnailUrl="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=450&fit=crop"
      videoDurationSec={312}
      videoSourceLabel="YouTube"
      officialStatus="user_shared"
      dropId="mock-reservation"
      maker={{ name: "지영", droppedAgo: "1시간 전" }}
      makerMessage="주말에 시간 되면 같이 가자! 진짜 힐링됨"
      title="주말에 여기 어때? 노을이 정말 예쁜 캠핑장"
      description="서울에서 1시간 반 거리에 있는데 뷰가 진짜 미쳤어. 특히 해질 때 노을 보면서 고기 구우면 힐링 그 자체야."
      intent="reservation"
      local={{
        name: "노을재 캠핑장",
        category: "캠핑 · 글램핑",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=200&h=200&fit=crop",
        distance: "가평",
        address: "경기 가평군",
        statusLabel: "예약 가능",
        hoursLabel: "체크인 15:00",
        rating: 4.9,
        reviewCount: 89,
        responseNote: "당일 예약 가능",
        priceRange: "1박 120,000원",
      }}
      creator={{
        channelName: "캠핑하는 직장인",
        channelUrl: "https://youtube.com/@campingworker",
      }}
    />
  );
}
