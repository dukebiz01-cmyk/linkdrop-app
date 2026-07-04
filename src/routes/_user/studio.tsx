import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
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
  Lock,
} from "lucide-react";
import { CreatorCoachCard } from "@/components/creator-coach-card";
import { getAuthClient } from "@/lib/auth-context";

// 스튜디오 허브 — 하단 탭 3번째("스튜디오") 진입 화면. 상단=AI 코치, 아래 3섹션:
//   새 카드 만들기(목적-first) · 가져오기(큐레이션) · 내 카드 강화.
//   ★ loader = isBusiness 판별만(쿠폰·예약/커머스 게이트용). auth redirect throw 금지 —
//      _user beforeLoad 가 auth 단독 처리(세션/userId throw 금지 → 리다이렉트 루프 방지).
//   목적 버튼은 /create-wizard?purpose= 로 목적을 프리셀렉트(create-wizard validateSearch + PURPOSE_EN_TO_KO).
//     · info=정보 / coupon=혜택·예약 / purchase=상품 판매. 비사업자 게이팅은 위저드 자체 책임(여기서 건드리지 않음).
//   도구 내부 기능이 아직 없으면 placeholder(준비 중 토스트).

type StudioLoaderData = { isBusiness: boolean; myRewards: number };

export const Route = createFileRoute("/_user/studio")({
  head: () => ({ meta: [{ title: "스튜디오 — LinkDrop" }] }),
  // P6-1(형님 확정 A) — 전면 대체: /studio 는 studio-build 리다이렉트만 잔류(북마크·딥링크 보호).
  //   아래 셸 UI(코치·도구 섹션·loader)는 P6-2 이식 재료로 보존 — 삭제 금지(유실 방지).
  //   비사업자 처리 변경 없음(P6-3 소관) — studio-build 쪽 현행 graceful 동작 그대로.
  beforeLoad: () => {
    throw redirect({ to: "/studio-build" });
  },
  // 비즈니스(approved 파트너) 판별 — 쿠폰·예약/커머스 버튼 게이트용(home.tsx loader 패턴).
  //   데이터 조회만 — redirect throw 금지(버튼 깜빡임 방지 + 리다이렉트 루프 방지).
  loader: async (): Promise<StudioLoaderData> => {
    const supabase = await getAuthClient();
    if (!supabase) return { isBusiness: false, myRewards: 0 };
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return { isBusiness: false, myRewards: 0 };
    const { data: isBusinessRaw } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });
    // 내 캐쉬 — reward_ledger 누적 잔액(party_user_id=auth.uid()). 미인증/에러 시 0 폴백.
    //   ⚠️ TEMP — get_my_rewards 가 types.ts 미반영이라 typed rpc 우회. 타입 재생성 후 제거.
    let myRewards = 0;
    try {
      const rpc = supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: unknown; error: unknown }>;
      const { data: rewardsRaw, error: rewardsErr } = await rpc("get_my_rewards");
      if (!rewardsErr) myRewards = Number(rewardsRaw) || 0;
    } catch {
      // 조회 실패 — 헤더는 0 으로 그대로 렌더(깨짐 방지).
    }
    return { isBusiness: Boolean(isBusinessRaw), myRewards };
  },
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
  /** 비즈니스(approved 파트너) 전용 — 아니면 잠금 + 사업자 등록 유도(/partner/register). */
  gated?: boolean;
  /** 사업자(isBusiness)면 거울 빌더(studio-build)로, 아니면 기존 create-wizard 흐름 유지(창작자=위저드). */
  studioForBiz?: boolean;
};

type ToolSection = { title: string; tools: Tool[] };

const SECTIONS: ToolSection[] = [
  {
    title: "새 카드 만들기",
    tools: [
      { label: "영상 가져오기", Icon: Video, to: "/create-wizard" }, // 기존 제작 흐름 연결(목적 미지정)
      { label: "정보", Icon: Info, to: "/create-wizard", purpose: "info", studioForBiz: true },
      { label: "쿠폰·예약", Icon: Ticket, to: "/create-wizard", purpose: "coupon", gated: true, studioForBiz: true },
      { label: "커머스", Icon: ShoppingBag, to: "/create-wizard", purpose: "purchase", gated: true },
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

function ToolItem({ tool, isBusiness }: { tool: Tool; isBusiness: boolean }) {
  const navigate = useNavigate();

  // 비즈니스 전용 게이트 — approved 파트너 아니면 잠금 + 사업자 등록 유도(/partner/register).
  //   백엔드 v7.4 게이트와 정합: 비-파트너는 정보 외 purpose 거부 → 위저드 헛수고 사전 차단.
  //   잠금 UI = 랜딩(HomePageV3) 패턴 재현(dimmed + Lock + "사업자 전용").
  if (tool.gated && !isBusiness) {
    return (
      <button
        type="button"
        onClick={() => void navigate({ to: "/partner/register" })}
        className={`${TOOL_BTN_CLASS} bg-[#FAFAFA] opacity-70`}
        aria-label={`${tool.label} — 사업자 전용`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
          <tool.Icon className="size-[18px] text-[#0A0A0A]" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-ko text-[#0A0A0A]">
          {tool.label}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#E5E5E5] px-2 py-0.5 text-[10px] font-semibold text-[#A3A3A3]">
          <Lock className="size-2.5" strokeWidth={2.5} />
          사업자 전용
        </span>
      </button>
    );
  }

  // 사업자(approved 파트너) = 거울 빌더(studio-build)로. 창작자(비즈니스 아님)는 아래 create-wizard 흐름 유지.
  //   studio-build 진입은 search param 없이 — 빌더가 매장 컨텍스트를 자체 loader 로 로드(?apply 등 미사용).
  //   gate(위)를 통과한 뒤이므로 비-사업자 gated 타일은 여기 도달 안 함(잠금 유지).
  if (tool.studioForBiz && isBusiness) {
    return (
      <Link to="/studio-build" className={TOOL_BTN_CLASS}>
        <ToolInner Icon={tool.Icon} label={tool.label} />
      </Link>
    );
  }

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
  const { isBusiness, myRewards } = Route.useLoaderData();
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFC] tracking-ko pb-12">
      <header className="flex items-center justify-between border-b border-[#F1F5F9] bg-white px-5 py-4">
        <h1 className="text-lg font-bold text-[#0A0A0A]">스튜디오</h1>
        {/* 내 캐쉬 — reward_ledger 누적 잔액(loader get_my_rewards). 미연동 시 0. */}
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F5] px-3 py-1.5">
          <span className="text-[11px] font-medium tracking-ko text-[#737373]">내 캐쉬</span>
          <span className="text-sm font-bold tracking-ko text-[#0A0A0A]">
            {Number(myRewards ?? 0).toLocaleString()}원
          </span>
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
                <ToolItem key={tool.label} tool={tool} isBusiness={isBusiness} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
