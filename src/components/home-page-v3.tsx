import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  FileText,
  Home,
  Inbox,
  Info,
  Link as LinkIcon,
  MessageCircle,
  Phone,
  Play,
  Plus,
  Search,
  ShoppingCart,
  Ticket,
  User,
  X,
} from "lucide-react";
import {
  suggestPurpose,
  saveCreateDraft,
  type HomePurpose,
  type SuggestionConfidence,
} from "@/lib/purpose-suggestion";
import {
  fetchVideoMetadata,
  parseVideoUrl,
  type VideoMetadata,
  type VideoMetadataFetchedBy,
} from "@/lib/video-metadata";
import { cn } from "@/lib/utils";

// ============================================================
// Types (라우트 연결 유지 — 기존 props 시그니처 보존)
// ============================================================

export type HomePageV3NavTab = "home" | "create" | "my-drops" | "inbox" | "profile";

export type { HomePurpose };
export type HomeSuggestionConfidence = SuggestionConfidence;

export interface HomeStartCreateParams {
  url: string;
  purpose: HomePurpose;
  intent_suggested?: HomePurpose;
  confidence?: HomeSuggestionConfidence;
  source_id?: string;
  platform?: string;
}

type HomeDropIntent = HomePurpose;

interface HomeMyDrop {
  id: string;
  thumbnailUrl: string;
  title: string;
  intent: HomeDropIntent;
  stats: { views: number; coupons?: number; reservations?: number };
}

export interface HomePageV3Props {
  activeNavTab?: HomePageV3NavTab;
  /** @deprecated onStartCreate 사용 */
  onCreateDrop?: () => void;
  /** @deprecated 목적은 Home 내부 선택 */
  onPurposeClick?: (label: string) => void;
  onStartCreate?: (params: HomeStartCreateParams) => void;
  onNavTab?: (tab: HomePageV3NavTab) => void;
}

/** 라우트 미수정 단계 — 내 Drop 섹션 UI 검증용 기본 mock */
const DEFAULT_MY_DROPS: HomeMyDrop[] = [
  {
    id: "mock-1",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=192&h=192&fit=crop",
    title: "서울숲 근처 브런치 카페 맛집",
    intent: "coupon",
    stats: { views: 184, coupons: 37 },
  },
  {
    id: "mock-2",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=192&h=192&fit=crop",
    title: "노을이 예쁜 캠핑장",
    intent: "reservation",
    stats: { views: 92, reservations: 12 },
  },
];

const INTENTS: {
  id: HomeDropIntent;
  label: string;
  description: string;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}[] = [
  // phase1-1: 5목적(정보·쿠폰·예약·구매·상담) → 3카드로 묶음.
  //   - reservation/lead id 는 카드에서 빠지지만 위저드 내부는 5개 지원 그대로.
  //   - 탭 시 purpose 는 카드의 id 가 그대로 wrapper handleStartCreate 로 전달.
  {
    id: "info",
    label: "정보 알리기",
    description: "장소, 상품, 후기, 이용 방법을 보기 쉽게 정리해요.",
    icon: FileText,
    bgColor: "bg-[#DBEAFE]",
    iconColor: "text-[#2563EB]",
  },
  {
    id: "coupon",
    label: "혜택·예약 만들기",
    description: "할인, 쿠폰, 기간 혜택, 네이버 예약 버튼을 붙여요.",
    icon: Ticket,
    bgColor: "bg-[#FEF3C7]",
    iconColor: "text-[#D97706]",
  },
  {
    id: "purchase",
    label: "문의·구매 연결하기",
    description: "상담, 전화, 구매처, 가격비교로 연결해요.",
    icon: Phone,
    bgColor: "bg-[#FCE7F3]",
    iconColor: "text-[#DB2777]",
  },
];

function metadataUsesFallback(fetchedBy: VideoMetadataFetchedBy): boolean {
  return (
    fetchedBy === "youtube_fallback" ||
    fetchedBy === "instagram_fallback" ||
    fetchedBy === "manual_fallback"
  );
}

function platformBadgeLabel(platform: VideoMetadata["platform"]): string {
  if (platform === "youtube") return "YouTube";
  if (platform === "instagram") return "Instagram";
  return "영상";
}

