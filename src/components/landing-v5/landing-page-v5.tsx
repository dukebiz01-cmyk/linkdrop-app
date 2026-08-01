import { useNavigate } from "@tanstack/react-router"
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
      {/* UI-5-T7-F6-6 — 헤더를 560 컨테이너 밖 풀폭 래퍼로: 배경·보더는 화면 풀폭, 콘텐츠만 560
          (데스크톱에서 border-b 가 560 지점에서 끊기던 어긋남 해소). 색·문구·버튼 무변. */}
      <header className="sticky top-0 z-20 border-b border-[#E8EDF3] bg-[#F8FAFC]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-[560px] items-center justify-between px-5">
          {/* 좌: 브랜드 락업 */}
          <LinkDropLockup script="korean" tone="color" symbolSize={26} />
          {/* 우: 로그인 필 버튼 */}
          <button
            type="button"
            onClick={goLogin}
            className="flex h-9 items-center rounded-full border border-[#CBD5E1] bg-white px-4 text-[13px] font-bold text-[#0F172A] transition-transform active:scale-[0.97]"
          >
            로그인
          </button>
        </div>
      </header>
      {/* UI-5-T7-F5-2 — 페이지 단일 컨테이너 560 통일(히어로·3단계·목적카드·하단CTA 동시 정렬). */}
      <div className="mx-auto w-full max-w-[560px] bg-[#F8FAFC]">
        <LandingHero />
        <HowItWorks />
        <PurposeCards />

        <section className="px-5 pb-6 pt-2">
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
