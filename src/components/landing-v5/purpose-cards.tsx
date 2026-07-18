import { Megaphone, CalendarCheck, ShoppingBag } from "lucide-react"

const PURPOSES = [
  { title: "정보 알리기", color: "#475569", icon: Megaphone, biz: false },
  { title: "예약·쿠폰", color: "#1D4ED8", icon: CalendarCheck, biz: true },
  { title: "상품 판매", color: "#0F766E", icon: ShoppingBag, biz: true },
]

/** 목적별 카드 — 한 화면에 들어오는 컴팩트 3열 그리드. */
export function PurposeCards() {
  return (
    <section className="px-5 pt-6 pb-2">
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[#0F172A]">
        이런 목적에 딱 맞아요
      </h2>
      <div className="mt-3.5 grid grid-cols-3 gap-2.5">
        {PURPOSES.map((p) => {
          const Icon = p.icon
          return (
            <div
              key={p.title}
              className="relative flex flex-col items-center gap-2 overflow-hidden rounded-[16px] border border-[#E8EDF3] bg-white px-2 pb-3.5 pt-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]"
            >
              {/* 컬러가 꽉 찬 원형 솔리드 아이콘 배지 */}
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_4px_10px_-3px_rgba(15,23,42,0.3)]"
                style={{ backgroundColor: p.color }}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={2.1} />
              </span>
              <span className="text-[12.5px] font-bold leading-tight text-[#0F172A]">{p.title}</span>
              {p.biz ? (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
                  style={{ backgroundColor: `${p.color}14`, color: p.color }}
                >
                  사업자 전용
                </span>
              ) : (
                <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9.5px] font-bold text-[#64748B]">
                  누구나
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
