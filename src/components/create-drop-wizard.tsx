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
import type { CardUserAction } from "@/components/cards/types";
import { shareToKakao } from "@/lib/kakao";
import {
  fetchVideoMetadata,
  parseVideoUrl,
  isHttpUrl,
  type VideoMetadata,
  type VideoMetadataFetchedBy,
} from "@/lib/video-metadata";
import type { DropPurpose } from "@/lib/types";
import { WIZARD_PRIMARY_BUTTON_CLASS } from "@/components/create-wizard-button-styles";
import { cn } from "@/lib/utils";
import { Step1UrlInput } from "@/components/create/Step1VideoInput";
import { MyContentPicker } from "@/components/create/MyContentPicker";
import { Step2PurposeSelect } from "@/components/create/Step2Purpose";
import { Step4DropPreview } from "@/components/create/Step4DropPreview";
import { Step5PurposeShare } from "@/components/create/Step5Share";
import { Step3Options } from "@/components/create/step3/Step3Options";
import { Step3Commerce } from "@/components/create/step3/Step3Commerce";
import { ProductAttachSection } from "@/components/create/step3/ProductAttachSection";
import { VideoAttachSection } from "@/components/create/step3/VideoAttachSection";
import { PURPOSE_MESSAGE_PLACEHOLDER } from "@/components/create/step3/PurposeMessageCard";
import { KakaoBubblePreview } from "@/components/wizard-share-preview";
import {
  aiPreviewFromPurpose,
  buildWizardShareData,
  createEmptyStep3Fields,
  videoInfoFromMetadata,
} from "@/components/create/wizard-helpers";
import {
  RESERVATION_DESTS,
  buildReservationSummary,
  canProceedReservationStep3,
  encodeReservationDates,
  normalizePlaceResult,
  normalizeReservationUrl,
  reservationItemFullLabel,
  searchPlaces,
} from "@/components/create/step3/reservation-helpers";

