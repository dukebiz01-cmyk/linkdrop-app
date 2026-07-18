import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Wand2,
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
  Calendar,
  Sprout,
  ExternalLink,
  Info,
  ChevronDown,
  GitBranch,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { type PriceOfferRow } from "@/components/ai-price-comparison-card";
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
// S3-2 — CouponPreview·CardBody·TimerBadge 소비 소멸(수렴 3종의 쿠폰·본체는 CardModelBody 정본).
// S4 — StockMeta 소비 소멸(재고 = 카드 v2 productQty). ProductWidget/buildProductWidget 소비도
//   소멸(purchase 본체 = CardModelBody) — 컴포넌트 자체는 보존(레거시 studio-build 소비 잔존).
// ST2b-2a A2 — 판매기간 D-day 라벨(FIX-39 booster45 순수 모듈 재사용 — 조회 시점 계산).
import { ddayLabel, buildGroupBuyView } from "@/components/card-model/booster45";
// ST2b-2b B1 — 재입고 알림(FIX-41) 실배선 — 락 문구 정본 사용.
import {
  requestRestockAlert,
  RESTOCK_ALERT_CONFIRM_COPY,
  RESTOCK_ALERT_DUPLICATE_COPY,
} from "@/lib/restock-alerts";

// SM-4 — 여정 렌더부 공용 추출분(share-journey.tsx). 타입·타임라인 모두 공용 소비.
import { ShareJourneyTimeline, type ShareJourneyRpcNode } from "@/components/share-journey";
// S3-4e — 사업자 정보 단일 소스(하드코딩 중복 금지) — 법정 푸터 펼침이 재사용.
import { BUSINESS_INFO } from "@/components/business-footer";
import { PurchaseCardBody } from "@/components/card/PurchaseCardBody";
import { CardActionButton } from "@/components/card/CardActionButton";
import { ButtonBlock } from "@/components/card/ButtonBlock";
import { toDropDetailInput } from "@/lib/adapters";
// 거울 수렴 S1 — info 분기만 CardModel 정본 렌더로 마운트(fromDropDetail). 타 variant 무접촉.
import { CardModelBody } from "@/components/card-model/CardModelBody";
import { fromDropDetail } from "@/components/card-model/card-model-adapters";
import { parseVideoUrl } from "@/lib/video-metadata";
import { cn } from "@/lib/utils";
import { trackReceiverEvent } from "@/lib/event-tracking";
import { getBadgeLabel, getBadgeColor, type OfficialStatus } from "@/lib/helpers/drop-status";
import { AbuseReportSheet } from "@/components/abuse-report-sheet";
import { VARIANT_ACCENT } from "@/lib/mode-accent";

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
    /** BADGE-ⓑ(4b) — Droppy 예상 보상(floor(dropy_rate×price_krw), adapters 산출). 미주입=미렌더. */
    dropyReward?: number;
    // ── ST2b-2 — 45 신규 키 ADDITIVE 운반(전부 미주입 = 미렌더, 구 발행 카드 회귀 0) ──
    /** A1 — 상품정보제공고시 스냅샷(FIX-37 표시형 행 그대로). */
    noticeRows?: Array<{ label: string; value: string }>;
    /** A2/A4 — 남은수량 단위 라벨(FIX-45c — '박스'/'망'/'kg' 등). 미주입 = '개'. */
    stockUnitLabel?: string;
    /** B2 — 공동구매 표시 키(폼 유효 통과 저장분만). */
    groupBuy?: { targetN: number; priceKrw: number; deadline: string | null };
    /** B2 — 판매기간 마감(sale_end 영속화) — 부스터 D-day 근거. */
    saleEndIso?: string;
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
    /** DOCK-6 — 출처(원본 생산자명) 스냅샷. 있으면 관련 상품 행에 출처 라인 표시. */
    producerName?: string;
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
    /** S3-4 보정(v8.9) — partners.facilities → 카드 그리드 [시설 정보] 공급. */
    facilities?: string[];
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
  /** Phase 1-C — 마감 기준(ISO): min(coupon.valid_until, share_events.expires_at). 미주입=타이머 미렌더. */
  expiresAt?: string;
  /** Phase 1-C(L6) — 서버 기준시각(ISO): use-countdown offset 보정. */
  serverNow?: string;
  /** Phase 1-C — 파생 재고(get_drop_detail.remaining_stock, L4: 공급값 표시만). */
  remainingStock?: number | null;
  /** P6-4(N4) — 열람자 사업자 여부: true 면 "나도 만들기"(Wand2) = /studio-build 직결.
   *  false/미주입(무세션 포함) = 현행 /create-wizard 경로(S5c) 그대로. */
  isViewerBusiness?: boolean;
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
// S17(P4) — footerSlot: 손님 공유 푸터를 폼 컨테이너 내부 최하단에 인입(ProductWidget 동일 패턴).
function ConsultationLeadForm({
  partnerName,
  footerSlot,
}: {
  partnerName: string;
  footerSlot?: ReactNode;
}) {
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
        {/* S17(P4) — 접수 완료 후에도 공유 푸터는 컨테이너 내부 최하단 유지. */}
        {footerSlot}
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
      {/* S17(P4) — 공유 푸터 인입: 폼 컨테이너(카드) 내부 최하단. 내부 버튼은 전부 type="button"
          (a·button)이라 form submit 과 충돌 없음. */}
      {footerSlot}
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
  expiresAt,
  serverNow,
  remainingStock,
  isViewerBusiness,
}: InfoDropPageProps) {
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  // S3-4e — 법정 푸터 사업자 정보 인라인 펼침(Radix 0).
  const [bizOpen, setBizOpen] = useState(false);
  // S4 — 재입고 알림: 카드 v2 내 버튼(boosterChips 품절 게이트) → 페이지 액션. 구
  //   RestockAlertButton 의 신청 로직·4상태 문구를 페이지 소관으로 승계(정의는 하단 보존).
  const [restockPhase, setRestockPhase] = useState<
    "idle" | "busy" | "created" | "duplicate" | "unauthenticated" | "error"
  >("idle");
  const handleRestockAlert = () => {
    if (restockPhase === "busy" || restockPhase === "created" || restockPhase === "duplicate")
      return;
    setRestockPhase("busy");
    void requestRestockAlert(dropId).then((r) =>
      setRestockPhase(
        r === "created"
          ? "created"
          : r === "duplicate"
            ? "duplicate"
            : r === "unauthenticated"
              ? "unauthenticated"
              : "error",
      ),
    );
  };
  // 4상태 문구(RestockAlertButton 동일 카피) — idle/busy = 미렌더. 콘텐츠 존(슬립 뒤)에 표시.
  const restockFeedback =
    restockPhase === "created" || restockPhase === "duplicate" ? (
      <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium leading-relaxed tracking-ko text-text-muted [word-break:keep-all]">
        {restockPhase === "duplicate" ? RESTOCK_ALERT_DUPLICATE_COPY : RESTOCK_ALERT_CONFIRM_COPY}
      </p>
    ) : restockPhase === "unauthenticated" ? (
      <p className="text-xs font-medium tracking-ko text-text-subtle">
        로그인하면 재입고 알림을 받을 수 있어요.
      </p>
    ) : restockPhase === "error" ? (
      <p className="text-xs font-medium tracking-ko text-text-subtle">
        지금은 신청이 안 됐어요 — 잠시 후 다시 시도해 주세요.
      </p>
    ) : null;
  // 트랙 D §50 — 매장(partnerId) 구독. me.tsx handleSubscribe 패턴 재사용(maker_follows, 스키마 0).
  const [subscriberUserId, setSubscriberUserId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  // 구독 관리 팝업(옵션 A) — "구독중" 칩 탭 시 오픈. 하단 수신거부(unfollow) 진입점.
  const [manageOpen, setManageOpen] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);

  // SM-2 — 공유 여정 아코디언(기본 접힘·lazy). 펼침 시 get_share_journey 1회, 재펼침 =
  //   컴포넌트 state 캐시(리마운트 전까지 — 체인은 열람 중 급변하지 않음). share_uuid 는
  //   클릭 시점에 URL(/d/{uuid})에서 파생(SSR 안전 — window 미접근 렌더 경로 0).
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyRows, setJourneyRows] = useState<ShareJourneyRpcNode[] | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState(false);
  // S3-4 §5 — fetch 를 toggle 에서 분리(전달 슬립 지도의 접힌 홉 체인이 로드 시점 데이터 필요).
  //   RPC·마스킹·캐시 원칙 무수정 — 호출 시점만 eager 로 앞당김(신규 RPC 0, 표시만).
  async function loadJourney() {
    if (journeyRows || journeyLoading) return; // 캐시(RPC 재호출 0)
    const m =
      typeof window !== "undefined"
        ? window.location.pathname.match(/\/d\/([0-9a-fA-F-]{36})/)
        : null;
    if (!m) {
      setJourneyError(true); // mock(/d/test 등) — 실체인 없음 → 오류 1줄(카드 가용성 무영향)
      return;
    }
    setJourneyLoading(true);
    try {
      // get_share_journey 는 types.ts 미반영(TEMP — 타입 재생성 후 캐스트 제거).
      const { data, error } = (await getSupabase().rpc(
        "get_share_journey" as never,
        { p_share_uuid: m[1] } as never,
      )) as { data: unknown; error: unknown };
      if (error || !Array.isArray(data)) {
        setJourneyError(true);
        return;
      }
      setJourneyRows(data as ShareJourneyRpcNode[]);
      setJourneyError(false);
    } catch {
      setJourneyError(true);
    } finally {
      setJourneyLoading(false);
    }
  }
  async function toggleJourney() {
    const next = !journeyOpen;
    setJourneyOpen(next);
    if (next) await loadJourney();
  }
  // S3-4 §5 — 지도(접힌 홉 체인)용 eager 1회 로드. 마운트 시점 1회 — 재렌더 무발화(ref 가드).
  const journeyEagerRef = useRef(false);
  useEffect(() => {
    if (journeyEagerRef.current) return;
    journeyEagerRef.current = true;
    void loadJourney();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // C5 — 흰 셸 미러: 메이커가 흰 카드(#FFFFFF) 저장 시 손님도 라이트 텍스트로(스튜디오 C4b와 동일 판정).
  //   기존 카드(cardColor null/navy 등) → false → 비-info 다크 셸 기존 흰 텍스트 그대로(회귀 0).
  const isLightCard = cardColor === "#FFFFFF";
  // 거울 수렴 S2·S3-1·S4 — 라이트 셸 판정 단일화: info(S1)·coupon(S2)·reservation(S3-1)·
  //   purchase(S4)는 CardModelBody 흰 카드(FIX-56 정본) 위라 페이지 크롬 텍스트도 항상 다크.
  //   잔존 variant(lead)는 기존 isLightCard 판정 그대로(무접촉) — S5 몫.
  const isLightShell =
    resolvedVariant === "info" ||
    resolvedVariant === "coupon" ||
    resolvedVariant === "reservation" ||
    resolvedVariant === "purchase" ||
    isLightCard;
  // C13 S4b — 목적색(스튜디오 MODE_ACCENT 와 단일 소스). 1차 CTA(Wand2·sticky 쿠폰받기·주문예약) 배경에 전파.
  //   미매핑 변형이면 검정(#0A0A0A) 폴백 = 기존 색 유지(회귀 0).
  const accent = VARIANT_ACCENT[resolvedVariant] ?? "#0A0A0A";
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
  // S3-0 — 결합 판정 정합(Day20 락: 결합 = sticky 미표시): 파트너 캘린더 표시 카드
  //   (coupon+partnerId, showReservationCalendar)도 결합으로 판정. isReservation 은
  //   showReservationCalendar(:855)에 포함되어 승계.
  const isCombined = hasFunnelCoupon && (hasReservationDates || showReservationCalendar);
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
      // phase1 FIX: 둘 다 funnelCoupon claim_coupon 만 트리거(예약 INSERT 없음).
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

  // S18-A(P4) — 카드 내부 "쿠폰 받기" CTA 가시성 관찰: 보이면(threshold 0.5) sticky 숨김, 벗어나면 복귀.
  //   IO 미지원·스크립트 미실행·SSR = visible=false 유지 → sticky 항상 표시(현행 동작 폴백).
  const inlineCouponCtaRef = useRef<HTMLDivElement | null>(null);
  const [inlineCouponCtaVisible, setInlineCouponCtaVisible] = useState(false);
  useEffect(() => {
    if (!hasStickyBar) return;
    const el = inlineCouponCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setInlineCouponCtaVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasStickyBar]);

  // 3b-1 — 예약/쿠폰 하단 블록 const 호이스팅(IIFE → 컴포넌트 스코프). 콘텐츠 0변화, 위치만.
  //   CardBody 주입(3b-3)이 쿠폰(L1030)·예약(L1076) 호출부에서 이 const 들을 참조하기 위함.
  //   IIFE 는 셸만 남겨 return JSX·순서·조건 그대로(아래 showReservationCalendar 블록).
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

  // 예약 활성 버튼은 캘린더 내부(reservation-calendar-page)의 단일 [예약하기]로 일원화
  //   (중복 제거). 여기선 슬롯 흐름이 깨졌을 때(onReservationRequest 부재) 안전 안내 1줄만.
  const reserveNotice = !onReservationRequest ? (
    <p className={`text-xs font-medium tracking-ko ${isLightShell ? "text-text-muted" : "text-white/70"}`}>
      예약 신청을 받을 수 없는 매장이에요.
    </p>
  ) : null;

  // 빌링 X 고지 — Duke 요구. 결제는 매장에서. 예약 ButtonBlock 펼침 안으로 흡수(자기완결).
  const billingNotice = (
    <p
      data-testid="billing-notice"
      className={`text-[12px] leading-relaxed tracking-ko ${isLightShell ? "text-text-muted" : "text-white/55"}`}
    >
      결제는 매장에서 직접 진행돼요. 자세한 내용은 매장에 문의해 주세요.
    </p>
  );

  // S3-2 — 구 쿠폰 패널 체인(couponTimer→couponPanel→benefitEventSection·combinedCouponOnlyCta)
  //   제거: S2(coupon)·S3-1(reservation) 수렴으로 소비 소멸(참조 0 grep 확인). 타이머·쿠폰
  //   표시는 CardModelBody 내장 쿠폰 존(couponExpiresAt·serverNow 관통)이 정본.

  // CC#2 (a) — 진행 이벤트 요약(makerAvailableDates 의 eventTitle/eventDescription).
  //   캘린더 내부 상세 리스트 카드(reservation-calendar-page)는 데이터·소스 그대로 유지.
  //   여기선 "진행 이벤트" 요약만 병치(merge 아님). 둘은 독립 소스.
  const eventItems = (reservationDates ?? []).filter(
    (d) => Boolean(d.eventTitle?.trim()) || Boolean(d.eventDescription?.trim()),
  );
  const hasEvents = eventItems.length > 0;

  // 거울 수렴 S2 — 진행 이벤트 요약 추출: coupon 신 경로는 카드 밖 크롬으로 단독 렌더(쿠폰부는
  //   CardModelBody 내장 쿠폰 존이 대체), reservation 구 경로는 benefitEventSection 합성 그대로.
  //   헤딩 색 = isLightShell(coupon 라이트 셸 다크 · reservation navy 흰색 유지).
  const eventsSection = hasEvents ? (
    <div className="space-y-2">
      <h2 className={`text-sm font-bold tracking-ko ${isLightShell ? "text-text-strong" : "text-white"}`}>
        진행 이벤트
      </h2>
      <ul className="space-y-2">
        {eventItems.map((item) => (
          <li key={item.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
            {item.eventTitle?.trim() ? (
              <p className="text-sm font-bold tracking-ko text-[#0F172A]">{item.eventTitle}</p>
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
  ) : null;

  // 3b-2 — 정보 보기(연락) 블록 const 추출. 콘텐츠 0변화(handleCtaClick 결선 그대로).
  //   S3-2 — 예약 실행 카드(coupon·reservation 분기) 하단에 편입 렌더.
  const contactRow =
    hasPhone || Boolean(safeLocal.address?.trim() || safeLocal.name?.trim()) ? (
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
    ) : null;

  // v0 원안 공유 푸터 — 카드 안 아이콘 줄(영상만들기 주 버튼 + 링크복사/친구에게보내기 아이콘 + 고지 + 신고).
  //   CardBody.shareFooter 슬롯(info/coupon/reservation = 카드 본문 맨 아래)과 비-CardBody variant(purchase/lead)
  //   페이지 레벨 양쪽에서 동일 마크업 재사용. 핸들러 1:1 보존: handleKakao=체인시드 / handleCopy / create-wizard href / 신고.
  // S7 — 형님 확정 A: AI요약을 카드 내부·푸터 위로(preFooterSlot). 스튜디오 정본(AI콘텐츠=푸터 위)과 정합.
  //   기존 카드 밖 아코디언(구 :1458 위치)에서 이 변수로 추출 — 게이트/내부 로직/스타일 불변, 위치만 이동.
  const aiSummaryAccordion =
    !isReservation && !commerce?.selfUpload ? (
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
    ) : null;

  // S17(P4) — 단일 마크업을 light 파라미터 함수로: 기존 소비처(카드색 기반)는 shareFooter 그대로,
  //   흰 카드 프레임 안 인입(purchase ProductWidget footerSlot·lead 폼)은 renderShareFooter(true)로
  //   라이트 스타일 강제(navy 페이지 배경과 무관하게 카드 안은 흰 바탕). 마크업·핸들러 복제 0.
  // S5c/S9/P6-4 — 나도 만들기 목적지(기존 체인 무수정 — 지점③은 스킨만).
  const remakeHref = isViewerBusiness
    ? "/studio-build"
    : videoSourceUrl && !commerce?.selfUpload
      ? `/create-wizard?url=${encodeURIComponent(videoSourceUrl)}&purpose=${resolvedVariant}`
      : `/create-wizard?purpose=${resolvedVariant}`;
  const remakeLabel = videoSourceUrl && !commerce?.selfUpload ? "이 영상으로 나도 만들기" : "나도 만들기";
  // ── S3-4 §5 — 공유 여정 지도(슬립 상단). 데이터 = 기존 get_share_journey 체인(신규 RPC 0,
  //    마스킹 유지 · 조회수/현금 문구 금지). 접힘 = 헤더 + 홉 체인 1줄 · 탭 = 인라인 펼침(Radix 0).
  const journeyViewerIdx = journeyRows?.findIndex((r) => r.is_viewer) ?? -1;
  const journeyNodes = journeyRows ?? [];
  const hopsBeforeMe = journeyViewerIdx >= 0 ? journeyViewerIdx : journeyNodes.length;
  const journeyChain = (() => {
    const before = journeyNodes.filter((_, i) => (journeyViewerIdx < 0 ? true : i < journeyViewerIdx));
    let chain: Array<{ label: string; ellipsis?: boolean }> = before.map((_, i) => ({
      label: String(i + 1),
    }));
    if (chain.length === 0) chain = [{ label: "1" }]; // 데이터 전 최소 체인(만든 곳)
    // §5 — 홉 4개 초과 시 축약: 1 ··· N-1 → N → 나.
    if (chain.length > 4)
      chain = [chain[0], { label: "···", ellipsis: true }, chain[chain.length - 2], chain[chain.length - 1]];
    return chain;
  })();
  const journeyMap = (
    <div
      data-testid="journey-map"
      className="rounded-xl bg-[#F8FAFC] p-3"
      style={{ boxShadow: "inset 0 0 0 1px #E8EDF3" }}
    >
      <button
        type="button"
        onClick={() => void toggleJourney()}
        aria-expanded={journeyOpen}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold tracking-ko text-text-strong">공유 여정</span>
          <span className="flex items-center gap-1 text-[11px] font-medium tracking-ko text-text-muted">
            {hopsBeforeMe > 0 ? `${hopsBeforeMe}명을 거쳐 도착` : "첫 번째로 도착"}
            <ChevronDown
              className={`size-3.5 transition-transform ${journeyOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </span>
        </div>
        {/* 홉 체인 — 번호 원 26px 실선 연결, '나' 앞 구간만 점선(아직 안 이어진 길), 나 = 28px 진한 채움. */}
        <div className="mt-2.5 flex items-center" aria-hidden>
          {journeyChain.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="h-[2px] min-w-3 flex-1 bg-[#CBD5E1]" />}
              <span
                className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  c.ellipsis
                    ? "text-[#94A3B8]"
                    : "border border-[#CBD5E1] bg-white text-[#475569]"
                }`}
              >
                {c.label}
              </span>
            </Fragment>
          ))}
          <span className="min-w-3 flex-1 border-t-2 border-dashed border-[#CBD5E1]" />
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-[11px] font-bold text-white">
            나
          </span>
        </div>
      </button>
      {journeyOpen && (
        <div className="mt-3 border-t border-[#E8EDF3] pt-2.5">
          {journeyLoading ? (
            <p className="text-[11px] font-medium tracking-ko text-text-subtle">여정을 불러오는 중…</p>
          ) : journeyError ? (
            <p className="text-[11px] font-medium tracking-ko text-text-subtle">
              여정을 불러오지 못했어요
            </p>
          ) : (
            <>
              <ol className="space-y-1.5">
                {journeyNodes.map((n, i) => (
                  <li key={n.position} className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        n.is_viewer
                          ? "bg-[#0F172A] text-white"
                          : "border border-[#CBD5E1] bg-white text-[#475569]"
                      }`}
                    >
                      {n.is_viewer ? "나" : i + 1}
                    </span>
                    <span className="text-[12px] font-semibold tracking-ko text-text-strong">
                      {n.is_viewer
                        ? "지금 보는 중 — 다음 번호는 내 친구"
                        : i === 0
                          ? `${n.masked_name} (만든 곳)`
                          : `${n.masked_name}님이 전달`}
                    </span>
                  </li>
                ))}
                {journeyNodes.length === 0 && (
                  <li className="text-[11px] font-medium tracking-ko text-text-subtle">
                    아직 공유 여정이 없어요
                  </li>
                )}
              </ol>
              <p className="mt-2 text-[10px] font-medium leading-relaxed tracking-ko text-text-subtle">
                다른 참여자는 개인정보 보호로 익명 표시 · 기여도만 집계
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );

  // ── S3-4 §4 — 전달 슬립(수신 전용 페이지 존 — 스튜디오 거울 대상 아님. 카드는 쿠폰존 마감).
  //    꼬리표(세로선→원→세로선)로 카드 하단과 연결. 슬립 = 흰 카드(radius 14 · 보더 0.5px).
  const deliverySlip = (
    <div data-testid="delivery-slip" className="-mt-3">
      <div className="flex flex-col items-center" aria-hidden>
        <span className="h-2.5 w-[2px] bg-[#CBD5E1]" />
        <span className="h-2.5 w-2.5 rounded-full border-2 border-[#CBD5E1] bg-white" />
        <span className="h-2.5 w-[2px] bg-[#CBD5E1]" />
      </div>
      <section className="space-y-3 rounded-[14px] border-[0.5px] border-[#E2E8F0] bg-white p-4">
        {journeyMap}
        <p className="text-center text-[13px] font-semibold tracking-ko text-text-muted">
          다음 번호를 이어보세요
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleKakao}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl bg-[#FEE500] text-[13px] font-bold tracking-ko text-[#191919] transition-transform duration-150 active:translate-y-px"
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
            친구에게 보내기
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-[#D4D4D8] bg-white text-[13px] font-bold tracking-ko text-text-strong transition-transform duration-150 active:translate-y-px"
          >
            <Copy className="h-5 w-5" strokeWidth={2.25} />
            링크 복사
          </button>
        </div>
      </section>
    </div>
  );

  // S3-3 ⑦ — withActions=false: 공유 3액션은 카드/슬립이 담당하는 수렴 variant 용 법정-only
  //   모드. S3-4 §4: 법정 뮤트 블록 = FTC 고지 + 문제 신고(11~12px 중앙). 공유 여정 링크는
  //   슬립의 지도(§5)로 대체 — withActions=true(비수렴 variant)에서만 기존 버튼 유지.
  const renderShareFooter = (light: boolean, withActions = true) => (
    <div data-testid="share-footer">
      {!withActions ? null : light ? (
        // S3-2 지점③(FIX-55 파킹 해제) — 라이트 푸터 정본화: 아이콘 단독 금지(60대 친화),
        //   [매직봉+라벨 명시] + [링크 복사] + [친구에게 보내기] 3액션 라벨 행.
        //   href/핸들러/체인 로직 무수정 — 스킨만. 비-light(잔존 variant 네이비)는 기존 유지.
        <div data-testid="share-block" className="mt-4 space-y-2">
          <a
            href={remakeHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={remakeLabel}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold tracking-ko text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)]"
            style={{ backgroundColor: accent }}
          >
            <Wand2 className="h-5 w-5" strokeWidth={2.25} />
            {remakeLabel}
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              aria-label="링크 복사"
              className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#F5F5F5] text-sm font-bold tracking-ko text-text-strong ring-1 ring-inset ring-[#E5E5E5]"
            >
              <Copy className="h-4 w-4" strokeWidth={2.25} />
              링크 복사
            </button>
            <button
              type="button"
              onClick={handleKakao}
              aria-label="친구에게 보내기"
              className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#F5F5F5] text-sm font-bold tracking-ko text-text-strong ring-1 ring-inset ring-[#E5E5E5]"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
              친구에게 보내기
            </button>
          </div>
        </div>
      ) : (
        <div data-testid="share-block" className="mt-4 flex items-center gap-2">
          {/* S5b — 형님 확정 A: 푸터 4면 동일. 영상 무 카드는 Wand2=나도 만들기(스튜디오 진입, 캐처→드로퍼 루프). */}
          {/* S9 — 새 탭: 보던 카드 보존 + 위저드 작업 보호 (리포 확립 패턴: 외부 진입=새 탭) */}
          <a
            href={remakeHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={remakeLabel}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white text-[#0A0A0A] shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
          >
            <Wand2 className="h-[22px] w-[22px]" strokeWidth={2.25} />
          </a>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="링크 복사"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/25"
          >
            <Copy className="h-5 w-5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={handleKakao}
            aria-label="친구에게 보내기"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/25"
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
      )}
      {withActions ? (
        // 비수렴(purchase 폴백·lead): FTC 1줄 + 문제신고 텍스트링크 + 공유여정 버튼(기존 무접촉).
        <>
          <p className={`mt-3 text-center text-[11px] leading-relaxed ${light ? "text-text-subtle" : "text-white/45"}`}>
            본 콘텐츠는 LinkDrop 광고·제휴 안내가 적용됩니다. (FTC 권고)
          </p>
          <button
            type="button"
            onClick={() => setIsReportSheetOpen(true)}
            className={`mt-2 mx-auto flex items-center gap-1 text-[11px] underline underline-offset-2 ${light ? "text-text-subtle" : "text-white/50"}`}
          >
            문제 신고
          </button>
          {/* SM-2 — 공유 여정 아코디언(비수렴 전용 — 수렴은 슬립 지도가 대체). 락 전부 상속. */}
          <button
            type="button"
            onClick={() => void toggleJourney()}
            aria-expanded={journeyOpen}
            className={`mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold tracking-ko ${
              light
                ? "border-[#D9E2EC] bg-[#EFF3F8] text-[#1E293B]"
                : "border-white/25 bg-white/15 text-white/95"
            }`}
          >
            <GitBranch className="size-3.5" strokeWidth={2} />
            공유 여정 보기
            <ChevronDown
              className={`size-3.5 transition-transform ${journeyOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
          {journeyOpen ? (
            <ShareJourneyTimeline
              light={light}
              loading={journeyLoading}
              error={journeyError}
              rows={journeyRows}
            />
          ) : null}
        </>
      ) : (
        // S3-4e — 법정 푸터 정본(수렴 3분기): 헤어라인 → FTC 1줄 → 알약 2버튼 → © LinkDrop.
        //   사업자 정보는 BUSINESS_INFO 단일 소스 재사용(하드코딩 중복 0 · Radix 0).
        //   기존 바닥 나열 5줄(전역 BusinessFooter)은 /d 에서 __root 가 억제 — 이 펼침으로 흡수.
        <div data-testid="legal-footer" className="mt-5 border-t border-[#E8EDF3] pt-4">
          <p className="flex items-center justify-center gap-1 text-center text-[11px] leading-relaxed text-text-subtle">
            <Info className="size-3 shrink-0" strokeWidth={2} />
            본 콘텐츠는 LinkDrop 광고·제휴 안내가 적용됩니다 (FTC 권고)
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsReportSheetOpen(true)}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[#E2E8F0] px-3 text-[12px] font-medium tracking-ko text-text-muted"
            >
              <Flag className="size-3.5" strokeWidth={2} />
              문제 신고
            </button>
            <button
              type="button"
              onClick={() => setBizOpen((v) => !v)}
              aria-expanded={bizOpen}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[#E2E8F0] px-3 text-[12px] font-medium tracking-ko text-text-muted"
            >
              <Building2 className="size-3.5" strokeWidth={2} />
              사업자 정보
              <ChevronDown
                className={`size-3 transition-transform ${bizOpen ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
            </button>
          </div>
          {bizOpen ? (
            <dl
              data-testid="business-info-expand"
              className="mx-auto mt-3 max-w-[360px] rounded-xl bg-[#F8FAFC] px-4 py-3"
              style={{ boxShadow: "inset 0 0 0 1px #E8EDF3" }}
            >
              {BUSINESS_INFO.map((row) => (
                <div key={row.label} className="flex gap-3 py-0.5 text-[11px] leading-relaxed">
                  <dt className="w-24 shrink-0 font-semibold tracking-ko text-text-subtle">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 flex-1 font-medium tracking-ko text-text-muted">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="mt-3 text-center text-[11px] text-text-subtle">© LinkDrop</p>
        </div>
      )}
    </div>
  );
  // S3-2 추가 — 라이트 variant(info·coupon·reservation·lead) 푸터 = 단일 정본(라벨 3액션).
  //   구 isLightCard(카드 저장색 판정)로는 info 가 light=false 구 스킨에 남았음 → isLightShell 로
  //   교체. 비-light(purchase 폴백 등 navy)만 구 아이콘 스킨 분기 존치.
  const shareFooter = renderShareFooter(isLightShell);
  /* SM-2 상태·핸들러는 컴포넌트 상단(useState 클러스터)에 — renderShareFooter 가 클로저로 사용. */

  return (
    <div
      className={cn(
        "relative mx-auto min-h-screen w-full max-w-[480px]",
        // sticky 바 = 12(pt) + 52(primary) + 12(pb) + safe-area ≈ 76px + safe-area.
        // 본문 마지막 ~ sticky 바 사이 안 겹치게 pb-[calc(5.5rem+safe-area)] (88px).
        // sticky 없는 드롭(정보/구매/상담) = pb-8 만으로 충분.
        hasStickyBar ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : "pb-8",
      )}
      // 셸 배경 — info(S1)·coupon(S2)·reservation(S3-1)·purchase(S4)는 회색(흰 CardModelBody
      //   카드 = 스튜디오 parity · FIX-56 저장색 무시 = navy 소멸). 잔존 variant(lead)는 기존 유지 — S5 몫.
      style={{
        backgroundColor:
          resolvedVariant === "info" ||
          resolvedVariant === "coupon" ||
          resolvedVariant === "reservation" ||
          resolvedVariant === "purchase"
            ? "#F5F5F5"
            : (cardColor ?? "#1E3A8A"),
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
                isLightShell ? "text-text-strong" : "text-white",
              )}
            >
              {safeMaker.name}
              <span
                className={cn(
                  "font-medium",
                  isLightShell ? "text-text-muted" : "text-white/70",
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
                  isLightShell ? "text-text-subtle" : "text-white/60",
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
          // 거울 수렴 S1 — info 분기 = CardModel 정본 렌더(CardModelBody, 스튜디오 미리보기와 동일
          //   거울). 프레임 navy(DropCardShell)→white(CardModelBody)는 의도된 수렴(문서 기록).
          //   S3-3 ⑦ — 내장 공유푸터 사용(스튜디오 정본 위치·라벨 3액션 신스킨). 페이지 하단은
          //   법정만(renderShareFooter legal-only). 영상요약(aiSummaryAccordion)은 페이지 크롬 존치.
          //   S13(전화/예약 칩 없음)은 local/funnelCoupon 미주입으로 유지.
          <>
            <CardModelBody
              variant="receiver"
              showJourney={false}
              actions={{ onShare, onCopyLink }}
              model={fromDropDetail({
                ...toDropDetailInput({
                  videoSourceUrl,
                  videoThumbnailUrl,
                  videoDurationSec,
                  videoSourceLabel,
                  title,
                  makerMessage,
                  keyPoints,
                  cardColor,
                  variant,
                  maker,
                } as unknown as InfoDropPageProps),
                remakeHref,
                remakeLabel,
              })}
            />
            {/* S3-4c — 슬립 = 위치 B(콘텐츠 뒤·법정 직전). */}
            {aiSummaryAccordion}
            {deliverySlip}
            {renderShareFooter(true, false)}
          </>
        )}
        {resolvedVariant === "coupon" && (
          // 거울 수렴 S2 — coupon 분기 = CardModel 정본 렌더(info S1 동형 A방식). 프레임
          //   navy(DropCardShell)→white(CardModelBody) = FIX-56 흰색 정본 이행.
          //   · 쿠폰 존(타이머·혜택명·증정/조건·기한·쿠폰 받기)은 카드 내장 도킹 쿠폰 카드가 담당
          //     — 구 benefitEventSection 쿠폰부(couponPanel) 대체. 타이머 확정값(expiresAt·serverNow)
          //     은 라우트 계산 존치, toDropDetailInput 이 운반만.
          //   · claim 상태(claim_coupon·OAuth ?coupon=1 복귀·claimInFlight)는 페이지 크롬 존치 —
          //     본체는 onClaimCoupon(=onReserveAndClaim 동일 핸들러)만 받는 표시 계층.
          //   · sticky "쿠폰 받기"(VARIANT_ACCENT) 크롬 존치. 진행 이벤트·캘린더·연락·영상요약·
          //     shareFooter 는 카드 밖 크롬으로 이동(구 CardBody 슬롯 순서 보존).
          //   · local 은 name 만 주입(쿠폰 존 발급처 표기) — phone/address 미주입 = 카드 내
          //     매장정보 버튼 미렌더(contactRow 크롬과 중복 회피, S13 동형).
          <>
            <CardModelBody
              variant="receiver"
              showJourney={false}
              couponCtaRef={inlineCouponCtaRef}
              actions={{
                onShare,
                onCopyLink,
                onClaimCoupon: onReserveAndClaim,
                // S3-4 §2 — 매장 정보 펼침 3버튼(기존 handleCtaClick 체인).
                onPhone: () => handleCtaClick("phone"),
                onSms: () => handleCtaClick("sms"),
                onDirections: () => handleCtaClick("directions"),
              }}
              // S3-4c — 예약 실행기 인라인 슬롯(상시 노출 폐지 — [예약하기] 탭 시 그 자리 확장).
              reserveExecutorSlot={
                showCalendar ? (
                  <div data-testid="reserve-executor-inline" className="space-y-4">
                    {calendarPanel}
                    {billingNotice}
                  </div>
                ) : undefined
              }
              model={fromDropDetail({
                ...toDropDetailInput({
                  videoSourceUrl,
                  videoThumbnailUrl,
                  videoDurationSec,
                  videoSourceLabel,
                  title,
                  makerMessage,
                  keyPoints,
                  cardColor,
                  variant,
                  maker,
                  funnelCoupon,
                  expiresAt,
                  serverNow,
                  // S3-3 ③·④·⑥ — 결합 카드 스튜디오 동형: 예약 가능일(슬롯)·매장정보 버튼
                  //   (phone/address)·함께 받는 카드(도킹) 관통.
                  initialSlots,
                  attachedProducts,
                  local,
                } as unknown as InfoDropPageProps),
                remakeHref,
                remakeLabel,
                // S3-4d — 쿠폰 variant 캘린더 장착 신호(파트너 캘린더 보유 = showCalendar).
                calendarEquipped: showCalendar,
              })}
            />
            {/* S3-4c — 실행기 상시 노출 폐지: [예약 가능일]→[예약하기] 인라인 확장
                (reserveExecutorSlot)으로 일원화. 슬립 = 위치 B(콘텐츠 뒤·법정 직전). */}
            {eventsSection}
            {aiSummaryAccordion}
            {deliverySlip}
            {/* S3-3 ⑦ — 공유 3액션은 카드 내장 푸터로 이동. 하단은 법정만(신고). */}
            {renderShareFooter(true, false)}
          </>
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
            <h2 className={`text-xl font-extrabold leading-snug tracking-ko ${isLightShell ? "text-text-strong" : "text-white"}`}>
              {pageCopy.sectionTitle}
            </h2>
            <p className={`text-sm font-medium leading-relaxed tracking-ko ${isLightShell ? "text-text-muted" : "text-white/70"}`}>
              {reservationGuide}
            </p>
            <p className={`text-xs font-medium ${isLightShell ? "text-text-subtle" : "text-white/60"}`}>{safeLocal.name}</p>
          </section>
        )}

        {isReservation && (
          // 거울 수렴 S3-1 — reservation 분기 = CardModel 정본 렌더(S1/S2 A방식 동형). 프레임
          //   navy(DropCardShell)→white(CardModelBody) = FIX-56 흰색 정본 이행.
          //   · ★거울 게이트: 카드 내 예약 존 = 스튜디오 reserve 미리보기 실렌더와 동형 —
          //     applied.calendar→"예약하기" 본체 버튼 + dates 있을 때 ReservationPreview(가능일).
          //     dates 재료 = SSR initialSlots 관통(스튜디오 cfgDates 거울, adapters S3-1).
          //   · 역할 분리(표시 vs 실행): 카드 내 존 = 스튜디오 동형 표시 + onReserve 는 실행기
          //     (직접예약 시트, onReservationRequest) 열기만. 인터랙티브 실행기(캘린더·인원·
          //     예약하기 CTA·결제고지) = 아래 크롬 존치(무조건 렌더 — 옛 reservationBlock 동작 보존).
          //   · funnelCoupon 주입 = 결합 카드 인카드 쿠폰존(S3-0 isCombined 정합·sticky 미표시,
          //     쿠폰 받기 = onReserveAndClaim). 구 combinedCouponOnlyCta/benefitEventSection 쿠폰부 대체.
          //   · local 은 name 만 주입(쿠폰존 발급처 표기) — phone/address 미주입 = 카드 내
          //     매장정보 버튼 미렌더(연락은 실행 카드 편입분 몫). S3-2: reservationUrl 주입도
          //     제거(어댑터 calendar 게이트가 dates 전용으로 정합 — 스튜디오 동형).
          <>
            <CardModelBody
              variant="receiver"
              showJourney={false}
              actions={{
                onShare,
                onCopyLink,
                onClaimCoupon: onReserveAndClaim,
                // S3-4 §2 — 매장 정보 펼침 3버튼(기존 handleCtaClick 체인).
                onPhone: () => handleCtaClick("phone"),
                onSms: () => handleCtaClick("sms"),
                onDirections: () => handleCtaClick("directions"),
              }}
              // S3-4c — 예약 실행기 인라인 슬롯(상시 노출 폐지). 예약 variant 는 무조건 주입
              //   (calendarPanel 자체 fallback 보존 — 옛 reservationBlock 동작).
              reserveExecutorSlot={
                <div data-testid="reserve-executor-inline" className="space-y-4">
                  {reserveNotice}
                  {calendarPanel}
                  {billingNotice}
                </div>
              }
              model={fromDropDetail({
                ...toDropDetailInput({
                  videoSourceUrl,
                  videoThumbnailUrl,
                  videoDurationSec,
                  videoSourceLabel,
                  title,
                  makerMessage,
                  keyPoints,
                  cardColor,
                  variant,
                  maker,
                  funnelCoupon,
                  expiresAt,
                  serverNow,
                  initialSlots,
                  // S3-3 ④·⑥ — 매장정보 버튼(phone/address)·함께 받는 카드(도킹) 관통.
                  attachedProducts,
                  local,
                } as unknown as InfoDropPageProps),
                remakeHref,
                remakeLabel,
              })}
            />
            {/* S3-4c — 실행기 상시 노출 폐지: [예약 가능일]→[예약하기] 인라인 확장
                (reserveExecutorSlot)으로 일원화. 슬립 = 위치 B(콘텐츠 뒤·법정 직전). */}
            {eventsSection}
            {deliverySlip}
            {/* S3-3 ⑦ — 공유 3액션은 카드 내장 푸터로 이동. 하단은 법정만(신고). */}
            {renderShareFooter(true, false)}
          </>
        )}

        {/* 2. 영상 카드 — 유튜브: lite embed(facade→iframe), 그 외: 썸네일 + onWatchOriginal.
            세로(쇼츠) 영상은 max-h cap 으로 화면을 다 먹지 않게 (히어로 유지 + 하단
            CTA 도달성). 가로(16:9) 는 자연 비율이라 cap 영향 거의 없음. */}
        {/* F2 커머스 — 영상 헤더(썸네일+원본영상 프레임) 숨김. 상품 카드가 이미지 보유.
            commerce 일 때만 숨기고, 영상/정보/쿠폰/예약 드롭은 그대로(회귀 없음). */}
        {!commerce && resolvedVariant !== "info" && resolvedVariant !== "coupon" && resolvedVariant !== "reservation" && (
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

        {/* C13 S3 — 한마디(makerMessage): purchase 는 위젯 아래로 이동(아래 별도 블록). 여기선 lead 만(기존 위치 유지). */}
        {makerMessage && resolvedVariant !== "info" && resolvedVariant !== "coupon" && resolvedVariant !== "reservation" && resolvedVariant !== "purchase" && (
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium italic leading-relaxed tracking-ko text-text-muted">
            &quot;{makerMessage}&quot;
          </p>
        )}

        {/* S3-2 — 구 IIFE 하단 스택 제거: 쿠폰에선 빈 div 잔재, 예약의 reserveNotice 는
            실행 카드 내부로 편입(아래 reservation 분기). */}

        {/* S7 — AI 요약 아코디언은 info/coupon 카드 내부(CardBody preFooterSlot)로 이동.
            정의: 상단 aiSummaryAccordion const. 여기(카드 밖) 직접 렌더 제거. */}

        {resolvedVariant === "purchase" &&
          (commerce ? (
            // S4 — purchase 거울 수렴: CardModelBody(카드 v2) 마운트 — info/coupon/reservation
            //   A방식 동형(toDropDetailInput → fromDropDetail → receiver). navy 소멸(FIX-56 흰 정본).
            //   · CTA 분기 = selfUpload 우선(합성 buyUrl 공존 시 주문예약이 이김): 주문예약 =
            //     기존 onPreorder 경로 / 외부 상품 = buyUrl 새 탭(구 ProductWidget 자기완결 동형).
            //   · 재입고 = 카드 내 버튼(boosterChips 품절 게이트) + 페이지 액션(4상태 문구 콘텐츠 존).
            //   · funnelCoupon·initialSlots 미주입 — 구 purchase 표면에 없던 존(쿠폰·캘린더) 신설
            //     금지(스코프 밖). local·attachedProducts 는 관통(그리드 매장정보·도킹 포토 셀).
            //   · 구 footerSlot 인입 소멸 — 전달 슬립 + 법정 푸터 v2(수렴 3 variant 동일 존).
            <>
              <CardModelBody
                variant="receiver"
                showJourney={false}
                actions={{
                  onShare,
                  onCopyLink,
                  onPreorder: commerce.selfUpload
                    ? onPreorder
                    : () => {
                        if (
                          typeof window !== "undefined" &&
                          commerce.buyUrl &&
                          commerce.buyUrl !== "#"
                        ) {
                          window.open(commerce.buyUrl, "_blank", "noopener,noreferrer");
                        }
                      },
                  onRestockAlert: handleRestockAlert,
                  // S3-4 §2 — 매장 정보 펼침 3버튼(기존 handleCtaClick 체인).
                  onPhone: () => handleCtaClick("phone"),
                  onSms: () => handleCtaClick("sms"),
                  onDirections: () => handleCtaClick("directions"),
                }}
                model={fromDropDetail({
                  ...toDropDetailInput({
                    videoSourceUrl,
                    videoThumbnailUrl,
                    videoDurationSec,
                    videoSourceLabel,
                    title,
                    makerMessage,
                    keyPoints,
                    cardColor,
                    variant,
                    maker,
                    commerce,
                    remainingStock,
                    serverNow,
                    attachedProducts,
                    local,
                  } as unknown as InfoDropPageProps),
                  remakeHref,
                  remakeLabel,
                })}
              />
              {/* S4 — v2 헌법 순서: 카드(마감 요소 아래 렌더 금지) → 전달 슬립(꼬리표 연결) →
                  콘텐츠(고시·한마디·영상요약·재입고 문구) → 법정 푸터. */}
              {deliverySlip}
              {restockFeedback}
              {/* S4-4b — 고시·배송정보 접이 2버튼(전달 슬립 아래·법정 푸터 위). 고시 내용
                  무손실(전자상거래 필수 — 삭제 절대 금지) · 실데이터 0 = 버튼 미렌더. */}
              <PurchaseInfoFolds
                noticeRows={commerce.noticeRows}
                harvestDate={commerce.harvestDate}
              />

              {/* C13 S3(🅱) — purchase 한마디(콘텐츠 존 유지). */}
              {makerMessage && (
                <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium italic leading-relaxed tracking-ko text-text-muted">
                  &quot;{makerMessage}&quot;
                </p>
              )}
              {/* 영상요약(비selfUpload만 — aiSummaryAccordion 자체 게이트 유지). */}
              {aiSummaryAccordion}
              {/* 공유 3액션은 슬립이 담당 — 하단은 법정만(수렴 3 variant 동일). */}
              {renderShareFooter(true, false)}
            </>
          ) : (
            // commerce 없음(외부 스크랩·mock) → 기존 PurchaseCardBody = AiPriceComparisonCard 시세 fallback 보존.
            <PurchaseCardBody
              commerce={commerce}
              title={safeTitle}
              local={local}
              productName={productName}
              brandGuess={brandGuess}
              priceOffers={priceOffers}
              onPreorder={onPreorder}
              onSellerClick={() => handleCtaClick("seller")}
            />
          ))}

        {/* S4 — 구 페이지 크롬(StockMeta·SaleDdayBadge·RestockAlertButton·GroupBuySection) 렌더
            제거: 카드 v2 가 흡수(한정 수량 = productQty · D-day/품절 = boosterChips · 재입고 =
            카드 버튼+restockFeedback · 공동구매 = model.groupBuy). 정의는 하단 보존(가역).
            고시·한마디·영상요약은 위 purchase 분기 콘텐츠 존으로 이동. */}

        {/* C13 S3(🅱) — 폴백(commerce 없음) purchase 한마디만 기존 위치 유지(무접촉). */}
        {resolvedVariant === "purchase" && !commerce && makerMessage && (
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium italic leading-relaxed tracking-ko text-text-muted">
            &quot;{makerMessage}&quot;
          </p>
        )}

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

        {/* ③ 관련 상품 — 담은 상품(attached). 본체 커머스/영상 렌더와 독립.
            탭 → 그 상품 자체 카드(/d/{refShareUuid}) 인앱 이동. 없으면 미표시.
            S3-3 ⑥·S4 — coupon·reservation·purchase(commerce) 수렴 분기는 카드 내 도킹 존
            (함께 받는 카드)이 담당 → 이중 렌더 금지로 크롬 미렌더. */}
        {attachedProducts &&
          attachedProducts.length > 0 &&
          resolvedVariant !== "coupon" &&
          resolvedVariant !== "reservation" &&
          !(resolvedVariant === "purchase" && commerce) && (
          <section data-testid="related-products">
            <h2
              className={cn(
                "text-sm font-bold tracking-ko",
                isLightShell ? "text-text-strong" : "text-white",
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
                      {/* DOCK-6 — 출처(원본 생산자명). 도킹 시점 스냅샷 있을 때만(회귀 0). */}
                      {p.producerName ? (
                        <p className="truncate text-xs font-medium tracking-ko text-text-subtle">
                          {p.producerName} 님의 카드
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

        {resolvedVariant === "lead" && (
          // S17(P4) — 푸터 인입: 폼(흰 계열 카드) 내부라 light 강제. 페이지레벨 lead 렌더는 제거됨.
          <ConsultationLeadForm partnerName={safeLocal.name} footerSlot={renderShareFooter(true)} />
        )}

        {/* 4. 목적별 CTA — info는 하단 푸터(링크·카톡)만. v7.2: 쿠폰은 본문 CTAS
            비우고 sticky 단일 액션 으로. purchase/lead 만 본문 CTAS 사용. */}
        {ctas.length > 0 && (
          <section>
            <h2
              className={cn(
                "text-sm font-bold tracking-ko",
                isLightShell ? "text-text-strong" : "text-white",
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

        {/* v7.2 보조 연락(정보 보기) → CardBody contactBlock 로 이관(3b-3). 옛 위치 미렌더. */}

        {/* c-1 — 순수 쿠폰 카드 + 네이버형 매장(reservation_url 보유) 일 때만 보조 예약 링크.
            예약-목적/결합 카드엔 미렌더(인앱 펀널 우선). 주요 CTA 아닌 서브틀 외부 링크. */}
        {isCoupon && !isCombined && local?.reservationUrl ? (
          <a
            href={local.reservationUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="coupon-naver-reservation"
            className={`flex items-center justify-center gap-1.5 text-xs font-medium tracking-ko underline-offset-2 transition-colors ${isLightShell ? "text-text-muted hover:text-text-strong" : "text-white/60 hover:text-white/80"} hover:underline`}
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

      {/* S16r — S7 이동 회귀 복원: CardBody 미사용 변형은 페이지레벨 렌더(위젯 아래·푸터 위).
            S4 — purchase(commerce) 수렴 분기는 콘텐츠 존이 담당 → 폴백(commerce 없음)·lead 만. */}
      {((resolvedVariant === "purchase" && !commerce) || resolvedVariant === "lead") &&
      aiSummaryAccordion ? (
        <section className="mx-auto w-full max-w-[480px] px-6 pt-4">{aiSummaryAccordion}</section>
      ) : null}

      {/* v0 원안 공유 푸터 — S17(P4): purchase(commerce)=ProductWidget.footerSlot / lead=폼 footerSlot 인입.
            페이지레벨 잔류는 commerce 없는 purchase 폴백(PurchaseCardBody 경로)만 — 푸터 유실 방지.
            navy 페이지 배경 위라 white-on-navy 스타일(shareFooter=카드색 기반) 그대로. */}
      {resolvedVariant === "purchase" && !commerce ? (
        <section className="mx-auto w-full max-w-[480px] px-6 pt-4">{shareFooter}</section>
      ) : null}

      {/* v7.2 5b — sticky 하단 바: funnelCoupon + onReserveAndClaim 있을
            때만 단일 액션. 카카오톡 공유는 위 공유 블록으로 이전 (sticky 미사용).
            정보/구매/상담 드롭 = sticky 없음.
            S18-A(P4) — 카드 내부 CTA(cta-coupon-inline)가 뷰포트에 보이면 숨김(IO), 벗어나면 복귀. */}
      {hasStickyBar && !inlineCouponCtaVisible ? (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#E5E7EB] bg-white">
          <div className="mx-auto w-full max-w-[480px] px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <button
              type="button"
              onClick={onReserveAndClaim}
              data-testid="cta-sticky-primary"
              // C13 S4b — 목적색(accent) bg. isCoupon 전용이라 accent 항상 정의됨(text-white 유지).
              className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold text-white"
              style={{ backgroundColor: accent }}
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

// ST2b-2a A1 — 상품정보제공고시 인라인 펼침(FIX-37 스냅샷 {label,value} 표시형 그대로 —
//   유형 분기 불요). 미입력 값 = "미입력" 정직 표기(자동 생성 0). Radix 0 — useState 펼침.
// S4-4b — 고시·배송정보 접이 2버튼(콘텐츠 존 · 승인 목업 동형: 흰 카드 버튼·radius 12·펼침 시
//   accent #0F766E 보더). Radix 0 — 탭 펼침·재탭 닫힘·한 번에 하나만(상호 배타).
//   · 고시 펼침 = 기존 NoticeRowsSection 표 마크업 그대로(내용 무손실 — 전자상거래 필수).
//   · 배송정보 = harvestDate + noticeRows 배송 분류행(발송/배송/택배) 실데이터만 — 0이면 버튼
//     자체 미렌더(가짜값 금지). 배송조회/송장/SHIP_STAGES 절대 미주입(§0).
function PurchaseInfoFolds({
  noticeRows,
  harvestDate,
}: {
  noticeRows?: Array<{ label: string; value: string }>;
  harvestDate?: string | null;
}) {
  const [open, setOpen] = useState<"notice" | "shipping" | null>(null);
  const rows = noticeRows ?? [];
  const shipRows = rows.filter((r) => /발송|배송|택배/.test(`${r.label} ${r.value}`));
  // 수확·발송 문구 — ProductWidget(:130) 규칙 동일(M월 D일 수확·발송 예정 · 파싱 실패 = 원문).
  const harvestLine = (() => {
    if (!harvestDate) return null;
    const parts = String(harvestDate).split("-");
    const mm = parts[1];
    const dd = parts[2];
    return mm && dd ? `${Number(mm)}월 ${Number(dd)}일 수확·발송 예정` : String(harvestDate);
  })();
  const hasNotice = rows.length > 0;
  const hasShipping = !!harvestLine || shipRows.length > 0;
  if (!hasNotice && !hasShipping) return null;
  const toggle = (k: "notice" | "shipping") => setOpen((v) => (v === k ? null : k));
  const renderRow = (r: { label: string; value: string }, i: number) => (
    <div key={i} className="rounded-lg bg-bg px-3 py-2">
      <p className="text-[11px] font-semibold tracking-ko text-text-subtle">{r.label}</p>
      {r.value ? (
        <p className="mt-0.5 text-[13px] font-semibold tracking-ko text-text-strong">{r.value}</p>
      ) : (
        <p className="mt-0.5 text-xs font-medium tracking-ko text-text-subtle">미입력</p>
      )}
    </div>
  );
  const foldButton = (k: "notice" | "shipping", label: string, sub?: string) => (
    <button
      type="button"
      onClick={() => toggle(k)}
      aria-expanded={open === k}
      className="flex min-h-[48px] w-full items-center gap-1.5 rounded-[12px] border bg-white px-4 py-3 text-left"
      style={{ borderColor: open === k ? "#0F766E" : "#E8EDF3" }}
    >
      <span className="flex-1 text-sm font-bold tracking-ko text-text-strong">{label}</span>
      {sub ? (
        <span className="text-[11px] font-medium tracking-ko text-text-subtle">{sub}</span>
      ) : null}
      <ChevronDown
        className="size-4 shrink-0 text-text-subtle transition-transform"
        style={{ transform: open === k ? "rotate(180deg)" : "none" }}
        strokeWidth={2.25}
      />
    </button>
  );
  return (
    <div data-testid="purchase-info-folds" className="space-y-2">
      {hasNotice ? (
        <div>
          {foldButton("notice", "상품정보 제공고시", "전자상거래 필수 항목")}
          {open === "notice" ? (
            <div className="mt-2 space-y-1.5 rounded-[12px] border border-[#E8EDF3] bg-white p-3">
              {rows.map(renderRow)}
            </div>
          ) : null}
        </div>
      ) : null}
      {hasShipping ? (
        <div>
          {foldButton("shipping", "배송정보")}
          {open === "shipping" ? (
            <div className="mt-2 space-y-1.5 rounded-[12px] border border-[#E8EDF3] bg-white p-3">
              {harvestLine ? (
                <div className="rounded-lg bg-bg px-3 py-2">
                  <p className="text-[11px] font-semibold tracking-ko text-text-subtle">
                    수확·발송 예정
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold tracking-ko text-text-strong">
                    {harvestLine}
                  </p>
                </div>
              ) : null}
              {shipRows.map(renderRow)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NoticeRowsSection({ rows }: { rows: Array<{ label: string; value: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center gap-1.5 px-4 py-3 text-left"
      >
        <span className="flex-1 text-sm font-bold tracking-ko text-text-strong">
          상품 상세정보 고시
        </span>
        <span className="text-[11px] font-medium tracking-ko text-text-subtle">
          전자상거래 필수 항목
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-text-subtle transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          strokeWidth={2.25}
        />
      </button>
      {open ? (
        <div className="space-y-1.5 px-4 pb-4">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg bg-bg px-3 py-2">
              <p className="text-[11px] font-semibold tracking-ko text-text-subtle">{r.label}</p>
              {r.value ? (
                <p className="mt-0.5 text-[13px] font-semibold tracking-ko text-text-strong">
                  {r.value}
                </p>
              ) : (
                <p className="mt-0.5 text-xs font-medium tracking-ko text-text-subtle">미입력</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ST2b-2a A2 — 판매기간 D-day 배지(조회 시점 계산 — 박제 금지). 마운트 가드 = SSR/클라
//   시계·타임존 불일치 방지(TimerBadge 하이드레이션 문법 동형). 마감 경과 = "판매 마감" 정직.
function SaleDdayBadge({ saleEndIso }: { saleEndIso: string }) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const t = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setToday(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`);
  }, []);
  if (!today) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
      {ddayLabel(saleEndIso, today)}
    </span>
  );
}

// ST2b-2b B1 — 재입고 알림 버튼(FIX-41 restock-alerts 실배선). 상태 4분기 정직 표기:
//   완료/중복 = 락 문구 · 비로그인 = 로그인 유도 · 오류 = 재시도 안내. 서버 발신 없음(v1).
function RestockAlertButton({ dropId }: { dropId: string }) {
  const [phase, setPhase] = useState<"idle" | "busy" | "created" | "duplicate" | "unauthenticated" | "error">("idle");
  if (phase === "created" || phase === "duplicate") {
    return (
      <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium leading-relaxed tracking-ko text-text-muted [word-break:keep-all]">
        {phase === "duplicate" ? RESTOCK_ALERT_DUPLICATE_COPY : RESTOCK_ALERT_CONFIRM_COPY}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={phase === "busy"}
        onClick={() => {
          setPhase("busy");
          void requestRestockAlert(dropId).then((r) =>
            setPhase(r === "created" ? "created" : r === "duplicate" ? "duplicate" : r === "unauthenticated" ? "unauthenticated" : "error"),
          );
        }}
        className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-border bg-bg text-sm font-semibold tracking-ko text-text-strong hover:border-text-muted disabled:opacity-60"
      >
        재입고 알림 받기
      </button>
      {phase === "unauthenticated" ? (
        <p className="text-xs font-medium tracking-ko text-text-subtle">
          로그인하면 재입고 알림을 받을 수 있어요.
        </p>
      ) : null}
      {phase === "error" ? (
        <p className="text-xs font-medium tracking-ko text-text-subtle">
          지금은 신청이 안 됐어요 — 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </div>
  );
}

// ST2b-2b B2 — 공동구매 표시(FIX-40 buildGroupBuyView — 사실만: 조건·고지·취소 경로).
//   진행률(joinedCount)은 실집계 입력 부재 → null(미렌더 — 가짜 집계 금지). 마감 = 조회 시점.
function GroupBuySection({
  groupBuy,
}: {
  groupBuy: { targetN: number; priceKrw: number; deadline: string | null };
}) {
  const view = buildGroupBuyView({
    targetN: groupBuy.targetN,
    achievedPriceKrw: groupBuy.priceKrw,
    joinedCount: null,
  });
  if (!view) return null;
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold tracking-ko text-text-strong">
          공동구매 · {view.offerLine}
        </p>
        {groupBuy.deadline ? <SaleDdayBadge saleEndIso={groupBuy.deadline} /> : null}
      </div>
      <p className="text-xs font-medium leading-relaxed tracking-ko text-text-muted [word-break:keep-all]">
        {view.noticeLine}
      </p>
      <p className="text-xs font-medium tracking-ko text-text-subtle">{view.cancelLine}</p>
    </section>
  );
}
