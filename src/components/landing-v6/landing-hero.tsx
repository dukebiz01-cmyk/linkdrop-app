// UI-5-T7-L6 — 랜딩 v6 히어로 (v0(51) 원문 이식 · 디자인·기능 보존 락).
//   어댑트: ① "use client" 제거 ② v0 globals.css 의 lingo-sweep·lingo-pulse 키프레임을
//   컴포넌트 스코프 <style> 로 이식 + prefers-reduced-motion 정지 분기(현행 연출 관례).
//   보정 1건(Duke 승인): (50)판 LingoAvatar 72px 오브를 주인공 위치(배지 위)에 복원 —
//   (51) 히어로 구조(원본→링고AI 변환→완성 카드 목업)는 원문 유지. lingo-hover 부유 동반 이식.
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
  ImageIcon,
  Link2,
  Sparkles,
} from "lucide-react"
import { LingoMascot, LingoAvatar } from "@/components/brand/lingo-mascot"

type LucideIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>

type Row = { icon: LucideIcon; label: string; value: string; accent?: boolean }

type Source = { kind: "video" | "photo"; label: string }

type Scene = {
  key: string
  purpose: string
  accent: string
  source: Source
  headerIcon: LucideIcon
  headerCaption: string
  title: string
  rows: Row[]
  cta: string
}

/**
 * 히어로 — 헤드라인 + 폰 목업.
 * 폰 목업 안에서 "원본 입력(영상 링크·사진) → 링고AI 변환 → 완성 카드"의
 * 흐름을 보여줘, 링고AI가 실제로 카드를 만들어준다는 가치를 시각적으로 증명한다.
 * 3가지 목적(정보 알림 · 예약·쿠폰 · 상품 판매)을 자동 순환한다.
 */
const SCENES: Scene[] = [
  {
    key: "reserve",
    purpose: "예약·쿠폰",
    accent: "#1D4ED8",
    source: { kind: "video", label: "youtu.be/dinner-course" },
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
    key: "public",
    purpose: "정보 알리기",
    accent: "#475569",
    source: { kind: "video", label: "youtu.be/spring-menu" },
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
    key: "sales",
    purpose: "상품 판매",
    accent: "#0F766E",
    source: { kind: "photo", label: "청송사과밭.jpg" },
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
    }, 3200)
    return () => clearInterval(id)
  }, [])

  const scene = SCENES[active]

  return (
    <section className="px-5 pt-8 pb-2 text-center">
      {/* v0 globals.css 이식분 — 변환 스윕·처리 도트·(보정) 오브 부유 + reduced-motion 정지 */}
      <style>{`
        @keyframes lingo-sweep{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
        .lingo-sweep{animation:lingo-sweep 2.6s cubic-bezier(0.4,0,0.2,1) infinite}
        @keyframes lingo-pulse{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes lingo-hover{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .lingo-hover{animation:lingo-hover 2.8s ease-in-out infinite;display:inline-flex}
        @media (prefers-reduced-motion: reduce){
          .lingo-sweep,.lingo-hover,[style*="lingo-pulse"]{animation:none !important}
        }
      `}</style>

      {/* 보정 1건(Duke 승인) — (50)판 링고 아바타 주인공 복원: AI 주인공을 크게 앞세운다 */}
      <div className="flex justify-center">
        <span className="lingo-hover">
          <LingoAvatar size={72} background="solid" />
        </span>
      </div>

      {/* 상단 소개 배지 */}
      <div className="mt-4 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-white/70 px-3 py-1.5 text-[12px] font-bold text-[#1D4ED8] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
          링고AI 카드 메이커
        </span>
      </div>

      {/* 헤드라인 */}
      <h1 className="mx-auto mt-5 text-[27px] font-bold leading-[1.34] tracking-[-0.02em] text-[#0F172A]">
        <span className="whitespace-nowrap">영상 링크나 사진 한 장으로</span>{" "}
        <span className="whitespace-nowrap">
          <span className="text-[#1D4ED8]">링고AI</span>가 전송 카드를 만들어요
        </span>
      </h1>
      <p className="mx-auto mt-3 max-w-[290px] text-pretty text-[14px] leading-relaxed text-[#64748B]">
        예약·쿠폰·판매까지, 목적에 맞는 카드를 자동으로
      </p>

      {/* 폰 목업 — 원본 입력 → 링고AI 변환 → 완성 카드 */}
      <div className="relative mt-9 flex justify-center">
        {/* 뒤 후광 */}
        <div
          className="pointer-events-none absolute left-1/2 top-6 h-64 w-64 -translate-x-1/2 rounded-full opacity-40 blur-3xl transition-colors duration-700"
          style={{ backgroundColor: `${scene.accent}55` }}
          aria-hidden="true"
        />
        <div className="relative w-[248px] rounded-[36px] border border-[#E8EDF3] bg-white p-2.5 shadow-[0_34px_70px_-24px_rgba(15,23,42,0.4)]">
          {/* 노치 */}
          <div className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[#E2E8F0]" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[26px] bg-[#F1F5F9]">
            <PhoneScreen scene={scene} />
          </div>
        </div>
      </div>

      {/* 순환 도트 */}
      <div className="mt-6 flex items-center justify-center gap-1.5">
        {SCENES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`${s.purpose} 카드 보기`}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: i === active ? 22 : 8,
              backgroundColor: i === active ? scene.accent : "#CBD5E1",
            }}
          />
        ))}
      </div>
    </section>
  )
}

