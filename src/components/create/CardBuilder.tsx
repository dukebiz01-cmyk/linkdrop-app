import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchVideoMetadata, parseVideoUrl } from "@/lib/video-metadata";
import type { DropPurpose } from "@/lib/types";
import { DropPreviewCard } from "@/components/create/DropPreviewCard";
import { aiPreviewFromPurpose, videoInfoFromMetadata } from "@/components/create/wizard-helpers";
import type { AiPreviewData, VideoInfo } from "@/components/create/types";

// 발행 콜백 — 위저드 onComplete 미러(정보 목적·영상 소스 최소 시그니처). 저장 책임=라우트.
export type BuilderComplete = (data: {
  video: VideoInfo;
  purpose: DropPurpose;
  ai: AiPreviewData;
  makerMessage: string;
}) => Promise<{ shareUuid: string; shareUrl: string }>;

/**
 * CardBuilder — 새 카드 빌더 화면(셸 + 핀 미리보기). 위저드(create-drop-wizard)는 건드리지 않고
 *   공유 헬퍼(parseVideoUrl/fetchVideoMetadata/videoInfoFromMetadata/aiPreviewFromPurpose)로
 *   미리보기 파이프라인만 재현한다.
 *
 * 범위 = 셸 + 핀 미리보기(chunk 2) + 목적 전환 칩(chunk 3)까지.
 *   상품/콘텐츠 블록 · 목적별 데이터 입력(예약 날짜·쿠폰·가격) · 저장은 다음 단계 — 여기 없음.
 *
 * 미리보기 단일 진입점 = videoInfo. 이번엔 URL effect 만 채우지만, 향후 자체(상품) 소스도
 *   같은 videoInfo 로 흘려보낼 수 있게 구조만 그렇게 둔다.
 */
// 잠금 결정 = 4목적(정보/쿠폰/예약/구매). PURPOSE_FLOW_CONFIG 순회 금지("상담" 누출 방지).
const PURPOSES: DropPurpose[] = ["정보", "쿠폰", "예약", "구매"];

