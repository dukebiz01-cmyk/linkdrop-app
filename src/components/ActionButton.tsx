import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * 메인 액션 버튼 (딥 틸 bg-action). 디자인 철학 #6: 화면당 1개만.
 */
export const ActionButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-action-button
        className={cn(
          "inline-flex min-h-[44px] min-w-[44px] items-center justify-center",
          "rounded-lg bg-action px-6 py-3 text-sm font-semibold text-action-foreground",
          "transition-colors duration-150 ease-out hover:bg-[#0A3D35]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          "disabled:bg-text-disabled disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
ActionButton.displayName = "ActionButton";
