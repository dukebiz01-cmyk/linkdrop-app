import { useState } from "react";
import { Play } from "lucide-react";

/**
 * YouTubeLiteEmbed — 썸네일 facade + 클릭 시 그 자리에서 iframe(autoplay) 교체.
 *
 * §0 (영상 원본 보존): 우리가 호스팅·다운로드 X, 공식 nocookie iframe.
 * 첫 페인트: img + Play 버튼만 → 무거운 iframe 로드 0 (lite embed).
 * 클릭(=사용자 제스처) 후: youtube-nocookie iframe + autoplay=1 (모바일 autoplay 허용).
 *
 * 비율: 16:9 기본, /shorts/면 9:16 (isShorts prop).
 * 디자인: 기존 영상 카드 오버레이 패턴(흰 Play + 반투명 원, bg-bg/95 shadow-soft) 그대로.
 */
export function YouTubeLiteEmbed({
  videoId,
  thumbnailUrl,
  title,
  isShorts,
  durationLabel,
  sourceLabel,
}: {
  videoId: string;
  thumbnailUrl: string;
  title: string;
  isShorts: boolean;
  durationLabel?: string;
  sourceLabel?: string;
}) {
  const [activated, setActivated] = useState(false);
  const aspectClass = isShorts ? "aspect-[9/16]" : "aspect-video";

  if (activated) {
    return (
      <div className={`relative w-full ${aspectClass} bg-black`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full ${aspectClass} bg-surface`}>
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="h-full w-full object-cover"
        />
      ) : null}
      {sourceLabel ? (
        <span className="absolute right-3 top-3 rounded-lg bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
          {sourceLabel}
        </span>
      ) : null}
      {durationLabel ? (
        <span className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
          {durationLabel}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setActivated(true)}
        aria-label="영상 재생"
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-bg/95 shadow-soft">
          <Play
            className="ml-0.5 size-6 fill-text-strong text-text-strong"
            strokeWidth={2}
          />
        </span>
      </button>
    </div>
  );
}
