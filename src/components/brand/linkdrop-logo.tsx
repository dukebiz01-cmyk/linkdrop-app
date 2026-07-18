/**
 * LinkDrop 브랜드 로고 시스템
 *
 * 컨셉: "Drop의 D 안에 물방울이 담긴다"
 *  - 볼드 'D' 레터폼 = LinkDrop의 대표 이니셜
 *  - 카운터(D 안쪽 빈 공간) = 물방울(drop) → 링크가 '떨어져' 카드가 되는 순간
 *
 * 심볼은 단일 evenodd 패스(D에서 물방울을 비워낸 형태)로,
 * 색 하나만 지정하면 어떤 배경에서도 적응하며 16px에서도 또렷합니다.
 * (viewBox 0 0 100 100, 시각 중심 ≈ 50,50)
 */

// 볼드 'D' 외곽 — 왼쪽 세로 획(둥근 모서리) + 오른쪽 반원 볼(bowl)
// 좌 x=22, 우 x=78(볼 반지름 32), 상 y=18, 하 y=82
const D_OUTER =
  "M28 18 H46 A32 32 0 0 1 46 82 H28 A6 6 0 0 1 22 76 V24 A6 6 0 0 1 28 18 Z"

// 물방울 카운터 — D 내부 광학 중심(x≈53, y=50)에 상하좌우 균형 배치
// 세로: 위 여백(30-18=12) = 아래 여백(82-70=12), 카운터 세로 중심 = 50
// 가로: 왼쪽 세로획을 두껍게(≈19) 남기고 오른쪽 볼 여백(≈13)과 균형
const DROP_COUNTER =
  "M53 30 C56 40 65 49 65 58 A12 12 0 1 1 41 58 C41 49 50 40 53 30 Z"

const GLYPH_PATH = `${D_OUTER} ${DROP_COUNTER}`

/** 심볼 단독 (배경 투명) */
export function LinkDropSymbol({
  size = 100,
  color = "#1D4ED8",
  className,
  title = "LinkDrop",
}: {
  size?: number
  color?: string
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <path fillRule="evenodd" clipRule="evenodd" d={GLYPH_PATH} fill={color} />
    </svg>
  )
}

/** 앱 아이콘 (둥근 사각형 배경 + 마스커블 세이프: 심볼이 안쪽 80% 안에 위치) */
export function LinkDropAppIcon({
  size = 512,
  bg = "#1D4ED8",
  glyphColor = "#FFFFFF",
  className,
  rounded = true,
}: {
  size?: number
  bg?: string
  glyphColor?: string
  className?: string
  rounded?: boolean
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="LinkDrop app icon"
    >
      <rect x="0" y="0" width="100" height="100" rx={rounded ? 22 : 0} fill={bg} />
      {/* 심볼을 중앙 정렬 후 70%로 축소 → 핵심 형상이 안쪽 80% 세이프존 내 */}
      <g transform="translate(50 50) scale(0.7) translate(-50 -50)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d={GLYPH_PATH}
          fill={glyphColor}
        />
      </g>
    </svg>
  )
}

type LockupTone = "color" | "ink" | "white"

const TONE = {
  color: { link: "#1A1A2E", drop: "#1D4ED8", symbol: "#1D4ED8" },
  ink: { link: "#1A1A2E", drop: "#1A1A2E", symbol: "#1A1A2E" },
  white: { link: "#FFFFFF", drop: "#FFFFFF", symbol: "#FFFFFF" },
} as const

/** 가로 락업: 심볼 + 워드마크 (Latin / Korean) */
export function LinkDropLockup({
  script = "latin",
  tone = "color",
  symbolSize = 44,
  className,
}: {
  script?: "latin" | "korean"
  tone?: LockupTone
  symbolSize?: number
  className?: string
}) {
  const t = TONE[tone]
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LinkDropSymbol size={symbolSize} color={t.symbol} />
      {script === "latin" ? (
        <span
          className="font-bold tracking-[-0.02em]"
          style={{ fontSize: symbolSize * 0.62, lineHeight: 1 }}
        >
          <span style={{ color: t.link }}>Link</span>
          <span style={{ color: t.drop }}>Drop</span>
        </span>
      ) : (
        <span
          className="font-bold tracking-[-0.03em]"
          style={{ fontSize: symbolSize * 0.62, lineHeight: 1 }}
        >
          <span style={{ color: t.link }}>링크</span>
          <span style={{ color: t.drop }}>드롭</span>
        </span>
      )}
    </div>
  )
}
