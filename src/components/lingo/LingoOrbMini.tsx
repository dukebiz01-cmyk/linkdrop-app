// UI-5-T7-F4-9 — 링고 신오브 미니어처(홈 표면 전용): 스튜디오 49 오브 시각 언어(링고 블루
//   #1D4ED8 정본 · F3-9 연출 문법 — CSS 키프레임·JS 타이머 0 · prefers-reduced-motion 정지)의
//   축소 정적판 + 숨쉬기 1종. 복제 방식 = 49 무접촉(오브 정본 진화 시 이 파일만 따라간다).
//   홈 구 Sparkles 아이콘 대체 전용(T-7 선행분) — 스튜디오 오브(마이크 기능체)와 역할 무관.
export function LingoOrbMini({
  size = 16,
  tone = "blue",
  className,
}: {
  size?: number;
  /** blue = 밝은 배경 위(기본) / white = 링고 블루 칩 등 짙은 배경 위. */
  tone?: "blue" | "white";
  className?: string;
}) {
  const gradient =
    tone === "blue"
      ? "radial-gradient(circle at 32% 30%, #93C5FD 0%, #2563EB 45%, #1D4ED8 100%)"
      : "radial-gradient(circle at 32% 30%, #FFFFFF 0%, #DBEAFE 55%, #BFDBFE 100%)";
  const glow =
    tone === "blue" ? "0 0 6px rgba(29,78,216,0.45)" : "0 0 6px rgba(255,255,255,0.55)";
  return (
    <span
      className={className}
      style={{ width: size, height: size, display: "inline-flex", flexShrink: 0 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes lingo-orb-mini-breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.9);opacity:.85}}
        @media (prefers-reduced-motion: reduce){.lingo-orb-mini{animation:none !important}}
      `}</style>
      <span
        className="lingo-orb-mini"
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "9999px",
          background: gradient,
          boxShadow: glow,
          animation: "lingo-orb-mini-breathe 2.4s ease-in-out infinite",
        }}
      />
    </span>
  );
}
