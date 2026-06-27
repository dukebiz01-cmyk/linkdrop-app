import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { startKakaoLogin } from "@/lib/oauth-kakao";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Play,
  Copy,
  MessageCircle,
  Check,
  Plus,
  FileText,
  Sparkles,
  ShieldCheck,
  Bell,
  Flag,
  Phone,
  MessageSquare,
  MapPin,
  ShoppingCart,
  Package,
  CalendarDays,
  Sprout,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { AiPriceComparisonCard, type PriceOfferRow } from "@/components/ai-price-comparison-card";
import { ActionButton } from "@/components/ActionButton";
import { ErrorMessage } from "@/components/ErrorMessage";
import {
  WIZARD_PRIMARY_BUTTON_CLASS,
  WIZARD_SECONDARY_BUTTON_CLASS,
} from "@/components/create-wizard-button-styles";
import { PUBLIC_DROP_CTAS, type PublicDropCta } from "@/components/public-drop-ctas";
import type { DropPurpose } from "@/lib/types";
import {
  MOCK_RESERVATION_SECTION_GUIDE,
  type DropViewVariant,
} from "@/lib/mock-data";
import {
  ReservationCalendarPage,
  type CampgroundInfoCardData,
  type ReservationSecondaryAction,
  type ReservationSelection,
} from "@/components/reservation-calendar-page";
import type { ReservationDateItem } from "@/components/create-drop-wizard";
import { YouTubeLiteEmbed } from "@/components/receiver/youtube-lite-embed";
import { CouponPreview } from "@/components/receiver/CouponPreview";
import { CardBody } from "@/components/card/CardBody";
import { CardActionButton } from "@/components/card/CardActionButton";
import { DropCardShell } from "@/components/card/DropCardShell";
import { toCardBodyProps } from "@/lib/adapters";
import { parseVideoUrl } from "@/lib/video-metadata";
import { cn } from "@/lib/utils";
import { trackReceiverEvent } from "@/lib/event-tracking";
import { getBadgeLabel, getBadgeColor, type OfficialStatus } from "@/lib/helpers/drop-status";
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
  /** F2 커머스(구매) — 시세·쿠폰 없는 단순 상품 카드. 있으면 시세(AI 가격비교) 대신 렌더. */
  commerce?: {
    name: string;
    priceKrw: number | null;
    buyUrl: string;
    imageUrl: string;
    /** S2b — 자체업로드 상품. true 면 구매버튼/CTA 가 "주문 문의(tel:)" 로 분기. */
    selfUpload?: boolean;
    /** 나-2 — 상품 메인 블록 저장 카피(나-1). 있으면 상품 /d 페이지에 리치 표시. */
    headline?: string;
    sellingPoints?: string[];
    /** ② 신선 원물(농가 선주문) — isFresh 일 때만 신선 strip. 시세는 미표시(플래그만 운반). */
    isFresh?: boolean;
    harvestDate?: string | null;
    stockLimit?: number | null;
    priceBandEnabled?: boolean;
  };
  /** ③ 카드 담기 — 담은(관련) 상품. 본체 source 와 무관, 별도 "관련 상품" 섹션. */
  attachedProducts?: Array<{
    refDropId: string;
    refShareUuid: string | null;
    name: string;
    priceKrw: number | null;
    imageUrl: string | null;
    /** 나-2 — 담을 때 동봉된 카피 스냅샷. 컴팩트 렌더에 헤드라인 태그라인으로만. */
    headline?: string;
    sellingPoints?: string[];
  }>;
  /** B 상품 홍보 카드 — 큰 이미지 + 헤드라인 + 셀링포인트 + 구매버튼(리치). "관련 상품"보다 상단·강조. */
  promoCards?: Array<{
    refDropId: string | null;
    refShareUuid: string | null;
    name: string;
    priceKrw: number | null;
    imageUrl: string | null;
    headline: string;
    sellingPoints: string[];
  }>;
  /** Slice2 멀티영상 — primary 외 담은 추가 영상(video 블록). 없으면 미렌더. */
  attachedVideos?: Array<{
    type: "video" | "article";
    provider: string;
    sourceId: string;
    sourceUrl: string;
    title: string | null;
    thumbnailUrl: string | null;
    authorName: string | null;
    snippet?: string | null;
  }>;
  local: {
    name: string;
    category: string;
    thumbnailUrl?: string;
    distance: string;
    address: string;
    statusLabel: string;
    phone?: string; // phase1-3: partners.contact_phone 연결
    reservationUrl?: string | null; // c-1: 네이버형 매장 외부 예약 URL(순수 쿠폰 카드 보조 링크)
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
  /** v7.2 — 메이커가 고른 카드 배경색. ★ 타입 자리만 — 렌더 배선은 e단계(현재 화면 변화 0). */
  cardColor?: string;
  shareUrl?: string;
  /** 예약 목적 — 메이커가 보낸 예약 가능 날짜 (수신자 달력 마킹용). */
  reservationDates?: ReservationDateItem[];
  /**
   * 재공유(re-share) 수신자 화면 여부. 부모 라우트가 URL 마커
   * (parentShareId · shareDepth · ref) 로 판별해 전달.
   * true 면 예약 캘린더가 read-only 카드로 전환된다.
   */
  isReshare?: boolean;
  /** 영상 원본 URL — youtube 인 경우 in-app embed 모달 활성 */
  videoSourceUrl?: string;
  onPrimaryAction?: () => void;
  /** 직접예약(인앱 신청) — '예약하기' 클릭 시 캘린더 선택값과 함께 부모가 시트를 연다. */
  onReservationRequest?: (selection?: ReservationSelection) => void;
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
  /** P3 — SSR loader 가 미리 가져온 슬롯 행. 주어지면(빈 배열 포함) 클라 fetch 스킵. */
  initialSlots?: SlotAvailableRow[];
  /** CC#2 (b) 캘린더 mode seam — 현재 date_range 만 구현. date_time_slot 은 분기점만(기본 date_range). */
  calendarMode?: "date_range" | "date_time_slot";
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
  /** ③b 선주문 — commerce(자체업로드) "선주문하기" CTA 클릭. 부모가 로그인/시트/RPC 핸들 */
  onPreorder?: () => void;
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
    // v7.2 — 손님 관점 카피. "혜택으로 손님 모으기"(업주 관점) → "받을 수
    // 있는 혜택"(손님 관점, 모든 업종 범용). 업주 위저드 미리보기
    // (create/types.ts PURPOSE_FLOW_CONFIG.쿠폰.title) 는 무수정.
    sectionTitle: "받을 수 있는 혜택",
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

type SlotAvailableRow = {
  slot_date: string;
  slot_time: string | null;
  available: number;
};

/**
 * v7.2 — ReservationCalendarPage 정적 import 로 전환. 기존 dynamic import 가
 * CDN chunk 캐시 불일치 등으로 영구 로딩(setCalendar 미실행) 위험이 있었음
 * (쿠폰 드롭은 뜨는데 예약 드롭은 안 뜨는 케이스 발생). mounted gate 는
 * 유지 → SSR 첫 렌더 placeholder, 클라 마운트 후 실 캘린더 렌더 → React
 * #418 hydration mismatch 차단도 그대로.
 */
function ReservationCalendarClient(props: {
  partnerName: string;
  campgroundInfo?: CampgroundInfoCardData;
  makerAvailableDates?: ReservationDateItem[];
  readOnly?: boolean;
  /** v7.1 — 매장별 슬롯 가용일. partnerId 있으면 get_available_slots 호출해 modifier 로 표시. */
  partnerId?: string | null;
  /** P3 — SSR loader 가 미리 가져온 슬롯. 주어지면 클라 fetch 스킵하고 이 값으로 초기화. */
  initialSlots?: SlotAvailableRow[];
  /** Phase 1 통합 — 예약 CTA 라벨(교집합 시 "예약 문의하고 쿠폰 받기"). 기본 "예약하기". */
  reserveCtaLabel?: string;
  /** CC#2 (b) — 캘린더 모드. date_range 만 구현, date_time_slot 은 분기점만. */
  calendarMode?: "date_range" | "date_time_slot";
  onCheckAvailability?: (selection: ReservationSelection) => void;
  onSecondaryAction?: (action: ReservationSecondaryAction) => void;
}) {
  const [mounted, setMounted] = useState(false);
  // P3 — SSR slots 있으면 그것으로 초기화(available>0 만), 없으면 기존대로 빈 배열 후 클라 fetch.
  const [partnerSlots, setPartnerSlots] = useState<SlotAvailableRow[]>(
    props.initialSlots ? props.initialSlots.filter((r) => r.available > 0) : [],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // v7.1 — partnerId 있을 때만 매장 슬롯 가용일 fetch (정보 드롭 회귀 0:
  // partnerId 가 undefined/null 이면 호출 자체 없음). 오늘 이후 행만 반환.
  useEffect(() => {
    // P3 — SSR 가 슬롯을 채워 내려줬으면 클라 fetch 스킵. 빈 배열([])이면 SSR 누락
    // (간헐) 가능성 → 클라 fetch 로 복구. undefined 도 fallback.
    if (props.initialSlots && props.initialSlots.length > 0) return;
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
  }, [props.partnerId, props.initialSlots]);

  // Phase A — Date[] 대신 {date, available} 보존. 캘린더 셀에 "남은 N자리"
  // 라벨을 위한 데이터. RPC available 컬럼 그대로 통과.
  // CC#2 (b) — date_range: 날짜 단위 집계. date_time_slot 은 분기점만(미구현 → date_range 폴백).
  const partnerSlotEntries = useMemo(() => {
    // TODO(date_time_slot): props.calendarMode === "date_time_slot" 시 slot_time 별
    //   시간 슬롯 entries(slot_time 칩)로 분기. 현재는 date_range 만 구현 → 날짜 단위 폴백.
    return partnerSlots.map((r) => {
      const [y, m, d] = r.slot_date.split("-").map(Number);
      return { date: new Date(y, m - 1, d), available: r.available };
    });
  }, [partnerSlots, props.calendarMode]);

  if (!mounted) {
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
      <ReservationCalendarPage
        partnerName={props.partnerName}
        campgroundInfo={props.campgroundInfo}
        makerAvailableDates={props.makerAvailableDates}
        partnerSlotEntries={partnerSlotEntries}
        readOnly={props.readOnly}
        reserveCtaLabel={props.reserveCtaLabel}
        calendarMode={props.calendarMode}
        className="mx-0 mt-0 w-full max-w-full"
        onCheckAvailability={props.onCheckAvailability}
        onSecondaryAction={props.onSecondaryAction}
      />
    </section>
  );
}

// CC#2 (a) — ReservationCardTabs(예약 카드 탭) 제거. 탭은 표시-전환 state(useState tab
//   + hasCoupon 변동 시 coupon→calendar 리셋 effect)만 보유했고 라우팅·데이터 로직은 없었음.
//   탭→세로 스택으로 전환하면서 두 탭 콘텐츠(쿠폰 패널·캘린더)와 variant 별 구성을 모두 보존.
//   (혜택·이벤트 합성 섹션 + 캘린더 + 예약하기 스택은 본문 showReservationCalendar 블록 참고.)

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
  commerce,
  attachedProducts,
  promoCards,
  attachedVideos,
  local,
  creator,
  aiSummary,
  keyPoints,
  shareUrl,
  funnelCoupon,
  onReserveAndClaim,
  onPreorder,
  reservationDates,
  isReshare = false,
  videoSourceUrl,
  onPrimaryAction,
  onReservationRequest,
  onWatchOriginal,
  onShare,
  onCopyLink,
  onKakaoShare,
  officialStatus,
  dropId,
  partnerId,
  initialSlots,
  calendarMode = "date_range",
  cardColor,
}: InfoDropPageProps) {
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  // 트랙 D §50 — 매장(partnerId) 구독. me.tsx handleSubscribe 패턴 재사용(maker_follows, 스키마 0).
  const [subscriberUserId, setSubscriberUserId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  // 구독 관리 팝업(옵션 A) — "구독중" 칩 탭 시 오픈. 하단 수신거부(unfollow) 진입점.
  const [manageOpen, setManageOpen] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);

  // 로그인 유저 + 현재 매장 구독 여부 로드. partnerId(=매장) 있을 때만 조회.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id ?? null;
      if (cancelled) return;
      setSubscriberUserId(uid);
      if (!uid || !partnerId) {
        setIsSubscribed(false);
        return;
      }
      // me.tsx 와 동일 방식: maker_follows(active) 조회. types.ts 스테일 → untyped .from().
      const { data: row } = await supabase
        .from("maker_follows")
        .select("followed_partner_id")
        .eq("follower_user_id", uid)
        .eq("followed_partner_id", partnerId)
        .eq("status", "active")
        .maybeSingle();
      if (!cancelled) setIsSubscribed(Boolean(row));
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  // 구독 버튼 — 로그인 필요. 미로그인 → 카카오 OAuth(현재 드롭 복귀), 로그인 → §50 동의 팝업.
  function handleSubscribeClick() {
    if (!partnerId) return;
    if (!subscriberUserId) {
      const next =
        typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      void startKakaoLogin(next);
      return;
    }
    setConsentChecked(false);
    setSubscribeOpen(true);
  }

  // 동의 완료 → maker_follows upsert(active + consent_at). me.tsx handleSubscribe 와 동일 패턴.
  async function handleSubscribeConfirm() {
    if (!partnerId || !subscriberUserId || !consentChecked || subscribing) return;
    setSubscribing(true);
    try {
      const { error } = await getSupabase()
        .from("maker_follows")
        .upsert(
          {
            follower_user_id: subscriberUserId,
            followed_partner_id: partnerId,
            source: "drop_card",
            consent_at: new Date().toISOString(),
            status: "active",
          },
          { onConflict: "follower_user_id,followed_partner_id" },
        );
      if (error) {
        console.error("[info-drop-page] subscribe failed:", error);
        toast.error("구독에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setIsSubscribed(true);
      setSubscribeOpen(false);
      toast.success("구독했어요.");
    } catch (e) {
      console.error("[info-drop-page] subscribe unexpected:", e);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setSubscribing(false);
    }
  }

  // 수신거부(구독 취소) → maker_follows status='unfollowed'. me.tsx handleUnsubscribe 와 동일 패턴.
  async function handleUnsubscribe() {
    if (!partnerId || !subscriberUserId || unsubscribing) return;
    setUnsubscribing(true);
    try {
      const { error } = await getSupabase()
        .from("maker_follows")
        .update({ status: "unfollowed" })
        .eq("follower_user_id", subscriberUserId)
        .eq("followed_partner_id", partnerId);
      if (error) {
        console.error("[info-drop-page] unsubscribe failed:", error);
        toast.error("수신거부 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setIsSubscribed(false);
      setManageOpen(false);
      toast.success("수신거부 처리됐어요.");
    } catch (e) {
      console.error("[info-drop-page] unsubscribe unexpected:", e);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setUnsubscribing(false);
    }
  }

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
  const hasPhone = Boolean(local?.phone?.trim());
  // 자체업로드(manual) 구매카드는 커머스 카드 자체의 [구매하기] + 하단 공유 블록
  //   (링크복사/카톡)으로 충분 → 중간 CTA(가격비교/구매처보기 등) 전부 제거.
  //   식별 = commerce.selfUpload(합성 source_url prefix). 외부 스크랩 상품(selfUpload=false)은
  //   기존 purchase 세트(가격비교/구매처/공유) 그대로 보존.
  const isSelfUploadPurchase = resolvedVariant === "purchase" && Boolean(commerce?.selfUpload);
  const ctasRaw: PublicDropCta[] = isSelfUploadPurchase
    ? []
    : (PUBLIC_DROP_CTAS[resolvedVariant] ?? PUBLIC_DROP_CTAS.info);
  const hasFunnelCoupon = Boolean(funnelCoupon);
  const ctas = ctasRaw.filter((c) => {
    if ((c.id === "phone" || c.id === "sms") && !hasPhone) return false;
    if ((c.id === "coupon" || c.id === "reserve-coupon") && !hasFunnelCoupon) return false;
    return true;
  });
  const isReservation = resolvedVariant === "reservation";
  // v7.2 — 쿠폰 드롭에도 매장 캘린더 탭 [쿠폰][예약가능 캘린더]. partnerId 있을 때만.
  const isCoupon = resolvedVariant === "coupon";
  // 예약 캘린더(ReservationCalendarClient)가 실제로 렌더되는 드롭인지. 쿠폰 게이팅 범위 한정용.
  const showReservationCalendar = isReservation || (isCoupon && Boolean(partnerId));
  // Phase 1 통합 CTA — 쿠폰 있음 && 예약 컨텍스트 있음(교집합)일 때만 예약+쿠폰 단일 CTA.
  //   단일타입(쿠폰만 / 예약만)은 isCombined=false → 기존 흐름(sticky 쿠폰받기 / 예약하기) 그대로.
  const hasReservationDates = Array.isArray(reservationDates) && reservationDates.length > 0;
  const isCombined = hasFunnelCoupon && (isReservation || hasReservationDates);
  const reserveCtaLabel = isCombined ? "예약 문의하고 쿠폰 받기" : "예약하기";
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

  // v7.2 — sticky 바는 funnelCoupon 있을 때만 표시. 없으면 본문 pb 축소.
  // Phase 1 통합 — 교집합(isCombined)은 sticky 제거(보조 "쿠폰만 받기"로 대체) → pb 도 축소.
  // FIX — funnelCoupon(detail.coupon, 매장 활성쿠폰)이 정보/구매 드롭에도 붙어 새는 케이스 차단:
  //   sticky "쿠폰 받기"는 쿠폰 드롭(isCoupon)에서만. (주석상 "정보/구매/상담 드롭 = sticky 없음" 의도 강제.)
  const hasStickyBar = Boolean(funnelCoupon && onReserveAndClaim && !isCombined && isCoupon);

  return (
    <div
      className={cn(
        "relative mx-auto min-h-screen w-full max-w-[480px]",
        // sticky 바 = 12(pt) + 52(primary) + 12(pb) + safe-area ≈ 76px + safe-area.
        // 본문 마지막 ~ sticky 바 사이 안 겹치게 pb-[calc(5.5rem+safe-area)] (88px).
        // sticky 없는 드롭(정보/구매/상담) = pb-8 만으로 충분.
        hasStickyBar ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : "pb-8",
      )}
      // 셸 배경 — info 만 회색(흰 배경 위 navy holo 카드 = 스튜디오 parity). 비-info 는 navy 유지(파일럿 보호).
      style={{
        backgroundColor: resolvedVariant === "info" ? "#F5F5F5" : (cardColor ?? "#1E3A8A"),
      }}
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
            <p
              className={cn(
                "text-sm font-bold tracking-ko",
                resolvedVariant === "info" ? "text-text-strong" : "text-white",
              )}
            >
              {safeMaker.name}
              <span
                className={cn(
                  "font-medium",
                  resolvedVariant === "info" ? "text-text-muted" : "text-white/70",
                )}
              >
                님이 보냈어요
              </span>
            </p>
            {/* selfUpload(자체업로드 상품)은 영상이 아니므로 "공유된 영상" 라벨 숨김. */}
            {!commerce?.selfUpload && (
              <p
                className={cn(
                  "text-xs font-medium tracking-ko",
                  resolvedVariant === "info" ? "text-text-subtle" : "text-white/60",
                )}
              >
                LinkDrop으로 공유된 영상
              </p>
            )}
          </div>
          {(officialStatus === "official" || officialStatus === "user_shared") && (
            <div
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                backgroundColor: getBadgeColor(officialStatus).bg,
                color: getBadgeColor(officialStatus).text,
                border: getBadgeColor(officialStatus).border
                  ? `0.5px solid ${getBadgeColor(officialStatus).border}`
                  : undefined,
              }}
            >
              {officialStatus === "official" && <ShieldCheck size={12} strokeWidth={2.5} />}
              {getBadgeLabel(officialStatus)}
            </div>
          )}
        </div>
        {/* 트랙 D §50 — 매장 구독. partnerId(매장) 있을 때만. 이미 구독중이면 "구독중" 표시. */}
        {partnerId ? (
          <div className="mt-3">
            {isSubscribed ? (
              <button
                type="button"
                data-testid="subscribe-state"
                onClick={() => setManageOpen(true)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-bold tracking-ko text-text-muted transition-colors hover:border-text-muted hover:text-text-strong"
              >
                <Bell className="size-4" strokeWidth={2} />
                구독중
              </button>
            ) : (
              <button
                type="button"
                data-testid="subscribe-button"
                onClick={handleSubscribeClick}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-3 text-sm font-bold tracking-ko text-white hover:bg-[#171717]"
              >
                <Bell className="size-4" strokeWidth={2} />
                소식 받기
              </button>
            )}
          </div>
        ) : null}
      </header>

      <div className="space-y-6 px-6" data-testid={`variant-${resolvedVariant}`}>
        {/* 4a — info variant 만 단일 CardBody(스튜디오 동일, 싱크로). 나머지 variant 는 아래 기존 렌더 0변경.
            text-white 래퍼 = CardBody 제목(부모색 상속)을 navy 위 흰글씨로(묻힘 방지). */}
        {resolvedVariant === "info" && (
          // 4b — info CardBody 를 DropCardShell 로 감싸 스튜디오와 동일한 navy+holo 밝은 카드로.
          //   DropCardShell 이 text-white base+holo+rounded 제공(4a text-white 래퍼 대체).
          //   interactive=false(손님 스크롤 페이지라 틸트 끔), holoOpacity 고정 0.2(stage 없음).
          <DropCardShell
            cardColor={cardColor ?? "#1E3A8A"}
            interactive={false}
            // 스튜디오 완성(별3) 기준 밝기 + 파란 holo 강화(0.45). boxShadow alpha 0.28+3*0.07=0.49.
            holoOpacity={0.45}
            boxShadow="0 22px 60px -12px rgba(15,23,42,0.49), 0 0 0 1px rgba(255,255,255,0.08) inset"
          >
            <CardBody
              {...toCardBodyProps({
                videoSourceUrl,
                videoThumbnailUrl,
                videoDurationSec,
                videoSourceLabel,
                title,
                makerMessage,
                keyPoints,
                cardColor,
                funnelCoupon,
                local,
                variant,
              } as unknown as InfoDropPageProps)}
              contactSlot={
                // 손님 실동작 연락 칩 — 스튜디오 CardActionButton 모양 공유 + onClick=handleCtaClick(실제 tel:/지도/예약).
                //   데이터(전화·주소·예약URL) 없으면 undefined → 버튼 0(일반 info 안전).
                hasPhone || safeLocal.address?.trim() || local?.reservationUrl ? (
                  <div className="flex gap-2">
                    {hasPhone ? (
                      <CardActionButton
                        icon={<Phone className="size-4" strokeWidth={2} />}
                        label="전화"
                        onClick={() => handleCtaClick("phone")}
                      />
                    ) : null}
                    {safeLocal.address?.trim() ? (
                      <CardActionButton
                        icon={<MapPin className="size-4" strokeWidth={2} />}
                        label="길찾기"
                        onClick={() => handleCtaClick("directions")}
                      />
                    ) : null}
                    {local?.reservationUrl ? (
                      <CardActionButton
                        icon={<ExternalLink className="size-4" strokeWidth={2} />}
                        label="예약"
                        onClick={() =>
                          window.open(local.reservationUrl as string, "_blank", "noopener,noreferrer")
                        }
                      />
                    ) : null}
                  </div>
                ) : undefined
              }
            />
          </DropCardShell>
        )}
        {resolvedVariant === "coupon" && (
          // 4c — 쿠폰 코어(영상·제목·한마디·셀링)도 동일 CardBody(A1: 코어만, navy 유지).
          //   funnelCoupon 생략 → 어댑터 coupon=null → CardBody CouponPreview 미렌더 → 쿠폰 카드는 couponPanel(L1206) 담당(dedup).
          //   contactSlot 생략 → 전화/길찾기는 기존 secondary-contact-row 담당(중복 회피).
          <DropCardShell
            cardColor={cardColor ?? "#1E3A8A"}
            interactive={false}
            holoOpacity={0.45}
            boxShadow="0 22px 60px -12px rgba(15,23,42,0.49), 0 0 0 1px rgba(255,255,255,0.08) inset"
          >
            <CardBody
              {...toCardBodyProps({
                videoSourceUrl,
                videoThumbnailUrl,
                videoDurationSec,
                videoSourceLabel,
                title,
                makerMessage,
                keyPoints,
                cardColor,
                local,
                variant,
              } as unknown as InfoDropPageProps)}
            />
          </DropCardShell>
        )}
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
            <h2 className="text-xl font-extrabold leading-snug tracking-ko text-white">
              {pageCopy.sectionTitle}
            </h2>
            <p className="text-sm font-medium leading-relaxed tracking-ko text-white/70">
              {reservationGuide}
            </p>
            <p className="text-xs font-medium text-white/60">{safeLocal.name}</p>
          </section>
        )}

        {/* 2. 영상 카드 — 유튜브: lite embed(facade→iframe), 그 외: 썸네일 + onWatchOriginal.
            세로(쇼츠) 영상은 max-h cap 으로 화면을 다 먹지 않게 (히어로 유지 + 하단
            CTA 도달성). 가로(16:9) 는 자연 비율이라 cap 영향 거의 없음. */}
        {/* F2 커머스 — 영상 헤더(썸네일+원본영상 프레임) 숨김. 상품 카드가 이미지 보유.
            commerce 일 때만 숨기고, 영상/정보/쿠폰/예약 드롭은 그대로(회귀 없음). */}
        {!commerce && resolvedVariant !== "info" && resolvedVariant !== "coupon" && (
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
                    <Play
                      className="ml-0.5 size-6 fill-text-strong text-text-strong"
                      strokeWidth={2}
                    />
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
              {/* 결정 B — 매장명 우선(사업자=가게명), 없으면 영상 채널명 fallback(정보 등).
                  safeLocal.name 은 DEFAULT_LOCAL("매장") 폴백이 있어 raw local?.name 으로 store 유무 판정. */}
              <p className="text-xs font-medium text-text-subtle">
                {local?.name?.trim() || safeCreator.channelName}
              </p>
            </div>
          </section>
        )}

        {makerMessage && resolvedVariant !== "info" && resolvedVariant !== "coupon" && (
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium italic leading-relaxed tracking-ko text-text-muted">
            &quot;{makerMessage}&quot;
          </p>
        )}

        {/* 예약 드롭 = [예약가능 캘린더 | 예약하기 | 쿠폰] 3탭 (기존).
            v7.2 쿠폰 드롭 = [쿠폰 | 예약가능 캘린더] 2탭. 정보/구매/상담 진입 X. */}
        {showReservationCalendar &&
          (() => {

            // v7.1 — partnerId 가 있으면 매장 슬롯 가용일도 표시(makerAvailableDates 와 공존).
            // makerAvailableDates 비어도 partnerId 있으면 캘린더 카드를 보여주어
            // 업주가 마킹한 날을 확인 가능.
            // 쿠폰 변형은 partnerId 만 신호 (위 게이트에서 이미 보장).
            const showCalendar = isCoupon
              ? Boolean(partnerId)
              : hasReservationDates || Boolean(partnerId);
            const calendarPanel = showCalendar ? (
              <ReservationCalendarClient
                partnerName={safeLocal.name}
                campgroundInfo={{ name: safeLocal.name }}
                makerAvailableDates={reservationDates}
                partnerId={partnerId}
                initialSlots={initialSlots}
                readOnly={isReshare}
                reserveCtaLabel={reserveCtaLabel}
                calendarMode={calendarMode}
                onCheckAvailability={(selection) => {
                  // A안 직접예약 — 캘린더 [예약하기] = 인앱 신청 시트. 선택한 날짜·인원을
                  // 부모(d.$shareUuid)로 올려 prefill + 로그인 게이트 + 시트 오픈.
                  onReservationRequest?.(selection);
                }}
                onSecondaryAction={(action) => handleCtaClick(action)}
              />
            ) : (
              <section className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm font-medium tracking-ko text-text-muted">
                  업주가 아직 가능한 날짜를 마킹하지 않았어요. 아래 [예약하기] 탭으로 예약 문의를
                  보낼 수 있어요.
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

                {onReservationRequest ? (
                  <ActionButton
                    type="button"
                    data-testid="cta-reservation-tab"
                    onClick={() => onReservationRequest?.()}
                    className={WIZARD_PRIMARY_BUTTON_CLASS}
                  >
                    {reserveCtaLabel}
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
                      {reserveCtaLabel}
                    </ActionButton>
                    <p className="text-xs font-medium tracking-ko text-white/70">
                      예약 신청을 받을 수 없는 드롭이에요.
                    </p>
                  </div>
                )}

                {/* 빌링 X 고지 — Duke 요구. 결제는 매장에서. */}
                <p
                  data-testid="billing-notice"
                  className="text-[11px] leading-relaxed tracking-ko text-white/60"
                >
                  결제는 매장에서 직접 진행돼요. 자세한 내용은 매장에 문의해 주세요.
                </p>
              </div>
            );

            const couponPanel = funnelCoupon ? (
              <div className="space-y-3">
                <CouponPreview coupon={funnelCoupon} />
                <p className="text-xs font-medium tracking-ko text-white/70">
                  예약을 신청하면 쿠폰이 지갑에 담겨요.
                </p>
              </div>
            ) : null;

            // CC#2 (a) — 진행 이벤트 요약(makerAvailableDates 의 eventTitle/eventDescription).
            //   캘린더 내부 상세 리스트 카드(reservation-calendar-page)는 데이터·소스 그대로 유지.
            //   여기선 "진행 이벤트" 요약만 병치(merge 아님). 둘은 독립 소스.
            const eventItems = (reservationDates ?? []).filter(
              (d) => Boolean(d.eventTitle?.trim()) || Boolean(d.eventDescription?.trim()),
            );
            const hasEvents = eventItems.length > 0;

            // CC#2 (a) — "예약하면 받는 혜택 / 진행 이벤트" 합성 섹션.
            //   혜택 = funnelCoupon(기존 couponPanel 재사용) · 이벤트 = makerAvailableDates 요약.
            //   두 소스 독립 → 조건부 병치(쿠폰만/이벤트만/둘 다 모두 정상, 둘 다 없으면 미렌더).
            const benefitEventSection =
              funnelCoupon || hasEvents ? (
                <section data-testid="benefit-event-section" className="space-y-3">
                  {funnelCoupon ? (
                    <div className="space-y-2">
                      <h2 className="text-sm font-bold tracking-ko text-white">
                        예약하면 받는 혜택
                      </h2>
                      {couponPanel}
                    </div>
                  ) : null}
                  {hasEvents ? (
                    <div className="space-y-2">
                      <h2 className="text-sm font-bold tracking-ko text-white">
                        진행 이벤트
                      </h2>
                      <ul className="space-y-2">
                        {eventItems.map((item) => (
                          <li
                            key={item.id}
                            className="rounded-2xl border border-[#E2E8F0] bg-white p-4"
                          >
                            {item.eventTitle?.trim() ? (
                              <p className="text-sm font-bold tracking-ko text-[#0F172A]">
                                {item.eventTitle}
                              </p>
                            ) : null}
                            {item.eventDescription?.trim() ? (
                              <p className="mt-1 text-xs font-medium tracking-ko text-[#64748B]">
                                {item.eventDescription}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null;

            // CC#2 (a) 탭 → 스택. ReservationCardTabs(표시-전환 state 만 보유, 라우팅·데이터
            //   로직 없음) 제거하고 패널을 세로 스택으로 보존. variant 별 구성 유지:
            //   coupon = [혜택·이벤트][캘린더] / reservation = [혜택·이벤트][캘린더][예약하기].
            return (
              <div className="space-y-4">
                {benefitEventSection}
                {calendarPanel}
                {!isCoupon ? reservePanel : null}
                {/* Phase 1 통합(가-2) — 교집합에서 sticky "쿠폰 받기" 대신 보조 "쿠폰만 받기".
                    예약 없이 claim_coupon 만(기존 onReserveAndClaim 경로 그대로). */}
                {isCombined && onReserveAndClaim ? (
                  <button
                    type="button"
                    data-testid="cta-coupon-only"
                    onClick={onReserveAndClaim}
                    className="flex w-full min-h-[44px] items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold tracking-ko text-[#0A0A0A] hover:bg-[#FAFAFA]"
                  >
                    쿠폰만 받기
                  </button>
                ) : null}
              </div>
            );
          })()}

        {/* 3. AI 요약 — CC#3 progressive disclosure: 핵심(영상·혜택·예약) 아래로 이동(부가).
            예약 variant는 캘린더 흐름에 집중, selfUpload(자체업로드 상품)은 숨김(게이트 그대로). */}
        {!isReservation && !commerce?.selfUpload && (
          <Accordion
            type="single"
            collapsible
            className="rounded-2xl border border-border bg-surface px-4"
          >
            <AccordionItem value="ai-summary" className="border-b-0">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-accent" strokeWidth={2} />
                  <span className="text-sm font-bold tracking-ko text-text-strong">영상 요약</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-base font-semibold leading-relaxed tracking-ko text-text-strong">
                  {summaryLine}
                </p>
                {points.length > 0 && resolvedVariant !== "info" && resolvedVariant !== "coupon" && (
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {resolvedVariant === "purchase" &&
          (commerce ? (
            // F2 커머스 — 시세·쿠폰 없는 단순 상품 카드(이미지=source, 가격/이름=block, 구매=source url).
            <section data-testid="variant-purchase" className="w-full max-w-full">
              <div className="overflow-hidden rounded-2xl border border-border bg-bg">
                {commerce.imageUrl ? (
                  <img
                    src={commerce.imageUrl}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : null}
                <div className="space-y-3 p-4">
                  <p className="text-base font-bold leading-snug tracking-ko text-text-strong">
                    {commerce.name || safeTitle}
                  </p>
                  <p className="text-xl font-extrabold tracking-ko text-text-strong">
                    {commerce.priceKrw != null
                      ? `${commerce.priceKrw.toLocaleString("ko-KR")}원`
                      : "가격 미정"}
                  </p>
                  {/* ② 농가/산지 — props.local 있을 때만(없으면 생략). 신뢰 강화. */}
                  {local?.name?.trim() || local?.address?.trim() ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium tracking-ko text-text-muted">
                      <MapPin className="size-4 shrink-0 text-text-subtle" strokeWidth={2} />
                      <span className="min-w-0 truncate">
                        {[local?.name?.trim(), local?.address?.trim()]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </p>
                  ) : null}
                  {/* ② 신선 원물 strip — isFresh 일 때만. 수확·발송 예정일 + 한정 수량. 시세 미표시. */}
                  {commerce.isFresh ? (
                    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
                      <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                        <Sprout className="size-4 shrink-0 text-text-strong" strokeWidth={2} />
                        신선 원물
                      </span>
                      {commerce.harvestDate ? (
                        <p className="flex items-center gap-1.5 text-sm font-medium tracking-ko text-text-muted">
                          <CalendarDays
                            className="size-4 shrink-0 text-text-subtle"
                            strokeWidth={2}
                          />
                          {(() => {
                            const parts = String(commerce.harvestDate).split("-");
                            const mm = parts[1];
                            const dd = parts[2];
                            return mm && dd
                              ? `${Number(mm)}월 ${Number(dd)}일 수확·발송 예정`
                              : String(commerce.harvestDate);
                          })()}
                        </p>
                      ) : null}
                      {commerce.stockLimit != null ? (
                        <span className="inline-flex w-fit items-center rounded-md border border-border bg-bg px-2 py-0.5 text-xs font-semibold tracking-ko text-text-strong">
                          {commerce.stockLimit}개 한정
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {/* 나-2 — 상품 저장 카피(나-1). 있으면 헤드라인+셀링포인트 리치 표시(없으면 회귀 0). */}
                  {commerce.headline ? (
                    <p className="text-base font-bold leading-snug tracking-ko text-text-strong">
                      {commerce.headline}
                    </p>
                  ) : null}
                  {commerce.sellingPoints && commerce.sellingPoints.length > 0 ? (
                    <ul className="space-y-1.5">
                      {commerce.sellingPoints.map((sp, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-muted"
                        >
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-text-strong"
                            strokeWidth={2.5}
                          />
                          <span>{sp}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {commerce.selfUpload ? (
                    // ③b 자체업로드 상품 — 1차 버튼 = 선주문하기. 부모(d.$shareUuid)가 로그인 강제 +
                    //   PreorderSheet(발송일·수량·결제 스텁) 오픈 + create_preorder 호출을 핸들.
                    <ActionButton
                      type="button"
                      className="w-full gap-2"
                      onClick={() => onPreorder?.()}
                    >
                      <ShoppingCart className="size-4" strokeWidth={2} />
                      선주문하기
                    </ActionButton>
                  ) : (
                    <ActionButton
                      type="button"
                      className="w-full"
                      onClick={() => {
                        if (
                          typeof window !== "undefined" &&
                          commerce.buyUrl &&
                          commerce.buyUrl !== "#"
                        ) {
                          window.open(commerce.buyUrl, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      구매하기
                    </ActionButton>
                  )}
                </div>
              </div>
            </section>
          ) : (
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
          ))}

        {/* B 상품 홍보 카드 — 리치(큰 이미지 + 헤드라인 + 셀링포인트 + 구매버튼). "관련 상품"보다 상단·강조.
            업주 1인칭 홍보물. 탭/구매 → 그 상품 카드(/d/{refShareUuid}). 없으면 미표시. */}
        {promoCards && promoCards.length > 0 && (
          <section data-testid="promo-cards" className="space-y-4">
            {promoCards.map((p, i) => (
              <article
                key={p.refDropId ?? `promo-${i}`}
                className="overflow-hidden rounded-2xl border border-border bg-bg"
              >
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="aspect-square w-full object-cover sm:aspect-[4/3]"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-surface sm:aspect-[4/3]">
                    <Package className="size-10 text-text-subtle" strokeWidth={1.5} />
                  </div>
                )}
                <div className="p-4">
                  {p.headline ? (
                    <h2 className="text-lg font-extrabold leading-snug tracking-ko text-text-strong">
                      {p.headline}
                    </h2>
                  ) : (
                    <h2 className="text-lg font-extrabold leading-snug tracking-ko text-text-strong">
                      {p.name}
                    </h2>
                  )}
                  <p className="mt-1 text-sm font-bold tracking-ko text-text-strong">
                    {p.priceKrw != null ? `${p.priceKrw.toLocaleString("ko-KR")}원` : "가격 미정"}
                  </p>
                  {p.sellingPoints.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {p.sellingPoints.map((sp, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-muted"
                        >
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-text-strong"
                            strokeWidth={2.5}
                          />
                          <span>{sp}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.refShareUuid && (
                    <a
                      href={`/d/${p.refShareUuid}`}
                      data-testid="promo-buy"
                      className={`mt-4 ${WIZARD_PRIMARY_BUTTON_CLASS}`}
                    >
                      상품 보러가기
                    </a>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        {/* ③ 관련 상품 — 담은 상품(attached). 본체 커머스/영상/쿠폰/예약 렌더와 독립.
            탭 → 그 상품 자체 카드(/d/{refShareUuid}) 인앱 이동. 없으면 미표시. */}
        {attachedProducts && attachedProducts.length > 0 && (
          <section data-testid="related-products">
            <h2
              className={cn(
                "text-sm font-bold tracking-ko",
                resolvedVariant === "info" ? "text-text-strong" : "text-white",
              )}
            >
              관련 상품
            </h2>
            <ul className="mt-3 space-y-2">
              {attachedProducts.map((p) => {
                const inner = (
                  <>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="size-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="size-14 shrink-0 rounded-lg bg-surface" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-ko text-text-strong">
                        {p.name}
                      </p>
                      {/* 나-2 — 저장 카피 헤드라인을 짧은 태그라인으로(컴팩트). 없으면 미표시(회귀 0). */}
                      {p.headline ? (
                        <p className="truncate text-xs font-medium tracking-ko text-text-subtle">
                          {p.headline}
                        </p>
                      ) : null}
                      <p className="text-xs font-medium tracking-ko text-text-muted">
                        {p.priceKrw != null
                          ? `${p.priceKrw.toLocaleString("ko-KR")}원`
                          : "가격 미정"}
                      </p>
                    </div>
                  </>
                );
                return (
                  <li key={p.refDropId}>
                    {p.refShareUuid ? (
                      <a
                        href={`/d/${p.refShareUuid}`}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3 transition-colors hover:border-text-subtle"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3 opacity-60">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {resolvedVariant === "lead" && <ConsultationLeadForm partnerName={safeLocal.name} />}

        {/* 4. 목적별 CTA — info는 하단 푸터(링크·카톡)만. v7.2: 쿠폰은 본문 CTAS
            비우고 sticky 단일 액션 으로. purchase/lead 만 본문 CTAS 사용. */}
        {ctas.length > 0 && (
          <section>
            <h2
              className={cn(
                "text-sm font-bold tracking-ko",
                resolvedVariant === "info" ? "text-text-strong" : "text-white",
              )}
            >
              {pageCopy.ctaHeading}
            </h2>
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

        {/* v7.2 — 보조 연락 row. 쿠폰/예약 드롭에만, 매장 정보 있을 때만.
            전화/문자/길찾기 가로 아이콘. 60대 친화 큰 터치. */}
        {(resolvedVariant === "coupon" || isReservation) &&
          (hasPhone || Boolean(safeLocal.address?.trim() || safeLocal.name?.trim())) && (
            <section data-testid="secondary-contact-row" className="flex items-stretch gap-2">
              {hasPhone ? (
                <button
                  type="button"
                  onClick={() => handleCtaClick("phone")}
                  className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-semibold tracking-ko text-[#0F172A] hover:bg-[#FAFAFA]"
                  aria-label="전화 문의"
                >
                  <Phone className="size-5 text-[#0A0A0A]" strokeWidth={2} />
                  전화
                </button>
              ) : null}
              {hasPhone ? (
                <button
                  type="button"
                  onClick={() => handleCtaClick("sms")}
                  className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-semibold tracking-ko text-[#0F172A] hover:bg-[#FAFAFA]"
                  aria-label="문자 문의"
                >
                  <MessageSquare className="size-5 text-[#0A0A0A]" strokeWidth={2} />
                  문자
                </button>
              ) : null}
              {safeLocal.address?.trim() || safeLocal.name?.trim() ? (
                <button
                  type="button"
                  onClick={() => handleCtaClick("directions")}
                  className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-semibold tracking-ko text-[#0F172A] hover:bg-[#FAFAFA]"
                  aria-label="길찾기"
                >
                  <MapPin className="size-5 text-[#0A0A0A]" strokeWidth={2} />
                  길찾기
                </button>
              ) : null}
            </section>
          )}

        {/* c-1 — 순수 쿠폰 카드 + 네이버형 매장(reservation_url 보유) 일 때만 보조 예약 링크.
            예약-목적/결합 카드엔 미렌더(인앱 펀널 우선). 주요 CTA 아닌 서브틀 외부 링크. */}
        {isCoupon && !isCombined && local?.reservationUrl ? (
          <a
            href={local.reservationUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="coupon-naver-reservation"
            className="flex items-center justify-center gap-1.5 text-xs font-medium tracking-ko text-white/60 underline-offset-2 transition-colors hover:text-white/80 hover:underline"
          >
            <ExternalLink className="size-3.5" strokeWidth={2} />
            네이버에서 예약하기
          </a>
        ) : null}
      </div>

      {/* G2 멀티소스 — primary 외 담은 콘텐츠(영상=링크, 글=링크 카드). 원문 새 탭. */}
      {attachedVideos && attachedVideos.length > 0 ? (
        <section className="mx-auto w-full max-w-[480px] px-6 pt-4">
          <Accordion
            type="single"
            collapsible
            className="rounded-2xl border border-border bg-surface px-4"
          >
            <AccordionItem value="related-content" className="border-b-0">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-sm font-bold tracking-ko text-text-strong">관련 콘텐츠</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3">
                  {attachedVideos.map((v) => {
                    const isArticle = v.type === "article";
                    const sourceLabel =
                      v.authorName?.trim() ||
                      (v.provider === "naver_news"
                        ? "네이버 뉴스"
                        : v.provider === "naver_blog"
                          ? "네이버 블로그"
                          : "");
                    return (
                      <li key={v.sourceId || v.sourceUrl}>
                        <a
                          href={v.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-2 transition-colors hover:border-[#D4D4D4]"
                        >
                          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5]">
                            {v.thumbnailUrl ? (
                              <img
                                src={v.thumbnailUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[#A3A3A3]">
                                {isArticle ? (
                                  <FileText className="size-5" strokeWidth={2} />
                                ) : (
                                  <Play className="size-5" strokeWidth={2} />
                                )}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-bold tracking-ko text-[#0A0A0A]">
                              {v.title || (isArticle ? "담은 글" : "담은 영상")}
                            </p>
                            {sourceLabel ? (
                              <p className="mt-0.5 truncate text-xs font-medium tracking-ko text-[#737373]">
                                {sourceLabel}
                              </p>
                            ) : null}
                            {isArticle && v.snippet ? (
                              <p className="mt-0.5 line-clamp-1 text-[11px] font-medium tracking-ko text-[#A3A3A3]">
                                {v.snippet}
                              </p>
                            ) : null}
                          </div>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      ) : null}

      {/* v7.2 5a — 하단 공유 블록 (모든 드롭 공통).
            [LinkDrop][링크 복사][친구에게 보내기] 가로 3 버튼.
            Slice 1: '친구에게 보내기'(= 기존 카카오 재공유) 1차 강조(검정 fill).
            본문 small 카톡·"나도 이런 정보..." 텍스트 링크·sticky 카톡 분기
            전부 통합. 60대 친화 큰 터치, #15 검정 미니멀, 이모지 X. */}
      <section className="mx-auto w-full max-w-[480px] space-y-3 px-6 pt-4">
        {copyFeedback && (
          <p
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              resolvedVariant === "info" ? "text-text-strong" : "text-white",
            )}
          >
            <Check className="size-4 text-intent-success" strokeWidth={2} />
            {copyFeedback}
          </p>
        )}
        <ErrorMessage message={shareError} />

        <div className="flex items-stretch gap-2" data-testid="share-block">
          {/* 연결 — '이 영상으로 만들기' = /create-wizard?url= prefill 진입(위저드 자동 메타fetch).
              selfUpload(자체업로드 상품)은 영상 원본이 없어 숨김. */}
          {videoSourceUrl && !commerce?.selfUpload ? (
            <a
              href={`/create-wizard?url=${encodeURIComponent(videoSourceUrl)}`}
              className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-semibold tracking-ko text-[#0F172A] hover:bg-[#FAFAFA]"
              aria-label="이 영상으로 만들기"
            >
              <Plus className="size-5 text-[#0A0A0A]" strokeWidth={2} />이 영상으로 만들기
            </a>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-semibold tracking-ko text-[#0F172A] hover:bg-[#FAFAFA]"
            aria-label="링크 복사"
          >
            <Copy className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            링크 복사
          </button>
          {/* Slice 1 — 받은 사람의 재공유(루프 닫기) 1차 액션. 동작은 기존
              onKakaoShare(=ld_create_share_edge_v3 재공유) 그대로. 검정 fill 로 강조. */}
          <button
            type="button"
            onClick={handleKakao}
            className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl bg-[#0A0A0A] px-2 py-2 text-xs font-bold tracking-ko text-white hover:bg-[#171717]"
            aria-label="친구에게 보내기"
          >
            <MessageCircle className="size-5 text-white" strokeWidth={2} />
            친구에게 보내기
          </button>
        </div>

        <p
          className={cn(
            "text-center text-[10px] leading-tight tracking-ko",
            resolvedVariant === "info" ? "text-[#A3A3A3]" : "text-white/50",
          )}
        >
          본 콘텐츠는 LinkDrop 광고/제휴 안내가 적용됩니다. (FTC 권고 사항)
        </p>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsReportSheetOpen(true)}
            className={cn(
              "inline-flex items-center gap-1 bg-transparent text-[11px] underline underline-offset-2",
              resolvedVariant === "info" ? "text-[#525252] hover:text-[#0A0A0A]" : "text-white/70 hover:text-white",
            )}
          >
            <Flag size={11} strokeWidth={2} />
            문제 신고
          </button>
        </div>
      </section>

      {/* v7.2 5b — sticky 하단 바: funnelCoupon + onReserveAndClaim 있을
            때만 단일 액션. 카카오톡 공유는 위 공유 블록으로 이전 (sticky 미사용).
            정보/구매/상담 드롭 = sticky 없음. */}
      {funnelCoupon && onReserveAndClaim && !isCombined && isCoupon ? (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#E5E7EB] bg-white">
          <div className="mx-auto w-full max-w-[480px] px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <button
              type="button"
              onClick={onReserveAndClaim}
              data-testid="cta-sticky-primary"
              className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#0A0A0A] px-4 text-base font-bold text-white hover:bg-[#171717]"
            >
              <span className="truncate">쿠폰 받기</span>
            </button>
          </div>
        </div>
      ) : null}
      <AbuseReportSheet
        isOpen={isReportSheetOpen}
        onClose={() => setIsReportSheetOpen(false)}
        dropId={dropId}
      />

      {/* 트랙 D §50 — 매장 구독 동의 팝업. 필수 동의 체크 게이트 + (광고)/무료 수신거부 안내. */}
      {partnerId ? (
        <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
          <DialogContent className="max-w-[400px] rounded-2xl tracking-ko">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-text-strong">
                {safeLocal.name} 소식 구독
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-text-muted">
                구독을 하시면 예약·쿠폰 등 다양한 혜택을 받아 보실 수 있어요
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-strong">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 rounded border-border accent-[#0A0A0A]"
                />
                <span>
                  <span className="font-bold">[필수]</span> 광고성 정보(소식·쿠폰) 수신에
                  동의합니다.
                </span>
              </label>
              <p className="text-[11px] leading-relaxed tracking-ko text-text-subtle">
                구독하시면 {safeLocal.name}의 다양한 혜택·쿠폰·이벤트를 받아보실 수 있어요.
                수신거부는 언제든 마이페이지 &gt; 구독한 메이커에서 무료로 가능해요.
              </p>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSubscribeOpen(false)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-bold tracking-ko text-text-strong hover:bg-surface"
              >
                취소
              </button>
              <button
                type="button"
                data-testid="subscribe-confirm"
                disabled={!consentChecked || subscribing}
                onClick={handleSubscribeConfirm}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-[#0A0A0A] px-4 text-sm font-bold tracking-ko text-white hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {subscribing ? "처리 중…" : "동의하고 구독"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* 트랙 D — 구독 관리 팝업(옵션 A). "구독중" 칩 탭 시 오픈. 하단 수신거부. */}
      {partnerId ? (
        <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogContent className="max-w-[400px] rounded-2xl tracking-ko">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-text-strong">
                {safeLocal.name} 소식 구독 중
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-text-muted">
                {safeLocal.name}의 소식·혜택을 받고 있어요.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-2">
              <button
                type="button"
                data-testid="unsubscribe-button"
                disabled={unsubscribing}
                onClick={handleUnsubscribe}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-bold tracking-ko text-text-strong transition-colors hover:border-text-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {unsubscribing ? "처리 중…" : "수신거부(구독 취소)"}
              </button>
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[#0A0A0A] px-4 text-sm font-bold tracking-ko text-white hover:bg-[#171717]"
              >
                닫기
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
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
