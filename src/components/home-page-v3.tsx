import { useEffect, useState } from "react";
import {
  Store,
  Bell,
  Link as LinkIcon,
  Clipboard,
  ArrowRight,
  Info,
  Calendar,
  Check,
  Sparkles,
} from "lucide-react";
import { fetchVideoMetadata, parseVideoUrl } from "@/lib/video-metadata";

// ============================================================
// v0.26 home page (링크우선 + 3목적 + v1.1 카피)
// 비주얼·레이아웃·카피 = v0 그대로. VideoPreview 만 mock → 실 fetchVideoMetadata.
// 4탭 nav 는 home.tsx wrapper 의 [&_.fixed.bottom-0]:hidden 으로 자동 숨김
// (repo BottomNav 3탭 노출). 4탭 노출은 별도 유닛.
// ============================================================

// ============================================================
// Types
// ============================================================

export interface HomePageV3MyDrop {
  id: string;
  thumbnailUrl: string;
  title: string;
  purpose: "info" | "reservation_benefit" | "purchase";
  stats: { views: number; reservations?: number; purchases?: number };
}

export type HomePageV3Purpose = "info" | "reservation_benefit" | "purchase";

export type HomePageV3Tab = "home" | "explore" | "create" | "me";

export interface HomePageV3Props {
  user?: { name: string; avatarUrl?: string };
  unreadCount?: number;
  myDrops?: HomePageV3MyDrop[];
  /** phase1 B: 비지니스(approved partner owner) 여부. true 만 "혜택·예약" 카드 노출. */
  isBusiness?: boolean;
  onCreateDrop: (videoUrl: string, purpose?: string) => void;
  onViewDrop: (dropId: string) => void;
  onViewAllDrops: () => void;
  onTabChange: (tab: HomePageV3Tab) => void;
  /** 내 매장 이동 — 사업자(isBusiness)일 때만 상단 Store 아이콘 노출·호출. */
  onGoStore?: () => void;
  onNotifications: () => void;
}

// ============================================================
// Purpose Config - 2 Purpose System (phase1 C: 5→2 노출 정책)
//   사용자 노출 = 정보 + 혜택·예약 만 두 가지.
//   구매·상담·예약 enum 은 보존(코드/위저드 내부), 선택 UI 에서만 숨김.
// ============================================================

const PURPOSES = [
  {
    id: "info" as const,
    label: "정보 알리기",
    description: "장소, 상품, 후기, 이용 방법을 보기 쉽게 정리해요",
    icon: Info,
    tag: "정보 · 정리",
    buttons: ["자세히 보기", "위치 보기", "후기 보기"],
  },
  {
    id: "reservation_benefit" as const,
    label: "혜택·예약 만들기",
    description: "할인, 쿠폰, 기간 혜택, 네이버 예약 버튼을 붙여요",
    icon: Calendar,
    tag: "예약 · 쿠폰",
    buttons: ["예약하기", "혜택 받기", "쿠폰 받기"],
  },
];

// ============================================================
// Video Preview Component
// ============================================================

interface VideoPreviewState {
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration?: string;
}

// ============================================================
// Main Component
// ============================================================

