import { useNavigate } from "@tanstack/react-router"
import { LinkDropLockup } from "@/components/brand/linkdrop-logo"
import { KakaoButton } from "./kakao-button"
import { GoogleButton } from "./google-button"
import { LandingHero } from "./landing-hero"
import { TrustFooter } from "./trust-footer"

/**
 * UI-5-T7-L6 — 랜딩 v6 (v0(51) app/landing/page.tsx 전면 이식 · 디자인·기능 보존 락).
 * (51) 4단 구조: 헤더 → 히어로(AI 변환 목업) → CTA → 미니 푸터.
 * how-it-works·purpose-cards 는 (51) 조립부 미사용 — 이식 제외(구 (50) 사본도 제거).
 * 어댑트: ① metadata → 라우트 head 담당(index.tsx — 동일 title/description 기존재)
 * ② Kakao·Google = 현행 실 OAuth 진입(onClick → /login 유도 — v5 계약 동형)
 * ③ 헤더 로그인 = v0 원문 그대로 #start 앵커(CTA 구역 스크롤 — 기능 보존).
 * 디바이스 프레임(min-[440px] 라운드 셸)·앰비언트 배경 원문 유지. landing-v5 무삭제 보존.
 */
export function LandingPageV6() {
  const navigate = useNavigate()
  const goLogin = () => navigate({ to: "/login" })
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-[#EAF0F9] to-[#E4EAF3] font-sans text-[#0F172A]">
      {/* 데스크톱 앰비언트 배경 — 여백을 의도적인 캔버스로 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-120px] h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-[#CFE0FB] opacity-60 blur-[130px]" />
        <div className="absolute bottom-[-140px] left-1/2 h-[360px] w-[560px] -translate-x-1/2 rounded-full bg-[#DDE6F5] opacity-70 blur-[120px]" />
      </div>

      {/* 앱 컬럼 — 여백이 생기는 화면에서는 디바이스 프레임처럼 표현 */}
      <div className="relative mx-auto min-h-dvh w-full max-w-[400px] bg-[#F8FAFC] min-[440px]:my-6 min-[440px]:min-h-0 min-[440px]:overflow-hidden min-[440px]:rounded-[32px] min-[440px]:border min-[440px]:border-white/80 min-[440px]:shadow-[0_36px_90px_-24px_rgba(15,23,42,0.4)]">
        {/* 1. 헤더 — 좌측 로고 + 로그인으로 상단 균형 */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E8EDF3]/70 bg-white/80 px-5 py-3 backdrop-blur-md">
          <LinkDropLockup script="korean" tone="color" symbolSize={26} />
          <a
            href="#start"
            className="rounded-full border border-[#E2E8F0] bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-[#334155] transition-colors hover:bg-[#F1F5F9]"
          >
            로그인
          </a>
        </header>

        {/* 2. 히어로 — AI 강조 + 상단 그라데이션 밴드로 무게감 */}
        <div className="relative overflow-hidden bg-gradient-to-b from-[#EFF4FF] via-[#F5F8FE] to-[#F8FAFC]">
          {/* 은은한 상단 광원 */}
          <div
            className="pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#DBEAFE] opacity-60 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <LandingHero />
          </div>
        </div>

        {/* 3. CTA — 로그인 진입 */}
        <section id="start" className="px-5 pb-8 pt-7">
          <div className="flex flex-col gap-2.5">
            <KakaoButton size="lg" onClick={goLogin} />
            <GoogleButton size="lg" onClick={goLogin} />
          </div>
          <p className="mt-3 text-center text-[12.5px] text-[#94A3B8]">
            가입 3초 · 카드 제작은 무료예요
          </p>
        </section>

        {/* 4. 미니 푸터 */}
        <TrustFooter />
      </div>
    </div>
  )
}