// 외부 consumer 호환 — reservation-helpers 의 4 함수 re-export.
export { encodeReservationDates, normalizePlaceResult, normalizeReservationUrl, searchPlaces };
import {
  PURPOSE_FLOW_CONFIG,
  type AiPreviewData,
  type AttachedProduct,
  type AttachedVideo,
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

// 가져오기(MyContentPicker) navigate 시 목적 보존용 — 한국어 DropPurpose → 영문(route purpose).
// create-wizard.tsx PURPOSE_EN_TO_KO 의 역매핑.
const PURPOSE_KO_TO_EN: Record<DropPurpose, string> = {
  정보: "info",
  쿠폰: "coupon",
  예약: "reservation",
  구매: "purchase",
  상담: "lead",
};

// =============================================================================
// Types
// =============================================================================

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
  isBusiness = false,
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
  // F2 커머스(구매) — 가격(필수)/상품명(선택). 상품은 영상 메타가 없어 별도 state.
  const [commercePrice, setCommercePrice] = useState("");
  const [commerceName, setCommerceName] = useState("");
  // v5.12 — 쿠폰 목적에서 메이커가 선택한 funnel coupon id. onComplete 시 전달.
  const [selectedFunnelCouponId, setSelectedFunnelCouponId] = useState<string | null>(null);
  // ③ 카드 담기 — 위저드 Step 2 에서 담은 자체업로드 상품(전 목적 공통). onComplete 시 전달.
  const [attachedProducts, setAttachedProducts] = useState<AttachedProduct[]>([]);
  // Slice2 멀티영상 — primary 외 추가 영상 누적(검색→담기 push, navigate 아님).
  const [attachedVideos, setAttachedVideos] = useState<AttachedVideo[]>([]);
  // quick-path — 기본 = Step1 후 미리보기 직행. [스튜디오에서 다듬기] 누르면 studioMode=true
  //   로 수동 카드화(Step2) 진입. studio 재진입 미리보기는 단일 [보내기](2버튼 아님).
  const [studioMode, setStudioMode] = useState(false);
  // quick 한 줄 — '예시' 탭 시 입력칸에 복사 후 포커스(편집 시작점). 발송값은 사람이 확정.
  const oneLineRef = useRef<HTMLTextAreaElement>(null);
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
    setSelectedFunnelCouponId(null);
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

  // F2 커머스 — 상품 URL 은 영상 메타가 없으므로 최소 videoInfo 를 합성한다.
  //   영상 useEffect 와 분리(추가형). 이 effect 가 뒤에 선언돼 구매 시 videoInfo 를 확정한다.
  //   (영상 목적이면 early-return 으로 영상 경로 무영향.)
  useEffect(() => {
    if (purpose !== "구매") return;
    const trimmed = url.trim();
    if (!isHttpUrl(trimmed)) {
      setVideoInfo(null);
      setUrlStatus("idle");
      return;
    }
    setUrlStatus("success");
    setVideoInfo({
      url: trimmed,
      thumbnailUrl: "",
      title: commerceName.trim() || "상품",
      channelName: "",
      duration: "",
      platform: "youtube", // placeholder — 커머스 카드는 플랫폼 라벨 미사용
    });
  }, [purpose, url, commerceName]);

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
    // quick 미리보기(스튜디오 미진입)에서 뒤로 = Step1 (Step2 를 스킵했으므로).
    if (step === 3 && !studioMode) {
      setStep(1);
      return;
    }
    setStep((s) => (s - 1) as StepNum);
  }

  // quick-path: Step1(영상+목적) → 미리보기 직행. 수동 카드화(Step2)는 [다듬기] 시에만.
  //   커머스(구매)는 가격(Step2 Commerce)이 필수라 항상 Step2 경유(단일 보내기).
  function handleNext() {
    if (step === 1) {
      if (!purpose) return;
      if (purpose === "구매") {
        setStep(2);
        return;
      }
      setAiPreview(buildAiPreview(purpose));
      setStep(3);
      return;
    }
    if (step === 2 && purpose) {
      setAiPreview(buildAiPreview(purpose));
      setStep(3);
      return;
    }
  }

  function canProceed(): boolean {
    if (step === 1) {
      // F1 커머스(구매) — 영상 메타 fetch(urlStatus) 없이 유효 http/https 상품 URL 로 통과.
      if (purpose === "구매") {
        return isHttpUrl(url.trim());
      }
      // 옛 Step 1 + Step 2 조건 합 — 영상 fetch 성공 + 목적 선택.
      return parseVideoUrl(url.trim()) !== null && urlStatus === "success" && purpose !== null;
    }
    if (step === 2) {
      // 옛 Step 3 의 목적별 통과 조건 그대로.
      if (purpose === "예약") return canProceedReservationStep3(step3Fields);
      if (purpose === "정보") return true;
      // phase1 FIX2: 쿠폰 분기는 매장 쿠폰 자동 연결로 dead 입력 UI 제거.
      //   detailId 게이트도 함께 해제 — 위저드에서 별도 선택 없이 진행.
      if (purpose === "쿠폰") return true;
      // F2 커머스 — 가격(원) 입력 시 통과. 시세·쿠폰 없음.
      if (purpose === "구매") return Number(commercePrice) > 0;
      return step3DetailId !== null;
    }
    return true; // step 3 = 마지막, sticky CTA 없음
  }

  // 첫 공유/복사/수신자 화면 보기 시 /api/drops 를 1회만 호출하고 결과를 캐싱한다.
  // 동시 클릭 race 는 savingRef 로 같은 promise 를 공유하여 중복 저장을 방지.
  async function ensureRealShare(): Promise<{ shareUuid: string; shareUrl: string } | null> {
    if (realShare) return realShare;
    if (savingRef.current) return savingRef.current;
    const ai = aiForPreview;
    if (!videoInfo || !ai || !purpose || !onComplete) return null;
    const message = step3Fields.shareMessage;
    const promise = onComplete({
      video: videoInfo,
      purpose,
      ai,
      makerMessage: message,
      selectedFunnelCouponId: purpose === "쿠폰" ? selectedFunnelCouponId : null,
      priceKrw: purpose === "구매" && Number(commercePrice) > 0 ? Number(commercePrice) : null,
      productName: purpose === "구매" ? commerceName.trim() || null : null,
      category: purpose === "구매" ? "농수산물" : null,
      attachedProducts,
      attachedVideos,
    });
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
      setShareError("카드 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
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
  const totalSteps = 3; // phase1 A: 5 → 3 스텝
  const progressPct = (activeStep / totalSteps) * 100;

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[480px] flex-col bg-white",
        // 예약 디테일 단계(새 Step 2)는 캘린더가 길어 본문이 내부 스크롤돼야 한다.
        // h-screen(확정 높이) 이라야 main(flex-1 min-h-0 overflow-y-auto)이 내부
        // 스크롤하고 하단 CTA가 본문을 덮지 않는다. 그 외는 min-h-screen.
        step === 2 && purpose === "예약" ? "h-screen" : "min-h-screen",
      )}
    >
      <header className="flex h-14 shrink-0 items-center border-b border-[#E5E7EB] px-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex h-11 min-w-11 items-center gap-1 rounded-lg px-3 text-sm font-medium tracking-ko text-[#525252] transition-colors hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          {step === 1 ? "닫기" : "이전"}
        </button>
        <span className="flex-1 text-center text-sm font-bold tracking-ko text-[#111111]">
          카드 만들기
        </span>
        {/* Step n/3 텍스트 제거 — 아래 진행 바가 단일 단계 표시. 가운데 정렬 유지용 spacer. */}
        <span className="w-16" aria-hidden />
      </header>
      <div className="h-1 w-full bg-[#E2E8F0]" aria-hidden>
        <div
          className="h-full bg-[#0A0A0A] transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* 목적-first + 입력 2경로: 목적 선택 후 [내 콘텐츠에서 가져오기](위) + 직접 입력(아래).
          가져오기는 비커머스에서만(커머스=상품 URL, 별도 트랙). 직접 입력 = 기존 Step1UrlInput. */}
      {step === 1 && (
        <>
          <Step2PurposeSelect
            selected={purpose}
            onSelect={handlePurposeSelect}
            suggestedPurpose={suggestedPurpose}
            suggestionConfidence={suggestionConfidence}
            isPurposePrefilled={isPurposePrefilled}
            isBusiness={isBusiness}
          />
          {purpose && (
            <>
              {/* 영상 미선택 시에만 검색(가져오기) 노출 — 선택되면 '선택된 영상'으로 정리. */}
              {purpose !== "구매" && !videoInfo && (
                <MyContentPicker purposeEn={PURPOSE_KO_TO_EN[purpose]} />
              )}
              <Step1UrlInput
                value={url}
                onChange={setUrl}
                status={urlStatus}
                videoInfo={videoInfo}
                metadataFetchedBy={metadataFetchedBy}
                purpose={purpose ?? undefined}
              />
            </>
          )}
        </>
      )}
      {/* F2 커머스(구매) — 옛 Step3 generic 대신 가격/상품명 전용 Step. */}
      {step === 2 && purpose === "구매" && (
        <Step3Commerce
          price={commercePrice}
          onPriceChange={setCommercePrice}
          name={commerceName}
          onNameChange={setCommerceName}
        />
      )}
      {/* 새 Step 2 = 옛 Step 3 (목적별 디테일, 내용 그대로). 구매는 위 커머스 Step 사용. */}
      {step === 2 && purpose && purpose !== "구매" && (
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
          selectedCouponId={selectedFunnelCouponId}
          onSelectCoupon={setSelectedFunnelCouponId}
        />
      )}
      {/* ③ 카드 담기 — Step 2 목적 분기 "아래" 전 목적 공통. 위 목적별 입력
          (Commerce/Options=예약 캘린더 포함) 레이아웃은 그대로 두고 추가만. */}
      {step === 2 && purpose && (
        <ProductAttachSection value={attachedProducts} onChange={setAttachedProducts} />
      )}
      {/* Slice2 멀티영상 담기 — primary(대표) + 추가 영상 N. 커머스(상품 URL)는 제외. */}
      {step === 2 && purpose && purpose !== "구매" && (
        <VideoAttachSection
          primary={
            videoInfo ? { title: videoInfo.title, thumbnailUrl: videoInfo.thumbnailUrl } : null
          }
          primarySourceId={parseVideoUrl(url.trim())?.videoId ?? null}
          isBusiness={isBusiness}
          value={attachedVideos}
          onChange={setAttachedVideos}
        />
      )}
      {/* Step 3 미리보기 — quick: 실제 카드(가짜 요약 없음)+한마디+2버튼 / studio·커머스: 기존 보존. */}
      {step === 3 &&
        purpose &&
        videoInfo &&
        aiPreview &&
        (!studioMode && purpose !== "구매" ? (
          <section className="space-y-5 px-6 pb-10 pt-4">
            {/* 카톡 말풍선 — 친구가 카톡서 볼 첫 인상. 아래 한 줄 입력이 라이브로 반영(makerMessage). */}
            <div>
              <p className="text-sm font-bold tracking-ko text-text-strong">미리보기</p>
              <div className="mt-3">
                <KakaoBubblePreview
                  data={buildWizardShareData(
                    videoInfo,
                    purpose,
                    videoInfo.title,
                    step3Fields.shareMessage.trim() || undefined,
                  )}
                  shareUrl={realShare?.shareUrl ?? mockShareUrl}
                />
              </div>
              <p className="mt-2 text-xs font-medium tracking-ko text-text-subtle">
                요약은 보낼 때 자동으로 정리돼요.
              </p>
            </div>

            {/* 한 줄 — 기본 빈 입력(사람 몫). '예시'는 영감으로만(복사+포커스 → 편집 시작점). */}
            <div>
              <label
                htmlFor="wizard-oneline"
                className="text-sm font-bold tracking-ko text-text-strong"
              >
                친구에게 한마디
              </label>
              <textarea
                id="wizard-oneline"
                ref={oneLineRef}
                value={step3Fields.shareMessage}
                onChange={(e) =>
                  setStep3Fields((prev) => ({ ...prev, shareMessage: e.target.value.slice(0, 200) }))
                }
                rows={2}
                placeholder="친구한테 한 마디…"
                className="mt-2 w-full resize-none rounded-lg border border-border bg-white px-3 py-2.5 text-sm tracking-ko text-text-strong placeholder:text-text-subtle focus:border-[#0A0A0A] focus:outline-none"
              />
              {!step3Fields.shareMessage.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setStep3Fields((prev) => ({ ...prev, shareMessage: PURPOSE_MESSAGE_PLACEHOLDER }));
                    requestAnimationFrame(() => oneLineRef.current?.focus());
                  }}
                  className="mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium tracking-ko text-text-muted transition-colors hover:bg-bg"
                >
                  예시: {PURPOSE_MESSAGE_PLACEHOLDER}
                </button>
              ) : null}
            </div>

            {/* 2버튼 — [바로 보내기](한 줄 채움일 때만) / [스튜디오에서 다듬기]. */}
            <div className="space-y-2">
              {shareFeedback ? (
                <p className="text-sm font-medium tracking-ko text-text-muted">{shareFeedback}</p>
              ) : null}
              <ErrorMessage message={shareError} />
              <ActionButton
                type="button"
                disabled={!step3Fields.shareMessage.trim()}
                onClick={handleKakaoShare}
                className={WIZARD_PRIMARY_BUTTON_CLASS}
              >
                바로 보내기
              </ActionButton>
              {!step3Fields.shareMessage.trim() ? (
                <p className="text-center text-xs font-medium tracking-ko text-text-subtle">
                  한 줄을 입력하면 보낼 수 있어요
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setStudioMode(true);
                  setStep(2);
                }}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
              >
                스튜디오에서 다듬기
              </button>
            </div>
          </section>
        ) : (
          <>
            <Step4DropPreview
              purpose={purpose}
              ai={aiForPreview!}
              videoInfo={videoInfo}
              reservation={purpose === "예약" ? buildReservationSummary(step3Fields) : undefined}
              labelDate={reservationItemFullLabel}
              attachedProducts={attachedProducts}
            />
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
          </>
        ))}

      {/* sticky CTA — Step 1·2 만. Step 3 은 자체 공유 UI. 예약 Step 2 는 자체
          in-flow CTA(캘린더) 쓰므로 sticky 제외 (옛 step 3 예약 패턴 그대로). */}
      {step < 3 && !(step === 2 && purpose === "예약") && (
        <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-6 py-4">
          <ActionButton
            type="button"
            disabled={!canProceed()}
            onClick={handleNext}
            className={WIZARD_PRIMARY_BUTTON_CLASS}
          >
            {step === 2 ? "공유 미리보기" : "다음"}
          </ActionButton>
        </div>
      )}
    </div>
  );
}

export default CreateDropWizard;
