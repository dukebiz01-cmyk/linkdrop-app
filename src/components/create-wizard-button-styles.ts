import { cn } from "@/lib/utils";

/** v0 Primary CTA — 검정 (#0A0A0A). teal 은 accent 전용. 텍스트는 흰색 유지. */
export const WIZARD_PRIMARY_BUTTON_CLASS = cn(
  "min-h-[52px] h-[52px] w-full rounded-2xl border-0 px-6 text-base font-bold tracking-ko text-white",
  "bg-[#0A0A0A] transition-colors duration-150 ease-out",
  "hover:bg-[#171717]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#A3A3A3] disabled:opacity-100",
  "disabled:hover:bg-[#E5E7EB]",
);

/** v0 Secondary CTA — 흰 배경 + 연한 보더. */
export const WIZARD_SECONDARY_BUTTON_CLASS = cn(
  "inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-6",
  "text-sm font-bold tracking-ko text-[#111111] transition-colors duration-150 ease-out",
  "hover:border-[#D4D4D4] hover:bg-[#FAFAFA]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#A3A3A3] disabled:opacity-100",
);
