import { useEffect, useState } from "react"
import {
  PlayCircle,
  CalendarCheck,
  ShoppingBag,
  MapPin,
  Clock,
  Ticket,
  Tag,
  Megaphone,
  BadgeCheck,
  Sparkles,
} from "lucide-react"

type LucideIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>

type Row = { icon: LucideIcon; label: string; value: string; accent?: boolean }

type Scene = {
  key: string
  purpose: string
  accent: string
  headerIcon: LucideIcon
  headerCaption: string
  title: string
  rows: Row[]
  cta: string
}

/**
 * 히어로 — 헤드라인 + 폰 목업.
 * 폰 목업은 우리 서비스의 3가지 목적(퍼블릭 정보 알림 · 예약·쿠폰 · 상품 판매)을
 * 자동으로 순환하며 보여줘, 특정 커머스에 치우치지 않고 전체 목적을 전달한다.
 */
const SCENES: Scene[] = [
  {
    key: "public",
    purpose: "정보 알리기",
    accent: "#475569",
    headerIcon: PlayCircle,
    headerCaption: "영상 하이라이트",
    title: "봄 신메뉴 출시 안내",
    rows: [
      { icon: Megaphone, label: "대상", value: "누구나 열람" },
      { icon: Clock, label: "기간", value: "3/1 – 3/31" },
    ],
    cta: "영상으로 보기",
  },
  {
    key: "reserve",
    purpose: "예약·쿠폰",
    accent: "#1D4ED8",
    headerIcon: CalendarCheck,
    headerCaption: "예약 가능",
    title: "주말 디너 예약받아요",
    rows: [
      { icon: Clock, label: "시간", value: "17:00 – 21:00" },
      { icon: Ticket, label: "쿠폰", value: "1만원 할인", accent: true },
    ],
    cta: "예약하기",
  },
  {
    key: "sales",
    purpose: "상품 판매",
    accent: "#0F766E",
    headerIcon: ShoppingBag,
    headerCaption: "판매 중",
    title: "청송 햇사과 5kg",
    rows: [
      { icon: MapPin, label: "원산지", value: "경북 청송" },
      { icon: Tag, label: "가격", value: "15,000원", accent: true },
    ],
    cta: "구매하기",
  },
]

export function LandingHero() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SCENES.length)
    }, 2600)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="px-5 pt-6 pb-2 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-[12px] font-bold text-[#1D4ED8]">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
        AI 카드 메이커
      </span>
      <h1 className="mt-3.5 text-balance text-[26px] font-bold leading-[1.32] tracking-[-0.02em] text-[#0F172A]">
        영상 링크 하나가,
        <br />
        행동하는 카드로
      </h1>
      <p className="mx-auto mt-2.5 max-w-[300px] text-pretty text-[14px] leading-relaxed text-[#64748B]">
        정보 알림부터 예약·판매까지, AI가 목적에 맞는 카드로
      </p>

      {/* 폰 목업 — 넓은 배경 패널 위에 올려 균형있게 */}
      <div className="relative mt-5 flex justify-center rounded-[28px] border border-[#EDF1F6] bg-gradient-to-b from-white to-[#F1F5F9] px-6 pb-6 pt-7">
        <div className="relative w-[228px] rounded-[30px] border border-[#E8EDF3] bg-white p-2.5 shadow-[0_20px_44px_-18px_rgba(15,23,42,0.28)]">
          <div className="relative h-[276px] overflow-hidden rounded-[22px] bg-[#F1F5F9]">
            {SCENES.map((scene, i) => (
              <PurposeCard key={scene.key} scene={scene} active={i === active} />
            ))}
          </div>
        </div>
      </div>

      {/* 순환 인디케이터 — 현재 목적 라벨 + 점 */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-[12px] font-bold transition-colors duration-300"
          style={{ backgroundColor: `${SCENES[active].accent}14`, color: SCENES[active].accent }}
        >
          {SCENES[active].purpose}
        </span>
        <div className="flex items-center gap-1.5">
          {SCENES.map((scene, i) => (
            <button
              key={scene.key}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${scene.purpose} 카드 보기`}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === active ? 20 : 8,
                backgroundColor: i === active ? SCENES[active].accent : "#CBD5E1",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function PurposeCard({ scene, active }: { scene: Scene; active: boolean }) {
  const HeaderIcon = scene.headerIcon
  return (
    <div
      className="absolute inset-0 flex flex-col transition-all duration-500 ease-out"
      style={{
        opacity: active ? 1 : 0,
        transform: active ? "translateY(0)" : "translateY(8px)",
        pointerEvents: active ? "auto" : "none",
      }}
      aria-hidden={!active}
    >
      {/* 헤더 밴드 — 중립 배경 + 목적 색 아이콘 하나만 포인트로 */}
      <div className="relative flex h-[116px] items-center justify-center bg-[#F8FAFC]">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: scene.accent, color: "#FFFFFF" }}
        >
          <HeaderIcon className="h-7 w-7" strokeWidth={2} />
        </span>
        <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#64748B] shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          {scene.headerCaption}
        </span>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-[15px] font-bold leading-snug text-[#0F172A]">{scene.title}</p>

        {scene.rows.map((row) => {
          const RowIcon = row.icon
          return (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-[10px] bg-[#F1F5F9] px-2.5 py-2"
            >
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#64748B]">
                <RowIcon className="h-3.5 w-3.5 text-[#94A3B8]" strokeWidth={2.25} />
                {row.label}
              </span>
              <span
                className="text-[13px] font-bold"
                style={{ color: row.accent ? scene.accent : "#334155" }}
              >
                {row.value}
              </span>
            </div>
          )
        })}

        {/* 행동 버튼 */}
        <div className="mt-auto">
          <div
            className="flex h-9 items-center justify-center rounded-[10px] text-[13px] font-bold text-white"
            style={{ backgroundColor: scene.accent }}
          >
            {scene.cta}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#94A3B8]">
            <BadgeCheck className="h-3.5 w-3.5 text-[#94A3B8]" strokeWidth={2.25} />
            AI가 자동으로 정리한 카드
          </div>
        </div>
      </div>
    </div>
  )
}
