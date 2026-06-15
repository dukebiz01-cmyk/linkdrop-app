import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import {
  WIZARD_PRIMARY_BUTTON_CLASS,
  WIZARD_SECONDARY_BUTTON_CLASS,
} from "@/components/create-wizard-button-styles";
import { ErrorMessage } from "@/components/ErrorMessage";
import type { DropPurpose } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Step 5 — 카카오톡 공유 미리보기에 필요한 카드 요약 데이터. */
export interface WizardSharePreviewData {
  video: {
    thumbnailUrl: string;
    title: string;
    channelName: string;
    duration: string;
    platformLabel: string;
  };
  purpose: DropPurpose;
  aiTitle: string;
  makerMessage?: string;
  partnerName?: string;
  /** 예약 목적 — 장소·예약 버튼·예약 가능 날짜 요약 (받는 사람 화면 미리보기용) */
  reservation?: {
    placeName: string;
    destLabel: string;
    hasReserveButton: boolean;
    /** main = "5월 24일 토 · 1박 가능 · 잔여 2자리", event = 강조 문구, memo = 짧은 메모(선택) */
    dates: { main: string; event?: string; memo?: string }[];
  };
}

export interface WizardSharePreviewProps {
  data: WizardSharePreviewData;
  shareUrl: string;
  onKakaoShare: () => Promise<void>;
  onCopyLink: () => Promise<void>;
  /** "홈으로 가기" — wizard 종료 + /home. 저장은 트리거하지 않는다. */
  onGoHome: () => void;
  shareError?: string | null;
  shareFeedback?: string | null;
  className?: string;
}

const PURPOSE_CHIP: Record<DropPurpose, string> = {
  정보: "bg-intent-info-bg text-intent-info",
  쿠폰: "bg-intent-warning-bg text-intent-warning",
  예약: "bg-intent-success-bg text-intent-success",
  구매: "bg-surface text-text-strong",
  상담: "bg-intent-danger-bg text-intent-danger",
};

/** Step 5 미리보기 카드의 목적별 행동(CTA) 라벨 — 공유 직전 최종 행동 확인용. */
const PURPOSE_CTA: Record<DropPurpose, string> = {
  정보: "자세히 보기",
  쿠폰: "쿠폰 받기",
  예약: "예약하기",
  구매: "상품 보기",
  상담: "상담 신청",
};

/**
 * 카카오톡 대화창 말풍선 형태의 피드 카드 미리보기(친구가 카톡에서 볼 모습).
 * Step5(스튜디오/구매)와 quick 미리보기가 공유. 발송 CTA 없음 — 순수 미리보기.
 * makerMessage 가 한 줄(라이브) — 입력이 바뀌면 description 도 실시간 반영된다.
 */
