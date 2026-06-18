import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fetchVideoMetadata, parseVideoUrl } from "@/lib/video-metadata";
import type { DropPurpose } from "@/lib/types";
import { DropPreviewCard } from "@/components/create/DropPreviewCard";
import { aiPreviewFromPurpose, videoInfoFromMetadata } from "@/components/create/wizard-helpers";
import type { VideoInfo } from "@/components/create/types";

/**
 * CardBuilder — 새 카드 빌더 화면(셸 + 핀 미리보기). 위저드(create-drop-wizard)는 건드리지 않고
 *   공유 헬퍼(parseVideoUrl/fetchVideoMetadata/videoInfoFromMetadata/aiPreviewFromPurpose)로
 *   미리보기 파이프라인만 재현한다.
 *
 * 이번 단계(chunk 2) 범위 = 셸 + 핀 미리보기까지.
 *   블록 토글 / 목적 전환 / 저장 / 발행은 다음 단계 — 여기 없음.
 *
 * 미리보기 단일 진입점 = videoInfo. 이번엔 URL effect 만 채우지만, 향후 자체(상품) 소스도
 *   같은 videoInfo 로 흘려보낼 수 있게 구조만 그렇게 둔다.
 */
export function CardBuilder() {
  const [url, setUrl] = useState("");
  const [urlStatus, setUrlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  // 목적 전환은 다음 단계 — 이번엔 "정보" 고정.
  const [purpose] = useState<DropPurpose>("정보");

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

      {/* 하단 스크롤 영역 — 구성 컨트롤은 다음 단계(플레이스홀더만). */}
      <div className="flex-1 px-6 py-6">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-bold tracking-ko text-text-strong">구성</p>
          <p className="mt-1 text-xs font-medium tracking-ko text-text-subtle">다음 단계</p>
        </div>
      </div>
    </div>
  );
}
