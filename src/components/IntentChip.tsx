import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Intent = "info" | "success" | "warning" | "danger";

const styles: Record<Intent, string> = {
  info: "bg-intent-info-bg text-intent-info",
  success: "bg-intent-success-bg text-intent-success",
  warning: "bg-intent-warning-bg text-intent-warning",
  danger: "bg-intent-danger-bg text-intent-danger",
};

export function IntentChip({
  intent = "info",
  children,
}: {
  intent?: Intent;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold",
        styles[intent],
      )}
    >
      {children}
    </span>
  );
}