export function KakaoBubblePreview({
  data,
  shareUrl,
}: {
  data: WizardSharePreviewData;
  shareUrl: string;
}) {
  const description = [data.purpose, data.partnerName, data.makerMessage?.trim()]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
      <div className="flex items-center justify-between border-b border-border bg-bg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEE500]">
            <MessageCircle className="h-4 w-4 text-[#3C1E1E]" strokeWidth={2} />
          </span>
          <span className="text-sm font-semibold tracking-ko text-text-strong">카카오톡</span>
        </div>
        <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-semibold tracking-ko text-text-muted">
          미리보기
        </span>
      </div>

      <div className="p-4">
        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          {data.video.thumbnailUrl && (
            <div className="relative aspect-video w-full bg-surface">
              <img src={data.video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
                {data.video.duration}
              </span>
            </div>
          )}
          <div className="space-y-2 p-4">
            <span
              className={cn(
                "inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold tracking-ko",
                PURPOSE_CHIP[data.purpose],
              )}
            >
              {data.purpose}
            </span>
            <p className="text-base font-bold tracking-ko text-text-strong">{data.aiTitle}</p>
            {description && (
              <p className="line-clamp-2 text-sm font-medium tracking-ko text-text-muted">
                {description}
              </p>
            )}
            <p className="text-xs font-medium text-text-subtle">{data.video.channelName}</p>
            {data.reservation?.placeName && (
              <p className="text-xs font-semibold tracking-ko text-text-strong">
                {data.reservation.placeName}
              </p>
            )}
            {data.reservation && data.reservation.dates.length > 0 && (
              <div className="space-y-2 rounded-lg border border-intent-success/30 bg-intent-success-bg p-3">
                <p className="text-xs font-bold tracking-ko text-text-strong">예약 가능 날짜</p>
                <ul className="space-y-2">
                  {data.reservation.dates.slice(0, 2).map((d, i) => (
                    <li key={`${d.main}-${i}`}>
                      <p className="text-xs font-semibold tracking-ko text-text-strong">{d.main}</p>
                      {d.event && (
                        <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                          {d.event}
                        </p>
                      )}
                      {d.memo && (
                        <p className="mt-1 text-[11px] font-medium tracking-ko text-text-subtle">
                          {d.memo}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {data.reservation.dates.length > 2 && (
                  <p className="text-[11px] font-medium tracking-ko text-text-subtle">
                    외 {data.reservation.dates.length - 2}개 더 보기
                  </p>
                )}
              </div>
            )}
            {/* 받는 사람 화면의 목적별 행동(CTA) preview — 작은 라벨, 실제 버튼 아님.
                예약 목적에서 버튼 연결이 없으면 받는 사람 화면에 버튼이 없으므로 숨긴다. */}
            {!(data.reservation && !data.reservation.hasReserveButton) && (
              <div>
                <span className="inline-flex items-center rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold tracking-ko text-text-strong">
                  {PURPOSE_CTA[data.purpose]}
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 truncate font-mono text-xs text-text-subtle">{shareUrl}</p>
      </div>
    </div>
  );
}

/**
 * 카카오톡 대화창에 보이는 말풍선 형태의 공유 미리보기 + 공유 CTA.
 * WHY: Step 5에서 “보내기 전에 친구 화면”을 보여주면 이탈률이 줄어든다 (v3 UX 원칙).
 */
export function WizardSharePreview({
  data,
  shareUrl,
  onKakaoShare,
  onCopyLink,
  onGoHome,
  shareError,
  shareFeedback,
  className,
}: WizardSharePreviewProps) {
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);

  async function handleKakao() {
    setKakaoLoading(true);
    try {
      await onKakaoShare();
    } finally {
      setKakaoLoading(false);
    }
  }

  async function handleCopy() {
    setCopyLoading(true);
    try {
      await onCopyLink();
    } finally {
      setCopyLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-1 flex-col", className)}>
      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
        <h1 className="mt-2 text-2xl font-extrabold tracking-ko text-text-strong">
          공유 전에 카드를 확인하세요
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
          받는 사람에게 보일 영상, 설명, 버튼을 확인한 뒤
          <br />
          카카오톡이나 링크로 공유하세요.
        </p>

        {/* Kakao-style feed card mock — 받는 사람이 카톡에서 보게 될 모습 미리보기. */}
        <div className="mt-8">
          <KakaoBubblePreview data={data} shareUrl={shareUrl} />
        </div>

        {shareFeedback && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-text-strong">
            <Check className="size-4 text-intent-success" strokeWidth={2} />
            {shareFeedback}
          </p>
        )}
        <ErrorMessage message={shareError} className="mt-4" />
      </div>

      <div className="sticky bottom-0 space-y-3 border-t border-border bg-bg px-6 py-4">
        <ActionButton
          type="button"
          onClick={handleKakao}
          disabled={kakaoLoading}
          className={cn(WIZARD_PRIMARY_BUTTON_CLASS, "gap-2")}
        >
          <MessageCircle className="size-5" strokeWidth={2} />
          {kakaoLoading ? "보내는 중…" : "친구에게 보내기"}
        </ActionButton>
        <button
          type="button"
          onClick={handleCopy}
          disabled={copyLoading}
          className={cn(WIZARD_SECONDARY_BUTTON_CLASS, "gap-2 disabled:opacity-50")}
        >
          <Copy className="size-4" strokeWidth={2} />
          {copyLoading ? "복사 중…" : "링크 복사하기"}
        </button>
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex min-h-[44px] w-full items-center justify-center text-sm font-medium tracking-ko text-text-muted transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          홈으로 가기
        </button>
      </div>
    </div>
  );
}
