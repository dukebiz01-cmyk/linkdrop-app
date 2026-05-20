import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clipboard,
  Gift,
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
import { WizardSharePreview } from "@/components/wizard-share-preview";
import { shareToKakao } from "@/lib/kakao";
import { MOCK_LOCAL_PARTNERS, MOCK_VIDEO_INFO } from "@/lib/mock-data";
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

export interface CreateDropWizardProps {
  variant?: "default" | "skeleton";
  onClose?: () => void;
  onComplete?: (data: {
    video: VideoInfo;
    purpose: DropPurpose;
    local?: LocalPartner;
    ai: AiPreviewData;
    makerMessage: string;
  }) => void;
}

type StepNum = 1 | 2 | 3 | 4 | 5;

// WHY: UX 레이어는 5 목적만 노출. DB intent_types 9행은 Phase 1 UI에서 숨김 (v3 결정 락).
const WIZARD_PURPOSES: {
  purpose: DropPurpose;
  label: string;
  description: string;
  icon: LucideIcon;
  requiresPartner: boolean;
  stripClass: string;
  aiRecommended?: boolean;
}[] = [
  {
    purpose: "정보",
    label: "정보",
    description: "영상 핵심 정리",
    icon: BookOpen,
    requiresPartner: false,
    stripClass: "bg-intent-info-strip",
    aiRecommended: true,
  },
  {
    purpose: "쿠폰",
    label: "쿠폰",
    description: "혜택으로 손님 모으기",
    icon: Gift,
    requiresPartner: true,
    stripClass: "bg-intent-coupon-strip",
  },
  {
    purpose: "예약",
    label: "예약",
    description: "날짜 선택과 예약 연결",
    icon: Calendar,
    requiresPartner: true,
    stripClass: "bg-intent-reservation-strip",
  },
  {
    purpose: "구매",
    label: "구매",
    description: "AI 상품 찾기·가격비교",
    icon: ShoppingBag,
    requiresPartner: true,
    stripClass: "bg-intent-commerce-strip",
  },
  {
    purpose: "상담",
    label: "상담",
    description: "문의·상담 받기",
    icon: Phone,
    requiresPartner: false,
    stripClass: "bg-intent-lead-strip",
  },
];

const MOCK_LOCALS: LocalPartner[] = MOCK_LOCAL_PARTNERS.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  address: p.address,
  avatarUrl: p.avatarUrl,
}));

// WHY: Phase 1은 Edge/ RPC 연동 전 mock AI — Step 4 UI 검증용.
const MOCK_AI_BY_PURPOSE: Record<DropPurpose, Omit<AiPreviewData, "suggestedShareText">> = {
  정보: {
    title: "성수동 숨은 카페 — 분위기·메뉴 한눈에",
    summary: "영상 속 카페 위치, 대표 메뉴, 방문 팁을 짧게 정리했어요.",
    keyPoints: ["도보 5분 거리", "브런치 메뉴 인기", "평일 오전 한산"],
  },
  쿠폰: {
    title: "10% 할인 쿠폰 — 이번 주말까지",
    summary: "영상에 나온 매장에서 바로 쓸 수 있는 혜택이에요.",
    keyPoints: ["1인 1회 사용", "예약 후 방문 권장", "현장 제시"],
  },
  예약: {
    title: "주말 빈자리 예약 — 쿠폰과 함께",
    summary: "원하는 날짜를 고르고 외부 예약 링크로 연결해요.",
    keyPoints: ["1박/2박 선택", "반려견 동반 가능", "네이버 예약 연결"],
  },
  구매: {
    title: "영상 속 상품 — 국내 최저가 비교",
    summary: "AI가 찾은 구매처와 예상 가격을 비교해 드려요.",
    keyPoints: ["국내·해외 셀러 비교", "배송비 포함 안내", "구매 전 가격 재확인"],
  },
  상담: {
    title: "1:1 상담 신청 — 빠른 연락",
    summary: "바로 예약하지 않는 분을 위한 문의 폼이에요.",
    keyPoints: ["전화·카톡 응답", "원하는 날짜 메모", "개인정보 최소 수집"],
  },
};

function platformLabel(platform: VideoInfo["platform"]): string {
  return platform === "youtube" ? "YouTube" : "Instagram";
}

function StepBadge({ n }: { n: StepNum }) {
  return <p className="text-xs font-semibold tracking-ko text-text-subtle">Step {n} / 5</p>;
}

// =============================================================================
// Step 1 — 영상 링크
// =============================================================================

