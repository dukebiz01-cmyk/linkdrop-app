import { Link2, MessageSquareText, Share2, ChevronRight } from "lucide-react"

const STEPS = [
  { n: 1, title: "링크 넣기", icon: Link2 },
  { n: 2, title: "AI와 대화", icon: MessageSquareText },
  { n: 3, title: "카톡 공유", icon: Share2 },
]

/** 이용 방법 — 한 줄에 들어오는 컴팩트 가로 3스텝. */
export function HowItWorks() {
  return (
    <section className="px-5 pt-7 pb-1">
      <div className="flex items-center justify-between rounded-[16px] border border-[#E8EDF3] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.n} className="flex items-center gap-2.5">
              <div className="flex flex-col items-center gap-1.5">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#F1F5F9]">
                  <Icon className="h-[19px] w-[19px] text-[#475569]" strokeWidth={2} />
                  <span className="absolute -right-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-[#334155] text-[9px] font-bold text-white ring-2 ring-white">
                    {s.n}
                  </span>
                </span>
                <span className="text-[12px] font-bold text-[#0F172A]">{s.title}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 flex-none text-[#CBD5E1]" strokeWidth={2.5} />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
