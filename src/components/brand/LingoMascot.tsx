/**
 * 링고(Lingo) — LinkDrop의 AI 어시스턴트 아이덴티티 마크
 *
 * 철학: 링크드롭의 대표 심볼인 "물방울(drop)"을 그대로 계승하되,
 *  카툰 캐릭터가 아니라 신뢰감 있는 프리미엄 심볼로 표현.
 *  - 물방울 몸체 = 브랜드 DNA("링크가 떨어져 행동이 되는 순간")
 *  - 은은한 세로 그라데이션 + 유리 광택 = 깊이감·신뢰감
 *  - 내부 코어(반짝임) = 물방울 안에 깃든 AI 지능
 *  - 궤도 링 = '살아 움직이는 어시스턴트' 신호 (절제된 하나)
 *
 * 얼굴/표정 없이 로고 시스템과 한 몸으로 읽히는 단일 벡터(viewBox 0 0 100 100).
 */

type LingoTone = "blue" | "white" | "ink"

const TONE: Record<
  LingoTone,
  { from: string; to: string; core: string; orbit: string; gloss: string; glossOpacity: number }
> = {
  // 흰 배경/밝은 칩 위 — 파란 물방울(그라데이션) + 밝은 코어
  blue: { from: "#3B82F6", to: "#1D4ED8", core: "#FFFFFF", orbit: "#BFDBFE", gloss: "#FFFFFF", glossOpacity: 0.26 },
  // 파란 배경/FAB 위 — 흰 물방울 + 파란 코어
  white: { from: "#FFFFFF", to: "#EAF1FF", core: "#1D4ED8", orbit: "#93B4FB", gloss: "#FFFFFF", glossOpacity: 0.5 },
  // 모노(잉크) — 다크 배경 대비용
  ink: { from: "#232338", to: "#14141F", core: "#EAF1FF", orbit: "#4A4A63", gloss: "#FFFFFF", glossOpacity: 0.12 },
}

// 물방울 몸체 — 뾰족한 위 꼭짓점(50,9) → 반지름 31의 둥근 하단(중심 50,63)
const BODY =
  "M50 9 C50 9 53 20 67 39 C76 51 81 55 81 63 A31 31 0 1 1 19 63 C19 55 24 51 33 39 C47 20 50 9 50 9 Z"

/** 링고 심볼 (배경 투명) */
export function LingoMascot({
  size = 96,
  tone = "blue",
  className,
  title = "링고AI",
  spin = false,
}: {
  size?: number
  tone?: LingoTone
  className?: string
  title?: string
  /** UI-5-T3-L1 — streaming(생각 중) 상태 언어: 궤도 링·노드 회전. 기본 false(기존 소비처 무영향). */
  spin?: boolean
}) {
  const t = TONE[tone]
  const gid = `lingo-grad-${tone}`
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>

      {/* 몸체 (세로 그라데이션으로 깊이감) */}
      <path d={BODY} fill={`url(#${gid})`} />

      {/* 부드러운 유리 광택 (좌상단) */}
      <path
        d="M41 30 C33 39 28 48 28 57 C28 45 34 38 42 29 Z"
        fill={t.gloss}
        opacity={t.glossOpacity}
      />
      <ellipse
        cx="37"
        cy="46"
        rx="5"
        ry="9"
        fill={t.gloss}
        opacity={t.glossOpacity * 0.55}
        transform="rotate(-22 37 46)"
      />

      {/* 궤도 링 — 코어를 감싸는 얇은 타원, 살아있는 AI 신호. L1 — spin = 궤도 그룹 회전(생각 중). */}
      {spin && <style>{`@keyframes lingo-orbit-spin{to{transform:rotate(360deg)}}`}</style>}
      <g style={spin ? { transformOrigin: "53px 64px", animation: "lingo-orbit-spin 1.1s linear infinite" } : undefined}>
        <ellipse
          cx="53"
          cy="64"
          rx="20"
          ry="8.5"
          fill="none"
          stroke={t.orbit}
          strokeWidth={2}
          opacity={0.9}
          transform="rotate(-28 53 64)"
        />
        {/* 궤도 위 작은 노드 */}
        <circle cx="70.5" cy="55.5" r="2.6" fill={t.orbit} />
      </g>

      {/* AI 코어 — 물방울 안에 깃든 지능(정제된 4갈래 반짝임) */}
      <path
        d="M50 49
           C51.2 58.2 52.8 59.8 62 61
           C52.8 62.2 51.2 63.8 50 73
           C48.8 63.8 47.2 62.2 38 61
           C47.2 59.8 48.8 58.2 50 49 Z"
        fill={t.core}
      />
    </svg>
  )
}

/** 링고 아바타 — 칩/FAB용 배경 포함 */
export function LingoAvatar({
  size = 56,
  background = "solid",
  className,
  spin = false,
}: {
  size?: number
  /** solid = 파란 그라데이션 원 + 흰 심볼 / tint = 연한 파란 원 + 파란 심볼 */
  background?: "solid" | "tint"
  className?: string
  /** L1 — 궤도 회전 패스스루(생각 중 상태 언어). */
  spin?: boolean
}) {
  const isSolid = background === "solid"
  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: isSolid
          ? "linear-gradient(160deg, #3B82F6 0%, #1D4ED8 60%, #1E40AF 100%)"
          : "#EFF6FF",
        boxShadow: isSolid ? "0 8px 20px -6px rgba(29,78,216,0.5)" : "inset 0 0 0 1px #DBEAFE",
      }}
      aria-hidden="true"
    >
      <LingoMascot size={size * 0.72} tone={isSolid ? "white" : "blue"} spin={spin} />
    </span>
  )
}
