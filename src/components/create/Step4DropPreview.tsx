import { Sparkles } from "lucide-react";
import {
  PURPOSE_FLOW_CONFIG,
  type AiPreviewData,
  type AttachedProduct,
  type ReservationDateItem,
  type ReservationSummary,
  type VideoInfo,
} from "@/components/create/types";
import { StepBadge } from "@/components/create/StepBadge";
import { DropPreviewCard } from "@/components/create/DropPreviewCard";
import type { DropPurpose } from "@/lib/types";

// AiResultPreviewCard 는 DropPreviewCard.tsx 로 이동 — 기존 import 경로 호환 위해 재노출.
export { AiResultPreviewCard } from "@/components/create/DropPreviewCard";

export function Step4DropPreview({
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

  // phase1 FIX1: 외부 <main> 제거. Step 3 (Step4+Step5 병합) 에서 중복 <main> 발생
  // → 두 flex-1 컨테이너가 viewport 분점하며 빈 화면. wizard 가 단일 스크롤 컨테이너
  // (페이지 자체)로 처리하도록 단순 <section> 으로 평탄화.
  return (
    <section className="px-6 pt-2">
      <StepBadge n={3} />
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-ko text-text-strong">
          AI가 받는 분 입장에서 정리했어요
        </h1>
        <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-xs font-semibold text-accent">
          <Sparkles className="size-3" strokeWidth={2} />
          AI
        </span>
      </div>
      <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">{flow.description}</p>

      <DropPreviewCard
        purpose={purpose}
        ai={ai}
        videoInfo={videoInfo}
        reservation={reservation}
        labelDate={labelDate}
        attachedProducts={attachedProducts}
      />

      <div className="mt-4 rounded-lg bg-surface p-3">
        <p className="text-xs font-semibold uppercase tracking-ko text-text-subtle">
          공유 문구 제안
        </p>
        <p className="mt-1 text-sm font-medium italic tracking-ko text-text-muted">
          &quot;{ai.suggestedShareText}&quot;
        </p>
      </div>
    </section>
  );
}
