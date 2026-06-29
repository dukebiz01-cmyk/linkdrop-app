import { Play, Send, Image as ImageIcon } from "lucide-react";
import type { DropFeedItem } from "@/components/home-page";

/**
 * ShareCardTile — V4 카드(정사각 썸네일 + 솔리드 정보영역 + 슬레이트 + 도트칩 + 섀도).
 *   유저홈 "오늘 공유하기 좋은 카드" · 탐색 그리드 공용. (아크릴 오버레이 → V4 솔리드로 교체.)
 *
 * 구조: 루트 article(group, flex-col, rounded-2xl, border #E8EDF3, V4 카드 섀도, hover -translate+elevation)
 *   / 썸네일 aspect-square(고정 1:1 → 카드 높이 정렬, group-hover scale) + 상단 스크림
 *   / 종류칩(top-left, 도트+라벨, purpose 주입 시만) · 공유 아이콘버튼(top-right, 44px 탭) · duration(좌하단)
 *   / 솔리드 정보영역(메이커·지역 1줄 + 제목 2줄 clamp, min-h 컬럼 정렬).
 *
 * 공리 V4(styles.css 600b062): 슬레이트+섀도+blue accent 허용, raw hex 허용, backdrop-blur 허용. Lucide만, 이모지 0.
 * 루트=article(비-button) + onClick → 공유만 내부 button + stopPropagation(중첩 button 금지).
 * ★ props 계약 유지: { drop, purpose?, onShare?, onClick? }. 홈=purpose 미주입(칩X), 탐색=주입(칩O).
 */
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type ChipTone = { dot: string; text: string };
type ChipMeta = { label: string; tone: ChipTone };

// 종류칩 메타 — 영문 intent / 국문 purpose 양쪽 매핑 + V4 톤(도트색·텍스트색).
//   정보→info톤 / 쿠폰·예약→coupon톤(blue) / 구매→sale톤. 그 외(ticket/lead/…)·미주입 → null(칩 숨김).
//   ★ 미주입(undefined) → null = 홈은 칩 없음(기존 계약 보존). 탐색만 purpose 주입 → 칩 표시.
function purposeMeta(v: string | undefined): ChipMeta | null {
  switch (v) {
    case "정보":
    case "info":
      return { label: "정보", tone: { dot: "#64748B", text: "text-[#475569]" } };
    case "쿠폰":
    case "예약":
    case "coupon":
    case "reservation":
      return { label: "쿠폰", tone: { dot: "#2563EB", text: "text-[#1D4ED8]" } };
    case "구매":
    case "commerce":
      return { label: "상품판매", tone: { dot: "#0F172A", text: "text-[#0F172A]" } };
    default:
      return null;
  }
}

export function ShareCardTile({
  drop,
  purpose,
  onShare,
  onClick,
}: {
  drop: DropFeedItem;
  purpose?: string;
  onShare?: (uuid: string) => void;
  onClick?: () => void;
}) {
  const isVideo = drop.videoDurationSec > 0;
  const chip = purposeMeta(purpose);
  const hasThumb = Boolean(drop.videoThumbnailUrl);

  return (
    <article
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_10px_28px_rgba(15,23,42,0.1)]"
      onClick={onClick}
    >
      {/* 썸네일 — 고정 1:1 정사각(모든 카드 높이 정렬). 없으면 폴백(영상=Play / 사진=Image). */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#F1F5F9]">
        {hasThumb ? (
          <img
            src={drop.videoThumbnailUrl}
            alt={drop.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[450ms] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-[1.05]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#94A3B8]">
            {isVideo ? (
              <Play className="h-8 w-8" strokeWidth={1.5} />
            ) : (
              <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
            )}
          </div>
        )}

        {/* 상단 스크림 — 칩·공유 가독성. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/30 to-transparent" />

        {/* 종류칩 — 좌상단, 도트+라벨(글래스 펄). purpose 주입 시만(홈 미주입=숨김). */}
        {chip ? (
          <span
            className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold shadow-[0_2px_6px_rgba(15,23,42,0.16)] backdrop-blur-sm ${chip.tone.text}`}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: chip.tone.dot }} />
            {chip.label}
          </span>
        ) : null}

        {/* 공유 — 우상단 아이콘 버튼. 탭영역 44px, 가시 원 32px. 카드 열기 방지 stopPropagation. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare?.(drop.shareUuid);
          }}
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center"
          aria-label="공유"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-[0_2px_6px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all duration-150 group-hover:bg-white active:scale-90">
            <Send
              className="size-[15px] text-[#0F172A] transition-colors group-hover:text-[#2563EB]"
              strokeWidth={2}
            />
          </span>
        </button>

        {/* 재생시간 — 좌하단(영상만). */}
        {isVideo ? (
          <span className="absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {formatDuration(drop.videoDurationSec)}
          </span>
        ) : null}
      </div>

      {/* 정보영역 — 솔리드, 고정 높이 컬럼 정렬(메이커·지역 1줄 + 제목 2줄). */}
      <div className="flex flex-col px-3 pb-3 pt-2.5">
        <div className="truncate text-[11px] font-semibold text-[#64748B]">
          {drop.maker.name}
          {drop.localName ? ` · ${drop.localName}` : ""}
        </div>
        <div className="mt-1 line-clamp-2 min-h-[37px] text-[13.5px] font-semibold leading-[1.4] tracking-[-0.01em] text-[#0F172A]">
          {drop.title}
        </div>
      </div>
    </article>
  );
}

// 로딩 스켈레톤 — 동일 1:1 비율(탐색/홈 로딩 자리). 펄스만, 인터랙션 없음.
export function ShareCardTileSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white">
      <div className="aspect-square w-full animate-pulse bg-[#F1F5F9]" />
      <div className="flex flex-col gap-1.5 px-3 pb-3 pt-2.5">
        <div className="h-3 w-2/5 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-3.5 w-full animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#F1F5F9]" />
      </div>
    </div>
  );
}
