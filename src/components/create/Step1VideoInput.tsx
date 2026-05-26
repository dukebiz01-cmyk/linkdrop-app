import { useEffect, useState } from "react";
import {
  AlertCircle,
  Clipboard,
  Link as LinkIcon,
  Loader2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StepBadge } from "@/components/create/StepBadge";
import type { VideoInfo } from "@/components/create/types";
import type { VideoMetadataFetchedBy } from "@/lib/video-metadata";

function platformLabel(platform: VideoInfo["platform"]): string {
  return platform === "youtube" ? "YouTube" : "Instagram";
}

function metadataUsesFallback(fetchedBy: VideoMetadataFetchedBy | null): boolean {
  return (
    fetchedBy === "youtube_fallback" ||
    fetchedBy === "instagram_fallback" ||
    fetchedBy === "manual_fallback"
  );
}

export function Step1UrlInput({
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
