import { Play, Send } from "lucide-react";
import type { DropFeedItem } from "@/components/home-page";

/**
 * ShareCardTile — "오늘 공유하기 좋은 카드" 컴팩트 그리드 셀(유저홈 2열).
 *
 * 세로 카드: 썸네일(위, 고정높이 ~84px, 영상이면 play+duration 오버레이)
 *   → 본문(메이커·시간 작게 / title 2줄 clamp / 하단 풀폭 "공유" 버튼).
 * 색 신규 0 — RoleHome·drop-feed-card 형제 색 문자열 그대로 재사용
 *   (#0A0A0A, #737373, #E5E5E5, #F5F5F5, #A3A3A3, black/60, bg-white). Lucide만, 이모지 0.
 *
 * onShare = 카톡 재공유(shareUuid 전달). onClick = 카드 열기(옵션).
 */
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ShareCardTile({
  drop,
  onShare,
  onClick,
}: {
  drop: DropFeedItem;
  onShare?: (uuid: string) => void;
  onClick?: () => void;
}) {
  const isVideo = drop.videoDurationSec > 0;

  return (
    <article
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white transition-colors hover:border-[#D4D4D4]"
      onClick={onClick}
    >
      {/* 썸네일 — 고정높이, 영상이면 play+duration 오버레이 */}
      <div className="relative h-[84px] w-full bg-[#F5F5F5]">
        <img
          src={drop.videoThumbnailUrl}
          alt={drop.title}
          className="h-full w-full object-cover"
        />
        {isVideo ? (
          <>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                <Play className="h-3.5 w-3.5 text-white" strokeWidth={2} fill="currentColor" />
              </span>
            </span>
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] tabular-nums text-white backdrop-blur-sm">
              {formatDuration(drop.videoDurationSec)}
            </span>
          </>
        ) : null}
      </div>

      {/* 본문 */}
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] font-medium tracking-ko text-[#0A0A0A]">
            {drop.maker.name}
          </span>
          <span className="text-[#A3A3A3]">·</span>
          <span className="shrink-0 text-[11px] tracking-ko text-[#A3A3A3]">
            {drop.maker.droppedAgo}
          </span>
        </div>

        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug tracking-ko text-[#0A0A0A]">
          {drop.title}
        </h3>

        {/* 하단 풀폭 공유 버튼 — 카드 열기 방지 stopPropagation */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare?.(drop.shareUuid);
          }}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white px-3 text-xs font-semibold tracking-ko text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
          aria-label="공유"
        >
          <Send className="h-4 w-4" strokeWidth={2} />
          공유
        </button>
      </div>
    </article>
  );
}