export function HomePageV3({
  unreadCount = 0,
  myDrops = [],
  isBusiness = false,
  onCreateDrop,
  onViewDrop,
  onViewAllDrops,
  onTabChange,
  onGoStore,
  onNotifications,
}: HomePageV3Props) {
  // phase1 B: 일반 사용자 = 정보만. 비지니스 = 정보 + 혜택·예약.
  const visiblePurposes = isBusiness ? PURPOSES : PURPOSES.filter((p) => p.id === "info");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPreview, setVideoPreview] = useState<VideoPreviewState | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedPurpose, setSelectedPurpose] = useState<HomePageV3Purpose | null>(null);

  // 실 fetchVideoMetadata (v0 mock setTimeout 대체)
  useEffect(() => {
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      setVideoPreview(null);
      setIsLoadingPreview(false);
      return;
    }
    const parsed = parseVideoUrl(trimmed);
    if (!parsed) {
      setVideoPreview(null);
      setIsLoadingPreview(false);
      return;
    }

    setIsLoadingPreview(true);
    let cancelled = false;
    const debounce = window.setTimeout(() => {
      void fetchVideoMetadata(trimmed).then((meta) => {
        if (cancelled) return;
        setIsLoadingPreview(false);
        setVideoPreview({
          title: meta.title,
          channelName: meta.authorName ?? "",
          thumbnailUrl: meta.thumbnailUrl ?? "",
        });
      });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [videoUrl]);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setVideoUrl(text);
    } catch (err) {
      console.error("[home-page-v3] paste failed:", err);
    }
  }

  function handleCreateDrop() {
    if (videoPreview && selectedPurpose) {
      onCreateDrop(videoUrl, selectedPurpose);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#FAFAFA]">
      {/* ─────────────────────────────────────────────────────────────
          Header
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E5E5E5] bg-white px-5">
        <h1 className="text-lg font-bold text-[#0A0A0A]" style={{ letterSpacing: "-0.02em" }}>
          LinkDrop
        </h1>
        <div className="flex items-center gap-1">
          {/* 내 매장 — 사업자(isBusiness)일 때만. 일반(소비자) 계정엔 미표시. */}
          {isBusiness ? (
            <button
              type="button"
              onClick={onGoStore}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A3A3A3] transition-colors hover:bg-[#F5F5F5] active:bg-[#E5E5E5]"
              aria-label="내 매장"
            >
              <Store className="h-5 w-5" strokeWidth={1.5} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNotifications}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#A3A3A3] transition-colors hover:bg-[#F5F5F5] active:bg-[#E5E5E5]"
            aria-label="알림"
          >
            <Bell className="h-5 w-5" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#0A0A0A] ring-2 ring-white" />
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-28">
        {/* ─────────────────────────────────────────────────────────────
            Hero
        ───────────────────────────────────────────────────────────── */}
        <section className="pt-6 pb-1 text-center">
          <h2
            className="text-[22px] font-bold leading-[1.35] text-[#0A0A0A]"
            style={{ letterSpacing: "-0.03em" }}
          >
            영상 링크 하나로,{" "}
            <span className="relative inline-block">
              예약과 혜택까지
              <span className="absolute inset-x-0 bottom-0.5 -z-10 h-2 bg-[#DCFCE7]" />
            </span>
          </h2>
          <p className="mt-2 text-[13px] text-[#737373]">
            붙여넣으면 AI가 행동 카드로 만들어드려요
          </p>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            Step 1: Link Input
        ───────────────────────────────────────────────────────────── */}
        <section className="mt-6 rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center gap-2.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ${
                videoPreview ? "bg-[#22C55E]" : "bg-[#F5F5F5]"
              }`}
            >
              {videoPreview ? (
                <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
              ) : (
                <span className="text-xs font-bold text-[#525252]">1</span>
              )}
            </div>
            <p className="text-[15px] font-semibold text-[#0A0A0A]">영상 링크 넣기</p>
          </div>

          <div
            className={`flex h-12 items-center gap-3 overflow-hidden rounded-xl border px-4 transition-all duration-200 ${
              videoUrl
                ? "border-[#0A0A0A] bg-[#FAFAFA]"
                : "border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#D4D4D4]"
            }`}
          >
            <LinkIcon
              className={`h-[18px] w-[18px] shrink-0 ${
                videoUrl ? "text-[#0A0A0A]" : "text-[#A3A3A3]"
              }`}
              strokeWidth={2}
            />
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="링크를 붙여넣으세요"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:outline-none"
            />
            <button
              type="button"
              onClick={handlePaste}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3.5 text-xs font-medium text-white transition-all hover:bg-[#171717] active:scale-[0.98]"
            >
              <Clipboard className="h-3.5 w-3.5" />
              붙여넣기
            </button>
          </div>

          {/* Loading */}
          {isLoadingPreview && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#FAFAFA] p-3">
              <div className="h-12 w-[85px] shrink-0 animate-pulse rounded-lg bg-[#E5E5E5]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[#E5E5E5]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[#E5E5E5]" />
              </div>
            </div>
          )}

          {/* Preview */}
          {videoPreview && !isLoadingPreview && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#F0FDF4] bg-[#F0FDF4] p-3">
              <div className="relative h-12 w-[85px] shrink-0 overflow-hidden rounded-lg bg-[#E5E5E5]">
                {videoPreview.thumbnailUrl ? (
                  <img
                    src={videoPreview.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {videoPreview.duration && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-medium text-white">
                    {videoPreview.duration}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0A0A0A]">
                  {videoPreview.title}
                </p>
                <p className="truncate text-xs text-[#A3A3A3]">{videoPreview.channelName}</p>
              </div>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E]">
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </div>
            </div>
          )}
        </section>

        {/* ─────────────────────────────────────────────────────────────
            Step 2: Purpose Selection (3 Purposes)
        ───────────────────────────────────────────────────────────── */}
        <section className="mt-4 rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="mb-1 flex items-center gap-2.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ${
                selectedPurpose ? "bg-[#22C55E]" : "bg-[#F5F5F5]"
              }`}
            >
              {selectedPurpose ? (
                <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
              ) : (
                <span className="text-xs font-bold text-[#525252]">2</span>
              )}
            </div>
            <p className="text-[15px] font-semibold text-[#0A0A0A]">목적 선택</p>
          </div>
          <p className="mb-4 ml-[38px] text-xs text-[#A3A3A3]">
            목적에 따라 AI가 요약과 버튼을 다르게 추천해요
          </p>

          <div className="space-y-3">
            {visiblePurposes.map((purpose) => {
              const Icon = purpose.icon;
              const isSelected = selectedPurpose === purpose.id;
              return (
                <button
                  key={purpose.id}
                  type="button"
                  onClick={() => setSelectedPurpose(isSelected ? null : purpose.id)}
                  className={`group w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-[#0A0A0A] bg-[#FAFAFA] shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                      : "border-[#E5E5E5] bg-white hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                        isSelected ? "bg-[#0A0A0A]" : "bg-[#F5F5F5] group-hover:bg-[#EBEBEB]"
                      }`}
                    >
                      <Icon
                        className={`h-[22px] w-[22px] ${
                          isSelected ? "text-white" : "text-[#525252]"
                        }`}
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[15px] font-bold leading-snug text-[#0A0A0A]">
                          {purpose.label}
                        </p>
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                            isSelected
                              ? "border-[#0A0A0A] bg-[#0A0A0A]"
                              : "border-[#D4D4D4] group-hover:border-[#A3A3A3]"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                            isSelected ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#737373]"
                          }`}
                        >
                          {purpose.tag}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#737373]">
                        {purpose.description}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons preview */}
                  <div
                    className={`grid transition-all duration-300 ${
                      isSelected
                        ? "mt-3.5 grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-[62px] border-t border-dashed border-[#E5E5E5] pt-3">
                        <p className="mb-2 text-[11px] font-medium text-[#A3A3A3]">추천 버튼</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {purpose.buttons.map((btn, idx) => (
                            <span
                              key={btn}
                              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                                idx === 0
                                  ? "bg-[#0A0A0A] text-white"
                                  : "bg-[#F5F5F5] text-[#525252]"
                              }`}
                            >
                              {btn}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            Drop Button
        ───────────────────────────────────────────────────────────── */}
        <section className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleCreateDrop}
            disabled={!videoPreview || !selectedPurpose}
            className={`group relative flex items-center gap-2.5 overflow-hidden rounded-full px-8 py-4 transition-all duration-300 ${
              videoPreview && selectedPurpose
                ? "bg-[#0A0A0A] shadow-[0_4px_16px_rgba(15,23,42,0.25)] hover:bg-[#171717] active:scale-[0.98]"
                : "bg-[#E5E5E5]"
            }`}
          >
            <Sparkles
              className={`relative h-5 w-5 ${
                videoPreview && selectedPurpose ? "text-white" : "text-[#A3A3A3]"
              }`}
              strokeWidth={1.75}
            />

            <span
              className={`relative text-base font-bold ${
                videoPreview && selectedPurpose ? "text-white" : "text-[#A3A3A3]"
              }`}
            >
              Drop 만들기
            </span>

            <ArrowRight
              className={`relative h-5 w-5 transition-transform duration-200 ${
                videoPreview && selectedPurpose
                  ? "text-white group-hover:translate-x-0.5"
                  : "text-[#A3A3A3]"
              }`}
              strokeWidth={2}
            />
          </button>
        </section>

        {(!videoPreview || !selectedPurpose) && (
          <p className="mt-3 text-center text-xs text-[#A3A3A3]">
            {!videoPreview ? "링크를 먼저 넣어주세요" : "목적을 선택해 주세요"}
          </p>
        )}

        {/* ─────────────────────────────────────────────────────────────
            My Drops Section
        ───────────────────────────────────────────────────────────── */}
        {myDrops.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0A0A0A]">내 Drop</h3>
              <button
                type="button"
                onClick={onViewAllDrops}
                className="flex items-center gap-0.5 text-sm font-medium text-[#A3A3A3] transition-colors hover:text-[#525252]"
              >
                전체 보기
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {myDrops.slice(0, 3).map((drop) => (
                <button
                  key={drop.id}
                  type="button"
                  onClick={() => onViewDrop(drop.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#E5E5E5] bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all hover:border-[#D4D4D4] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] active:scale-[0.99]"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5]">
                    <img src={drop.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-[#0A0A0A]">{drop.title}</p>
                    <p className="mt-0.5 text-xs text-[#A3A3A3]">
                      조회 {drop.stats.views}회
                      {drop.stats.reservations && ` · 예약 ${drop.stats.reservations}건`}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#A3A3A3]" />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* phase1-#1 마무리: 내장 4탭 nav 제거. 공통 BottomNav 가 _user.tsx /
          index.tsx 에서 별도 렌더 (단일 nav, URL 파생 active). 충돌 원천 제거. */}
    </div>
  );
}

export default HomePageV3;
