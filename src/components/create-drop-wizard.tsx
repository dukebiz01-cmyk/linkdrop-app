import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clipboard,
  Copy,
  Gift,
  MessageCircle,
  Link as LinkIcon,
  Loader2,
  Phone,
  Plus,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton } from "@/components/ActionButton";
import { ErrorMessage } from "@/components/ErrorMessage";
import { WizardSharePreview, type WizardSharePreviewData } from "@/components/wizard-share-preview";
import { CardShell } from "@/components/cards/CardShell";
import type { CardConfig, CardUserAction } from "@/components/cards/types";
import { PurposeMessageCard } from "@/components/create/PurposeMessageCard";
import { shareToKakao } from "@/lib/kakao";
import {
  fetchVideoMetadata,
  parseVideoUrl,
  type VideoMetadata,
  type VideoMetadataFetchedBy,
} from "@/lib/video-metadata";
import type { DropPurpose } from "@/lib/types";
import {
  WIZARD_PRIMARY_BUTTON_CLASS,
  WIZARD_SECONDARY_BUTTON_CLASS,
} from "@/components/create-wizard-button-styles";
import { cn } from "@/lib/utils";
import { Step3InfoCards } from "@/components/create/Step3InfoCards";

// =============================================================================
// Types
// =============================================================================

export interface VideoInfo {
  url: string;
  thumbnailUrl: string;
  title: string;
  channelName: string;
  duration: string;
  platform: "youtube" | "instagram";
}

export interface LocalPartner {
  id: string;
  name: string;
  category: string;
  address: string;
  avatarUrl: string;
}

export interface AiPreviewData {
  title: string;
  summary: string;
  keyPoints: string[];
  suggestedShareText: string;
}

export type WizardSuggestionConfidence = "high" | "medium" | "low";

export interface CreateDropWizardProps {
  variant?: "default" | "skeleton";
  initialUrl?: string;
  initialPurpose?: DropPurpose;
  initialSuggestedPurpose?: DropPurpose;
  initialSuggestionConfidence?: WizardSuggestionConfidence;
  initialPlatform?: string;
  initialSourceId?: string;
  /** Home sessionStorage draft — Step 1 즉시 preview */
  initialMetadata?: VideoMetadata | null;
  /** url+purpose 동시 전달 시 빠른 생성(3단계). 미지정 시 initialUrl·initialPurpose로 판별 */
  fastCreateMode?: boolean;
  onClose?: () => void;
  /**
   * Step 5 진입 후 첫 카카오톡 공유/링크 복사 클릭 시 호출.
   * 실제 /api/drops 저장을 수행하고 real share_uuid/share_url 을 반환.
   * 실패 시 throw 하면 wizard 가 인라인 에러를 표시한다.
   */
  onComplete?: (data: {
    video: VideoInfo;
    purpose: DropPurpose;
    local?: LocalPartner;
    ai: AiPreviewData;
    makerMessage: string;
  }) => Promise<{ shareUuid: string; shareUrl: string }>;
}

function videoInfoFromMetadata(meta: VideoMetadata, fallbackUrl: string): VideoInfo {
  const platform =
    meta.platform === "instagram"
      ? "instagram"
      : meta.platform === "youtube"
        ? "youtube"
        : "youtube";
  return {
    url: meta.sourceUrl || fallbackUrl,
    thumbnailUrl: meta.thumbnailUrl ?? "",
    title: meta.title,
    channelName: meta.authorName ?? "",
    duration: "",
    platform,
  };
}

type StepNum = 1 | 2 | 3 | 4 | 5;
type FastStepNum = 1 | 2 | 3;

type PurposeFlowConfig = {
  badge: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  chipClass: string;
  /** Step 3 세부 유형 카드 */
  detailCards: { id: string; label: string }[];
  /** Fast Step 2 목적별 추가 편집 필드 라벨 */
  editFields: string[];
};

/** 목적별 copy/버튼/세부카드/편집필드 — UI는 공통 카드 컴포넌트에 주입만 */
const PURPOSE_FLOW_CONFIG: Record<DropPurpose, PurposeFlowConfig> = {
  정보: {
    badge: "정보",
    title: "영상 핵심 정리",
    description: "영상의 핵심 내용을 보기 쉽게 정리했어요.",
    points: ["핵심 요약 생성", "정보 구조 정리", "공유 문구 생성"],
    cta: "자세히 보기",
    chipClass: "bg-intent-info-bg text-intent-info",
    detailCards: [
      { id: "summary", label: "영상 핵심 요약" },
      { id: "place", label: "장소/매장 소개" },
      { id: "review", label: "후기 정리" },
      { id: "checklist", label: "체크리스트" },
    ],
    editFields: [],
  },
  쿠폰: {
    badge: "쿠폰",
    title: "혜택으로 손님 모으기",
    description: "친구가 바로 사용할 수 있는 쿠폰형 Drop을 만들었어요.",
    points: ["쿠폰명 생성", "사용 조건 정리", "쿠폰 받기 버튼 구성"],
    cta: "쿠폰 받기",
    chipClass: "bg-intent-warning-bg text-intent-warning",
    detailCards: [
      { id: "discount", label: "할인 쿠폰" },
      { id: "visit", label: "방문 혜택" },
      { id: "invite", label: "친구 초대 혜택" },
      { id: "limited", label: "기간 한정 혜택" },
    ],
    editFields: ["할인 내용", "사용 조건"],
  },
  예약: {
    badge: "예약",
    title: "주말 빈자리 예약",
    description: "비어 있는 날짜와 예약 버튼을 함께 보여주도록 구성했어요.",
    points: ["예약 버튼 구성", "예약 가능한 날짜 표시", "예약 링크 연결"],
    cta: "예약하기",
    chipClass: "bg-intent-success-bg text-intent-success",
    detailCards: [
      { id: "camping", label: "캠핑장 예약" },
      { id: "stay", label: "숙박 예약" },
      { id: "experience", label: "체험 예약" },
      { id: "consult", label: "상담 예약" },
    ],
    editFields: ["예약 링크", "예약 가능 기간"],
  },
  구매: {
    badge: "구매",
    title: "AI 상품 찾기·가격비교",
    description: "영상 속 상품 후보와 구매 연결을 정리했어요.",
    points: ["상품 후보 추출", "가격비교 카드 구성", "구매 버튼 구성"],
    cta: "상품 보기",
    chipClass: "bg-surface text-text-strong",
    detailCards: [
      { id: "find", label: "AI 상품 찾기" },
      { id: "compare", label: "가격 비교" },
      { id: "cart", label: "장바구니 구성" },
      { id: "link", label: "구매 링크 연결" },
    ],
    editFields: ["상품명", "구매 링크"],
  },
  상담: {
    badge: "상담",
    title: "문의·상담 받기",
    description: "관심 있는 사람이 바로 문의할 수 있게 구성했어요.",
    points: ["상담 폼 구성", "문의 버튼 구성", "응답 문구 생성"],
    cta: "상담 신청",
    chipClass: "bg-intent-danger-bg text-intent-danger",
    detailCards: [
      { id: "one_to_one", label: "1:1 문의" },
      { id: "quote", label: "견적 문의" },
      { id: "phone", label: "전화 상담" },
      { id: "booking_consult", label: "예약 상담" },
    ],
    editFields: ["상담 항목", "응답 방식"],
  },
};

export type EditableAiDraft = {
  title: string;
  summary: string;
  keyPoints: string[];
  suggestedShareText: string;
  makerMessage: string;
  ctaLabel: string;
  /** 목적별 추가 편집 필드 — PURPOSE_FLOW_CONFIG.editFields 기반 */
  extraFields: { label: string; value: string }[];
};

// WHY: UX 레이어는 5 목적만 노출. DB intent_types 9행은 Phase 1 UI에서 숨김 (v3 결정 락).
const WIZARD_PURPOSES: {
  purpose: DropPurpose;
  label: string;
  description: string;
  icon: LucideIcon;
  stripClass: string;
  aiRecommended?: boolean;
}[] = [
  {
    purpose: "정보",
    label: "정보",
    description: "영상 핵심 정리",
    icon: BookOpen,
    stripClass: "bg-intent-info-strip",
    aiRecommended: true,
  },
  {
    purpose: "쿠폰",
    label: "쿠폰",
    description: "혜택으로 손님 모으기",
    icon: Gift,
    stripClass: "bg-intent-coupon-strip",
  },
  {
    purpose: "예약",
    label: "예약",
    description: "날짜 선택과 예약 연결",
    icon: Calendar,
    stripClass: "bg-intent-reservation-strip",
  },
  {
    purpose: "구매",
    label: "구매",
    description: "AI 상품 찾기·가격비교",
    icon: ShoppingBag,
    stripClass: "bg-intent-commerce-strip",
  },
  {
    purpose: "상담",
    label: "상담",
    description: "문의·상담 받기",
    icon: Phone,
    stripClass: "bg-intent-lead-strip",
  },
];

const PURPOSE_CONFIRM_HEADLINE: Record<DropPurpose, string> = {
  정보: "정보 Drop으로 만들게요",
  쿠폰: "쿠폰 Drop으로 만들게요",
  예약: "예약 Drop으로 만들게요",
  구매: "구매 Drop으로 만들게요",
  상담: "상담 Drop으로 만들게요",
};