export function CardBuilder({ onComplete }: { onComplete?: BuilderComplete }) {
  const [url, setUrl] = useState("");
  const [urlStatus, setUrlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  // 목적(chunk 3) — 칩으로 전환. ai 가 purpose deps 로 재계산 → DropPreviewCard 가 새 목적으로 재렌더.
  const [purpose, setPurpose] = useState<DropPurpose>("정보");
  // 발행(chunk 4) — 정보 목적·영상 소스만. 위저드 savingRef 처럼 1회 저장 후 재사용 + 중복 가드.
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const savingRef = useRef<Promise<{ shareUuid: string; shareUrl: string }> | null>(null);

  // URL → videoInfo (create-drop-wizard.tsx 의 URL useEffect 패턴 그대로, 공유 헬퍼만 사용).
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlStatus("idle");
      setVideoInfo(null);
      return;
    }

    const parsed = parseVideoUrl(trimmed);
    if (!parsed) {
      setUrlStatus("error");
      setVideoInfo(null);
      return;
    }

    setUrlStatus("loading");
    let cancelled = false;

    const debounce = setTimeout(() => {
      void fetchVideoMetadata(trimmed).then((meta) => {
        if (cancelled) return;
        setVideoInfo(videoInfoFromMetadata(meta, trimmed));
        setUrlStatus("success");
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [url]);

  const ai = useMemo(() => aiPreviewFromPurpose(purpose), [purpose]);

  // 발행 가능 = 영상 있음 && 정보 목적(이번 단계). 그 외 목적·소스는 다음 단계.
  const canPublish = Boolean(videoInfo) && purpose === "정보";

  // 발행 — 라우트 onComplete(/api/drops→create_drop_v2) 호출. savingRef 로 동시클릭/중복 저장 가드.
  async function handlePublish() {
    if (!onComplete || !videoInfo || purpose !== "정보") return;
    if (publishedUrl || publishing || savingRef.current) return; // 1회 저장 후 재사용 + 발행 중 무시
    setPublishing(true);
    setPublishError(null);
    const promise = onComplete({ video: videoInfo, purpose, ai, makerMessage: "" });
    savingRef.current = promise;
    try {
      const result = await promise;
      setPublishedUrl(result.shareUrl);
    } catch (e) {
      console.error("[CardBuilder] publish failed:", e);
      setPublishError("발행에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPublishing(false);
      savingRef.current = null;
    }
  }

  async function handleCopy() {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-bg">
      {/* 상단 헤더 — 일반 흐름(스크롤 시 위로). 뒤로 = /studio. */}
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2">
        <Link
          to="/studio"
          aria-label="뒤로"
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-text-strong"
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
        </Link>
        <span className="text-sm font-bold tracking-ko text-text-strong">새 카드 만들기</span>
      </header>

      {/* 핀 영역 — sticky top-0. URL 입력 + 받는 사람 카드 미리보기를 상단에 고정. */}
      <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-bg px-6 py-4">
        <div>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="유튜브·인스타 영상 링크"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {urlStatus === "loading" ? (
            <p className="mt-2 text-xs font-medium tracking-ko text-text-subtle">
              영상 정보를 불러오는 중…
            </p>
          ) : urlStatus === "error" ? (
            <p className="mt-2 text-xs font-medium tracking-ko text-text-subtle">
              링크를 확인해 주세요.
            </p>
          ) : null}
        </div>

        {videoInfo ? (
          <DropPreviewCard purpose={purpose} ai={ai} videoInfo={videoInfo} />
        ) : (
          <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
            <p className="text-sm font-medium tracking-ko text-text-muted">
              영상 링크를 넣으면 받는 사람 카드가 여기 떠요
            </p>
          </div>
        )}
      </div>

      {/* 하단 스크롤 영역 — 구성. chunk 3 = 목적 전환 칩(누르면 핀 미리보기가 그 목적 카드로). */}
      <div className="flex-1 px-6 py-6">
        <section>
          <h2 className="text-sm font-bold tracking-ko text-text-strong">목적</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PURPOSES.map((p) => {
              const active = purpose === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPurpose(p)}
                  className={cn(
                    "inline-flex min-h-[36px] items-center rounded-full px-3 py-1.5 text-sm font-bold tracking-ko transition-colors",
                    active
                      ? "bg-[#0A0A0A] text-white"
                      : "border border-border bg-white text-text-muted hover:border-text-muted hover:text-text-strong",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-medium tracking-ko text-text-subtle">
            블록(상품·콘텐츠)은 곧 추가됩니다
          </p>
        </section>

        {/* 발행(chunk 4) — 정보 목적·영상 소스만. 저장 성공 시 단축링크 표시. */}
        <section className="mt-6">
          {publishedUrl ? (
            <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-bold tracking-ko text-text-strong">발행 완료</p>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium tracking-ko text-text-strong">
                  {publishedUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="링크 복사"
                  className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border border-border bg-white px-3 text-sm font-bold tracking-ko text-text-strong transition-colors hover:border-text-muted"
                >
                  {copied ? (
                    <Check className="size-4" strokeWidth={2} />
                  ) : (
                    <Copy className="size-4" strokeWidth={2} />
                  )}
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-bold tracking-ko text-text-strong transition-colors hover:border-text-muted"
              >
                카드 보기
              </a>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={!canPublish || publishing}
                onClick={handlePublish}
                className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#0A0A0A] px-6 text-base font-bold tracking-ko text-white transition-colors hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishing ? "발행 중…" : "발행"}
              </button>
              {!videoInfo ? (
                <p className="mt-2 text-center text-xs font-medium tracking-ko text-text-subtle">
                  영상 링크를 먼저 넣어 주세요.
                </p>
              ) : purpose !== "정보" ? (
                <p className="mt-2 text-center text-xs font-medium tracking-ko text-text-subtle">
                  이 목적은 발행을 곧 지원해요.
                </p>
              ) : null}
              {publishError ? (
                <p className="mt-2 text-center text-xs font-medium tracking-ko text-intent-danger">
                  {publishError}
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
