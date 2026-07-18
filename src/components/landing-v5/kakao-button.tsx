import type React from "react"

/**
 * 카카오로 시작하기 버튼 — 카카오 공식 옐로우(#FEE500) + 검은 텍스트.
 * onClick으로 /login 유도(실 OAuth는 로그인 페이지 담당).
 */
export function KakaoButton({
  className,
  size = "md",
  onClick,
}: {
  className?: string
  size?: "md" | "lg"
  onClick?: () => void
}) {
  const pad = size === "lg" ? "h-14 text-[16px]" : "h-12 text-[15px]"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex ${pad} w-full items-center justify-center gap-2 rounded-[14px] bg-[#FEE500] font-bold text-[#1A1A1A] transition-transform active:scale-[0.98] ${className ?? ""}`}
    >
      <KakaoBubble className="h-[18px] w-[18px]" />
      카카오로 시작하기
    </button>
  )
}

function KakaoBubble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="#1A1A1A">
      <path d="M12 3C6.9 3 2.75 6.3 2.75 10.37c0 2.62 1.74 4.92 4.36 6.22-.19.68-.7 2.52-.8 2.91-.13.49.18.48.38.35.16-.1 2.5-1.7 3.52-2.39.58.08 1.18.13 1.79.13 5.1 0 9.25-3.3 9.25-7.37S17.1 3 12 3Z" />
    </svg>
  )
}