const PURPOSE_CONFIRM_DETAIL: Record<DropPurpose, string> = {
  정보: "선택한 목적에 따라 AI가 영상 핵심, 요약, 공유 문구를 추천합니다.",
  쿠폰: "선택한 목적에 따라 AI가 혜택, 쿠폰 버튼, 공유 문구를 추천합니다.",
  예약: "선택한 목적에 따라 AI가 예약 버튼, 날짜 선택, 공유 문구를 추천합니다.",
  구매: "선택한 목적에 따라 AI가 상품 후보, 가격 비교, 구매 버튼을 추천합니다.",
  상담: "선택한 목적에 따라 AI가 문의 폼, 상담 버튼, 공유 문구를 추천합니다.",
};

function findPurposeConfig(p: DropPurpose) {
  return WIZARD_PURPOSES.find((item) => item.purpose === p);
}

type Step3DetailId = string;

type SummaryTone = "짧게" | "자세히" | "후기처럼";

// 예약 목적 — 메이커가 안내하는 예약 가능 날짜의 상태.
export type ReservationDateStatus = "available" | "few_left" | "almost_full" | "closed" | "inquiry";

// 예약 목적 — 메이커가 정하는 예약 가능 날짜 입력 모드.
export type ReservationDateMode = "single" | "range" | "multiple";

// 예약 가능 날짜 1건 — 하루/기간/여러 날짜를 같은 배열(reservationDates)에 담는다.
// WHY: 예약 가능 기간을 시스템이 단정하지 않는다. 메이커가 모드를 골라 직접 입력한다.
export type ReservationDateItem = {
  id: string;
  mode: ReservationDateMode;
  /** single=[d] · range=[start,end] · multiple=[d,...] */
  dates: string[];
  startDate?: string;
  endDate?: string;
  nights?: number;
  status: ReservationDateStatus;
  remainingCount?: number;
  memo?: string;
  /** 그날의 행사/이벤트 — 메이커 자유 입력. 고정 chip·eventTypes 없음. */
  eventTitle?: string;
  eventDescription?: string;
  highlighted?: boolean;
};

// 예약 업종 — 공용 카드 구조의 분기 키. 이번 작업은 stay 만 구현, 나머지는 fallback.
export type ReservationVertical =
  | "stay"
  | "beauty"
  | "restaurant"
  | "experience"
  | "medical"
  | "general";

// 예약 일정 방식 — 업종별 캘린더/시간 입력 방식. 이번 작업은 checkin_checkout 만 구현.
export type ScheduleMode =
  | "checkin_checkout"
  | "time_slots"
  | "date_time_party"
  | "sessions"
  | "general";

export type Step3FieldState = {
  summaryTone: SummaryTone;
  shareMessage: string;
  couponName: string;
  discountText: string;
  useCondition: string;
  expiryDate: string;
  dateMode: string;
  guestCount: string;
  petAllowed: boolean;
  bookingLink: string;
  /** 예약 목적 — 예약 버튼 연결 방식 (RESERVATION_DESTS.id) */
  reservationDest: string;
  /** 예약 목적 — 업종. 공용 카드 구조의 분기 키 (현재 stay 만 구현). */
  reservationVertical: ReservationVertical;
  /** 예약 목적 — 일정 방식 (현재 checkin_checkout 만 구현). */
  scheduleMode: ScheduleMode;
  /** 예약 목적 — 어떤 예약을 알릴지 (빈자리/주말/펜션 객실 등) */
  reservationType: string;
  /** 예약 목적 — 어느 사이트/객실인지 (전체/캠핑 사이트/펜션 객실/글램핑/직접 입력) */
  facilityTarget: string;
  /** 예약 목적 — facilityTarget 이 직접 입력일 때 메이커가 적는 시설명 */
  facilityCustom: string;
  /** 예약 목적 — 장소 정보 (searchPlaces 후보 선택 또는 직접 입력) */
  placeName: string;
  placeAddress: string;
  placePhone: string;
  placeMapUrl: string;
  placeSource: string;
  /** 예약 목적 — 캘린더에서 선택한 예약 가능 날짜 (각 single 모드 항목) */
  reservationDates: ReservationDateItem[];
  /** 예약 목적 — 더 자세히 만들기(고급 설정) */
  checkInTime: string;
  checkOutTime: string;
  baseGuests: string;
  maxGuests: string;
  facilityDetail: string;
  cautionNote: string;
  couponCondition: string;
  operatorNote: string;
  eventDetail: string;
  productKeyword: string;
  priceCompareEnabled: boolean;
  productCount: string;
  purchaseLink: string;
  collectContact: boolean;
  consultItem: string;
  ctaCopy: string;
  privacyNotice: string;
  shareMessageUserAction: CardUserAction;
  /** 정보 목적 — 한줄요약 (AI 추천 또는 사용자 수정) */
  infoHeadline: string;
  infoHeadlineUserAction: CardUserAction;
  /** 정보 목적 — 키포인트 (옵션, 고급 카드) */
  infoKeyPoints: string[];
  /** 정보 목적 — 체크리스트 (옵션, 고급 카드) */
  infoChecklist: string[];
  /** 정보 목적 — 인용 (옵션, 고급 카드) */
  infoQuote: string;
};

// 예약 Step 3 입력값 → 받는 사람 화면/공유 데이터로 흐를 요약.
export type ReservationSummary = {
  placeName: string;
  placeAddress: string;
  placePhone: string;
  placeMapUrl: string;
  destKind: string;
  destLabel: string;
  destValue: string;
  /** '나중에 입력'이 아니고 연결값이 있을 때만 예약하기 버튼 노출 */
  hasReserveButton: boolean;
  hasPhoneButton: boolean;
  hasMapButton: boolean;
  dates: ReservationDateItem[];
};

function createEmptyStep3Fields(): Step3FieldState {
  return {
    summaryTone: "짧게",
    shareMessage: "",
    couponName: "",
    discountText: "",
    useCondition: "",
    expiryDate: "",
    dateMode: "날짜 직접 선택",
    guestCount: "2명",
    petAllowed: false,
    bookingLink: "",
    reservationDest: "",
    reservationVertical: "stay",
    scheduleMode: "checkin_checkout",
    // 기본값 "빈자리/취소자리" — 예약 유형 미선택으로 게이트가 막히지 않게 한다.
    // stay 템플릿의 가장 일반적인 시작점. RESERVATION_TYPE_OPTIONS[0] 와 일치(변경 시 동기화).
    reservationType: "빈자리/취소자리",
    // 기본값 "전체" — 사이트/객실 미선택으로 게이트가 막히지 않게 한다.
    facilityTarget: "전체",
    facilityCustom: "",
    placeName: "",
    placeAddress: "",
    placePhone: "",
    placeMapUrl: "",
    placeSource: "",
    reservationDates: [],
    checkInTime: "",
    checkOutTime: "",
    baseGuests: "",
    maxGuests: "",
    facilityDetail: "",
    cautionNote: "",
    couponCondition: "",
    operatorNote: "",
    eventDetail: "",
    productKeyword: "",
    priceCompareEnabled: true,
    productCount: "3개",
    purchaseLink: "",
    collectContact: true,
    consultItem: "",
    ctaCopy: "",
    privacyNotice: "문의 시 개인정보 수집·이용에 동의합니다.",
    shareMessageUserAction: null,
    infoHeadline: "",
    infoHeadlineUserAction: null,
    infoKeyPoints: [],
    infoChecklist: [],
    infoQuote: "",
  };
}

const STEP3_COPY: Record<DropPurpose, { title: string; description: string }> = {
  정보: {
    title: "정보 구성을 정해 주세요",
    description: "영상에서 어떤 정보를 중심으로 정리할지 선택하세요.",
  },
  쿠폰: {
    title: "쿠폰 조건을 정해 주세요",
    description: "친구에게 보낼 혜택과 사용 조건을 정하세요.",
  },
  예약: {
    title: "예약 정보를 정해 주세요",
    description: "날짜, 인원, 예약 연결 방식을 정하세요.",
  },
  구매: {
    title: "구매 연결을 정해 주세요",
    description: "상품 후보와 가격비교 방식을 정하세요.",
  },
  상담: {
    title: "상담 방식을 정해 주세요",
    description: "문의 받을 항목과 상담 방식을 정하세요.",
  },
};

type Step5ShareConfig = {
  label: string;
  badge: string;
  title: string;
  description: string;
  cta: string;
};

/** Step 5 공유 화면 — 목적별 badge/title/description/cta */
const STEP5_SHARE_BY_PURPOSE: Record<DropPurpose, Step5ShareConfig> = {
  정보: {
    label: "정보",
    badge: "정보",
    title: "영상 핵심 정리",
    description: "영상의 핵심을 정리한 Drop이에요.",
    cta: "자세히 보기",
  },
  쿠폰: {
    label: "쿠폰",
    badge: "쿠폰",
    title: "혜택 쿠폰",
    description: "바로 쓸 수 있는 혜택 Drop이에요.",
    cta: "쿠폰 받기",
  },
  예약: {
    label: "예약",
    badge: "예약",
    title: "예약 안내",
    description: "원하는 날짜로 예약하는 Drop이에요.",
    cta: "예약하기",
  },
  구매: {
    label: "구매",
    badge: "구매",
    title: "상품·가격비교",
    description: "상품 후보와 가격을 비교하는 Drop이에요.",
    cta: "상품 보기",
  },
  상담: {
    label: "상담",
    badge: "상담",
    title: "문의·상담",
    description: "바로 문의할 수 있는 Drop이에요.",
    cta: "상담 신청",
  },
};

