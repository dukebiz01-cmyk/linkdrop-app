import { useNavigate } from "@tanstack/react-router"
import { LingoOrbMini } from "@/components/lingo/LingoOrbMini"

/**
 * UI-5-T7-F4-14 — 랜딩 히어로 재설계 (Duke 목업 동형 · v0 보존 락 "상단 한정" 해제 승인분).
 * 구 폰 목업(3씬 순환)은 오브 중심 히어로로 교체 — 목적 3종 전달은 하단 PurposeCards 가 담당.
 * CTA 는 기존 /login 유도 경로 재사용(실 OAuth 는 로그인 페이지 담당 — 신규 인증 없음).
 * 연출은 CSS 키프레임만(JS 타이머 0) · prefers-reduced-motion 전체 정지.
 */
export function LandingHero() {
  const navigate = useNavigate()
  const goLogin = () => navigate({ to: "/login" })

  return (
    <section
      className="px-5 pb-8 pt-7 text-center"
      style={{ background: "linear-gradient(170deg, #12233D 0%, #1D4ED8 100%)" }}
    >
      <style>{`
        @keyframes hero-orb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes hero-orb-ripple{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.05);opacity:0}}
        @media (prefers-reduced-motion: reduce){.hero-orb-float,.hero-orb-ripple{animation:none !important}}
      `}</style>

      {/* 배지 */}
      <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[12px] font-bold text-white">
        ✦ 링고AI가 같이 만들어요
      </span>

      {/* 헤드라인(유지) + 부제(신규) */}
      <h1 className="mt-3.5 text-balance text-[26px] font-bold leading-[1.32] tracking-[-0.02em] text-white">
        영상 링크 하나가,
        <br />
        행동하는 카드로
      </h1>
      <p className="mx-auto mt-2.5 max-w-[320px] text-pretty text-[14px] leading-relaxed text-white/75 [word-break:keep-all]">
        말만 하세요 — 정보 알림부터 예약·판매까지 링고가 목적에 맞는 카드로 만들어 드려요
      </p>

      {/* 링고 오브 — LingoOrbMini 공용(스튜디오 49 시각 언어 정본) + 파동 2겹·부유는 히어로 래퍼 담당 */}
      <div className="relative mx-auto mt-6 flex h-[120px] w-[120px] items-center justify-center">
        <span
          aria-hidden
          className="hero-orb-ripple absolute inset-0 rounded-full border-2 border-white/30"
          style={{ animation: "hero-orb-ripple 4.2s ease-out infinite" }}
        />
        <span
          aria-hidden
          className="hero-orb-ripple absolute inset-0 rounded-full border-2 border-white/30"
          style={{ animation: "hero-orb-ripple 4.2s ease-out 2.1s infinite" }}
        />
        <span
          className="hero-orb-float"
          style={{ animation: "hero-orb-float 3.2s ease-in-out infinite" }}
        >
          <LingoOrbMini size={72} tone="white" />
        </span>
      </div>

      {/* CTA 승격 — 카카오 옐로 정본(#FEE500). 기존 /login 유도 흐름 재사용. */}
      <button
        type="button"
        onClick={goLogin}
        className="mt-6 flex h-14 min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#FEE500] text-[16px] font-bold text-[#1A1A1A] transition-transform active:scale-[0.98]"
      >
        💬 카카오로 3초 만에 시작하기
      </button>
      <p className="mt-2.5 text-[12.5px] text-white/70">
        <button
          type="button"
          onClick={goLogin}
          className="font-bold text-white underline underline-offset-2"
        >
          구글로 시작
        </button>
        {" · 카드 제작은 무료예요"}
      </p>

      {/* 3단계 1줄 — 하단 HowItWorks 원문은 그대로 유지(중복 아님 · 히어로 요약판) */}
      <p className="mt-5 text-[12.5px] font-semibold text-white/80">
        ① 링크 넣기 → ② 링고와 대화 → ③ 카톡 공유
      </p>
    </section>
  )
}
