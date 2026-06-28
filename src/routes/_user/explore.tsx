import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, LayoutGrid, LayoutList } from "lucide-react";
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

const TABS: { key: ExploreTab; label: string; empty: string }[] = [
  { key: "all", label: "전체", empty: "아직 공개된 카드가 없어요." },
  { key: "info", label: "정보", empty: "아직 공개된 정보 카드가 없어요." },
  { key: "coupon", label: "쿠폰", empty: "아직 공개된 쿠폰 카드가 없어요." },
  { key: "commerce", label: "상품판매", empty: "아직 공개된 상품 카드가 없어요." },
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
    <div className="mx-auto max-w-md px-6 pt-6">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">탐색</h1>
          {/* 그리드/리스트 토글 — 활성=검정 bg+흰아이콘, 비활성=그레이. 세션 state 만. */}
          <div className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5">
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
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors ${
                    on ? "bg-[#0A0A0A] text-white" : "bg-transparent text-[#A3A3A3] hover:text-[#525252]"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={2} />
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-sm font-medium tracking-ko text-[#737373]">
          공개된 카드를 둘러보세요.
        </p>
      </header>

      {/* 4탭 알약 탭바 — 활성=블루 bg+흰글씨, 비활성=연회색 bg+그레이. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`min-h-[44px] rounded-lg px-4 text-sm font-bold tracking-ko transition-colors ${
                on
                  ? "bg-[#2563EB] text-white"
                  : "bg-[#F5F5F5] text-[#525252] hover:bg-[#E5E5E5]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 정렬 표시 — 최신순 단일(토글 없음). */}
      <div className="mb-3 flex items-center justify-end gap-1 text-xs font-medium tracking-ko text-[#A3A3A3]">
        <Clock className="size-3.5" strokeWidth={2} />
        최신순
      </div>

      {drops.length > 0 ? (
        // 그리드=2열 / 리스트=1열. 단일 ShareCardTile, grid-cols 만 전환(8pt gap).
        //   items-stretch(그리드 기본) + ShareCardTile h-full → 같은 행 카드 높이 균일.
        <div className={`grid items-stretch gap-2 ${view === "grid" ? "grid-cols-2" : "grid-cols-1"}`}>
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
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 text-center">
          <p className="text-sm font-medium tracking-ko text-[#737373]">{active.empty}</p>
        </div>
      )}
    </div>
  );
}
