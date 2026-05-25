import type { CardStatus } from "./types";

const STATUS_LABEL: Record<CardStatus, { label: string; className: string }> = {
  ai_suggested: { label: "추천", className: "bg-blue-50 text-blue-600" },
  completed: { label: "완료", className: "bg-slate-100 text-slate-600" },
  needs_confirmation: { label: "연결 필요", className: "bg-amber-50 text-amber-700" },
  hidden: { label: "수신자 숨김", className: "bg-slate-100 text-slate-500" },
};

export function StatusBadge({ status }: { status: CardStatus }) {
  const { label, className } = STATUS_LABEL[status];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-ko ${className}`}
    >
      {label}
    </span>
  );
}
