import { cn } from "@/lib/utils";

/**
 * 공개/비공개 토글 — Step5 공유 화면(studio·quick 공통).
 * onToggle 이 없으면 렌더하지 않는다(소비처의 조건부 노출 유지).
 * 공개(true) → 탐색 피드 노출, 비공개(false, 기본) → 받은 사람만 링크 열람.
 */
export function VisibilityToggle({
  isPublic,
  onToggle,
}: {
  isPublic?: boolean;
  onToggle?: (next: boolean) => void;
}) {
  if (!onToggle) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold tracking-ko text-text-strong">탐색에 공개</p>
        <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
          공개하면 탐색 피드에 올라가 누구나 발견할 수 있어요. 비공개는 받은 사람만 링크로 열람돼요.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(isPublic)}
        aria-label="탐색에 공개"
        onClick={() => onToggle(!isPublic)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2",
          isPublic ? "bg-[#0A0A0A]" : "bg-border",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white transition-transform",
            isPublic ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
