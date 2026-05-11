import { cn } from "@/lib/utils";

/**
 * 광고 표기 배너 (한국 표시광고법 — 경제적 이해관계 고지).
 * requires_disclosure intent에서 카드 상단·공유 화면에 노출.
 */
export function AdDisclosure({
  variant = "banner",
  className,
}: {
  variant?: "banner" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-lg border border-border px-2 py-1",
          "text-[11px] font-semibold tracking-tight text-text-muted",
          className,
        )}
      >
        광고
      </span>
    );
  }
  return (
    <div
      role="note"
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3",
        className,
      )}
    >
      <p className="text-xs font-semibold tracking-tight text-text-strong">
        광고
      </p>
      <p className="text-xs font-medium text-text-muted">
        파트너로부터 보상을 받을 수 있어요
      </p>
    </div>
  );
}
