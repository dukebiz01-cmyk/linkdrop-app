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
  Megaphone,
  TrendingUp,
  Rocket,
  ChevronRight,
} from "lucide-react";
import { CreatorCoachCard } from "@/components/creator-coach-card";

// 스튜디오 허브 — 하단 탭 3번째("스튜디오") 진입 화면. 상단=AI 코치, 아래 3섹션:
//   새 카드 만들기(목적-first) · 가져오기(큐레이션) · 내 카드 강화.
//   ★ loader 없음 — _user beforeLoad 가 auth 단독 처리(세션/userId throw 금지 → 리다이렉트 루프 방지).
//   목적 버튼은 /create-wizard?purpose= 로 목적을 프리셀렉트(create-wizard validateSearch + PURPOSE_EN_TO_KO).
//     · info=정보 / coupon=혜택·예약 / purchase=상품 판매. 비사업자 게이팅은 위저드 자체 책임(여기서 건드리지 않음).
//   도구 내부 기능이 아직 없으면 placeholder(준비 중 토스트).

export const Route = createFileRoute("/_user/studio")({
  head: () => ({ meta: [{ title: "스튜디오 — LinkDrop" }] }),
  component: StudioPage,
});

// create-wizard 가 ?purpose= 로 받는 목적 키(PURPOSE_EN_TO_KO 기준 그대로).
type WizardPurpose = "info" | "coupon" | "purchase";

type Tool = {
  label: string;
  Icon: typeof Video;
  /** 연결된 기존 라우트. 없으면 placeholder(준비 중 토스트). */
  to?: "/create-wizard" | "/explore" | "/partner/promotion";
  /** /create-wizard 진입 시 목적 프리셀렉트(create-wizard ?purpose=). */
  purpose?: WizardPurpose;
};

type ToolSection = { title: string; tools: Tool[] };

const SECTIONS: ToolSection[] = [
  {
    title: "새 카드 만들기",
    tools: [
      { label: "영상 가져오기", Icon: Video, to: "/create-wizard" }, // 기존 제작 흐름 연결(목적 미지정)
      { label: "정보", Icon: Info, to: "/create-wizard", purpose: "info" },
      { label: "쿠폰·예약", Icon: Ticket, to: "/create-wizard", purpose: "coupon" },
      { label: "커머스", Icon: ShoppingBag, to: "/create-wizard", purpose: "purchase" },
    ],
  },
  {
    title: "가져오기",
    tools: [
      { label: "블로그·뉴스", Icon: FileText, to: "/explore" }, // 네이버 가져오기 = 탐색
      { label: "카드뉴스", Icon: LayoutGrid }, // §0: 외부 URL 가져오기만, 생성 금지 → placeholder
      { label: "이미지 올리기", Icon: ImageIcon }, // placeholder
    ],
  },
  {
    title: "내 카드 강화",
    tools: [
      { label: "마케팅 강화", Icon: Megaphone, to: "/partner/promotion" }, // _partner 게이트(파트너 owner 전용)
      { label: "노출 강화", Icon: TrendingUp }, // placeholder
      { label: "상위 노출", Icon: Rocket }, // placeholder
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

function ToolItem({ tool }: { tool: Tool }) {
  // 목적 프리셀렉트 — /create-wizard?purpose= (create-wizard validateSearch 가 purpose 수용).
  if (tool.to === "/create-wizard" && tool.purpose) {
    return (
      <Link to="/create-wizard" search={{ purpose: tool.purpose }} className={TOOL_BTN_CLASS}>
        <ToolInner Icon={tool.Icon} label={tool.label} />
      </Link>
    );
  }
  // 단순 라우트 이동(목적 없음).
  if (tool.to) {
    return (
      <Link to={tool.to} className={TOOL_BTN_CLASS}>
        <ToolInner Icon={tool.Icon} label={tool.label} />
      </Link>
    );
  }
  // 연결 대상 없음 → placeholder.
  return (
    <button type="button" onClick={() => toast.info("준비 중이에요")} className={TOOL_BTN_CLASS}>
      <ToolInner Icon={tool.Icon} label={tool.label} />
    </button>
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
              {section.tools.map((tool) => (
                <ToolItem key={tool.label} tool={tool} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
