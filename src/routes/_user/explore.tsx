import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock,
  LayoutGrid,
  LayoutList,
  Compass,
  Layers,
  Newspaper,
  TicketPercent,
  Tag,
  Sparkles,
} from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { ShareCardTile } from "@/components/home/ShareCardTile";
import { getDiscoverDrops } from "@/lib/feed-queries";
import { reshareDrop } from "@/lib/reshare-drop";
import type { DropFeedItem } from "@/components/home-page";

// 탐색 = 발견 전용(pull). 공개 published 카드를 [전체·정보·쿠폰·커머스] 4탭으로.
//   탭별 서버 필터(purpose) — 카드 늘어도 클라가 안 터짐. 4탭 미리 로드(전환 즉각).
//   전체 = 필터 없는 공개 카드 전부(맨 앞·기본). 정렬 = 최신순 단일(published_at desc, getDiscoverDrops 기본).
type ExploreLoaderData = {
  all: DropFeedItem[];
  info: DropFeedItem[];
  coupon: DropFeedItem[];
  commerce: DropFeedItem[];
};

type ExploreTab = "all" | "info" | "coupon" | "commerce";

export const Route = createFileRoute("/_user/explore")({
  head: () => ({ meta: [{ title: "탐색" }] }),
  loader: async (): Promise<ExploreLoaderData> => {
    const empty: ExploreLoaderData = { all: [], info: [], coupon: [], commerce: [] };
    const supabase = await getAuthClient();
    if (!supabase) return empty;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.user.id) return empty;
    // 4탭 병렬 로드. 전체 = opts 없이(필터 없음 = 공개 카드 전부). 쿠폰 탭 = 쿠폰·예약(혜택) + 매장 연결(bizOnly).
    const [all, info, coupon, commerce] = await Promise.all([
      getDiscoverDrops(supabase),
      getDiscoverDrops(supabase, { purposes: ["정보"] }),
      getDiscoverDrops(supabase, { purposes: ["쿠폰", "예약"], bizOnly: true }),
      getDiscoverDrops(supabase, { purposes: ["구매"] }),
    ]);
    return { all, info, coupon, commerce };
  },
  component: ExplorePage,
});

// ★ key/label/empty/필터 매핑 0변경 — icon 필드만 V4 추가.
const TABS: { key: ExploreTab; label: string; empty: string; icon: typeof Layers }[] = [
  { key: "all", label: "전체", empty: "아직 공개된 카드가 없어요.", icon: Layers },
  { key: "info", label: "정보", empty: "아직 공개된 정보 카드가 없어요.", icon: Newspaper },
  { key: "coupon", label: "쿠폰", empty: "아직 공개된 쿠폰 카드가 없어요.", icon: TicketPercent },
  { key: "commerce", label: "상품판매", empty: "아직 공개된 상품 카드가 없어요.", icon: Tag },
];

function ExplorePage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ExploreTab>("all");
  // 보기 모드 — 그리드(2열) / 리스트(1열). 세션 state 만(localStorage 미사용). 기본 = 그리드.
  const [view, setView] = useState<"grid" | "list">("grid");

  function handleOpenDrop(shareUuid: string) {
    navigate({ to: "/d/$shareUuid", params: { shareUuid } });
  }

  const active = TABS.find((t) => t.key === tab)!;
  const drops = data[tab];

  return (
    <div className="mx-auto max-w-md bg-white px-4 pb-24">
      {/* 헤더 — V4 컴퍼스 마크 + 그리드/리스트 흰칩 토글. */}
      <header className="flex items-center justify-between pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 items-center justify-center rounded-[11px] bg-[#0F172A] shadow-[0_4px_12px_rgba(15,23,42,0.18)]"
            aria-hidden="true"
          >
            <Compass className="size-5 text-white" strokeWidth={2} />
          </span>
          <h1 className="text-[18px] font-bold tracking-[-0.01em] text-[#0F172A]">탐색</h1>
        </div>
        <div className="flex items-center gap-0.5 rounded-xl border border-[#EAEEF3] bg-[#F1F5F9] p-1">
          {([
            { mode: "grid", Icon: LayoutGrid, label: "그리드 보기" },
            { mode: "list", Icon: LayoutList, label: "리스트 보기" },
          ] as const).map(({ mode, Icon, label }) => {
            const on = view === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-label={label}
                aria-pressed={on}
                className={`flex h-8 w-9 items-center justify-center rounded-lg transition-all ${
                  on
                    ? "bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.1)]"
                    : "text-[#94A3B8] hover:text-[#475569]"
                }`}
              >
                <Icon className="size-[18px]" strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </header>

      {/* 탭 — 알약+아이콘(블루 활성), 가로 스크롤. key/필터 매핑 불변. */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex min-h-[40px] flex-shrink-0 items-center gap-1.5 rounded-full pl-3 pr-4 text-[13px] font-semibold transition-all ${
                on
                  ? "bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.28)]"
                  : "border border-[#EAEEF3] bg-white text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
              }`}
            >
              <Icon className="size-4" strokeWidth={2.25} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 카운트 + 최신순(고정 표시, 드롭다운 없음 — §0 vanity 정렬 금지). */}
      <div className="mb-3 flex items-center justify-between px-0.5">
        <span className="text-[12px] font-medium text-[#64748B]">
          {drops.length > 0 ? `${drops.length}개의 카드` : ""}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-[#EAEEF3] bg-white py-1.5 pl-3 pr-3 text-[12px] font-semibold text-[#475569]">
          <Clock className="size-3.5 text-[#2563EB]" strokeWidth={2.25} />
          최신순
        </span>
      </div>

      {drops.length > 0 ? (
        // 그리드=2열(gap-3) / 리스트=1열(gap-2.5). 단일 ShareCardTile, grid-cols 만 전환(layout prop 미사용).
        <div className={`grid items-stretch ${view === "grid" ? "grid-cols-2 gap-3" : "grid-cols-1 gap-2.5"}`}>
          {drops.map((drop) => (
            <ShareCardTile
              key={drop.shareUuid}
              drop={drop}
              purpose={drop.intent}
              onClick={() => handleOpenDrop(drop.shareUuid)}
              onShare={() =>
                void reshareDrop({
                  shareUuid: drop.shareUuid,
                  title: drop.title,
                  imageUrl: drop.videoThumbnailUrl,
                  purpose: drop.intent,
                })
              }
            />
          ))}
        </div>
      ) : (
        // 빈상태 — 탭별 문구 유지(active.empty).
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7DEE7] bg-[#F8FAFC] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-[#EAEEF3] bg-white">
            <Sparkles className="size-5 text-[#94A3B8]" strokeWidth={1.75} />
          </div>
          <p className="text-[13px] font-semibold text-[#475569]">{active.empty}</p>
        </div>
      )}
    </div>
  );
}
