import type React from "react"

/**
 * 구글로 시작하기 버튼 — 구글 브랜드 가이드(흰 배경 + 1px 테두리 + 컬러 G 로고).
 * onClick으로 /login 유도(실 OAuth는 로그인 페이지 담당).
 */
export function GoogleButton({
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
      className={`flex ${pad} w-full items-center justify-center gap-2 rounded-[14px] border border-[#E2E8F0] bg-white font-bold text-[#0F172A] transition-transform active:scale-[0.98] ${className ?? ""}`}
    >
      <GoogleG className="h-[18px] w-[18px]" />
      구글로 시작하기
    </button>
  )
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.86Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.63H1.29A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.96 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.98 3.09C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  )
}
