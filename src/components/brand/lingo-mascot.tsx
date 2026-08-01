/**
 * 링고(Lingo) — LinkDrop의 AI 어시스턴트 아이덴티티 마크
 *
 * 철학: '램프의 요정 지니'처럼 링고가 피어오르는 형상.
 *  - 둥근 머리·몸체 = 친근한 AI 요정의 존재감
 *  - 아래로 감기는 연기 꼬리 = 램프에서 소환되어 나타나는 순간
 *  - 중앙 스파클 = 생성형 AI의 관용 시그널(Gemini·v0·Notion AI류)
 *  - 스파클 뒤 발광(glow) = '지능이 빛난다'는 깊이감·프리미엄
 *
 * 요소를 절제해 로고 시스템과 한 몸으로 읽히는 단일 벡터(viewBox 0 0 100 100).
 */

type LingoTone = "blue" | "white" | "ink"

const TONE: Record<
  LingoTone,
  { from: string; to: string; core: string; spark: string; glow: string; gloss: string; glossOpacity: number }
> = {
  // 흰 배경/밝은 칩 위 — 파란 물방울(그라데이션) + 흰 스파클
  blue: { from: "#3B82F6", to: "#1D4ED8", core: "#FFFFFF", spark: "#BFDBFE", glow: "#93C5FD", gloss: "#FFFFFF", glossOpacity: 0.22 },
  // 파란 배경/FAB 위 — 흰 물방울 + 파란 스파클
  white: { from: "#FFFFFF", to: "#E8F0FF", core: "#1D4ED8", spark: "#3B82F6", glow: "#60A5FA", gloss: "#FFFFFF", glossOpacity: 0.5 },
  // 모노(잉크) — 다크 배경 대비용
  ink: { from: "#232338", to: "#14141F", core: "#EAF1FF", spark: "#6B6B86", glow: "#3A3A52", gloss: "#FFFFFF", glossOpacity: 0.1 },
}

// 지니 몸체 — 둥근 머리 돔(중심 51,37) + 꼬리가 왼쪽으로 흐르며 끝이 살짝 감기는 연기 실루엣
// 정중앙 뾰족 꼬리(=지도 핀)를 피하기 위해 하단을 비대칭으로 흘림
const BODY =
  "M53 8 C71 8 83 23 83 40 C83 54 73 62 64 71 C58 77 53 83 48 88 C45 91 41.5 90.5 40.5 86.5 C39.5 82.5 43 80 45 75 C40 68 28 62 23 54 C20 49 19 44 19 40 C19 23 35 8 53 8 Z"

// 4갈래 스파클(오목한 별) 생성기 — 중심(cx,cy), 뾰족 끝까지 반지름 r
// ratio: 가로/세로 균형 (1=정방형), waist: 허리 오목함(작을수록 날카로움)
function sparkle(cx: number, cy: number, r: number, waist = 0.12) {
  const w = r * waist
  return (
    `M${cx} ${cy - r} ` +
    `C${cx + w} ${cy - w} ${cx + w} ${cy - w} ${cx + r} ${cy} ` +
    `C${cx + w} ${cy + w} ${cx + w} ${cy + w} ${cx} ${cy + r} ` +
    `C${cx - w} ${cy + w} ${cx - w} ${cy + w} ${cx - r} ${cy} ` +
    `C${cx - w} ${cy - w} ${cx - w} ${cy - w} ${cx} ${cy - r} Z`
  )
}

/** 링고 심볼 (배경 투명) */
export function LingoMascot({
  size = 96,
  tone = "blue",
  className,
  title = "링고AI",
}: {
  size?: number
  tone?: LingoTone
  className?: string
  title?: string
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
        {/* 스파클 뒤 발광 */}
        <radialGradient id={`${gid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={t.glow} stopOpacity={0.9} />
          <stop offset="0.55" stopColor={t.glow} stopOpacity={0.28} />
          <stop offset="1" stopColor={t.glow} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* 몸체 (세로 그라데이션으로 깊이감) */}
      <path d={BODY} fill={`url(#${gid})`} />

      {/* 절제된 유리 광택 — 돔 좌상단 곡률과 나란한 초승달 */}
      <path
        d="M41 18 C32 22 26 30 24 40 C23 45 23 49 24 53 C22 46 23 36 28 28 C31 23 36 19 41 18 Z"
        fill={t.gloss}
        opacity={t.glossOpacity}
      />

      {/* 지능이 빛나는 발광 — 스파클 뒤 소프트 라이트 (돔 중심) */}
      <circle cx="51" cy="37" r="25" fill={`url(#${gid}-glow)`} />

      {/* AI 스파클 — 둥근 머리 중심에서 또렷하게 빛나는 4갈래 별 (크리스프) */}
      <path d={sparkle(51, 37, 16, 0.085)} fill={t.core} />
      {/* 보조 반짝임 — 우상단 작은 스파클 (가장자리 안쪽) */}
      <path d={sparkle(68, 22, 4.5, 0.14)} fill={t.spark} />
    </svg>
  )
}

/** 링고 아바타 — 칩/FAB용 배경 포함 */
export function LingoAvatar({
  size = 56,
  background = "solid",
  className,
}: {
  size?: number
  /** solid = 파란 그라데이션 원 + 흰 심볼 / tint = 연한 파란 원 + 파란 심볼 */
  background?: "solid" | "tint"
  className?: string
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
      <LingoMascot size={size * 0.72} tone={isSolid ? "white" : "blue"} />
    </span>
  )
}
