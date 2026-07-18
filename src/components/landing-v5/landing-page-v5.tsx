import { useNavigate } from "@tanstack/react-router"
import { Star } from "lucide-react"
import { LinkDropLockup } from "@/components/brand/linkdrop-logo"
import { KakaoButton } from "./kakao-button"
import { GoogleButton } from "./google-button"
import { LandingHero } from "./landing-hero"
import { HowItWorks } from "./how-it-works"
import { PurposeCards } from "./purpose-cards"

/**
 * LAND-1 — 비로그인 루트 랜딩 v5 (v0 48 정본 이식).
 * 푸터 없음: 법정 푸터는 __root.tsx 전역 BusinessFooter가 담당(이중 렌더 금지).
 * CTA 전부 /login 유도(기존 흐름 보존).
 */
export function LandingPageV5() {
  const navigate = useNavigate()
  const goLogin = () => navigate({ to: "/login" })
  return (
    <div className="min-h-dvh bg-[#F8FAFC] font-sans text-[#0F172A]">
      <div className="mx-auto w-full max-w-[390px] bg-[#F8FAFC]">
        <header className="sticky top-0 z-20 flex items-center justify-center border-b border-[#E8EDF3] bg-[#F8FAFC]/90 px-5 py-3.5 backdrop-blur-sm">
          <LinkDropLockup script="korean" tone="color" symbolSize={30} />
        </header>

        <LandingHero />
        <HowItWorks />
        <PurposeCards />

        <section className="px-5 pb-6 pt-5">
          <p className="mb-3 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-[#64748B]">
            <Star className="h-3.5 w-3.5 fill-[#1D4ED8] text-[#1D4ED8]" strokeWidth={0} />
            괴산·증평·진천 파트너 매장과 함께하고 있어요
          </p>
          <div className="flex flex-col gap-2.5">
            <KakaoButton size="lg" onClick={goLogin} />
            <GoogleButton size="lg" onClick={goLogin} />
          </div>
          <p className="mt-2.5 text-center text-[12.5px] text-[#94A3B8]">
            가입은 카카오·구글로 간단하게 · 카드 제작은 무료예요
          </p>
        </section>
      </div>
    </div>
  )
}
