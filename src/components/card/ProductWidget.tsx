import { useState } from "react";
import { Check, ShoppingCart, MapPin, CalendarDays, Sprout, Video } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { ImageZoomModal } from "@/components/card/ImageZoomModal";
import type { VideoSlot } from "@/components/card/CardBody.types";

/**
 * ProductWidget — 상품(커머스) 본체 위젯 (presentational + 이미지확대만 내부 캡슐).
 *
 * C1: 손님 PurchaseCardBody(커머스 분기)를 공유 위젯으로 추출한 v1. 마크업·토큰·동작 동일(흰 카드).
 *   - 스튜디오(제작)·손님(/d) 양쪽이 CardBody.productBlock 슬롯에 이 위젯을 주입해 WYSIWYG(배선은 C2/C3).
 *   - interactivity(이미지 확대 zoomOpen)만 위젯 내부 state. 선주문(onPreorder)은 부모 콜백(prop).
 *   - 구매버튼(window.open buyUrl)은 자기완결. §0: 시세/비교가 미표시 — 결정가(priceKrw) 단일값만.
 *   - media.type==="video" 는 ③단계(영상 3출처)용 인터페이스 자리만 — 이번엔 image 만 실동작.
 */
export interface ProductWidgetProps {
  name: string;
  /** 결정가(원). null 이면 "가격 미정"(§0: 단일값만, 시세 없음). */
  priceKrw: number | null;
  /** 본체 미디어 — image(현행) / video(③단계). 미지정이면 imageUrl 로 폴백. */
  media?: { type: "image" | "video"; imageUrl?: string; videoSlot?: VideoSlot };
  imageUrl?: string;
  headline?: string;
  sellingPoints?: string[];
  isFresh?: boolean;
  harvestDate?: string | null;
  stockLimit?: number | null;
  local?: { name?: string; address?: string; distance?: string };
  /** 자체업로드 상품 → 1차 버튼 "선주문하기"(onPreorder). false/미지정이면 "구매하기"(buyUrl). */
  selfUpload?: boolean;
  buyUrl?: string;
  onPreorder?: () => void;
  onSellerClick?: () => void;
}

export function ProductWidget({
  name,
  priceKrw,
  media,
  imageUrl,
  headline,
  sellingPoints,
  isFresh,
  harvestDate,
  stockLimit,
  local,
  selfUpload,
  buyUrl,
  onPreorder,
}: ProductWidgetProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  // 본체 미디어 결정 — media 우선, 없으면 imageUrl 폴백. video 는 ③단계.
  const isVideo = media?.type === "video";
  const bodyImage = media?.imageUrl ?? imageUrl ?? "";

  return (
    <section data-testid="product-widget" className="w-full max-w-full">
      <div className="overflow-hidden rounded-2xl border border-border bg-bg">
        {isVideo ? (
          // ③단계(영상 3출처) 구현 자리 — media.videoSlot 로 YouTubeLiteEmbed 렌더 예정. 이번엔 미실동작.
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface text-text-subtle">
            <Video className="size-7" strokeWidth={1.5} />
          </div>
        ) : bodyImage ? (
          <>
            {/* 탭하면 전체화면 무크롭 확대(긴 세로 잘림 해소). 카드 안 표시(aspect-[4/3] 크롭)는 그대로. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoomOpen(true);
              }}
              className="block w-full cursor-zoom-in"
            >
              <img src={bodyImage} alt="" className="aspect-[4/3] w-full object-cover" />
            </button>
            <ImageZoomModal src={bodyImage} alt={name} open={zoomOpen} onOpenChange={setZoomOpen} />
          </>
        ) : null}
        <div className="space-y-3 p-4">
          <p className="text-base font-bold leading-snug tracking-ko text-text-strong">{name}</p>
          <p className="text-xl font-extrabold tracking-ko text-text-strong">
            {priceKrw != null ? `${priceKrw.toLocaleString("ko-KR")}원` : "가격 미정"}
          </p>
          {/* ② 농가/산지 — local 있을 때만(없으면 생략). 신뢰 강화. */}
          {local?.name?.trim() || local?.address?.trim() ? (
            <p className="flex items-center gap-1.5 text-sm font-medium tracking-ko text-text-muted">
              <MapPin className="size-4 shrink-0 text-text-subtle" strokeWidth={2} />
              <span className="min-w-0 truncate">
                {[local?.name?.trim(), local?.address?.trim()].filter(Boolean).join(" · ")}
              </span>
            </p>
          ) : null}
          {/* ② 신선 원물 strip — isFresh 일 때만. 수확·발송 예정일 + 한정 수량. 시세 미표시. */}
          {isFresh ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                <Sprout className="size-4 shrink-0 text-text-strong" strokeWidth={2} />
                신선 원물
              </span>
              {harvestDate ? (
                <p className="flex items-center gap-1.5 text-sm font-medium tracking-ko text-text-muted">
                  <CalendarDays className="size-4 shrink-0 text-text-subtle" strokeWidth={2} />
                  {(() => {
                    const parts = String(harvestDate).split("-");
                    const mm = parts[1];
                    const dd = parts[2];
                    return mm && dd
                      ? `${Number(mm)}월 ${Number(dd)}일 수확·발송 예정`
                      : String(harvestDate);
                  })()}
                </p>
              ) : null}
              {stockLimit != null ? (
                <span className="inline-flex w-fit items-center rounded-md border border-border bg-bg px-2 py-0.5 text-xs font-semibold tracking-ko text-text-strong">
                  {stockLimit}개 한정
                </span>
              ) : null}
            </div>
          ) : null}
          {/* 나-2 — 상품 저장 카피(나-1). 있으면 헤드라인+셀링포인트 리치 표시(없으면 회귀 0). */}
          {headline ? (
            <p className="text-base font-bold leading-snug tracking-ko text-text-strong">
              {headline}
            </p>
          ) : null}
          {sellingPoints && sellingPoints.length > 0 ? (
            <ul className="space-y-1.5">
              {sellingPoints.map((sp, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-muted"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-text-strong" strokeWidth={2.5} />
                  <span>{sp}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {selfUpload ? (
            // ③b 자체업로드 상품 — 1차 버튼 = 선주문하기. 부모(d.$shareUuid)가 로그인 강제 +
            //   PreorderSheet(발송일·수량·결제 스텁) 오픈 + create_preorder 호출을 핸들.
            <ActionButton type="button" className="w-full gap-2" onClick={() => onPreorder?.()}>
              <ShoppingCart className="size-4" strokeWidth={2} />
              주문예약
            </ActionButton>
          ) : (
            <ActionButton
              type="button"
              className="w-full"
              onClick={() => {
                if (typeof window !== "undefined" && buyUrl && buyUrl !== "#") {
                  window.open(buyUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              구매하기
            </ActionButton>
          )}
        </div>
      </div>
    </section>
  );
}