function PhoneScreen({ scene }: { scene: Scene }) {
  const SourceIcon = scene.source.kind === "video" ? Link2 : ImageIcon
  return (
    <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-5">
      {/* 1) 원본 입력 */}
      <div className="text-left">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
          원본
        </span>
        <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-2.5 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]">
            <SourceIcon className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="truncate text-[12px] font-medium text-[#475569]">
            {scene.source.label}
          </span>
        </div>
      </div>

      {/* 2) 링고AI 변환 라인 (라이트 스윕) */}
      <div className="relative flex items-center justify-center gap-1.5 overflow-hidden rounded-lg py-0.5">
        <LingoMascot size={15} tone="blue" />
        <span className="text-[11px] font-bold text-[#1D4ED8]">링고AI가 변환했어요</span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className="h-1 w-1 rounded-full bg-[#93C5FD]"
              style={{ animation: `lingo-pulse 1.2s ease-in-out ${d * 0.2}s infinite` }}
            />
          ))}
        </span>
      </div>

      {/* 3) 완성 카드 */}
      <PurposeCard scene={scene} />
    </div>
  )
}

function PurposeCard({ scene }: { scene: Scene }) {
  const HeaderIcon = scene.headerIcon
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_10px_28px_-12px_rgba(15,23,42,0.22)]">
      {/* 헤더 밴드 */}
      <div
        className="relative flex h-[92px] items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${scene.accent}1F 0%, ${scene.accent}0A 55%, #FFFFFF 100%)`,
        }}
      >
        {/* 생성 라이트 스윕 — 헤더 밴드 안에서만 (텍스트 가독성 보호) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="lingo-sweep absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>

        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_8px_18px_-6px_rgba(15,23,42,0.35)]"
          style={{ backgroundColor: scene.accent, color: "#FFFFFF" }}
        >
          <HeaderIcon className="h-6 w-6" strokeWidth={2} />
        </span>
        <span
          className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10.5px] font-bold shadow-[0_1px_3px_rgba(15,23,42,0.1)]"
          style={{ color: scene.accent }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: scene.accent }} />
          {scene.headerCaption}
        </span>
      </div>

      {/* 본문 */}
      <div className="flex flex-col gap-2 p-3.5 text-left">
        <p className="text-[15px] font-bold leading-snug text-[#0F172A]">{scene.title}</p>

        {scene.rows.map((row) => {
          const RowIcon = row.icon
          return (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-[10px] bg-[#F1F5F9] px-2.5 py-2"
            >
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748B]">
                <RowIcon className="h-3.5 w-3.5 text-[#94A3B8]" strokeWidth={2.25} />
                {row.label}
              </span>
              <span
                className="text-[12.5px] font-bold"
                style={{ color: row.accent ? scene.accent : "#334155" }}
              >
                {row.value}
              </span>
            </div>
          )
        })}

        {/* 행동 버튼 */}
        <div
          className="mt-1 flex h-9 items-center justify-center rounded-[10px] text-[13px] font-bold text-white"
          style={{ backgroundColor: scene.accent }}
        >
          {scene.cta}
        </div>
      </div>
    </div>
  )
}
