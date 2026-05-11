import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * 모든 리스트/검색 결과 화면에 반드시 사용.
 * 디자인 철학 #10: "모든 리스트 화면에 Empty State 있음".
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-text-strong">{title}</h3>
      {description && (
        <p className="mt-2 text-sm font-medium text-text-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}