function aiPreviewFromPurpose(p: DropPurpose): AiPreviewData {
  const flow = PURPOSE_FLOW_CONFIG[p];
  return {
    title: flow.title,
    summary: flow.description,
    keyPoints: flow.points,
    suggestedShareText: `${flow.title} — ${flow.description}`,
  };
}

// TODO: video metadata + selected purpose + detail option 기반 AI Edge Function 호출
// TODO: 목적별 blocks 생성
// TODO: createDropV2 RPC 연결
// TODO: ai_suggested_purpose vs user_selected_purpose 분석 이벤트 저장

function createFastAiDraft(p: DropPurpose): EditableAiDraft {
  const flow = PURPOSE_FLOW_CONFIG[p];
  const ai = aiPreviewFromPurpose(p);
  return {
    title: ai.title,
    summary: ai.summary,
    keyPoints: ai.keyPoints,
    suggestedShareText: ai.suggestedShareText,
    makerMessage: "",
    ctaLabel: flow.cta,
    extraFields: flow.editFields.map((label) => ({ label, value: "" })),
  };
}

function draftToAiPreview(draft: EditableAiDraft): AiPreviewData {
  return {
    title: draft.title,
    summary: draft.summary,
    keyPoints: draft.keyPoints,
    suggestedShareText: draft.suggestedShareText,
  };
}

/** Step 4 / Fast Step 2 — 목적별 AI 결과 카드 (config 주입) */
function AiResultPreviewCard({
  purpose,
  videoInfo,
  title,
  summary,
  keyPoints,
  ctaLabel,
}: {
  purpose: DropPurpose;
  videoInfo: VideoInfo;
  title: string;
  summary: string;
  keyPoints: string[];
  ctaLabel: string;
}) {
  const flow = PURPOSE_FLOW_CONFIG[purpose];

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-bg shadow-soft">
      {videoInfo.thumbnailUrl ? (
        <div className="relative aspect-video w-full bg-surface">
          <img src={videoInfo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="space-y-4 p-4">
        <span
          className={cn(
            "inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold tracking-ko",
            flow.chipClass,
          )}
        >
          {flow.badge}
        </span>
        <p className="text-base font-bold tracking-ko text-text-strong">{title}</p>
        <p className="text-sm font-medium leading-relaxed tracking-ko text-text-muted">{summary}</p>
        <ul className="space-y-2 border-t border-border pt-4">
          {keyPoints.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-strong"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
              {point}
            </li>
          ))}
        </ul>
        {/* 받는 사람 화면의 행동(CTA) preview — 실제 액션 버튼이 아니라 작은 라벨. */}
        <div className="border-t border-border pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-ko text-text-subtle">
            받는 사람 화면 버튼
          </p>
          <span className="mt-2 inline-flex items-center rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold tracking-ko text-text-strong">
            {ctaLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function AiResultEditPanel({
  draft,
  onDraftChange,
}: {
  draft: EditableAiDraft;
  onDraftChange: (patch: Partial<EditableAiDraft>) => void;
}) {
  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-border bg-surface p-4">
      <label className="block">
        <span className="text-sm font-semibold tracking-ko text-text-strong">제목</span>
        <Input
          value={draft.title}
          onChange={(e) => onDraftChange({ title: e.target.value })}
          className="mt-2 h-12 rounded-lg"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold tracking-ko text-text-strong">설명</span>
        <textarea
          value={draft.summary}
          onChange={(e) => onDraftChange({ summary: e.target.value })}
          rows={3}
          className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong"
        />
      </label>
      <div>
        <span className="text-sm font-semibold tracking-ko text-text-strong">핵심 포인트</span>
        <ul className="mt-2 space-y-2">
          {draft.keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="mt-3 size-4 shrink-0 text-accent" strokeWidth={2} />
              <Input
                value={point}
                onChange={(e) => {
                  const next = [...draft.keyPoints];
                  next[i] = e.target.value;
                  onDraftChange({ keyPoints: next });
                }}
                className="h-10 rounded-lg"
              />
            </li>
          ))}
        </ul>
      </div>
      <label className="block">
        <span className="text-sm font-semibold tracking-ko text-text-strong">공유 문구</span>
        <textarea
          value={draft.suggestedShareText}
          onChange={(e) => onDraftChange({ suggestedShareText: e.target.value })}
          rows={2}
          className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold tracking-ko text-text-strong">
          친구에게 한마디 (선택)
        </span>
        <textarea
          value={draft.makerMessage}
          onChange={(e) => onDraftChange({ makerMessage: e.target.value.slice(0, 100) })}
          rows={2}
          placeholder="예: 여기 진짜 좋더라"
          className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold tracking-ko text-text-strong">버튼 문구</span>
        <Input
          value={draft.ctaLabel}
          onChange={(e) => onDraftChange({ ctaLabel: e.target.value })}
          className="mt-2 h-12 rounded-lg"
        />
      </label>
    </div>
  );
}

function buildWizardShareData(
  videoInfo: VideoInfo,
  purpose: DropPurpose,
  aiTitle: string,
  makerMessage?: string,
  reservation?: ReservationSummary,
): WizardSharePreviewData {
  return {
    video: {
      thumbnailUrl: videoInfo.thumbnailUrl,
      title: videoInfo.title,
      channelName: videoInfo.channelName,
      duration: videoInfo.duration,
      platformLabel: platformLabel(videoInfo.platform),
    },
    purpose,
    aiTitle,
    makerMessage,
    reservation: reservation
      ? {
          placeName: reservation.placeName,
          destLabel: reservation.destLabel,
          hasReserveButton: reservation.hasReserveButton,
          // 날짜별 status·remainingCount·event·memo 를 항목 단위로 그대로 전달.
          dates: reservation.dates.map((item) => ({
            main: reservationItemFullLabel(item),
            event: item.eventTitle,
            memo: item.memo,
          })),
        }
      : undefined,
  };
}

function FastStepBadge({ n }: { n: FastStepNum }) {
  return <p className="text-xs font-semibold tracking-ko text-text-subtle">Step {n} / 3</p>;
}

function platformLabel(platform: VideoInfo["platform"]): string {
  return platform === "youtube" ? "YouTube" : "Instagram";
}

function StepBadge({ n }: { n: StepNum }) {
  return <p className="text-xs font-semibold tracking-ko text-text-subtle">Step {n} / 5</p>;
}

function metadataUsesFallback(fetchedBy: VideoMetadataFetchedBy | null): boolean {
  return (
    fetchedBy === "youtube_fallback" ||
    fetchedBy === "instagram_fallback" ||
    fetchedBy === "manual_fallback"
  );
}

// =============================================================================
// Step 1 — 영상 링크
// =============================================================================

