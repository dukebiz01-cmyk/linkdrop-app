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
import {
  WizardSharePreview,
  type WizardSharePreviewData,
} from "@/components/wizard-share-preview";
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
  onComplete?: (data: {
    video: VideoInfo;
    purpose: DropPurpose;
    local?: LocalPartner;
    ai: AiPreviewData;
    makerMessage: string;
  }) => void;
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
export type ReservationDateStatus =
  | "available"
  | "few_left"
  | "almost_full"
  | "closed"
  | "inquiry";

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
  /** 예약 목적 — 예약 버튼 연결 방식 (naver/external/phone/sms/kakao/later) */
  reservationDest: string;
  /** 예약 목적 — 장소 정보 (searchPlaces 후보 선택 또는 직접 입력) */
  placeName: string;
  placeAddress: string;
  placePhone: string;
  placeMapUrl: string;
  placeSource: string;
  /** 예약 목적 — 메이커가 안내하는 예약 가능 날짜 (하루/기간/여러 날짜) */
  reservationDates: ReservationDateItem[];
  productKeyword: string;
  priceCompareEnabled: boolean;
  productCount: string;
  purchaseLink: string;
  collectContact: boolean;
  consultItem: string;
  ctaCopy: string;
  privacyNotice: string;
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
    placeName: "",
    placeAddress: "",
    placePhone: "",
    placeMapUrl: "",
    placeSource: "",
    reservationDates: [],
    productKeyword: "",
    priceCompareEnabled: true,
    productCount: "3개",
    purchaseLink: "",
    collectContact: true,
    consultItem: "",
    ctaCopy: "",
    privacyNotice: "문의 시 개인정보 수집·이용에 동의합니다.",
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
  const purposeDiffers =
    suggestedPurpose && selected && suggestedPurpose !== selected;

  if (isPurposePrefilled && selected && selectedConfig) {
    const SelectedIcon = selectedConfig.icon;
    return (
      <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
        <StepBadge n={2} />
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
              AI 추천: <span className="font-semibold text-text-strong">{suggestedConfig.label}</span>
            </p>
            <p className="text-sm font-medium tracking-ko text-text-muted">
              내 선택: <span className="font-semibold text-[#2563EB]">{selectedConfig.label}</span>
            </p>
            {purposeDiffers && (
              <p className="text-xs font-medium leading-relaxed tracking-ko text-text-subtle">
                AI는 {suggestedConfig.label}을 추천했지만, 선택한 {selectedConfig.label} 기준으로 Drop을
                만듭니다.
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
            <p className="text-base font-bold tracking-ko text-text-strong">{selectedConfig.label}</p>
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
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={2} />
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
    </main>
  );
}

// =============================================================================
// Step 3 — 목적별 세부 설정
// =============================================================================

function Step3FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-sm font-semibold tracking-ko text-text-strong">{children}</span>
  );
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

// 예약 목적 — 받는 사람이 누를 "예약하기" 버튼의 연결 목적지 선택지.
const RESERVATION_DESTS: {
  id: string;
  label: string;
  inputLabel: string | null;
  placeholder: string;
  inputType: string;
}[] = [
  {
    id: "naver",
    label: "네이버 예약 링크",
    inputLabel: "네이버 예약 링크 주소",
    placeholder: "https://booking.naver.com/...",
    inputType: "url",
  },
  {
    id: "external",
    label: "외부 예약 링크",
    inputLabel: "예약 링크 주소",
    placeholder: "https://...",
    inputType: "url",
  },
  {
    id: "phone",
    label: "전화 연결",
    inputLabel: "전화번호",
    placeholder: "010-0000-0000",
    inputType: "tel",
  },
  {
    id: "sms",
    label: "문자 문의",
    inputLabel: "휴대폰 번호",
    placeholder: "010-0000-0000",
    inputType: "tel",
  },
  {
    id: "kakao",
    label: "카카오톡 문의",
    inputLabel: "카카오톡 채널·오픈채팅 링크",
    placeholder: "https://pf.kakao.com/...",
    inputType: "url",
  },
  {
    id: "later",
    label: "나중에 입력",
    inputLabel: null,
    placeholder: "",
    inputType: "text",
  },
];

// 예약 가능 날짜 상태 → 한글 라벨.
const RESERVATION_DATE_STATUS_LABEL: Record<ReservationDateStatus, string> = {
  available: "여유",
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

// 예약 Step 3 입력값 → ReservationSummary (Step 4/5·공유 데이터로 전달).
function buildReservationSummary(fields: Step3FieldState): ReservationSummary {
  const dest = RESERVATION_DESTS.find((d) => d.id === fields.reservationDest) ?? null;
  const isLater = !fields.reservationDest || fields.reservationDest === "later";
  const destValue = fields.bookingLink.trim();
  return {
    placeName: fields.placeName.trim(),
    placeAddress: fields.placeAddress.trim(),
    placePhone: fields.placePhone.trim(),
    placeMapUrl: fields.placeMapUrl.trim(),
    destKind: fields.reservationDest,
    destLabel: dest?.label ?? "",
    destValue,
    // 예약하기 버튼: '나중에 입력'이 아니고 연결값이 있을 때만 노출.
    hasReserveButton: !isLater && destValue.length > 0,
    hasPhoneButton: fields.placePhone.trim().length > 0,
    hasMapButton: fields.placeMapUrl.trim().length > 0,
    dates: fields.reservationDates,
  };
}

// WHY: 메이커는 매장을 "연결"하는 사람이 아니라, 받는 사람이 누를 예약 버튼의
//      목적지를 정하는 사람이다. 매장 검색 UI 대신 목적지 선택 카드로 구성한다.
function ReservationDestinationPicker({
  fields,
  onFieldsChange,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
}) {
  const selected = RESERVATION_DESTS.find((d) => d.id === fields.reservationDest) ?? null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-bold tracking-ko text-text-strong">
          예약 버튼을 어디로 연결할까요?
        </p>
        <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
          받는 사람이 예약하기를 누르면 이동할 곳을 정하세요.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {RESERVATION_DESTS.map((dest) => {
          const active = fields.reservationDest === dest.id;
          return (
            <li key={dest.id}>
              <button
                type="button"
                onClick={() =>
                  onFieldsChange({
                    reservationDest: dest.id,
                    // 전화 연결 — 장소에서 찾은 전화번호를 자동 채움.
                    bookingLink: dest.id === "phone" ? fields.placePhone : "",
                  })
                }
                className={cn(
                  "flex min-h-[44px] w-full items-center justify-center rounded-2xl border px-3 py-3 text-center text-sm font-semibold tracking-ko transition-colors",
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
      {selected?.inputLabel && (
        <label className="block">
          <span className="text-sm font-semibold tracking-ko text-text-strong">
            {selected.inputLabel}
          </span>
          <Input
            type={selected.inputType}
            value={fields.bookingLink}
            onChange={(e) => onFieldsChange({ bookingLink: e.target.value })}
            placeholder={selected.placeholder}
            className="mt-2 h-12 rounded-lg"
          />
        </label>
      )}
      {selected?.id === "later" && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium leading-relaxed tracking-ko text-text-muted">
            예약 버튼 연결이 없어 받은 사람 화면에 예약 버튼이 표시되지 않습니다. 나중에
            수정에서 연결할 수 있어요.
          </p>
        </div>
      )}
    </div>
  );
}

// 예약 목적 Step 3 — 카드 1: 장소 정보 직접 입력.
// WHY: 메이커는 매장을 "검색·연결"하는 사람이 아니라 예약 장소 정보를 직접
//      정리하는 사람이다. 매장 검색 UI 대신 compact 입력 4칸으로 구성한다.
function ReservationPlaceCard({
  fields,
  onFieldsChange,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-bold tracking-ko text-text-strong">
          어디를 예약하는 곳인가요?
        </p>
        <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
          예약 장소 정보를 직접 입력해 주세요. 받는 사람 화면에 함께 표시됩니다.
        </p>
      </div>
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
        <span className="text-xs font-semibold tracking-ko text-text-strong">지도 링크 (선택)</span>
        <Input
          type="url"
          value={fields.placeMapUrl}
          onChange={(e) => onFieldsChange({ placeMapUrl: e.target.value })}
          placeholder="https://map.naver.com/..."
          className="mt-2 h-11 rounded-lg"
        />
      </label>
    </div>
  );
}

// 예약 가능 날짜 입력 폼 state — reservationDates(목록) state 와 완전히 분리.
type ReservationDateDraft = {
  mode: ReservationDateMode;
  date: string;
  dates: string[];
  startDate: string;
  endDate: string;
  status: ReservationDateStatus;
  remainingCount: string;
  memo: string;
  eventTitle: string;
  eventDescription: string;
};

const EMPTY_RESERVATION_DATE_DRAFT: ReservationDateDraft = {
  mode: "single",
  date: "",
  dates: [],
  startDate: "",
  endDate: "",
  status: "available",
  remainingCount: "",
  memo: "",
  eventTitle: "",
  eventDescription: "",
};

const RESERVATION_DATE_MODE_LABEL: Record<ReservationDateMode, string> = {
  single: "하루",
  range: "기간",
  multiple: "여러 날짜",
};

// draft 가 현재 모드 기준 유효한지 — '확인' 버튼 활성화 조건.
function isReservationDraftValid(draft: ReservationDateDraft): boolean {
  if (draft.mode === "single") return Boolean(draft.date);
  if (draft.mode === "range") {
    return Boolean(
      draft.startDate &&
        draft.endDate &&
        reservationRangeNights(draft.startDate, draft.endDate) > 0,
    );
  }
  return draft.dates.length > 0;
}

// draft → ReservationDateItem. 모드별 필수값 미충족이면 null.
function buildReservationDateItem(draft: ReservationDateDraft): ReservationDateItem | null {
  if (!isReservationDraftValid(draft)) return null;
  const parsedCount = parseInt(draft.remainingCount, 10);
  const remainingCount =
    draft.remainingCount.trim() && Number.isFinite(parsedCount) && parsedCount > 0
      ? parsedCount
      : undefined;
  const base = {
    id: makeReservationDateId(),
    status: draft.status,
    remainingCount,
    memo: draft.memo.trim() || undefined,
    eventTitle: draft.eventTitle.trim() || undefined,
    eventDescription: draft.eventDescription.trim() || undefined,
  };
  if (draft.mode === "single") {
    return { ...base, mode: "single", dates: [draft.date] };
  }
  if (draft.mode === "range") {
    return {
      ...base,
      mode: "range",
      dates: [draft.startDate, draft.endDate],
      startDate: draft.startDate,
      endDate: draft.endDate,
      nights: reservationRangeNights(draft.startDate, draft.endDate),
    };
  }
  return { ...base, mode: "multiple", dates: [...draft.dates] };
}

// 예약 목적 Step 3 — 섹션 3: 예약 가능 날짜 안내 (하루/기간/여러 날짜 3모드).
// WHY: 예약 가능 기간을 시스템이 단정하지 않는다. 메이커가 모드를 골라 직접 입력하고,
//      '확인'을 눌렀을 때만 reservationDates 배열에 append 된다. 목록 변경은 직전
//      값(prev) 기준 함수형 업데이터로만 하며, 폼 열기/닫기/취소는 목록을 건드리지 않는다.
function ReservationDateSection({
  fields,
  onReservationDatesChange,
}: {
  fields: Step3FieldState;
  onReservationDatesChange: (
    updater: (prev: ReservationDateItem[]) => ReservationDateItem[],
  ) => void;
}) {
  // 입력 폼 열림 여부 + 입력값 — 둘 다 reservationDates 목록과 독립.
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ReservationDateDraft>(EMPTY_RESERVATION_DATE_DRAFT);
  const [multiInput, setMultiInput] = useState("");

  function patchDraft(patch: Partial<ReservationDateDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  // '날짜 추가' — 입력 폼을 여는 버튼. 목록은 그대로.
  function openForm() {
    setDraft(EMPTY_RESERVATION_DATE_DRAFT);
    setMultiInput("");
    setFormOpen(true);
  }

  // '취소' — 입력 폼만 닫는다. reservationDates 목록은 유지.
  function cancelForm() {
    setDraft(EMPTY_RESERVATION_DATE_DRAFT);
    setMultiInput("");
    setFormOpen(false);
  }

  // 여러 날짜 모드 — 임시 입력값을 draft.dates 에 추가.
  function addMultiDate() {
    if (!multiInput || draft.dates.includes(multiInput)) return;
    patchDraft({ dates: [...draft.dates, multiInput].sort() });
    setMultiInput("");
  }

  function removeMultiDate(value: string) {
    patchDraft({ dates: draft.dates.filter((d) => d !== value) });
  }

  // '확인' — draft 를 항목으로 만들어 직전 목록(prev)에 append. 목록 초기화 없음.
  function confirmDate() {
    const item = buildReservationDateItem(draft);
    if (!item) return;
    onReservationDatesChange((prev) => [
      ...prev,
      { ...item, highlighted: prev.length === 0 },
    ]);
    cancelForm();
  }

  // 목록 항목 삭제 / 대표 강조 — 모두 prev 기준 함수형 업데이트.
  function removeItem(id: string) {
    onReservationDatesChange((prev) => prev.filter((it) => it.id !== id));
  }

  function toggleHighlight(id: string) {
    onReservationDatesChange((prev) =>
      prev.map((it) => ({
        ...it,
        highlighted: it.id === id ? !it.highlighted : it.highlighted,
      })),
    );
  }

  const draftValid = isReservationDraftValid(draft);
  const rangeNights =
    draft.mode === "range" && draft.startDate && draft.endDate
      ? reservationRangeNights(draft.startDate, draft.endDate)
      : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-bold tracking-ko text-text-strong">
          예약 가능한 날짜를 표시해 주세요
        </p>
        <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
          비어 있는 날짜나 예약을 받고 싶은 날짜를 선택하세요.
        </p>
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-[11px] font-medium leading-relaxed tracking-ko text-text-muted">
          선택한 날짜는 공유 카드에 최대 2개까지 표시됩니다.
        </p>
      </div>

      {/* 추가된 날짜 목록 — 폼 열기/닫기와 무관하게 항상 유지된다. */}
      {fields.reservationDates.length > 0 && (
        <ul className="space-y-2">
          {fields.reservationDates.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3",
                item.highlighted
                  ? "border-[#2563EB] bg-[#EFF6FF]/40 ring-1 ring-[#2563EB]/25"
                  : "border-border bg-bg",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold tracking-ko text-text-strong">
                  {reservationItemDateLabel(item)}
                </p>
                <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                  {reservationItemSpanLabel(item)} · {reservationItemStatusLabel(item)}
                </p>
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
              </div>
              <button
                type="button"
                onClick={() => toggleHighlight(item.id)}
                className="min-h-[44px] shrink-0 text-xs font-semibold tracking-ko text-[#2563EB]"
              >
                {item.highlighted ? "강조 해제" : "대표 강조"}
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label="날짜 삭제"
                className="flex size-11 shrink-0 items-center justify-center text-text-subtle hover:text-text-muted"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 폼 닫힘 — '날짜 추가'는 입력 폼을 여는 버튼(저장 버튼 아님). */}
      {!formOpen && (
        <button
          type="button"
          onClick={openForm}
          className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-bg text-sm font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
        >
          <Plus className="size-4" strokeWidth={2} />
          날짜 추가
        </button>
      )}

      {/* 폼 열림 — 모드 선택 + 모드별 입력. '확인'을 눌러야 목록에 append. */}
      {formOpen && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex gap-2">
            {(["single", "range", "multiple"] as ReservationDateMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patchDraft({ mode: m })}
                className={cn(
                  "min-h-[44px] flex-1 rounded-lg border px-3 text-xs font-semibold tracking-ko transition-colors",
                  draft.mode === m
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                    : "border-border bg-bg text-text-strong hover:border-text-muted",
                )}
              >
                {RESERVATION_DATE_MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {draft.mode === "single" && (
            <label className="block">
              <span className="text-xs font-semibold tracking-ko text-text-strong">날짜</span>
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => patchDraft({ date: e.target.value })}
                className="mt-2 h-12 rounded-lg"
              />
            </label>
          )}

          {draft.mode === "range" && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  시작일
                </span>
                <Input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => patchDraft({ startDate: e.target.value })}
                  className="mt-2 h-12 rounded-lg"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  종료일
                </span>
                <Input
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => patchDraft({ endDate: e.target.value })}
                  className="mt-2 h-12 rounded-lg"
                />
              </label>
              <p className="text-xs font-medium tracking-ko text-text-muted">
                {rangeNights > 0
                  ? `${formatReservationRange(draft.startDate, draft.endDate)} · ${rangeNights}박 가능`
                  : "시작일과 종료일을 순서대로 선택해 주세요."}
              </p>
            </div>
          )}

          {draft.mode === "multiple" && (
            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  날짜 추가 입력
                </span>
                <div className="mt-2 flex gap-2">
                  <Input
                    type="date"
                    value={multiInput}
                    onChange={(e) => setMultiInput(e.target.value)}
                    className="h-12 flex-1 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={addMultiDate}
                    disabled={!multiInput}
                    className="min-h-[44px] shrink-0 rounded-lg border border-border bg-bg px-4 text-xs font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted disabled:opacity-40"
                  >
                    추가
                  </button>
                </div>
              </div>
              {draft.dates.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {draft.dates.map((d) => (
                    <li key={d}>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 text-xs font-semibold tracking-ko text-text-strong">
                        {formatReservationDate(d)}
                        <button
                          type="button"
                          onClick={() => removeMultiDate(d)}
                          aria-label="날짜 제거"
                          className="text-text-subtle hover:text-text-muted"
                        >
                          <X className="size-3" strokeWidth={2} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <span className="text-xs font-semibold tracking-ko text-text-strong">상태</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {RESERVATION_DATE_STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patchDraft({ status: s })}
                  className={cn(
                    "min-h-[44px] rounded-lg border px-3 text-xs font-semibold tracking-ko transition-colors",
                    draft.status === s
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
              잔여 자리 (선택)
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={draft.remainingCount}
              onChange={(e) => patchDraft({ remainingCount: e.target.value })}
              placeholder="예: 2"
              className="mt-2 h-12 rounded-lg"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-ko text-text-strong">
              짧은 메모 (선택)
            </span>
            <Input
              value={draft.memo}
              onChange={(e) => patchDraft({ memo: e.target.value.slice(0, 20) })}
              placeholder="예: 반려동물 동반 가능"
              className="mt-2 h-12 rounded-lg"
            />
          </label>

          {/* 그날의 행사/이벤트 — 고정 chip 없이 메이커가 자유롭게 적는다. */}
          <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
            <div>
              <p className="text-xs font-semibold tracking-ko text-text-strong">
                그날 특별한 게 있나요?
              </p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed tracking-ko text-text-muted">
                행사나 이벤트가 있으면 자유롭게 적어주세요. 받는 사람이 그날 가야 할 이유를
                더 쉽게 이해할 수 있어요.
              </p>
            </div>
            <label className="block">
              <span className="text-xs font-semibold tracking-ko text-text-strong">
                행사/이벤트 내용
              </span>
              <Input
                value={draft.eventDescription}
                onChange={(e) =>
                  patchDraft({ eventDescription: e.target.value.slice(0, 60) })
                }
                placeholder="예: 저녁 7시 물풍선 놀이, 밤 8시 마술쇼"
                className="mt-2 h-12 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold tracking-ko text-text-strong">
                짧은 강조 문구
              </span>
              <Input
                value={draft.eventTitle}
                onChange={(e) => patchDraft({ eventTitle: e.target.value.slice(0, 30) })}
                placeholder="예: 아이와 가기 좋은 날 / 이번 주말 2자리만"
                className="mt-2 h-12 rounded-lg"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelForm}
              className="min-h-[44px] flex-1 rounded-lg border border-border bg-bg text-sm font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmDate}
              disabled={!draftValid}
              className="min-h-[44px] flex-1 rounded-lg bg-action text-sm font-semibold tracking-ko text-white disabled:opacity-40"
            >
              확인
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
        표시된 날짜는 메이커가 입력한 예약 안내입니다. 최종 예약 가능 여부는 예약처에서
        확인해 주세요.
      </p>
    </div>
  );
}

function Step3PurposeFields({
  purpose,
  fields,
  onFieldsChange,
}: {
  purpose: DropPurpose;
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
}) {
  const flow = PURPOSE_FLOW_CONFIG[purpose];

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium leading-relaxed tracking-ko text-text-muted">
          선택한 세부 유형으로 AI가 {flow.badge} Drop을 구성해요. 다음 단계에서 결과를 확인할 수
          있어요.
        </p>
      </div>
      <label className="block rounded-2xl border border-border bg-bg p-4">
        <span className="text-sm font-semibold tracking-ko text-text-strong">
          친구에게 한마디 (선택)
        </span>
        <textarea
          value={fields.shareMessage}
          onChange={(e) => onFieldsChange({ shareMessage: e.target.value.slice(0, 100) })}
          rows={2}
          placeholder="예: 여기 진짜 좋더라"
          className="mt-2 block w-full resize-none border-0 bg-transparent p-0 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle focus-visible:outline-none"
        />
      </label>
    </div>
  );
}

// 예약 목적 Step 3 — 장소 / 예약 가능 날짜 / 예약 버튼 연결 3개 카드.
// WHY: 메이커가 "무엇을 만들어 보내는지" 한눈에 보이도록 세부 유형 선택 게이트
//      없이 3개 카드를 바로 노출한다. 받는 사람용 예약 Drop 구조를 그대로 반영.
function Step3ReservationCards({
  fields,
  onFieldsChange,
  onReservationDatesChange,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  onReservationDatesChange: (
    updater: (prev: ReservationDateItem[]) => ReservationDateItem[],
  ) => void;
}) {
  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={3} />
      <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">
        예약 정보를 확인해 주세요
      </h1>
      <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
        받는 사람이 예약하기 전에 필요한 정보를 정리해 주세요.
      </p>

      <div className="mt-6 space-y-4">
        <section className="rounded-2xl border border-border bg-bg p-4">
          <ReservationPlaceCard fields={fields} onFieldsChange={onFieldsChange} />
        </section>
        <section className="rounded-2xl border border-border bg-bg p-4">
          <ReservationDateSection
            fields={fields}
            onReservationDatesChange={onReservationDatesChange}
          />
        </section>
        <section className="rounded-2xl border border-border bg-bg p-4">
          <ReservationDestinationPicker fields={fields} onFieldsChange={onFieldsChange} />
        </section>

        <label className="block rounded-2xl border border-border bg-bg p-4">
          <span className="text-sm font-semibold tracking-ko text-text-strong">
            친구에게 한마디 (선택)
          </span>
          <textarea
            value={fields.shareMessage}
            onChange={(e) => onFieldsChange({ shareMessage: e.target.value.slice(0, 100) })}
            rows={2}
            placeholder="예: 여기 진짜 좋더라"
            className="mt-2 block w-full resize-none border-0 bg-transparent p-0 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle focus-visible:outline-none"
          />
        </label>
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
}: {
  purpose: DropPurpose;
  detailId: Step3DetailId | null;
  onDetailSelect: (id: Step3DetailId) => void;
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  onReservationDatesChange: (
    updater: (prev: ReservationDateItem[]) => ReservationDateItem[],
  ) => void;
}) {
  // 예약 목적은 세부 유형 게이트 없이 3개 카드 UI 로 바로 구성한다.
  if (purpose === "예약") {
    return (
      <Step3ReservationCards
        fields={fields}
        onFieldsChange={onFieldsChange}
        onReservationDatesChange={onReservationDatesChange}
      />
    );
  }

  const copy = STEP3_COPY[purpose];
  const categories = PURPOSE_FLOW_CONFIG[purpose].detailCards;

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={3} />
      <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">{copy.title}</h1>
      <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
        {copy.description}
      </p>

      <p className="mt-6 text-sm font-semibold tracking-ko text-text-strong">세부 유형</p>
      <DetailCategoryGrid
        categories={categories}
        selectedId={detailId}
        onSelect={onDetailSelect}
      />

      {detailId && (
        <Step3PurposeFields
          purpose={purpose}
          fields={fields}
          onFieldsChange={onFieldsChange}
        />
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
      <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">
        {flow.description}
      </p>

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
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-intent-danger"
                strokeWidth={2}
              />
              <span className="text-sm font-medium leading-relaxed tracking-ko text-intent-danger">
                예약 버튼 연결이 없어 받은 사람 화면에 예약하기 버튼이 표시되지 않습니다.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg bg-surface p-3">
        <p className="text-xs font-semibold uppercase tracking-ko text-text-subtle">공유 문구 제안</p>
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
      data={buildWizardShareData(
        videoInfo,
        purpose,
        ai.title,
        makerMessage,
        reservation,
      )}
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
  const purposeDiffers =
    suggestedPurpose && suggestedPurpose !== purpose;
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
            <span className="text-sm font-semibold tracking-ko text-text-strong">{field.label}</span>
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
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
    const slug = purpose
      ? { 정보: "info", 쿠폰: "coupon", 예약: "reservation", 구매: "purchase", 상담: "lead" }[purpose]
      : "info";
    const base = `${origin}/d/preview-${slug}-${Date.now().toString(36)}`;
    // 예약 목적 — 메이커가 입력한 예약 가능 날짜를 공유 URL(?r=)에 실어 /d 까지 전달.
    if (purpose === "예약" && step3Fields.reservationDates.length > 0) {
      const encoded = encodeReservationDates(step3Fields.reservationDates);
      if (encoded) return `${base}?r=${encoded}`;
    }
    return base;
  }, [purpose, step3Fields.reservationDates]);

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
      // 예약은 세부 유형 게이트가 없으므로 장소명 입력으로 진행 여부를 판단한다.
      if (purpose === "예약") return step3Fields.placeName.trim().length > 0;
      return step3DetailId !== null;
    }
    return true;
  }

  async function handleKakaoShare() {
    const ai =
      isFastCreateMode && editableAi ? draftToAiPreview(editableAi) : aiPreview;
    if (!videoInfo || !ai || !purpose) return;
    setShareError(null);
    setShareFeedback(null);
    const makerNote = isFastCreateMode
      ? (editableAi?.makerMessage.trim() ?? "")
      : step3Fields.shareMessage.trim();
    const result = await shareToKakao({
      title: ai.title,
      description: [purpose, makerNote].filter(Boolean).join(" · "),
      imageUrl: videoInfo.thumbnailUrl,
      linkUrl: mockShareUrl,
      buttons: [
        {
          title:
            (isFastCreateMode && editableAi
              ? editableAi.ctaLabel
              : purpose
                ? STEP5_SHARE_BY_PURPOSE[purpose].cta
                : null) ?? "보러 가기",
          link: mockShareUrl,
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
    try {
      await navigator.clipboard.writeText(mockShareUrl);
      setShareFeedback("링크를 복사했어요.");
    } catch {
      setShareError("링크 복사에 실패했어요.");
    }
  }

  function handleGoHome() {
    const message = isFastCreateMode
      ? (editableAi?.makerMessage ?? "")
      : step3Fields.shareMessage;
    const ai = isFastCreateMode && editableAi ? draftToAiPreview(editableAi) : aiPreview;
    if (videoInfo && purpose && ai) {
      onComplete?.({
        video: videoInfo,
        purpose,
        ai,
        makerMessage: message,
      });
    }
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
            onDraftChange={(patch) => setEditableAi((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        )}
        {fastStep === 3 && videoInfo && (
          <Step5PurposeShare
            purpose={purpose}
            videoInfo={videoInfo}
            ai={fastAi}
            shareUrl={mockShareUrl}
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
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-white">
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
        />
      )}
      {step === 4 && purpose && videoInfo && aiPreview && (
        <Step4AiPreview
          purpose={purpose}
          ai={aiPreview}
          videoInfo={videoInfo}
          reservation={purpose === "예약" ? buildReservationSummary(step3Fields) : undefined}
        />
      )}
      {step === 5 && purpose && videoInfo && aiPreview && (
        <Step5PurposeShare
          purpose={purpose}
          videoInfo={videoInfo}
          ai={aiPreview}
          shareUrl={mockShareUrl}
          onKakaoShare={handleKakaoShare}
          onCopyLink={handleCopyLink}
          onGoHome={handleGoHome}
          shareError={shareError}
          shareFeedback={shareFeedback}
          makerMessage={step3Fields.shareMessage.trim() || undefined}
          reservation={purpose === "예약" ? buildReservationSummary(step3Fields) : undefined}
        />
      )}

      {step < 5 && (
        <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-6 py-4">
          {step === 3 && (
            <button
              type="button"
              onClick={() => {
                if (purpose) {
                  setAiPreview(buildAiPreview(purpose));
                  setStep(4);
                }
              }}
              className={WIZARD_SECONDARY_BUTTON_CLASS}
            >
              메시지 없이 계속
            </button>
          )}
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
