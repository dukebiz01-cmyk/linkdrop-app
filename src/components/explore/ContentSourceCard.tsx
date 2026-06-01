import { Sparkles } from "lucide-react";

export type ContentSourceCardData = {
  id: string;
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  sourceUrl: string | null;
  description: string | null;
};

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ContentSourceCard({
  source,
  onCreate,
  onRemove,
  onPlay,
}: {
  source: ContentSourceCardData;
  onCreate: (sourceId: string) => void;
  onRemove: (sourceId: string) => void;
  // 작업 B: 썸네일/제목 탭 → 인앱 임베드 모달. 부모(explore.tsx) 에서 단일 모달 관리.
  onPlay: (source: ContentSourceCardData) => void;
}) {
  const title = source.title?.trim() || "제목 없음";
  const author = source.authorName?.trim() || "";
  const duration = formatDuration(source.durationSec);
  const description = source.description?.trim() || "";
  const hasThumb = Boolean(source.thumbnailUrl);

  return (
    <article className="flex w-full items-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-3 transition-colors hover:border-[#D4D4D4]">
      <button
        type="button"
        onClick={() => onPlay(source)}
        aria-label="영상 재생"
        className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5] transition-opacity hover:opacity-90"
      >
        {hasThumb ? (
          <img src={source.thumbnailUrl ?? ""} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#A3A3A3]">
            <Sparkles className="size-6" strokeWidth={2} />
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1 right-1 rounded-lg bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
            {duration}
          </span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button type="button" onClick={() => onPlay(source)} className="text-left">
          <p className="line-clamp-2 text-sm font-bold tracking-ko text-[#0A0A0A] hover:underline">
            {title}
          </p>
        </button>
        {author && (
          <p className="truncate text-xs font-medium tracking-ko text-[#737373]">{author}</p>
        )}
        {description && (
          <p className="line-clamp-2 text-[11px] font-medium leading-snug tracking-ko text-[#A3A3A3]">
            {description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCreate(source.id)}
            className="inline-flex h-9 min-h-[36px] items-center justify-center rounded-lg bg-[#0A0A0A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#171717]"
          >
            카드 만들기
          </button>
          <button
            type="button"
            onClick={() => onRemove(source.id)}
            className="inline-flex h-9 min-h-[36px] items-center justify-center rounded-lg border border-[#E5E5E5] bg-white px-3 text-xs font-medium tracking-ko text-[#737373] transition-colors hover:border-[#D4D4D4] hover:bg-[#FAFAFA] hover:text-[#525252]"
          >
            제거
          </button>
        </div>
      </div>
    </article>
  );
}