function Step1UrlInput({
  value,
  onChange,
  status,
  videoInfo,
  metadataFetchedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  status: "idle" | "loading" | "success" | "error";
  videoInfo: VideoInfo | null;
  metadataFetchedBy: VideoMetadataFetchedBy | null;
}) {
  const [thumbBroken, setThumbBroken] = useState(false);

  useEffect(() => {
    setThumbBroken(false);
  }, [videoInfo?.thumbnailUrl, videoInfo?.url]);
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch {
      // 클립보드 권한 거부 시 무시
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-6 pb-32 pt-2">
        <StepBadge n={1} />
        <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">
          보낼 영상 링크를 넣어주세요
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
          유튜브나 인스타에서 [공유] → [링크 복사] 후
          <br />
          아래에 붙여넣으면 AI가 Drop을 만들어줘요.
        </p>

        <div className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <LinkIcon
              className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-subtle"
              strokeWidth={2}
            />
            <Input
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://youtu.be/..."
              className="h-14 rounded-lg border-border pl-12 pr-10 font-mono text-sm placeholder:font-sans placeholder:text-text-subtle"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-muted"
                aria-label="지우기"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handlePaste}
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-text-muted hover:bg-surface"
            aria-label="붙여넣기"
          >
            <Clipboard className="size-5" strokeWidth={2} />
          </button>
        </div>

        {status === "idle" && !value && (
          <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm font-medium tracking-ko text-text-muted">
            영상 링크를 안내, 쿠폰, 예약, 구매, 상담으로 연결해보세요.
          </p>
        )}

        {status === "loading" && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <Loader2 className="size-5 animate-spin text-accent" strokeWidth={2} />
            <span className="text-sm font-medium tracking-ko text-text-muted">
              영상 정보를 가져오는 중...
            </span>
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-intent-danger/30 bg-intent-danger-bg p-4">
            <AlertCircle className="size-5 text-intent-danger" strokeWidth={2} />
            <span className="text-sm font-medium tracking-ko text-intent-danger">
              유튜브 또는 인스타그램 링크인지 확인해 주세요
            </span>
          </div>
        )}

        {status === "success" && videoInfo && (
          <>
            {metadataUsesFallback(metadataFetchedBy) && (
              <p className="mt-4 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
                영상 정보를 자동으로 가져오지 못했어요. 링크는 그대로 사용할 수 있어요.
              </p>
            )}
            <div className="mt-4 flex gap-3 overflow-hidden rounded-2xl border border-border bg-bg p-3">
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-surface">
                {videoInfo.thumbnailUrl && !thumbBroken ? (
                  <img
                    src={videoInfo.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setThumbBroken(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-subtle">
                    <LinkIcon className="size-6" strokeWidth={2} />
                  </div>
                )}
                <span className="absolute left-1 top-1 rounded-lg bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold tracking-ko text-white">
                  {platformLabel(videoInfo.platform)}
                </span>
                {videoInfo.duration ? (
                  <span className="absolute bottom-1 right-1 rounded-lg bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                    {videoInfo.duration}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <p className="line-clamp-2 text-sm font-bold tracking-ko text-text-strong">
                  {videoInfo.title}
                </p>
                {videoInfo.channelName ? (
                  <p className="text-xs font-medium tracking-ko text-text-muted">
                    {videoInfo.channelName}
                  </p>
                ) : null}
                <p className="truncate font-mono text-[11px] text-text-subtle">{videoInfo.url}</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// =============================================================================
// Step 2 — 5 목적 선택 (밈 Phase 2 미노출)
// =============================================================================

function PurposePickerGrid({
  selected,
  onSelect,
  suggestedPurpose,
  suggestionConfidence,
}: {
  selected: DropPurpose | null;
  onSelect: (p: DropPurpose) => void;
  suggestedPurpose?: DropPurpose | null;
  suggestionConfidence?: WizardSuggestionConfidence | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {WIZARD_PURPOSES.map((item) => {
        const Icon = item.icon;
        const isSelected = selected === item.purpose;
        const showSuggestedBadge =
          suggestedPurpose === item.purpose &&
          suggestionConfidence &&
          (suggestionConfidence === "high" || suggestionConfidence === "medium");
        return (
          <button
            key={item.purpose}
            type="button"
            onClick={() => onSelect(item.purpose)}
            className={cn(
              "group relative flex min-h-[112px] flex-col items-start justify-between gap-2 overflow-hidden rounded-2xl border border-border p-4 text-left transition-all duration-150 ease-out",
              "hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              isSelected && "border-[#2563EB] bg-[#EFF6FF]/40 ring-1 ring-[#2563EB]/25",
            )}
          >
            {showSuggestedBadge && (
              <span
                className={cn(
                  "absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold tracking-ko",
                  suggestionConfidence === "high"
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#2563EB] bg-white text-[#2563EB]",
                )}
              >
                <Sparkles className="size-3" strokeWidth={2} />
                AI 추천
              </span>
            )}
            {!showSuggestedBadge && !suggestedPurpose && item.aiRecommended && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold tracking-ko text-accent">
                <Sparkles className="size-3" strokeWidth={2} />
                AI 추천
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 left-0 w-1 transition-opacity duration-150",
                item.stripClass,
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            />
            <Icon className="size-6 text-text-muted" strokeWidth={2} />
            <div>
              <span className="text-sm font-bold tracking-ko text-text-strong">{item.label}</span>
              <p className="mt-1 text-xs font-medium leading-snug tracking-ko text-text-muted">
                {item.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Step2PurposeSelect({
  selected,
  onSelect,
  suggestedPurpose,
  suggestionConfidence,
  isPurposePrefilled,
}: {
  selected: DropPurpose | null;
  onSelect: (p: DropPurpose) => void;
  suggestedPurpose?: DropPurpose | null;
  suggestionConfidence?: WizardSuggestionConfidence | null;
  isPurposePrefilled: boolean;
}) {
  const [showPurposePicker, setShowPurposePicker] = useState(!isPurposePrefilled);
  const selectedConfig = selected ? findPurposeConfig(selected) : null;
  const suggestedConfig = suggestedPurpose ? findPurposeConfig(suggestedPurpose) : null;
  const purposeDiffers = suggestedPurpose && selected && suggestedPurpose !== selected;

  // Card assembly — Step 2 purpose 카드. 시각만 통일, onSelect 로직은 그대로 사용.
  const purposeCardConfig: CardConfig = {
    id: "purpose",
    type: "purpose",
    required: true,
    enabled: true,
    position: 2,
    status: selected ? "completed" : "needs_confirmation",
    data: {},
    label: "목적",
  };

  if (isPurposePrefilled && selected && selectedConfig) {
    const SelectedIcon = selectedConfig.icon;
    return (
      <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
        <StepBadge n={2} />
        <CardShell config={purposeCardConfig}>
        <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-ko text-text-strong">
          선택한 목적을 확인해 주세요
        </h1>

        <p className="mt-4 text-lg font-bold tracking-ko text-text-strong">
          {PURPOSE_CONFIRM_HEADLINE[selected]}
        </p>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
          홈에서 선택한 목적입니다. 필요하면 아래에서 변경할 수 있어요.
        </p>
        <p className="mt-1 text-sm leading-relaxed tracking-ko text-text-subtle">
          {PURPOSE_CONFIRM_DETAIL[selected]}
        </p>

        {suggestedConfig && (
          <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium tracking-ko text-text-muted">
              AI 추천:{" "}
              <span className="font-semibold text-text-strong">{suggestedConfig.label}</span>
            </p>
            <p className="text-sm font-medium tracking-ko text-text-muted">
              내 선택: <span className="font-semibold text-[#2563EB]">{selectedConfig.label}</span>
            </p>
            {purposeDiffers && (
              <p className="text-xs font-medium leading-relaxed tracking-ko text-text-subtle">
                AI는 {suggestedConfig.label}을 추천했지만, 선택한 {selectedConfig.label} 기준으로
                Drop을 만듭니다.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#2563EB] bg-[#EFF6FF]/40 p-4 ring-1 ring-[#2563EB]/25">
          <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 w-1", selectedConfig.stripClass)}
            />
            <SelectedIcon className="size-6 text-[#2563EB]" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-ko text-text-strong">
              {selectedConfig.label}
            </p>
            <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
              {selectedConfig.description}
            </p>
          </div>
          <Check className="size-6 shrink-0 text-[#2563EB]" strokeWidth={2} />
        </div>

        <button
          type="button"
          onClick={() => setShowPurposePicker((v) => !v)}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-border bg-white text-sm font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted hover:bg-surface"
        >
          {showPurposePicker ? "목적 선택 닫기" : "목적 바꾸기"}
        </button>

        {showPurposePicker && (
          <div className="mt-4">
            <PurposePickerGrid
              selected={selected}
              onSelect={onSelect}
              suggestedPurpose={suggestedPurpose}
              suggestionConfidence={suggestionConfidence}
            />
          </div>
        )}
        </CardShell>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={2} />
      <CardShell config={purposeCardConfig}>
      <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-ko text-text-strong">
        이 Drop의 목적을 선택하세요
      </h1>

      <div className="mt-8">
        <PurposePickerGrid
          selected={selected}
          onSelect={onSelect}
          suggestedPurpose={suggestedPurpose}
          suggestionConfidence={suggestionConfidence}
        />
      </div>

      <p className="mt-6 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
        선택한 목적에 따라 AI가 요약, 버튼, 공유 문구를 다르게 추천합니다.
      </p>
      </CardShell>
    </main>
  );
}

// =============================================================================
// Step 3 — 목적별 세부 설정
// =============================================================================

function Step3FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-semibold tracking-ko text-text-strong">{children}</span>;
}

function DetailCategoryGrid({
  categories,
  selectedId,
  onSelect,
}: {
  categories: { id: Step3DetailId; label: string }[];
  selectedId: Step3DetailId | null;
  onSelect: (id: Step3DetailId) => void;
}) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2">
      {categories.map((cat) => {
        const active = selectedId === cat.id;
        return (
          <li key={cat.id}>
            <button
              type="button"
              onClick={() => onSelect(cat.id)}
              className={cn(
                "flex min-h-[44px] w-full items-center justify-center rounded-2xl border px-3 py-3 text-center text-sm font-semibold tracking-ko transition-colors",
                active
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#2563EB]/25"
                  : "border-border bg-bg text-text-strong hover:border-text-muted",
              )}
            >
              {cat.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// 예약 목적 — 장소 검색 후보. searchPlaces 결과 단위.
export type PlaceCandidate = {
  name: string;
  address: string;
  phone: string;
  mapUrl: string;
  source: string;
};

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
type ReservationDestKind = "link" | "phone" | "sms" | "kakao" | "none";

const RESERVATION_DESTS: {
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
function reservationButtonName(destId: string): string {
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
const RESERVATION_DATE_STATUS_LABEL: Record<ReservationDateStatus, string> = {
  available: "예약 가능",
  few_left: "잔여 자리",
  almost_full: "마감 임박",
  closed: "마감",
  inquiry: "문의 필요",
};

const RESERVATION_DATE_STATUS_OPTIONS: ReservationDateStatus[] = [
  "available",
  "few_left",
  "almost_full",
  "closed",
  "inquiry",
];

// "2026-05-24" → "5월 24일 토". 파싱 실패 시 원본 반환.
function formatReservationDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`;
}

// 날짜 항목 고유 id.
function makeReservationDateId(): string {
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
function reservationRangeNights(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  return Math.round((e - s) / 86_400_000);
}

// "2026-05-18","2026-05-20" → "5월 18일~20일" (같은 달이면 끝은 일자만).
function formatReservationRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${start}~${end}`;
  const sm = s.getMonth() + 1;
  const em = e.getMonth() + 1;
  const endPart = sm === em ? `${e.getDate()}일` : `${em}월 ${e.getDate()}일`;
  return `${sm}월 ${s.getDate()}일~${endPart}`;
}

// ["2026-05-18","2026-05-21"] → "5월 18일, 21일" (달이 바뀔 때만 달 표기).
function formatReservationDateList(dates: string[]): string {
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
function reservationItemDateLabel(item: ReservationDateItem): string {
  if (item.mode === "range" && item.startDate && item.endDate) {
    return formatReservationRange(item.startDate, item.endDate);
  }
  if (item.mode === "multiple") return formatReservationDateList(item.dates);
  return item.dates[0] ? formatReservationDate(item.dates[0]) : "";
}

// 날짜 항목의 기간 부분 라벨 — "1박 가능" / "N박 가능" / "선택 가능".
function reservationItemSpanLabel(item: ReservationDateItem): string {
  if (item.mode === "range") {
    const n = item.nights ?? 0;
    return n > 0 ? `${n}박 가능` : "기간 가능";
  }
  if (item.mode === "multiple") return "선택 가능";
  return "1박 가능";
}

// 날짜 항목의 상태 부분 라벨 — few_left + 잔여수면 "잔여 N자리".
function reservationItemStatusLabel(item: ReservationDateItem): string {
  if (item.status === "few_left" && item.remainingCount && item.remainingCount > 0) {
    return `잔여 ${item.remainingCount}자리`;
  }
  return RESERVATION_DATE_STATUS_LABEL[item.status];
}

// 날짜 항목 한 줄 라벨 — "5월 24일 토 · 1박 가능 · 잔여 2자리".
function reservationItemFullLabel(item: ReservationDateItem): string {
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
function buildReservationSummary(fields: Step3FieldState): ReservationSummary {
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
// 예약 목적 Step 3 — 캘린더 중심 화면 (캠핑장·펜션·글램핑 사장님용)
// =============================================================================

// 캘린더 1칸 — ISO 날짜 + 그날에 묶인 예약 가능 항목(없으면 미선택).
function isoForDay(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// 오늘 ISO (로컬 기준).
function todayIso(): string {
  const d = new Date();
  return isoForDay(d.getFullYear(), d.getMonth(), d.getDate());
}

// 이번 주(또는 다음 주) 토·일 ISO. 토요일이 지났으면 다음 주말.
function thisWeekendIsos(): string[] {
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
function upcomingWeekdayIsos(): string[] {
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
function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// 캘린더 칸에 표시할 짧은 상태 라벨 — few_left+잔여수면 "잔여 N".
function reservationCellStatusLabel(item: ReservationDateItem): string {
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
function reservationSummaryLine(item: ReservationDateItem): string {
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
const RESERVATION_CELL_TONE: Record<ReservationDateStatus, string> = {
  available: "bg-intent-success-bg text-intent-success",
  few_left: "bg-intent-warning-bg text-intent-warning",
  almost_full: "bg-intent-warning-bg text-intent-warning",
  inquiry: "bg-intent-info-bg text-intent-info",
  closed: "bg-surface text-text-subtle",
};

// 어떤 예약을 알릴지 — 빠른 템플릿 칩.
const RESERVATION_TYPE_OPTIONS = [
  "빈자리/취소자리",
  "주말 예약",
  "펜션 객실",
  "단체 문의",
  "수영장/행사",
  "일반 예약",
];

// 어느 사이트/객실인지 — 시설 대상 옵션.
const FACILITY_TARGET_OPTIONS = ["전체", "캠핑 사이트", "펜션 객실", "글램핑/카라반", "직접 입력"];

// 빠른 입력 템플릿 — 캘린더 옆 작은 칩.
type QuickTemplateId =
  | "weekend_cancel"
  | "weekday_open"
  | "pension_one"
  | "group_ok"
  | "pool"
  | "firewood";

const QUICK_TEMPLATES: { id: QuickTemplateId; label: string }[] = [
  { id: "weekend_cancel", label: "이번 주말 취소자리" },
  { id: "weekday_open", label: "평일 빈자리" },
  { id: "pension_one", label: "펜션 객실 1개" },
  { id: "group_ok", label: "단체 문의 가능" },
  { id: "pool", label: "수영장 운영" },
  { id: "firewood", label: "장작 쿠폰 제공" },
];

// 캘린더 날짜 1건을 single 모드 ReservationDateItem 으로 만든다.
// WHY: 데이터 계약 — 캘린더 선택 날짜는 mode:"single", dates:[iso].
function makeSingleReservationItem(
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
function reservationPreviewHeadline(fields: Step3FieldState): string {
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
function buildReservationCustomerMessage(fields: Step3FieldState): string {
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
function reservationStep3GateReason(fields: Step3FieldState): string | null {
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

function canProceedReservationStep3(fields: Step3FieldState): boolean {
  return reservationStep3GateReason(fields) === null;
}

// 예약 Step 3 — 고객 미리보기 카드 (현재 state 로 라이브 갱신).
function ReservationPreviewCard({ fields }: { fields: Step3FieldState }) {
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
function ReservationChipGrid({
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
function ReservationCalendar({
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

function ReservationDateSheet({
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
function Step3ReservationCards({
  fields,
  onFieldsChange,
  onReservationDatesChange,
  onNext,
  onSkip,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  onReservationDatesChange: (
    updater: (prev: ReservationDateItem[]) => ReservationDateItem[],
  ) => void;
  onNext: () => void;
  onSkip: () => void;
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
          <button
            type="button"
            disabled={gateReason !== null}
            onClick={onSkip}
            className={WIZARD_SECONDARY_BUTTON_CLASS}
          >
            안내 문구 없이 계속
          </button>
        </div>
      </div>
    </main>
  );
}

function Step3Options({
  purpose,
  detailId,
  onDetailSelect,
  fields,
  onFieldsChange,
  onReservationDatesChange,
  onNext,
  onSkip,
}: {
  purpose: DropPurpose;
  detailId: Step3DetailId | null;
  onDetailSelect: (id: Step3DetailId) => void;
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  onReservationDatesChange: (
    updater: (prev: ReservationDateItem[]) => ReservationDateItem[],
  ) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  // 예약 목적은 세부 유형 게이트 없이 3개 카드 UI 로 바로 구성한다.
  if (purpose === "예약") {
    return (
      <Step3ReservationCards
        fields={fields}
        onFieldsChange={onFieldsChange}
        onReservationDatesChange={onReservationDatesChange}
        onNext={onNext}
        onSkip={onSkip}
      />
    );
  }

  if (purpose === "정보") {
    return (
      <Step3InfoCards
        detailId={detailId}
        onDetailSelect={onDetailSelect}
        fields={fields}
        onFieldsChange={onFieldsChange}
        onNext={onNext}
      />
    );
  }

  const copy = STEP3_COPY[purpose];
  const categories = PURPOSE_FLOW_CONFIG[purpose].detailCards;

  // Card assembly — Step 3 옵션(세부 유형) 카드. 시각만 통일, detailId/onDetailSelect 로직은 그대로.
  const optionsCardConfig: CardConfig = {
    id: "step3-options",
    type: "purpose",
    required: true,
    enabled: true,
    position: 3,
    status: detailId ? "completed" : "needs_confirmation",
    data: {},
    label: "세부 유형",
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={3} />
      <CardShell config={optionsCardConfig}>
        <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">{copy.title}</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
          {copy.description}
        </p>

        <p className="mt-6 text-sm font-semibold tracking-ko text-text-strong">세부 유형</p>
        <DetailCategoryGrid categories={categories} selectedId={detailId} onSelect={onDetailSelect} />
      </CardShell>

      {detailId && (
        <div className="mt-4">
          <PurposeMessageCard fields={fields} onFieldsChange={onFieldsChange} />
        </div>
      )}
    </main>
  );
}

// =============================================================================
// Step 4 — AI 결과 미리보기 (mock)
// =============================================================================

function Step4AiPreview({
  purpose,
  ai,
  videoInfo,
  reservation,
}: {
  purpose: DropPurpose;
  ai: AiPreviewData;
  videoInfo: VideoInfo;
  reservation?: ReservationSummary;
}) {
  const flow = PURPOSE_FLOW_CONFIG[purpose];

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={4} />
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-ko text-text-strong">
          AI가 받을 사람용 카드로 정리했어요
        </h1>
        <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-xs font-semibold text-accent">
          <Sparkles className="size-3" strokeWidth={2} />
          AI
        </span>
      </div>
      <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">{flow.description}</p>

      <AiResultPreviewCard
        purpose={purpose}
        videoInfo={videoInfo}
        title={ai.title}
        summary={ai.summary}
        keyPoints={ai.keyPoints}
        ctaLabel={flow.cta}
      />

      {purpose === "예약" && reservation && (
        <div className="mt-4 space-y-2">
          {(reservation.placeName || reservation.placeAddress) && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              {reservation.placeName && (
                <p className="text-sm font-bold tracking-ko text-text-strong">
                  {reservation.placeName}
                </p>
              )}
              {reservation.placeAddress && (
                <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                  {reservation.placeAddress}
                </p>
              )}
              {reservation.hasReserveButton && (
                <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                  예약하기 버튼 → {reservation.destLabel}
                </p>
              )}
            </div>
          )}
          {reservation.dates.length > 0 && (
            <div className="space-y-2 rounded-lg border border-intent-success/30 bg-intent-success-bg p-3">
              <p className="text-xs font-bold tracking-ko text-text-strong">예약 가능 날짜</p>
              <ul className="space-y-2">
                {reservation.dates.slice(0, 2).map((item) => (
                  <li key={item.id}>
                    <p className="text-xs font-semibold tracking-ko text-text-strong">
                      {reservationItemFullLabel(item)}
                    </p>
                    {item.eventTitle && (
                      <p className="mt-1 text-xs font-medium tracking-ko text-text-strong">
                        {item.eventTitle}
                      </p>
                    )}
                    {item.eventDescription && (
                      <p className="mt-1 text-[11px] font-medium tracking-ko text-text-muted">
                        {item.eventDescription}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {reservation.dates.length > 2 && (
                <p className="text-[11px] font-medium tracking-ko text-text-subtle">
                  외 {reservation.dates.length - 2}개 더 보기
                </p>
              )}
            </div>
          )}
          {!reservation.hasReserveButton && (
            <div className="flex items-start gap-2 rounded-lg border border-intent-danger/30 bg-intent-danger-bg p-4">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-intent-danger" strokeWidth={2} />
              <span className="text-sm font-medium leading-relaxed tracking-ko text-intent-danger">
                예약 버튼 연결이 없어 받은 사람 화면에 예약하기 버튼이 표시되지 않습니다.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg bg-surface p-3">
        <p className="text-xs font-semibold uppercase tracking-ko text-text-subtle">
          공유 문구 제안
        </p>
        <p className="mt-1 text-sm font-medium italic tracking-ko text-text-muted">
          &quot;{ai.suggestedShareText}&quot;
        </p>
      </div>
    </main>
  );
}

// =============================================================================
// Step 5 — 공유 미리보기 (v0 WizardSharePreview 재사용)
// =============================================================================

// WHY: 기존 v0 공유 미리보기 디자인(WizardSharePreview)을 그대로 재사용하고,
//      목적별 데이터(purpose chip / aiTitle / description)만 주입한다.
function Step5PurposeShare({
  purpose,
  videoInfo,
  ai,
  shareUrl,
  onKakaoShare,
  onCopyLink,
  onGoHome,
  shareError,
  shareFeedback,
  makerMessage,
  reservation,
}: {
  purpose: DropPurpose;
  videoInfo: VideoInfo;
  ai: AiPreviewData;
  shareUrl: string;
  onKakaoShare: () => Promise<void>;
  onCopyLink: () => Promise<void>;
  onGoHome: () => void;
  shareError: string | null;
  shareFeedback: string | null;
  makerMessage?: string;
  reservation?: ReservationSummary;
}) {
  return (
    <WizardSharePreview
      data={buildWizardShareData(videoInfo, purpose, ai.title, makerMessage, reservation)}
      shareUrl={shareUrl}
      onKakaoShare={onKakaoShare}
      onCopyLink={onCopyLink}
      onGoHome={onGoHome}
      shareError={shareError}
      shareFeedback={shareFeedback}
    />
  );
}

// =============================================================================
// Fast mode — Home 진입 3단계
// =============================================================================

function FastStep1VideoPurposeConfirm({
  purpose,
  videoInfo,
  urlStatus,
  suggestedPurpose,
  suggestionConfidence,
  onPurposeSelect,
}: {
  purpose: DropPurpose;
  videoInfo: VideoInfo | null;
  urlStatus: "idle" | "loading" | "success" | "error";
  suggestedPurpose?: DropPurpose | null;
  suggestionConfidence?: WizardSuggestionConfidence | null;
  onPurposeSelect: (p: DropPurpose) => void;
}) {
  const [showPurposePicker, setShowPurposePicker] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const selectedConfig = findPurposeConfig(purpose)!;
  const suggestedConfig = suggestedPurpose ? findPurposeConfig(suggestedPurpose) : null;
  const purposeDiffers = suggestedPurpose && suggestedPurpose !== purpose;
  const SelectedIcon = selectedConfig.icon;

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <FastStepBadge n={1} />
      <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">
        영상과 목적을 확인해 주세요
      </h1>

      {urlStatus === "loading" && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
          <Loader2 className="size-5 animate-spin text-accent" strokeWidth={2} />
          <span className="text-sm font-medium tracking-ko text-text-muted">
            영상 정보를 가져오는 중...
          </span>
        </div>
      )}

      {urlStatus === "success" && videoInfo && (
        <div className="mt-4 flex gap-3 overflow-hidden rounded-2xl border border-border bg-bg p-3">
          <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-surface">
            {videoInfo.thumbnailUrl && !thumbBroken ? (
              <img
                src={videoInfo.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setThumbBroken(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-subtle">
                <LinkIcon className="size-6" strokeWidth={2} />
              </div>
            )}
            <span className="absolute left-1 top-1 rounded-lg bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {platformLabel(videoInfo.platform)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold tracking-ko text-text-strong">
              {videoInfo.title}
            </p>
            {videoInfo.channelName ? (
              <p className="mt-1 truncate text-xs font-medium text-text-muted">
                {videoInfo.channelName}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <p className="mt-6 text-lg font-bold tracking-ko text-text-strong">
        {PURPOSE_CONFIRM_HEADLINE[purpose]}
      </p>
      <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">
        홈에서 선택한 목적입니다. 필요하면 아래에서 변경할 수 있어요.
      </p>

      {suggestedConfig && (
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium tracking-ko text-text-muted">
            AI 추천: <span className="font-semibold text-text-strong">{suggestedConfig.label}</span>
          </p>
          <p className="text-sm font-medium tracking-ko text-text-muted">
            내 선택: <span className="font-semibold text-[#2563EB]">{selectedConfig.label}</span>
          </p>
          {purposeDiffers && (
            <p className="text-xs font-medium leading-relaxed tracking-ko text-text-subtle">
              AI는 {suggestedConfig.label}을 추천했지만, 선택한 {selectedConfig.label} 기준으로
              Drop을 만듭니다.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#2563EB] bg-[#EFF6FF]/40 p-4 ring-1 ring-[#2563EB]/25">
        <SelectedIcon className="size-6 shrink-0 text-[#2563EB]" strokeWidth={2} />
        <p className="text-base font-bold tracking-ko text-text-strong">{selectedConfig.label}</p>
        <Check className="ml-auto size-5 text-[#2563EB]" strokeWidth={2} />
      </div>

      <button
        type="button"
        onClick={() => setShowPurposePicker((v) => !v)}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-border bg-white text-sm font-semibold tracking-ko text-text-strong"
      >
        {showPurposePicker ? "목적 선택 닫기" : "목적 바꾸기"}
      </button>
      {showPurposePicker && (
        <div className="mt-4">
          <PurposePickerGrid
            selected={purpose}
            onSelect={onPurposeSelect}
            suggestedPurpose={suggestedPurpose}
            suggestionConfidence={suggestionConfidence}
          />
        </div>
      )}
    </main>
  );
}

function FastStep2AiEdit({
  purpose,
  draft,
  onDraftChange,
}: {
  purpose: DropPurpose;
  draft: EditableAiDraft;
  onDraftChange: (patch: Partial<EditableAiDraft>) => void;
}) {
  const share = STEP5_SHARE_BY_PURPOSE[purpose];

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <FastStepBadge n={2} />
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-ko text-text-strong">AI 분석 결과 편집</h1>
        <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-xs font-semibold text-accent">
          <Sparkles className="size-3" strokeWidth={2} />
          AI
        </span>
      </div>
      <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">
        {share.label} · {purpose} — 내용을 확인하고 수정해 주세요
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold tracking-ko text-text-strong">제목</span>
          <Input
            value={draft.title}
            onChange={(e) => onDraftChange({ title: e.target.value })}
            className="mt-2 h-12 rounded-lg"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold tracking-ko text-text-strong">설명</span>
          <textarea
            value={draft.summary}
            onChange={(e) => onDraftChange({ summary: e.target.value })}
            rows={3}
            className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko"
          />
        </label>

        <div>
          <span className="text-sm font-semibold tracking-ko text-text-strong">핵심 포인트</span>
          <ul className="mt-2 space-y-2">
            {draft.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-1 size-4 shrink-0 text-accent" strokeWidth={2} />
                <Input
                  value={point}
                  onChange={(e) => {
                    const next = [...draft.keyPoints];
                    next[i] = e.target.value;
                    onDraftChange({ keyPoints: next });
                  }}
                  className="h-10 rounded-lg"
                />
              </li>
            ))}
          </ul>
        </div>

        {draft.extraFields.map((field, i) => (
          <label key={field.label} className="block">
            <span className="text-sm font-semibold tracking-ko text-text-strong">
              {field.label}
            </span>
            <Input
              value={field.value}
              onChange={(e) => {
                const next = [...draft.extraFields];
                next[i] = { ...field, value: e.target.value };
                onDraftChange({ extraFields: next });
              }}
              className="mt-2 h-12 rounded-lg"
            />
          </label>
        ))}

        <label className="block">
          <span className="text-sm font-semibold tracking-ko text-text-strong">공유 문구</span>
          <textarea
            value={draft.suggestedShareText}
            onChange={(e) => onDraftChange({ suggestedShareText: e.target.value })}
            rows={2}
            className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold tracking-ko text-text-strong">
            메이커 메시지 (선택)
          </span>
          <textarea
            value={draft.makerMessage}
            onChange={(e) => onDraftChange({ makerMessage: e.target.value.slice(0, 100) })}
            rows={2}
            placeholder="친구에게 전할 한마디"
            className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko"
          />
        </label>

        <p className="text-xs font-medium tracking-ko text-text-subtle">
          미리보기 버튼: {draft.ctaLabel}
        </p>
      </div>
    </main>
  );
}

// =============================================================================
// Main wizard
// =============================================================================

export function CreateDropWizard({
  variant = "default",
  initialUrl,
  initialPurpose,
  initialSuggestedPurpose,
  initialSuggestionConfidence,
  initialMetadata,
  fastCreateMode: fastCreateModeProp,
  onClose,
  onComplete,
}: CreateDropWizardProps) {
  // WHY: Home(url+purpose) 경유도 5단계 흐름을 탄다 — Step 3 목적별 세부 카드를
  //      거치도록. fast 3단계는 fastCreateMode prop 을 명시할 때만 활성화.
  // WHY: 예약 목적은 장소·예약 가능 날짜·예약 버튼 연결 Step 3 카드가 반드시
  //      필요하다. fast 3단계에는 이 입력 UI 가 없으므로 예약은 항상 5단계로 탄다.
  const isFastCreateMode = Boolean(fastCreateModeProp) && initialPurpose !== "예약";
  const [fastStep, setFastStep] = useState<FastStepNum>(1);
  const [editableAi, setEditableAi] = useState<EditableAiDraft | null>(() =>
    isFastCreateMode && initialPurpose ? createFastAiDraft(initialPurpose) : null,
  );
  const [step, setStep] = useState<StepNum>(1);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [urlStatus, setUrlStatus] = useState<"idle" | "loading" | "success" | "error">(() => {
    if (initialUrl && initialMetadata) return "success";
    if (initialUrl) return "loading";
    return "idle";
  });
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(() =>
    initialUrl && initialMetadata ? videoInfoFromMetadata(initialMetadata, initialUrl) : null,
  );
  const [metadataFetchedBy, setMetadataFetchedBy] = useState<VideoMetadataFetchedBy | null>(
    initialMetadata?.fetchedBy ?? null,
  );
  const [purpose, setPurpose] = useState<DropPurpose | null>(initialPurpose ?? null);
  const [suggestedPurpose, setSuggestedPurpose] = useState<DropPurpose | null>(
    initialSuggestedPurpose ?? null,
  );
  const [suggestionConfidence, setSuggestionConfidence] =
    useState<WizardSuggestionConfidence | null>(initialSuggestionConfidence ?? null);
  const skipNextUrlFetch = useRef(Boolean(initialUrl && initialMetadata));
  const isPurposePrefilled = Boolean(initialPurpose);
  const [step3DetailId, setStep3DetailId] = useState<Step3DetailId | null>(null);
  const [step3Fields, setStep3Fields] = useState<Step3FieldState>(createEmptyStep3Fields);
  const [aiPreview, setAiPreview] = useState<AiPreviewData | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  // 첫 공유/복사/수신자 화면 보기 시 1회만 /api/drops 저장 — 이후 같은 URL 재사용.
  const [realShare, setRealShare] = useState<{ shareUuid: string; shareUrl: string } | null>(null);
  const savingRef = useRef<Promise<{ shareUuid: string; shareUrl: string }> | null>(null);

  function resetStep3ForPurpose() {
    setStep3DetailId(null);
    setStep3Fields(createEmptyStep3Fields());
    setAiPreview(null);
  }

  function handlePurposeSelect(next: DropPurpose) {
    if (purpose !== next) {
      resetStep3ForPurpose();
      if (isFastCreateMode) {
        setEditableAi(createFastAiDraft(next));
      }
    }
    setPurpose(next);
  }

  const mockShareUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
    const slug = purpose
      ? { 정보: "info", 쿠폰: "coupon", 예약: "reservation", 구매: "purchase", 상담: "lead" }[
          purpose
        ]
      : "info";
    const base = `${origin}/d/preview-${slug}-${Date.now().toString(36)}`;
    if (purpose !== "예약") return base;
    // 예약 목적 — 공유 URL(?r= 예약 가능 날짜, ?u= 예약 버튼 연결값)에 메이커 입력값을 실어 /d 까지 전달.
    const params = new URLSearchParams();
    if (step3Fields.reservationDates.length > 0) {
      const encoded = encodeReservationDates(step3Fields.reservationDates);
      if (encoded) params.set("r", encoded);
    }
    const bookingLink = step3Fields.bookingLink.trim();
    if (bookingLink) params.set("u", bookingLink);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }, [purpose, step3Fields.reservationDates, step3Fields.bookingLink]);

  // 예약 dates 비어 있으면 Step 4/5 미리보기·공유 카피를 "예약 버튼만" 흐름에 맞춰 좁힌다.
  // - title: "예약하기"
  // - summary: "아래 버튼을 눌러 예약 페이지로 이동할 수 있어요."
  // - keyPoints: "예약 가능한 날짜 표시"·"날짜 선택"·"체크인·체크아웃" 제거, 그 외 유지.
  // dates 가 1개 이상이면 원본 aiPreview 그대로.
  const aiForPreview =
    purpose === "예약" && step3Fields.reservationDates.length === 0 && aiPreview
      ? {
          ...aiPreview,
          title: "예약하기",
          summary: "아래 버튼을 눌러 예약 페이지로 이동할 수 있어요.",
          keyPoints: aiPreview.keyPoints.filter(
            (p) =>
              !["예약 가능한 날짜 표시", "날짜 선택", "체크인·체크아웃"].some((h) => p.includes(h)),
          ),
        }
      : aiPreview;

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlStatus("idle");
      setVideoInfo(null);
      setMetadataFetchedBy(null);
      return;
    }

    const parsed = parseVideoUrl(trimmed);
    if (!parsed) {
      setUrlStatus("error");
      setVideoInfo(null);
      setMetadataFetchedBy(null);
      return;
    }

    if (skipNextUrlFetch.current) {
      skipNextUrlFetch.current = false;
      return;
    }

    setUrlStatus("loading");
    let cancelled = false;

    const debounce = setTimeout(() => {
      void fetchVideoMetadata(trimmed).then((meta) => {
        if (cancelled) return;
        const platform =
          meta.platform === "instagram"
            ? "instagram"
            : meta.platform === "youtube"
              ? "youtube"
              : parsed.platform;

        setMetadataFetchedBy(meta.fetchedBy);
        setUrlStatus("success");
        setVideoInfo({
          url: meta.sourceUrl,
          thumbnailUrl: meta.thumbnailUrl ?? "",
          title: meta.title,
          channelName: meta.authorName ?? "",
          duration: "",
          platform,
        });
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [url]);

  function buildAiPreview(p: DropPurpose): AiPreviewData {
    const base = aiPreviewFromPurpose(p);
    const message = step3Fields.shareMessage.trim();
    const suffix = message ? ` — "${message}"` : "";
    return {
      ...base,
      suggestedShareText: base.title + suffix,
    };
  }

  function handleBack() {
    if (isFastCreateMode) {
      if (fastStep === 1) {
        onClose?.();
        return;
      }
      setFastStep((s) => (s - 1) as FastStepNum);
      return;
    }
    if (step === 1) {
      onClose?.();
      return;
    }
    setStep((s) => (s - 1) as StepNum);
  }

  function handleNext() {
    if (isFastCreateMode) {
      if (fastStep === 1 && purpose) {
        setEditableAi(createFastAiDraft(purpose));
        setFastStep(2);
        return;
      }
      if (fastStep === 2 && purpose && editableAi) {
        setAiPreview(draftToAiPreview(editableAi));
        setFastStep(3);
        return;
      }
      return;
    }
    if (step === 2 && purpose) {
      setAiPreview(null);
      setStep(3);
      return;
    }
    if (step === 3 && purpose) {
      setAiPreview(buildAiPreview(purpose));
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
      return;
    }
    setStep((s) => Math.min(5, s + 1) as StepNum);
  }

  function canProceed(): boolean {
    if (isFastCreateMode) {
      if (fastStep === 1) {
        return parseVideoUrl(url.trim()) !== null && urlStatus === "success" && purpose !== null;
      }
      return true;
    }
    if (step === 1) return parseVideoUrl(url.trim()) !== null && urlStatus === "success";
    if (step === 2) return purpose !== null;
    if (step === 3) {
      // 예약은 캘린더 화면 — 예약 종류·시설·날짜·날짜 상태·예약 버튼 연결을 모두 요구한다.
      if (purpose === "예약") return canProceedReservationStep3(step3Fields);
      if (purpose === "정보") return true;
      return step3DetailId !== null;
    }
    return true;
  }

  // 첫 공유/복사/수신자 화면 보기 시 /api/drops 를 1회만 호출하고 결과를 캐싱한다.
  // 동시 클릭 race 는 savingRef 로 같은 promise 를 공유하여 중복 저장을 방지.
  async function ensureRealShare(): Promise<{ shareUuid: string; shareUrl: string } | null> {
    if (realShare) return realShare;
    if (savingRef.current) return savingRef.current;
    const ai = isFastCreateMode && editableAi ? draftToAiPreview(editableAi) : aiForPreview;
    if (!videoInfo || !ai || !purpose || !onComplete) return null;
    const message = isFastCreateMode ? (editableAi?.makerMessage ?? "") : step3Fields.shareMessage;
    const promise = onComplete({ video: videoInfo, purpose, ai, makerMessage: message });
    savingRef.current = promise;
    try {
      const data = await promise;
      // 예약 목적 — ?r= 예약 가능 날짜(base64url), ?u= link kind 예약 URL 을 함께 운반.
      // phone/sms 는 받는 사람 tel:/sms: 분기 미구현(Phase 2) 이라 ?u= 미전달 → /d 버튼은 비활성.
      // DB(store.reservation_url / component_blocks) 저장 전까지는 query param 임시 운반.
      const dest =
        purpose === "예약"
          ? RESERVATION_DESTS.find((d) => d.id === step3Fields.reservationDest)
          : undefined;
      const linkUrl = dest?.kind === "link" ? normalizeReservationUrl(step3Fields.bookingLink) : "";
      const datesEncoded =
        purpose === "예약" && step3Fields.reservationDates.length > 0
          ? encodeReservationDates(step3Fields.reservationDates)
          : "";
      const params = new URLSearchParams();
      if (datesEncoded) params.set("r", datesEncoded);
      if (linkUrl) params.set("u", linkUrl);
      const query = params.toString();
      const shareUrl = query ? `${data.shareUrl}?${query}` : data.shareUrl;
      const result = { shareUuid: data.shareUuid, shareUrl };
      setRealShare(result);
      return result;
    } catch (e) {
      setShareError("Drop 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      console.error("[CreateDropWizard] ensureRealShare", e);
      return null;
    } finally {
      savingRef.current = null;
    }
  }

  async function handleKakaoShare() {
    const ai = isFastCreateMode && editableAi ? draftToAiPreview(editableAi) : aiForPreview;
    if (!videoInfo || !ai || !purpose) return;
    setShareError(null);
    setShareFeedback(null);
    const real = await ensureRealShare();
    if (!real) return;
    const makerNote = isFastCreateMode
      ? (editableAi?.makerMessage.trim() ?? "")
      : step3Fields.shareMessage.trim();
    const result = await shareToKakao({
      title: ai.title,
      description: [purpose, makerNote].filter(Boolean).join(" · "),
      imageUrl: videoInfo.thumbnailUrl,
      linkUrl: real.shareUrl,
      buttons: [
        {
          title:
            (isFastCreateMode && editableAi
              ? editableAi.ctaLabel
              : purpose
                ? STEP5_SHARE_BY_PURPOSE[purpose].cta
                : null) ?? "보러 가기",
          link: real.shareUrl,
        },
      ],
    });
    if (result.fallback === "clipboard") {
      setShareFeedback("카카오 SDK 호출에 실패해서 링크를 복사했어요.");
    } else if (!result.ok) {
      setShareError("카카오 공유에 실패했어요. 링크를 직접 복사해 주세요.");
    }
  }

  async function handleCopyLink() {
    setShareError(null);
    setShareFeedback(null);
    const real = await ensureRealShare();
    if (!real) return;
    try {
      await navigator.clipboard.writeText(real.shareUrl);
      setShareFeedback("링크를 복사했어요.");
    } catch {
      setShareError("링크 복사에 실패했어요.");
    }
  }

  // "홈으로 가기" — wizard 종료 후 /home 으로 이동. 저장은 트리거하지 않는다.
  // (저장은 카카오톡 공유/링크 복사 클릭 시 ensureRealShare 가 한 번만 수행)
  function handleGoHome() {
    onClose?.();
  }

  if (variant === "skeleton") {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-4 w-12 rounded-lg" />
        </header>
        <div className="flex-1 px-6 pt-6">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="mt-6 h-14 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const activeStep = isFastCreateMode ? fastStep : step;
  const totalSteps = isFastCreateMode ? 3 : 5;
  const progressPct = (activeStep / totalSteps) * 100;

  if (isFastCreateMode && purpose && editableAi) {
    const fastAi = draftToAiPreview(editableAi);

    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-white">
        <header className="flex h-14 shrink-0 items-center border-b border-[#E5E7EB] px-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-11 min-w-11 items-center gap-1 rounded-lg px-3 text-sm font-medium tracking-ko text-[#525252] hover:text-[#111111]"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            {fastStep === 1 ? "닫기" : "이전"}
          </button>
          <span className="flex-1 text-center text-sm font-bold tracking-ko text-[#111111]">
            드롭 만들기
          </span>
          <span className="w-16 text-right text-xs font-semibold tracking-ko text-[#525252]">
            Step {fastStep}/3
          </span>
        </header>
        <div className="h-1 w-full bg-[#E2E8F0]" aria-hidden>
          <div
            className="h-full bg-[#2563EB] transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {fastStep === 1 && (
          <FastStep1VideoPurposeConfirm
            purpose={purpose}
            videoInfo={videoInfo}
            urlStatus={urlStatus}
            suggestedPurpose={suggestedPurpose}
            suggestionConfidence={suggestionConfidence}
            onPurposeSelect={handlePurposeSelect}
          />
        )}
        {fastStep === 2 && (
          <FastStep2AiEdit
            purpose={purpose}
            draft={editableAi}
            onDraftChange={(patch) =>
              setEditableAi((prev) => (prev ? { ...prev, ...patch } : prev))
            }
          />
        )}
        {fastStep === 3 && videoInfo && (
          <Step5PurposeShare
            purpose={purpose}
            videoInfo={videoInfo}
            ai={fastAi}
            shareUrl={realShare?.shareUrl ?? mockShareUrl}
            onKakaoShare={handleKakaoShare}
            onCopyLink={handleCopyLink}
            onGoHome={handleGoHome}
            shareError={shareError}
            shareFeedback={shareFeedback}
            makerMessage={editableAi.makerMessage.trim() || undefined}
          />
        )}

        {fastStep < 3 && (
          <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-6 py-4">
            <ActionButton
              type="button"
              disabled={!canProceed()}
              onClick={handleNext}
              className={WIZARD_PRIMARY_BUTTON_CLASS}
            >
              다음
            </ActionButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[480px] flex-col bg-white",
        // 예약 Step 3은 캘린더가 길어 본문이 내부 스크롤돼야 한다. h-screen(확정 높이)
        // 이라야 main(flex-1 min-h-0 overflow-y-auto)이 내부 스크롤하고 하단 CTA가
        // 본문을 덮지 않는다. 그 외 단계·목적은 기존 min-h-screen 유지.
        step === 3 && purpose === "예약" ? "h-screen" : "min-h-screen",
      )}
    >
      <header className="flex h-14 shrink-0 items-center border-b border-[#E5E7EB] px-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex h-11 min-w-11 items-center gap-1 rounded-lg px-3 text-sm font-medium tracking-ko text-[#525252] transition-colors hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          {step === 1 ? "닫기" : "이전"}
        </button>
        <span className="flex-1 text-center text-sm font-bold tracking-ko text-[#111111]">
          드롭 만들기
        </span>
        <span className="w-16 text-right text-xs font-semibold tracking-ko text-[#525252]">
          Step {step}/5
        </span>
      </header>
      <div className="h-1 w-full bg-[#E2E8F0]" aria-hidden>
        <div
          className="h-full bg-[#2563EB] transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {step === 1 && (
        <Step1UrlInput
          value={url}
          onChange={setUrl}
          status={urlStatus}
          videoInfo={videoInfo}
          metadataFetchedBy={metadataFetchedBy}
        />
      )}
      {step === 2 && (
        <Step2PurposeSelect
          selected={purpose}
          onSelect={handlePurposeSelect}
          suggestedPurpose={suggestedPurpose}
          suggestionConfidence={suggestionConfidence}
          isPurposePrefilled={isPurposePrefilled}
        />
      )}
      {step === 3 && purpose && (
        <Step3Options
          purpose={purpose}
          detailId={step3DetailId}
          onDetailSelect={setStep3DetailId}
          fields={step3Fields}
          onFieldsChange={(patch) => setStep3Fields((prev) => ({ ...prev, ...patch }))}
          onReservationDatesChange={(updater) =>
            setStep3Fields((prev) => ({
              ...prev,
              reservationDates: updater(prev.reservationDates),
            }))
          }
          onNext={handleNext}
          onSkip={() => {
            if (purpose) {
              setAiPreview(buildAiPreview(purpose));
              setStep(4);
            }
          }}
        />
      )}
      {step === 4 && purpose && videoInfo && aiPreview && (
        <Step4AiPreview
          purpose={purpose}
          ai={aiForPreview!}
          videoInfo={videoInfo}
          reservation={purpose === "예약" ? buildReservationSummary(step3Fields) : undefined}
        />
      )}
      {step === 5 && purpose && videoInfo && aiPreview && (
        <Step5PurposeShare
          purpose={purpose}
          videoInfo={videoInfo}
          ai={aiForPreview!}
          shareUrl={realShare?.shareUrl ?? mockShareUrl}
          onKakaoShare={handleKakaoShare}
          onCopyLink={handleCopyLink}
          onGoHome={handleGoHome}
          shareError={shareError}
          shareFeedback={shareFeedback}
          makerMessage={step3Fields.shareMessage.trim() || undefined}
          reservation={purpose === "예약" ? buildReservationSummary(step3Fields) : undefined}
        />
      )}

      {/* 예약 Step 3은 자체 in-flow CTA를 쓰므로 공유 sticky CTA에서 제외한다. */}
      {step < 5 && !(step === 3 && purpose === "예약") && (
        <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-6 py-4">
          <ActionButton
            type="button"
            disabled={!canProceed()}
            onClick={handleNext}
            className={WIZARD_PRIMARY_BUTTON_CLASS}
          >
            {step === 4 ? "공유 미리보기" : "다음"}
          </ActionButton>
        </div>
      )}
    </div>
  );
}

export default CreateDropWizard;
