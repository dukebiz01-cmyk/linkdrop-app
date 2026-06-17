import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Video,
  Image as ImageIcon,
  LayoutGrid,
  FileText,
  Info,
  Ticket,
  ShoppingBag,
  Scissors,
  Megaphone,
  TrendingUp,
  Rocket,
  ChevronRight,
} from "lucide-react";
import { CreatorCoachCard } from "@/components/creator-coach-card";

// 스튜디오 허브 — 하단 탭 3번째("스튜디오") 진입 화면. 상단=AI 코치, 아래=제작/목적/강화 도구.
//   ★ loader 없음 — _user beforeLoad 가 auth 단독 처리(세션/userId throw 금지 → 리다이렉트 루프 방지).
//   도구 내부 기능은 이번 범위 아님 — 기존 흐름 있으면 연결(영상 가져오기→create-wizard), 없으면 placeholder.

export const Route = createFileRoute("/_user/studio")({
  head: () => ({ meta: [{ title: "스튜디오 — LinkDrop" }] }),
  component: StudioPage,
});

type Tool = {
  label: string;
  Icon: typeof Video;
  /** 연결된 기존 흐름. 없으면 placeholder(준비 중 토스트). */
  to?: "/create-wizard";
};

type ToolSection = { title: string; tools: Tool[] };

const SECTIONS: ToolSection[] = [
  {
    title: "콘텐츠 만들기",
    tools: [
      { label: "영상 가져오기", Icon: Video, to: "/create-wizard" }, // 기존 제작 흐름 연결
      { label: "이미지 올리기", Icon: ImageIcon },
      { label: "카드뉴스", Icon: LayoutGrid },
      { label: "블로그", Icon: FileText },
    ],
  },
  {
    title: "목적·혜택",
    tools: [
      { label: "정보", Icon: Info },
      { label: "쿠폰·예약", Icon: Ticket },
      { label: "커머스", Icon: ShoppingBag },
    ],
  },
  {
    title: "강화·노출",
    tools: [
      { label: "영상 편집", Icon: Scissors },
      { label: "마케팅 강화", Icon: Megaphone },
      { label: "노출 강화", Icon: TrendingUp },
      { label: "상위 노출", Icon: Rocket },
    ],
  },
];

const TOOL_BTN_CLASS =
  "group flex min-h-[44px] items-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3 text-left transition-colors hover:border-[#A3A3A3]";

function ToolInner({ Icon, label }: { Icon: typeof Video; label: string }) {
  return (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
        <Icon className="size-[18px] text-[#0A0A0A]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-ko text-[#0A0A0A]">
        {label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[#A3A3A3]" strokeWidth={2} />
    </>
  );
}

function StudioPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFC] tracking-ko pb-12">
      <header className="flex items-center justify-between border-b border-[#F1F5F9] bg-white px-5 py-4">
        <h1 className="text-lg font-bold text-[#0A0A0A]">스튜디오</h1>
        {/* 캐쉬 표시 자리 — 값은 추후 연동. 지금은 placeholder. */}
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F5] px-3 py-1.5">
          <span className="text-[11px] font-medium tracking-ko text-[#737373]">내 캐쉬</span>
          <span className="text-sm font-bold tracking-ko text-[#0A0A0A]">—</span>
        </span>
      </header>

      <div className="space-y-6 px-5 pt-4">
        {/* 상단 — AI 코치 (me.tsx 에서 이전). 기본 period 'all'. */}
        <CreatorCoachCard />

        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-bold tracking-ko text-[#0A0A0A]">{section.title}</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {section.tools.map((tool) =>
                tool.to ? (
                  <Link key={tool.label} to={tool.to} className={TOOL_BTN_CLASS}>
                    <ToolInner Icon={tool.Icon} label={tool.label} />
                  </Link>
                ) : (
                  <button
                    key={tool.label}
                    type="button"
                    onClick={() => toast.info("준비 중이에요")}
                    className={TOOL_BTN_CLASS}
                  >
                    <ToolInner Icon={tool.Icon} label={tool.label} />
                  </button>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
