import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PURPOSE_FLOW_CONFIG,
  type AiPreviewData,
  type AttachedProduct,
  type ReservationDateItem,
  type ReservationSummary,
  type VideoInfo,
} from "@/components/create/types";
import type { DropPurpose } from "@/lib/types";

/** Step 4 — 목적별 AI 결과 카드 (config 주입) */
export function AiResultPreviewCard({
  purpose,
  videoInfo,
  title,
  summary,
  keyPoints,
  ctaLabel,
}: {
  purpose: DropPurpose;
  videoInfo: VideoInfo;
  title: string;
  summary: string;
  keyPoints: string[];
  ctaLabel: string;
}) {
  const flow = PURPOSE_FLOW_CONFIG[purpose];

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-bg shadow-soft">
      {videoInfo.thumbnailUrl ? (
        <div className="relative aspect-video w-full bg-surface">
          <img src={videoInfo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="space-y-4 p-4">
        <span
          className={cn(
            "inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold tracking-ko",
            flow.chipClass,
          )}
        >
          {flow.badge}
        </span>
        <p className="text-base font-bold tracking-ko text-text-strong">{title}</p>
        <p className="text-sm font-medium leading-relaxed tracking-ko text-text-muted">{summary}</p>
        <ul className="space-y-2 border-t border-border pt-4">
          {keyPoints.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-strong"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
              {point}
            </li>
          ))}
        </ul>
        {/* 받는 사람 화면의 행동(CTA) preview — 실제 액션 버튼이 아니라 작은 라벨. */}
        <div className="border-t border-border pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-ko text-text-subtle">
            받는 사람 화면 버튼
          </p>
          <span className="mt-2 inline-flex items-center rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold tracking-ko text-text-strong">
            {ctaLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 미리보기 카드 본체 — 위저드 전용 chrome(StepBadge·헤더·padding) 없이 카드 3블록만 렌더.
 * 위저드 밖(빌더)에서 재사용하기 위해 Step4DropPreview 에서 추출. 레이아웃 중립(프래그먼트).
 */
export function DropPreviewCard({
  purpose,
  ai,
  videoInfo,
  reservation,
  labelDate,
  attachedProducts,
}: {
  purpose: DropPurpose;
  ai: AiPreviewData;
  videoInfo: VideoInfo;
  reservation?: ReservationSummary;
  /** 예약 날짜 라벨 빌더 — 호출자가 reservationItemFullLabel 주입. */
  labelDate?: (item: ReservationDateItem) => string;
  /** ③ 카드 담기 — 담은 상품 미리보기(있으면 1섹션). */
  attachedProducts?: AttachedProduct[];
}) {
  const flow = PURPOSE_FLOW_CONFIG[purpose];

  return (
    <>
      <AiResultPreviewCard
        purpose={purpose}
        videoInfo={videoInfo}
        title={ai.title}
        summary={ai.summary}
        keyPoints={ai.keyPoints}
        ctaLabel={flow.cta}
      />

      {purpose === "예약" && reservation && (
        <div className="mt-4 space-y-2">
          {(reservation.placeName || reservation.placeAddress) && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              {reservation.placeName && (
                <p className="text-sm font-bold tracking-ko text-text-strong">
                  {reservation.placeName}
                </p>
              )}
              {reservation.placeAddress && (
                <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                  {reservation.placeAddress}
                </p>
              )}
              {reservation.hasReserveButton && (
                <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                  예약하기 버튼 → {reservation.destLabel}
                </p>
              )}
            </div>
          )}
          {reservation.dates.length > 0 && (
            <div className="space-y-2 rounded-lg border border-intent-success/30 bg-intent-success-bg p-3">
              <p className="text-xs font-bold tracking-ko text-text-strong">예약 가능 날짜</p>
              <ul className="space-y-2">
                {reservation.dates.slice(0, 2).map((item) => (
                  <li key={item.id}>
                    <p className="text-xs font-semibold tracking-ko text-text-strong">
                      {labelDate ? labelDate(item) : item.id}
                    </p>
                    {item.eventTitle && (
                      <p className="mt-1 text-xs font-medium tracking-ko text-text-strong">
                        {item.eventTitle}
                      </p>
                    )}
                    {item.eventDescription && (
                      <p className="mt-1 text-[11px] font-medium tracking-ko text-text-muted">
                        {item.eventDescription}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {reservation.dates.length > 2 && (
                <p className="text-[11px] font-medium tracking-ko text-text-subtle">
                  외 {reservation.dates.length - 2}개 더 보기
                </p>
              )}
            </div>
          )}
          {!reservation.hasReserveButton && (
            <div className="flex items-start gap-2 rounded-lg border border-intent-danger/30 bg-intent-danger-bg p-4">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-intent-danger" strokeWidth={2} />
              <span className="text-sm font-medium leading-relaxed tracking-ko text-intent-danger">
                예약 버튼 연결이 없어 받은 사람 화면에 예약하기 버튼이 표시되지 않습니다.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ③ 카드 담기 — 담은 상품 미리보기(플랫 리스트, blocks.map 아님). 없으면 미표시. */}
      {attachedProducts && attachedProducts.length > 0 && (
        <div className="mt-4 space-y-2 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-bold tracking-ko text-text-strong">
            담은 상품 {attachedProducts.length}
          </p>
          <ul className="space-y-2">
            {attachedProducts.map((p) => (
              <li key={p.refDropId} className="flex items-center gap-3">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="size-12 shrink-0 rounded-lg bg-bg" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-ko text-text-strong">
                    {p.name}
                  </p>
                  <p className="text-xs font-medium tracking-ko text-text-muted">
                    {p.priceKrw != null ? `${p.priceKrw.toLocaleString("ko-KR")}원` : "가격 미정"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
