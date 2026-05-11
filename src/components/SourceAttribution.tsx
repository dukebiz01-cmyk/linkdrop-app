import { cn } from "@/lib/utils";

export type SourceMode = "user_submitted" | "partner_official" | "creator_claimed";

/**
 * 영상 출처 표기. 플랫폼·채널·권리 상태 노출.
 * top: 카드 상단 한 줄 / bottom: 카드 하단 상세
 */
export function SourceAttribution({
  provider,
  authorName,
  sourceMode = "user_submitted",
  position = "top",
  className,
}: {
  provider: "youtube" | "instagram" | "manual";
  authorName?: string | null;
  sourceMode?: SourceMode;
  position?: "top" | "bottom";
  className?: string;
}) {
  const platformLabel =
    provider === "youtube"
      ? "YouTube"
      : provider === "instagram"
        ? "Instagram"
        : "직접 입력";

  const modeLabel =
    sourceMode === "partner_official"
      ? "공식 채널"
      : sourceMode === "creator_claimed"
        ? "창작자 인증"
        : "사용자 공유";

  if (position === "top") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 text-xs font-medium text-text-muted",
          className,
        )}
      >
        <span className="font-semibold text-text-strong">{platformLabel}</span>
        {authorName && (
          <>
            <span aria-hidden>·</span>
            <span>{authorName}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{modeLabel}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border px-4 py-3 text-xs font-medium text-text-muted",
        className,
      )}
    >
      <p className="font-semibold text-text-strong">{platformLabel}</p>
      {authorName && <p className="mt-1">{authorName}</p>}
      <p className="mt-1">{modeLabel}</p>
    </div>
  );
}
