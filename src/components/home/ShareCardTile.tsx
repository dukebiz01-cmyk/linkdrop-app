import { Play, Send, Image as ImageIcon } from "lucide-react";
import type { DropFeedItem } from "@/components/home-page";

/**
 * ShareCardTile — full-bleed 썸네일 + 하단 아크릴판(글래스모피즘) 카드.
 *   유저홈 "오늘 공유하기 좋은 카드" · 탐색 그리드(1/2열) 공용.
 *
 * 구조: 루트 relative h-[180px] / 썸네일 absolute inset-0 object-cover(없으면 폴백 아이콘)
 *   / 종류칩(top-left) · 공유 아이콘버튼(top-right) · duration(아크릴판 위) 오버레이
 *   / 하단 아크릴판(absolute bottom-0) = bg-white/72 backdrop-blur-md + 메이커·지역 + 제목.
 *
 * 디자인 공리(styles.css): backdrop-blur 허용(bottom-nav·기존 오버레이 선례) → 사용.
 *   box-shadow 는 shadow-soft(modal/dropdown) 외 금지 → 공유 아이콘은 그림자 없이 border 로.
 * 색 — 형제 팔레트만(#0A0A0A, #525252, #A3A3A3, #E5E5E5, #D4D4D4, #F5F5F5, black, white).
 *   #404040 는 팔레트 미존재 → #525252 폴백. 블루 미사용. Lucide만, 이모지 0.
 *
 * 루트=article(비-button) + onClick → 공유는 내부 button + stopPropagation(중첩 button 금지).
 * onShare = 카톡 재공유(shareUuid 전달). onClick = 카드 열기(옵션).
 * purpose = 종류칩 값(옵셔널). 호출부가 drop.intent/purpose 를 넘길 때만 칩 표시(미주입=칩 없음).
 */
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// 종류칩 라벨 — 영문 intent(coupon/reservation/commerce/info)·국문 purpose(쿠폰/예약/구매/정보) 양쪽 매핑.
//   정보→정보 / 쿠폰·예약→쿠폰 / 구매→상품판매. 그 외(ticket/lead/… )는 null = 칩 숨김.
function purposeChipLabel(v: string | undefined): string | null {
  switch (v) {
    case "정보":
    case "info":
      return "정보";
    case "쿠폰":
    case "예약":
    case "coupon":
    case "reservation":
      return "쿠폰";
    case "구매":
    case "commerce":
      return "상품판매";
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
  const chipLabel = purposeChipLabel(purpose);
  const hasThumb = Boolean(drop.videoThumbnailUrl);

  return (
    <article
      className="relative h-[180px] cursor-pointer overflow-hidden rounded-2xl border border-[#E5E5E5] transition-colors hover:border-[#D4D4D4]"
      onClick={onClick}
    >
      {/* full-bleed 썸네일 — 없으면 폴백(영상=Play / 사진=Image) */}
      {hasThumb ? (
        <img
          src={drop.videoThumbnailUrl}
          alt={drop.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F5]">
          {isVideo ? (
            <Play className="h-8 w-8 text-[#A3A3A3]" strokeWidth={1.5} />
          ) : (
            <ImageIcon className="h-8 w-8 text-[#A3A3A3]" strokeWidth={1.5} />
          )}
        </div>
      )}

      {/* 종류칩 — top-left, 반투명 흰 아크릴 */}
      {chipLabel ? (
        <span className="absolute left-2 top-2 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold tracking-ko text-[#0A0A0A] backdrop-blur-sm">
          {chipLabel}
        </span>
      ) : null}

      {/* 공유 — top-right 아이콘 버튼. 탭영역 44px(공리), 가시 원 32px. 카드 열기 방지 stopPropagation. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onShare?.(drop.shareUuid);
        }}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center"
        aria-label="공유"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/85 text-[#0A0A0A] backdrop-blur-sm transition-colors hover:bg-white">
          <Send className="h-4 w-4" strokeWidth={2} />
        </span>
      </button>

      {/* 하단 아크릴판 — 반투명 흰 + 블러. duration(영상)은 판 바로 위에 띄움(bottom-full). */}
      <div className="absolute inset-x-0 bottom-0 border-t border-white/50 bg-white/72 px-2.5 py-2.5 backdrop-blur-md backdrop-saturate-150">
        {isVideo ? (
          <span className="absolute bottom-full left-2 mb-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] tabular-nums text-white backdrop-blur-sm">
            {formatDuration(drop.videoDurationSec)}
          </span>
        ) : null}

        {/* 메이커 · 지역 (1줄) */}
        <div className="flex min-w-0 items-center gap-1 text-[10px] tracking-ko text-[#525252]">
          <span className="truncate font-medium">{drop.maker.name}</span>
          {drop.localName ? (
            <>
              <span className="shrink-0">·</span>
              <span className="truncate">{drop.localName}</span>
            </>
          ) : null}
        </div>

        {/* 제목 (2줄 clamp) */}
        <h3 className="mt-0.5 line-clamp-2 text-[12.5px] font-semibold leading-snug tracking-ko text-[#0A0A0A]">
          {drop.title}
        </h3>
      </div>
    </article>
  );
}