function Step1UrlInput({
  value,
  onChange,
  status,
  videoInfo,
}: {
  value: string;
  onChange: (v: string) => void;
  status: "idle" | "loading" | "success" | "error";
  videoInfo: VideoInfo | null;
}) {
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
            <span className="text-sm font-medium text-text-muted">영상을 분석하고 있어요…</span>
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-intent-danger/30 bg-intent-danger-bg p-4">
            <AlertCircle className="size-5 text-intent-danger" strokeWidth={2} />
            <span className="text-sm font-medium text-intent-danger">URL을 다시 확인해 주세요</span>
          </div>
        )}

        {status === "success" && videoInfo && (
          <div className="mt-4 flex gap-3 overflow-hidden rounded-2xl border border-border bg-bg p-3">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface">
              <img src={videoInfo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 right-1 rounded-lg bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                {videoInfo.duration}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <p className="line-clamp-2 text-sm font-bold tracking-ko text-text-strong">
                {videoInfo.title}
              </p>
              <p className="text-xs font-medium text-text-muted">{videoInfo.channelName}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// =============================================================================
// Step 2 — 5 목적 선택 (밈 Phase 2 미노출)
// =============================================================================

function Step2PurposeSelect({
  selected,
  onSelect,
}: {
  selected: DropPurpose | null;
  onSelect: (p: DropPurpose) => void;
}) {
  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={2} />
      <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-ko text-text-strong">
        이 Drop의 목적을 선택하세요
      </h1>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {WIZARD_PURPOSES.map((item) => {
          const Icon = item.icon;
          const isSelected = selected === item.purpose;
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
              {item.aiRecommended && (
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
                <span className="text-sm font-bold tracking-ko text-text-strong">
                  {item.label}
                </span>
                <p className="mt-1 text-xs font-medium leading-snug tracking-ko text-text-muted">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
        선택한 목적에 따라 AI가 요약, 버튼, 공유 문구를 다르게 추천합니다.
      </p>
    </main>
  );
}

// =============================================================================
// Step 3 — 옵션 / 메시지
// =============================================================================

function Step3Options({
  purpose,
  makerMessage,
  onMessageChange,
  partnerSearch,
  onPartnerSearchChange,
  selectedPartner,
  onSelectPartner,
}: {
  purpose: DropPurpose;
  makerMessage: string;
  onMessageChange: (v: string) => void;
  partnerSearch: string;
  onPartnerSearchChange: (v: string) => void;
  selectedPartner: LocalPartner | null;
  onSelectPartner: (p: LocalPartner | null) => void;
}) {
  const config = WIZARD_PURPOSES.find((p) => p.purpose === purpose)!;
  const filtered = MOCK_LOCALS.filter((l) =>
    l.name.toLowerCase().includes(partnerSearch.toLowerCase()),
  );

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={3} />
      <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">
        옵션을 정해 주세요
      </h1>
      <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">
        {config.label} 드롭 · 친구에게 함께 갈 한마디 (선택)
      </p>

      {config.requiresPartner && (
        <div className="mt-6">
          <p className="text-sm font-semibold tracking-ko text-text-strong">연결할 매장</p>
          <div className="relative mt-2">
            <Search
              className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-subtle"
              strokeWidth={2}
            />
            <Input
              type="search"
              value={partnerSearch}
              onChange={(e) => onPartnerSearchChange(e.target.value)}
              placeholder="매장 이름 검색"
              className="h-12 rounded-lg border-border pl-12"
            />
          </div>

          {selectedPartner ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent bg-surface p-3">
              <img
                src={selectedPartner.avatarUrl}
                alt=""
                className="size-12 rounded-lg object-cover"
              />
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
      )}

      <label className="mt-6 block">
        <span className="text-sm font-semibold tracking-ko text-text-strong">
          친구에게 한마디 (선택)
        </span>
        <textarea
          value={makerMessage}
          onChange={(e) => onMessageChange(e.target.value.slice(0, 100))}
          maxLength={100}
          rows={3}
          placeholder="예: 여기 진짜 좋더라. 너 좋아할 것 같아!"
          className="mt-2 block w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        />
        <span className="mt-1 block text-right text-xs font-medium text-text-subtle">
          {makerMessage.length}/100
        </span>
      </label>
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
        {purpose}
        {partnerName ? ` · ${partnerName}` : ""} — 공유 전에 내용을 확인해 주세요
      </p>

      <div className="mt-6 space-y-4 rounded-2xl border border-border bg-bg p-4">
        <div className="flex gap-3">
          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
            <img src={videoInfo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-ko text-text-strong">{ai.title}</p>
            <p className="mt-1 text-sm font-medium text-text-muted">{ai.summary}</p>
          </div>
        </div>

        <ul className="space-y-2 border-t border-border pt-4">
          {ai.keyPoints.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm font-medium text-text-strong">
              <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
              {point}
            </li>
          ))}
        </ul>

        <div className="rounded-lg bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-ko text-text-subtle">공유 문구 제안</p>
          <p className="mt-1 text-sm font-medium italic tracking-ko text-text-muted">
            &quot;{ai.suggestedShareText}&quot;
          </p>
        </div>
      </div>
    </main>
  );
}

// =============================================================================
// Main wizard
// =============================================================================

export function CreateDropWizard({
  variant = "default",
  onClose,
  onComplete,
}: CreateDropWizardProps) {
  const [step, setStep] = useState<StepNum>(1);
  const [url, setUrl] = useState("");
  const [urlStatus, setUrlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [purpose, setPurpose] = useState<DropPurpose | null>(null);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<LocalPartner | null>(null);
  const [makerMessage, setMakerMessage] = useState("");
  const [aiPreview, setAiPreview] = useState<AiPreviewData | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const purposeConfig = purpose ? WIZARD_PURPOSES.find((p) => p.purpose === purpose) : null;
  const requiresPartner = purposeConfig?.requiresPartner ?? false;

  const mockShareUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
    const slug = purpose
      ? { 정보: "info", 쿠폰: "coupon", 예약: "reservation", 구매: "purchase", 상담: "lead" }[purpose]
      : "info";
    return `${origin}/d/preview-${slug}-${Date.now().toString(36)}`;
  }, [purpose]);

  // WHY: Phase 1 URL 파싱은 mock — oEmbed/Edge 연동 전 UX 검증용.
  useEffect(() => {
    if (!url) {
      setUrlStatus("idle");
      setVideoInfo(null);
      return;
    }
    const isValid = url.includes("youtu") || url.includes("instagram");
    if (!isValid) {
      setUrlStatus("error");
      setVideoInfo(null);
      return;
    }
    setUrlStatus("loading");
    const timer = setTimeout(() => {
      const mock = MOCK_VIDEO_INFO.cafeTour;
      setUrlStatus("success");
      setVideoInfo({
        url,
        thumbnailUrl: mock.thumbnailUrl,
        title: mock.title,
        channelName: mock.channelName,
        duration: mock.duration,
        platform: url.includes("instagram") ? "instagram" : "youtube",
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [url]);

  function buildAiPreview(p: DropPurpose, message: string): AiPreviewData {
    const base = MOCK_AI_BY_PURPOSE[p];
    const suffix = message.trim() ? ` — "${message.trim()}"` : "";
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
      setAiPreview(buildAiPreview(purpose, makerMessage));
      setStep(4);
      return;
    }
    if (step === 4) {
      // TODO: Step 5 완료 후 createDropV2({ intentId, sourceId, blocks, curatorMessage }) RPC로 교체
      setStep(5);
      return;
    }
    setStep((s) => Math.min(5, s + 1) as StepNum);
  }

  function canProceed(): boolean {
    if (step === 1) return urlStatus === "success";
    if (step === 2) return purpose !== null;
    if (step === 3) return !requiresPartner || selectedPartner !== null;
    return true;
  }

  async function handleKakaoShare() {
    if (!videoInfo || !aiPreview || !purpose) return;
    setShareError(null);
    setShareFeedback(null);
    const result = await shareToKakao({
      title: aiPreview.title,
      description: [purpose, selectedPartner?.name, makerMessage.trim()].filter(Boolean).join(" · "),
      imageUrl: videoInfo.thumbnailUrl,
      linkUrl: mockShareUrl,
      buttons: [{ title: "보러 가기", link: mockShareUrl }],
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
    if (videoInfo && purpose && aiPreview) {
      onComplete?.({
        video: videoInfo,
        purpose,
        local: selectedPartner ?? undefined,
        ai: aiPreview,
        makerMessage,
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
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>

      {step === 1 && (
        <Step1UrlInput value={url} onChange={setUrl} status={urlStatus} videoInfo={videoInfo} />
      )}
      {step === 2 && <Step2PurposeSelect selected={purpose} onSelect={setPurpose} />}
      {step === 3 && purpose && (
        <Step3Options
          purpose={purpose}
          makerMessage={makerMessage}
          onMessageChange={setMakerMessage}
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
        <WizardSharePreview
          data={{
            video: {
              thumbnailUrl: videoInfo.thumbnailUrl,
              title: videoInfo.title,
              channelName: videoInfo.channelName,
              duration: videoInfo.duration,
              platformLabel: platformLabel(videoInfo.platform),
            },
            purpose,
            aiTitle: aiPreview.title,
            makerMessage: makerMessage.trim() || undefined,
            partnerName: selectedPartner?.name,
          }}
          shareUrl={mockShareUrl}
          onKakaoShare={handleKakaoShare}
          onCopyLink={handleCopyLink}
          onGoHome={handleGoHome}
          shareError={shareError}
          shareFeedback={shareFeedback}
        />
      )}

      {step < 5 && (
        <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-6 py-4">
          {step === 3 && (
            <button
              type="button"
              onClick={() => {
                if (purpose) {
                  setAiPreview(buildAiPreview(purpose, makerMessage));
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
