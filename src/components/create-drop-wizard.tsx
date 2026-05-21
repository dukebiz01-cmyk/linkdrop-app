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
  MapPin,
  Phone,
  Search,
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
import { MOCK_LOCAL_PARTNERS } from "@/lib/mock-data";
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
    description: "원하는 날짜를 고르고 예약으로 이어지도록 구성했어요.",
    points: ["예약 버튼 구성", "날짜 선택 안내", "예약 링크 연결"],
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

const MOCK_LOCALS: LocalPartner[] = MOCK_LOCAL_PARTNERS.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  address: p.address,
  avatarUrl: p.avatarUrl,
}));

type Step3DetailId = string;

type SummaryTone = "짧게" | "자세히" | "후기처럼";

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
  productKeyword: string;
  priceCompareEnabled: boolean;
  productCount: string;
  purchaseLink: string;
  collectContact: boolean;
  consultItem: string;
  ctaCopy: string;
  privacyNotice: string;
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

function purposeNeedsOptionalPartner(p: DropPurpose): boolean {
  return p === "쿠폰" || p === "예약" || p === "상담";
}

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
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-action text-sm font-semibold tracking-ko text-white"
        >
          {ctaLabel}
        </button>
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
  partnerName?: string,
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
    partnerName,
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

function PartnerOptionalPicker({
  partnerSearch,
  onPartnerSearchChange,
  selectedPartner,
  onSelectPartner,
}: {
  partnerSearch: string;
  onPartnerSearchChange: (v: string) => void;
  selectedPartner: LocalPartner | null;
  onSelectPartner: (p: LocalPartner | null) => void;
}) {
  const filtered = MOCK_LOCALS.filter((l) =>
    l.name.toLowerCase().includes(partnerSearch.toLowerCase()),
  );

  return (
    <div className="mt-4">
      <p className="text-sm font-semibold tracking-ko text-text-strong">
        버튼을 어디로 연결할까요? <span className="font-medium text-text-muted">(선택)</span>
      </p>
      <div className="relative mt-2">
        <Search
          className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-subtle"
          strokeWidth={2}
        />
        <Input
          type="search"
          value={partnerSearch}
          onChange={(e) => onPartnerSearchChange(e.target.value)}
          placeholder="예약 링크·전화·문자로 연결"
          className="h-12 rounded-lg border-border pl-12"
        />
      </div>
      {selectedPartner ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent bg-surface p-3">
          <img src={selectedPartner.avatarUrl} alt="" className="size-12 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-strong">{selectedPartner.name}</p>
            <p className="text-xs font-medium text-text-muted">{selectedPartner.category}</p>
          </div>
          <button
            type="button"
            onClick={() => onSelectPartner(null)}
            className="text-xs font-semibold text-accent"
          >
            변경
          </button>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((local) => (
            <li key={local.id}>
              <button
                type="button"
                onClick={() => onSelectPartner(local)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg p-3 text-left transition-colors hover:border-text-muted"
              >
                <img src={local.avatarUrl} alt="" className="size-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-strong">{local.name}</p>
                  <p className="flex items-center gap-1 text-xs font-medium text-text-muted">
                    <MapPin className="size-3" strokeWidth={2} />
                    {local.category}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Step3PurposeFields({
  purpose,
  fields,
  onFieldsChange,
  partnerSearch,
  onPartnerSearchChange,
  selectedPartner,
  onSelectPartner,
}: {
  purpose: DropPurpose;
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  partnerSearch: string;
  onPartnerSearchChange: (v: string) => void;
  selectedPartner: LocalPartner | null;
  onSelectPartner: (p: LocalPartner | null) => void;
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
      {purposeNeedsOptionalPartner(purpose) && (
        <PartnerOptionalPicker
          partnerSearch={partnerSearch}
          onPartnerSearchChange={onPartnerSearchChange}
          selectedPartner={selectedPartner}
          onSelectPartner={onSelectPartner}
        />
      )}
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

function Step3Options({
  purpose,
  detailId,
  onDetailSelect,
  fields,
  onFieldsChange,
  partnerSearch,
  onPartnerSearchChange,
  selectedPartner,
  onSelectPartner,
}: {
  purpose: DropPurpose;
  detailId: Step3DetailId | null;
  onDetailSelect: (id: Step3DetailId) => void;
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  partnerSearch: string;
  onPartnerSearchChange: (v: string) => void;
  selectedPartner: LocalPartner | null;
  onSelectPartner: (p: LocalPartner | null) => void;
}) {
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
          partnerSearch={partnerSearch}
          onPartnerSearchChange={onPartnerSearchChange}
          selectedPartner={selectedPartner}
          onSelectPartner={onSelectPartner}
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
  partnerName,
}: {
  purpose: DropPurpose;
  ai: AiPreviewData;
  videoInfo: VideoInfo;
  partnerName?: string;
}) {
  const flow = PURPOSE_FLOW_CONFIG[purpose];

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={4} />
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-ko text-text-strong">AI가 이렇게 만들었어요</h1>
        <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-xs font-semibold text-accent">
          <Sparkles className="size-3" strokeWidth={2} />
          AI
        </span>
      </div>
      <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">
        {flow.description}
        {partnerName ? ` · ${partnerName}` : ""}
      </p>

      <AiResultPreviewCard
        purpose={purpose}
        videoInfo={videoInfo}
        title={ai.title}
        summary={ai.summary}
        keyPoints={ai.keyPoints}
        ctaLabel={flow.cta}
      />

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
  partnerName,
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
  partnerName?: string;
}) {
  return (
    <WizardSharePreview
      data={buildWizardShareData(videoInfo, purpose, ai.title, makerMessage, partnerName)}
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
  partnerSearch,
  onPartnerSearchChange,
  selectedPartner,
  onSelectPartner,
}: {
  purpose: DropPurpose;
  videoInfo: VideoInfo | null;
  urlStatus: "idle" | "loading" | "success" | "error";
  suggestedPurpose?: DropPurpose | null;
  suggestionConfidence?: WizardSuggestionConfidence | null;
  onPurposeSelect: (p: DropPurpose) => void;
  partnerSearch: string;
  onPartnerSearchChange: (v: string) => void;
  selectedPartner: LocalPartner | null;
  onSelectPartner: (p: LocalPartner | null) => void;
}) {
  const [showPurposePicker, setShowPurposePicker] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const selectedConfig = findPurposeConfig(purpose)!;
  const suggestedConfig = suggestedPurpose ? findPurposeConfig(suggestedPurpose) : null;
  const purposeDiffers =
    suggestedPurpose && suggestedPurpose !== purpose;
  const filtered = MOCK_LOCALS.filter((l) =>
    l.name.toLowerCase().includes(partnerSearch.toLowerCase()),
  );
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

      {purposeNeedsOptionalPartner(purpose) && (
        <div className="mt-6">
          <p className="text-sm font-semibold tracking-ko text-text-strong">
            버튼을 어디로 연결할까요? <span className="font-medium text-text-muted">(선택)</span>
          </p>
          <div className="relative mt-2">
            <Search
              className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-subtle"
              strokeWidth={2}
            />
            <Input
              type="search"
              value={partnerSearch}
              onChange={(e) => onPartnerSearchChange(e.target.value)}
              placeholder="예약 링크·전화·문자로 연결"
              className="h-12 rounded-lg border-border pl-12"
            />
          </div>
          {selectedPartner ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-accent bg-surface p-3">
              <img src={selectedPartner.avatarUrl} alt="" className="size-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-strong">{selectedPartner.name}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectPartner(null)}
                className="text-xs font-semibold text-accent"
              >
                변경
              </button>
            </div>
          ) : (
            <ul className="mt-3 max-h-32 space-y-2 overflow-y-auto">
              {filtered.slice(0, 3).map((local) => (
                <li key={local.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPartner(local)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left hover:border-text-muted"
                  >
                    <span className="text-sm font-semibold text-text-strong">{local.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
  const isFastCreateMode = Boolean(fastCreateModeProp);
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
  const [partnerSearch, setPartnerSearch] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<LocalPartner | null>(null);
  const [aiPreview, setAiPreview] = useState<AiPreviewData | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  function resetStep3ForPurpose() {
    setStep3DetailId(null);
    setStep3Fields(createEmptyStep3Fields());
    setPartnerSearch("");
    setSelectedPartner(null);
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
    return `${origin}/d/preview-${slug}-${Date.now().toString(36)}`;
  }, [purpose]);

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
    if (step === 3) return step3DetailId !== null;
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
      description: [purpose, selectedPartner?.name, makerNote].filter(Boolean).join(" · "),
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
        local: selectedPartner ?? undefined,
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
            partnerSearch={partnerSearch}
            onPartnerSearchChange={setPartnerSearch}
            selectedPartner={selectedPartner}
            onSelectPartner={setSelectedPartner}
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
            partnerName={selectedPartner?.name}
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
          partnerSearch={partnerSearch}
          onPartnerSearchChange={setPartnerSearch}
          selectedPartner={selectedPartner}
          onSelectPartner={setSelectedPartner}
        />
      )}
      {step === 4 && purpose && videoInfo && aiPreview && (
        <Step4AiPreview
          purpose={purpose}
          ai={aiPreview}
          videoInfo={videoInfo}
          partnerName={selectedPartner?.name}
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
          partnerName={selectedPartner?.name}
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