function VideoPreviewCard({ meta }: { meta: VideoMetadata }) {
  const [thumbBroken, setThumbBroken] = useState(false);

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <div className="relative h-[45px] w-[80px] shrink-0 overflow-hidden rounded-lg bg-[#E2E8F0]">
        {meta.thumbnailUrl && !thumbBroken ? (
          <img
            src={meta.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setThumbBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#94A3B8]">
            <LinkIcon className="size-5" strokeWidth={2} />
          </div>
        )}
        <span className="absolute left-0.5 top-0.5 rounded bg-black/75 px-1 py-0.5 text-[9px] font-semibold text-white">
          {platformBadgeLabel(meta.platform)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0F172A]">{meta.title}</p>
        {meta.authorName ? (
          <p className="truncate text-xs text-[#64748B]">{meta.authorName}</p>
        ) : null}
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <div className="h-[45px] w-[80px] shrink-0 animate-pulse rounded-lg bg-[#E2E8F0]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[#E2E8F0]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#E2E8F0]" />
      </div>
    </div>
  );
}

export function HomePageV3({
  activeNavTab = "home",
  onCreateDrop,
  onPurposeClick,
  onStartCreate,
  onNavTab,
}: HomePageV3Props) {
  const myDrops = DEFAULT_MY_DROPS;
  const [videoUrl, setVideoUrl] = useState("");
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<HomePurpose | null>(null);
  const [suggestedPurpose, setSuggestedPurpose] = useState<HomePurpose | null>(null);
  const [suggestionConfidence, setSuggestionConfidence] =
    useState<HomeSuggestionConfidence | null>(null);
  const [suggestionReason, setSuggestionReason] = useState<string | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isSuggestingPurpose, setIsSuggestingPurpose] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const hasValidUrl = Boolean(videoMetadata) && !urlError;
  const isButtonEnabled = hasValidUrl && selectedPurpose !== null;

  const ctaLabel = (() => {
    if (!hasValidUrl && !selectedPurpose) return "영상 링크와 목적을 선택해 주세요";
    if (hasValidUrl && !selectedPurpose) return "목적을 선택해 주세요";
    if (!hasValidUrl && selectedPurpose) return "영상 링크를 넣어 주세요";
    return "만들기 시작";
  })();

  useEffect(() => {
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      setVideoMetadata(null);
      setUrlError(null);
      setIsFetchingMetadata(false);
      setSuggestedPurpose(null);
      setSuggestionConfidence(null);
      setSuggestionReason(null);
      setIsSuggestingPurpose(false);
      return;
    }

    const parsed = parseVideoUrl(trimmed);
    if (!parsed) {
      setVideoMetadata(null);
      setUrlError("유튜브 또는 인스타그램 링크인지 확인해 주세요");
      setIsFetchingMetadata(false);
      setSuggestedPurpose(null);
      setSuggestionConfidence(null);
      setSuggestionReason(null);
      setIsSuggestingPurpose(false);
      return;
    }

    setUrlError(null);
    setIsFetchingMetadata(true);
    let cancelled = false;

    const debounce = setTimeout(() => {
      void fetchVideoMetadata(trimmed)
        .then((meta) => {
          if (cancelled) return;
          setVideoMetadata(meta);
          setIsFetchingMetadata(false);
        })
        .catch(() => {
          if (cancelled) return;
          setVideoMetadata(null);
          setUrlError("영상 정보를 자동으로 가져오지 못했어요. 링크는 그대로 사용할 수 있어요.");
          setIsFetchingMetadata(false);
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!videoMetadata || urlError) {
      setSuggestedPurpose(null);
      setSuggestionConfidence(null);
      setSuggestionReason(null);
      setIsSuggestingPurpose(false);
      return;
    }

    setIsSuggestingPurpose(true);
    let cancelled = false;

    const timer = setTimeout(() => {
      void suggestPurpose({
        metadata: videoMetadata,
        url: videoUrl,
        sourceId: videoMetadata.sourceId,
        platform:
          videoMetadata.platform !== "unknown" ? videoMetadata.platform : undefined,
      }).then((suggestion) => {
        if (cancelled) return;
        setSuggestedPurpose(suggestion.purpose);
        setSuggestionConfidence(suggestion.confidence);
        setSuggestionReason(suggestion.reason);
        // TODO(analytics): ai_suggested_purpose, ai_confidence, suggested_equals_selected, source_id, url_platform
        setIsSuggestingPurpose(false);
      });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [videoMetadata, videoUrl, urlError]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setVideoUrl(text.trim());
    } catch {
      console.log("[HomePageV3] Clipboard read failed");
    }
  }, []);

  const handleCreateDrop = useCallback(() => {
    if (!isButtonEnabled || !selectedPurpose || !videoMetadata) return;

    const params: HomeStartCreateParams = {
      url: videoUrl.trim(),
      purpose: selectedPurpose,
      intent_suggested: suggestedPurpose ?? undefined,
      confidence: suggestionConfidence ?? undefined,
      source_id: videoMetadata.videoId,
      platform: videoMetadata.platform !== "unknown" ? videoMetadata.platform : undefined,
    };

    // TODO(analytics): user_selected_purpose, suggested_equals_selected, source_id, url_platform
    saveCreateDraft({
      url: params.url,
      purpose: params.purpose,
      suggestedPurpose: params.intent_suggested,
      confidence: params.confidence,
      platform: params.platform,
      source_id: params.source_id,
      metadata: videoMetadata,
    });

    if (onStartCreate) {
      onStartCreate(params);
      return;
    }
    onCreateDrop?.();
  }, [
    isButtonEnabled,
    selectedPurpose,
    videoMetadata,
    videoUrl,
    suggestedPurpose,
    suggestionConfidence,
    onStartCreate,
    onCreateDrop,
  ]);

  const handlePurposeSelect = useCallback(
    (purpose: HomePurpose) => {
      setSelectedPurpose(purpose);
      if (onPurposeClick) {
        const label = INTENTS.find((i) => i.id === purpose)?.label ?? purpose;
        onPurposeClick(label);
      }
    },
    [onPurposeClick],
  );

  return (
    <div
      className="relative mx-auto min-h-screen max-w-md pb-24"
      style={{
        background: "radial-gradient(circle at top right, #EFF6FF 0%, transparent 60%), #FFFFFF",
      }}
    >
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#F1F5F9] bg-white/80 px-4 backdrop-blur-xl">
        <h1
          className="flex items-center gap-1 text-xl font-bold tracking-ko text-[#0A0A0A]"
          style={{ letterSpacing: "-0.02em" }}
        >
          LinkDrop
          <span className="inline-block size-1.5 rounded-full bg-[#2563EB]" aria-hidden />
        </h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#0A0A0A] transition-colors hover:bg-[#F1F5F9]"
            aria-label="검색"
            onClick={() => console.log("[HomePageV3] Search clicked")}
          >
            <Search className="size-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#0A0A0A] transition-colors hover:bg-[#F1F5F9]"
            aria-label="알림"
            onClick={() => console.log("[HomePageV3] Notifications clicked")}
          >
            <Bell className="size-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="px-5">
        {/* Hero */}
        <section className="flex flex-col items-center pb-6 pt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
            Link to Action
          </p>
          <h2
            className="mt-3 text-center text-[32px] font-bold leading-[1.2] text-[#0F172A]"
            style={{ letterSpacing: "-0.02em" }}
          >
            영상을{" "}
            <span className="relative inline-block text-[#2563EB]">
              Drop
              <svg
                className="absolute -bottom-0.5 left-0 w-full"
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                height="6"
                aria-hidden
              >
                <path
                  d="M0,6 Q50,0 100,6"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            으로
          </h2>
          <p className="mt-3 text-center text-[15px] leading-relaxed text-[#64748B]">
            영상 링크 하나로, 예약·혜택까지
            <br />
            붙여넣으면 AI가 행동 카드로 만들어드려요
          </p>
        </section>

        {/* AI 안내 — v0 bottom sheet */}
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className="group flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-3 text-[13px] font-medium text-[#475569] transition-colors duration-150 hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
        >
          <Play className="size-4" strokeWidth={2} />
          AI가 어떻게 만드는지 보기
          <ChevronDown className="size-4" strokeWidth={2} />
        </button>

        {/* 영상 링크 입력 + preview */}
        <section className="mt-4">
          <p className="mb-2 text-[13px] font-medium leading-relaxed text-[#64748B]">
            영상 링크를 넣고, 어떤 Drop으로 만들지 선택하세요.
          </p>
          <div
            className={cn(
              "relative flex h-14 items-center gap-3 rounded-xl border bg-white px-4 transition-colors duration-150",
              videoUrl
                ? "border-[#2563EB] shadow-[0_1px_3px_rgba(37,99,235,0.12)]"
                : "border-[#E2E8F0] hover:border-[#CBD5E1]",
            )}
          >
            <LinkIcon className="size-5 shrink-0 text-[#94A3B8]" strokeWidth={2} />
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="영상 링크 붙여넣기"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handlePaste()}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#F1F5F9] px-3 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#E2E8F0] hover:text-[#0F172A]"
            >
              <Clipboard className="size-3.5" strokeWidth={2} />
              붙여넣기
            </button>
          </div>
          {isFetchingMetadata && (
            <p className="mt-3 text-sm font-medium text-[#64748B]">영상 정보를 가져오는 중...</p>
          )}
          {isFetchingMetadata && <PreviewSkeleton />}
          {urlError && !isFetchingMetadata && (
            <p className="mt-3 text-sm font-medium text-[#DC2626]">{urlError}</p>
          )}
          {videoMetadata && !isFetchingMetadata && !urlError && (
            <>
              {metadataUsesFallback(videoMetadata.fetchedBy) && (
                <p className="mt-3 text-sm font-medium leading-relaxed text-[#64748B]">
                  영상 정보를 자동으로 가져오지 못했어요. 링크는 그대로 사용할 수 있어요.
                </p>
              )}
              <VideoPreviewCard meta={videoMetadata} />
            </>
          )}
        </section>

        {/* How it works sheet */}
        {showHowItWorks && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-t-2xl bg-white pb-8 pt-4 shadow-[0_-8px_32px_rgba(15,23,42,0.12)]">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E2E8F0]" />
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] transition-colors hover:bg-[#E2E8F0]"
                aria-label="닫기"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
              <div className="px-6">
                <h3 className="text-center text-lg font-bold tracking-ko text-[#0F172A]">
                  AI가 어떻게 만드는지 보기
                </h3>
                <p className="mt-1 text-center text-sm font-medium text-[#64748B]">
                  3단계로 Drop 페이지가 완성돼요
                </p>
                <ol className="mt-8 flex flex-col items-center gap-6">
                  <li className="flex w-full items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-lg font-bold text-[#2563EB]">
                      1
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0F172A]">영상 링크 붙여넣기</p>
                      <p className="text-sm text-[#64748B]">유튜브, 인스타 영상 링크를 붙여넣어요</p>
                    </div>
                  </li>
                  <ChevronDown className="size-5 text-[#CBD5E1]" aria-hidden />
                  <li className="flex w-full items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-lg font-bold text-[#2563EB]">
                      2
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0F172A]">AI가 분석해요</p>
                      <p className="text-sm text-[#64748B]">영상 내용을 요약하고 정보를 추출해요</p>
                    </div>
                  </li>
                  <ChevronDown className="size-5 text-[#CBD5E1]" aria-hidden />
                  <li className="flex w-full items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-lg font-bold text-[#2563EB]">
                      3
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0F172A]">행동 카드 완성</p>
                      <p className="text-sm text-[#64748B]">예약·혜택까지 한 번에 이어드려요</p>
                    </div>
                  </li>
                </ol>
                <button
                  type="button"
                  onClick={() => setShowHowItWorks(false)}
                  className="mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-[#2563EB] text-[15px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  알겠어요
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 목적 카드 */}
        <section className="mt-8">
          <h3 className="text-lg font-bold tracking-ko text-[#0F172A]">무엇으로 만들까요?</h3>
          <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#64748B]">
            선택한 목적에 따라 AI가 요약, 버튼, 공유 문구를 다르게 추천합니다.
          </p>
          {isSuggestingPurpose && (
            <p className="mt-3 text-sm font-medium text-[#64748B]">
              AI가 적합한 목적을 찾고 있어요...
            </p>
          )}
          {suggestedPurpose && suggestionReason && !isSuggestingPurpose && (
            <p className="mt-3 text-xs leading-relaxed text-[#64748B]">{suggestionReason}</p>
          )}
          <p className="mt-2 text-xs font-medium text-[#94A3B8]">
            AI 추천은 참고용이에요. 원하는 목적을 직접 선택할 수 있습니다.
          </p>
          <ul className="mt-4 space-y-2.5">
            {INTENTS.map((intent) => {
              const Icon = intent.icon;
              const isSelected = selectedPurpose === intent.id;
              const isSuggested = suggestedPurpose === intent.id;
              const showAiBadge =
                isSuggested &&
                suggestionConfidence &&
                (suggestionConfidence === "high" || suggestionConfidence === "medium");

              return (
                <li key={intent.id}>
                  <button
                    type="button"
                    onClick={() => handlePurposeSelect(intent.id)}
                    className={cn(
                      "group relative flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors duration-150",
                      isSelected
                        ? "border-[#2563EB] bg-[#EFF6FF] shadow-[0_1px_4px_rgba(37,99,235,0.12)]"
                        : "border-[#E2E8F0] bg-white hover:border-[#2563EB] hover:shadow-[0_1px_4px_rgba(15,23,42,0.06)]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        intent.bgColor,
                      )}
                    >
                      <Icon className={cn("size-5", intent.iconColor)} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-[#0F172A]">
                          {intent.label}
                        </span>
                        {showAiBadge && (
                          <span
                            className={cn(
                              "rounded-lg px-1.5 py-0.5 text-[10px] font-semibold tracking-ko",
                              suggestionConfidence === "high"
                                ? "bg-[#2563EB] text-white"
                                : "border border-[#2563EB] bg-white text-[#2563EB]",
                            )}
                          >
                            AI 추천
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[#64748B]">
                        {intent.description}
                      </span>
                    </span>
                    {isSelected ? (
                      <Check className="size-5 shrink-0 text-[#2563EB]" strokeWidth={2} />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-[#CBD5E1]" strokeWidth={2} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Drop 만들기 */}
        <section className="mt-6 pb-8">
          <button
            type="button"
            onClick={handleCreateDrop}
            disabled={!isButtonEnabled}
            className={cn(
              "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold tracking-ko transition-colors duration-150",
              isButtonEnabled
                ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                : "cursor-not-allowed bg-[#E2E8F0] text-[#A3A3A3]",
            )}
          >
            {ctaLabel}
            {isButtonEnabled ? <ArrowRight className="size-5" strokeWidth={2} /> : null}
          </button>
        </section>

        {/* 내 Drop — 컴포넌트 내부 mock */}
        {myDrops.length > 0 && (
          <section className="pb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold tracking-ko text-[#0F172A]">내가 만든 카드</h3>
              <button
                type="button"
                className="flex items-center gap-0.5 text-[13px] font-medium text-[#64748B] transition-colors hover:text-[#2563EB]"
                onClick={() => console.log("[HomePageV3] View all drops")}
              >
                전체 보기
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </button>
            </div>
            <ul className="mt-3 space-y-2.5">
              {myDrops.slice(0, 3).map((drop) => {
                const intentMeta = INTENTS.find((i) => i.id === drop.intent);
                return (
                  <li key={drop.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 text-left transition-colors hover:border-[#CBD5E1]"
                      onClick={() => console.log("[HomePageV3] View drop:", drop.id)}
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-[#E2E8F0]">
                        <img
                          src={drop.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[#0F172A]">
                          {drop.title}
                        </p>
                        <span
                          className={cn(
                            "mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                            drop.intent === "coupon" && "bg-[#FEF3C7] text-[#D97706]",
                            drop.intent === "reservation" && "bg-[#D1FAE5] text-[#10B981]",
                            drop.intent === "purchase" && "bg-[#FCE7F3] text-[#DB2777]",
                            drop.intent === "lead" && "bg-[#E0E7FF] text-[#6366F1]",
                            drop.intent === "info" && "bg-[#DBEAFE] text-[#2563EB]",
                          )}
                        >
                          {intentMeta?.label ?? "정보"}
                        </span>
                        <p className="mt-1 text-[11px] text-[#64748B]">
                          조회 {drop.stats.views}
                          {drop.stats.coupons !== undefined && ` · 쿠폰 ${drop.stats.coupons}`}
                          {drop.stats.reservations !== undefined &&
                            ` · 예약 ${drop.stats.reservations}`}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-[#CBD5E1]" strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      {/* 하단 네비 — v0 톤 */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex h-16 max-w-md items-center justify-around border-t border-[#F1F5F9] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <BottomNavTab
          icon={<Home className="size-5" strokeWidth={2} />}
          label="홈"
          isActive={activeNavTab === "home"}
          onClick={() => onNavTab?.("home")}
        />
        <BottomNavTab
          icon={<Plus className="size-4" strokeWidth={2} />}
          label="만들기"
          highlight
          isActive={activeNavTab === "create"}
          onClick={() => onNavTab?.("create")}
        />
        <BottomNavTab
          icon={<Inbox className="size-5" strokeWidth={2} />}
          label="내 카드"
          isActive={activeNavTab === "my-drops"}
          onClick={() => onNavTab?.("my-drops")}
        />
        <BottomNavTab
          icon={<Inbox className="size-5" strokeWidth={2} />}
          label="받은함"
          isActive={activeNavTab === "inbox"}
          onClick={() => onNavTab?.("inbox")}
        />
        <BottomNavTab
          icon={<User className="size-5" strokeWidth={2} />}
          label="나"
          isActive={activeNavTab === "profile"}
          onClick={() => onNavTab?.("profile")}
        />
      </nav>
    </div>
  );
}

function BottomNavTab({
  icon,
  label,
  isActive,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-0.5 px-3 py-1.5",
        isActive || highlight ? "text-[#2563EB]" : "text-[#94A3B8]",
      )}
    >
      {highlight ? (
        <span className="flex size-8 items-center justify-center rounded-full bg-[#2563EB] text-white">
          {icon}
        </span>
      ) : (
        icon
      )}
      <span
        className={cn(
          "text-[10px] tracking-ko",
          highlight ? "font-semibold text-[#2563EB]" : "font-medium",
        )}
      >
        {label}
      </span>
    </button>
  );
}
