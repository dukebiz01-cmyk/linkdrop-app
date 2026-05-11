import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Intent = "info" | "success" | "warning" | "danger";

const styles: Record<Intent, string> = {
  info: "bg-intent-info-bg text-intent-info",
  success: "bg-intent-success-bg text-intent-success",
  warning: "bg-intent-warning-bg text-intent-warning",
  danger: "bg-intent-danger-bg text-intent-danger",
};

export function IntentStrip({
  intent = "info",
  children,
}: {
  intent?: Intent;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg px-4 py-3 text-sm font-medium",
        styles[intent],
      )}
    >
      {children}
    </div>
  );
}