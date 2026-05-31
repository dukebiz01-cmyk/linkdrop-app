import { Sparkles } from "lucide-react";

export type ContentSourceCardData = {
  id: string;
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
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
}: {
  source: ContentSourceCardData;
  onCreate: (sourceId: string) => void;
}) {
  const title = source.title?.trim() || "제목 없음";
  const author = source.authorName?.trim() || "";
  const duration = formatDuration(source.durationSec);
  const hasThumb = Boolean(source.thumbnailUrl);

  return (
    <article className="flex w-full items-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-3 transition-colors hover:border-[#D4D4D4]">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5]">
        {hasThumb ? (
          <img
            src={source.thumbnailUrl ?? ""}
            alt=""
            className="h-full w-full object-cover"
          />
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
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-sm font-bold tracking-ko text-[#0A0A0A]">
          {title}
        </p>
        {author && (
          <p className="truncate text-xs font-medium tracking-ko text-[#737373]">
            {author}
          </p>
        )}
        <button
          type="button"
          onClick={() => onCreate(source.id)}
          className="mt-1 inline-flex h-9 min-h-[36px] w-fit items-center justify-center rounded-lg bg-[#0A0A0A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#171717]"
        >
          카드 만들기
        </button>
      </div>
    </article>
  );
}
