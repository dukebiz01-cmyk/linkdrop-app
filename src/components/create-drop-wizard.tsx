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
import { Step1UrlInput } from "@/components/create/Step1VideoInput";
import { Step2PurposeSelect } from "@/components/create/Step2Purpose";
import { Step3InfoCards } from "@/components/create/Step3InfoCards";
import { Step4AiPreview } from "@/components/create/Step4AiPreview";
import { Step5PurposeShare } from "@/components/create/Step5Share";
import { Step3ReservationCards } from "@/components/create/step3/Step3ReservationCards";
import {
  RESERVATION_DESTS,
  buildReservationSummary,
  canProceedReservationStep3,
  encodeReservationDates,
  normalizePlaceResult,
  normalizeReservationUrl,
  reservationItemFullLabel,
  searchPlaces,
} from "@/components/create/reservation-helpers";

// 외부 consumer 호환 — reservation-helpers 의 4 함수 re-export.
export {
  encodeReservationDates,
  normalizePlaceResult,
  normalizeReservationUrl,
  searchPlaces,
};
import {
  PURPOSE_FLOW_CONFIG,
  type AiPreviewData,
  type CreateDropWizardProps,
  type LocalPartner,
  type PlaceCandidate,
  type PurposeFlowConfig,
  type ReservationDateItem,
  type ReservationDateMode,
  type ReservationDateStatus,
  type ReservationSummary,
  type ReservationVertical,
  type ScheduleMode,
  type Step3DetailId,
  type Step3FieldState,
  type StepNum,
  type VideoInfo,
  type WizardSuggestionConfidence,
} from "@/components/create/types";
import { StepBadge } from "@/components/create/StepBadge";

// 외부 consumer 호환 — types.ts / StepBadge.tsx 로 이동된 항목들 re-export
export type {
  AiPreviewData,
  CreateDropWizardProps,
  LocalPartner,
  PlaceCandidate,
  PurposeFlowConfig,
  ReservationDateItem,
  ReservationDateMode,
  ReservationDateStatus,
  ReservationSummary,
  ReservationVertical,
  ScheduleMode,
  Step3DetailId,
  Step3FieldState,
  StepNum,
  VideoInfo,
  WizardSuggestionConfidence,
};
export { PURPOSE_FLOW_CONFIG, StepBadge };

// =============================================================================
// Types
// =============================================================================

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

function platformLabel(platform: VideoInfo["platform"]): string {
  return platform === "youtube" ? "YouTube" : "Instagram";
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

// 예약 Step 3 — 고객 미리보기 카드 (현재 state 로 라이브 갱신).

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
// Step 5 — 공유 미리보기 (v0 WizardSharePreview 재사용)
// =============================================================================

// =============================================================================
// Fast mode — Home 진입 3단계
// =============================================================================

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
  onClose,
  onComplete,
}: CreateDropWizardProps) {
  // WHY: Home(url+purpose) 경유도 5단계 흐름을 탄다 — Step 3 목적별 세부 카드를
  //      거치도록. fast 3단계는 fastCreateMode prop 을 명시할 때만 활성화.
  // WHY: 예약 목적은 장소·예약 가능 날짜·예약 버튼 연결 Step 3 카드가 반드시
  //      필요하다. fast 3단계에는 이 입력 UI 가 없으므로 예약은 항상 5단계로 탄다.
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
    if (step === 1) {
      onClose?.();
      return;
    }
    setStep((s) => (s - 1) as StepNum);
  }

  function handleNext() {
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
    const ai = aiForPreview;
    if (!videoInfo || !ai || !purpose || !onComplete) return null;
    const message = step3Fields.shareMessage;
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
    const ai = aiForPreview;
    if (!videoInfo || !ai || !purpose) return;
    setShareError(null);
    setShareFeedback(null);
    const real = await ensureRealShare();
    if (!real) return;
    const makerNote = step3Fields.shareMessage.trim();
    const result = await shareToKakao({
      title: ai.title,
      description: [purpose, makerNote].filter(Boolean).join(" · "),
      imageUrl: videoInfo.thumbnailUrl,
      linkUrl: real.shareUrl,
      buttons: [
        {
          title: (purpose ? STEP5_SHARE_BY_PURPOSE[purpose].cta : null) ?? "보러 가기",
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

  const activeStep = step;
  const totalSteps = 5;
  const progressPct = (activeStep / totalSteps) * 100;

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
          labelDate={reservationItemFullLabel}
        />
      )}
      {step === 5 && purpose && videoInfo && aiPreview && (
        <Step5PurposeShare
          data={buildWizardShareData(
            videoInfo,
            purpose,
            aiForPreview!.title,
            step3Fields.shareMessage.trim() || undefined,
            purpose === "예약" ? buildReservationSummary(step3Fields) : undefined,
          )}
          shareUrl={realShare?.shareUrl ?? mockShareUrl}
          onKakaoShare={handleKakaoShare}
          onCopyLink={handleCopyLink}
          onGoHome={handleGoHome}
          shareError={shareError}
          shareFeedback={shareFeedback}
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
