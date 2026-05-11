import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * 검정 메인 액션 버튼. 디자인 철학 #6: 화면당 1개만.
 */
export const ActionButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      data-action-button
      className={cn(
        "inline-flex min-h-[44px] min-w-[44px] items-center justify-center",
        "rounded-lg bg-action px-6 py-3 text-sm font-semibold text-action-foreground",
        "transition-colors hover:bg-text-strong/90",
        "disabled:bg-text-disabled disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
ActionButton.displayName = "ActionButton";