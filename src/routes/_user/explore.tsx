import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { DropFeedCard } from "@/components/drop-feed-card";
import { getDiscoverDrops } from "@/lib/feed-queries";
import { reshareDrop } from "@/lib/reshare-drop";
import type { DropFeedItem } from "@/components/home-page";

// 탐색 = 발견 전용(pull). 공개 published 카드를 [정보·쿠폰·커머스] 3탭으로.
//   탭별 서버 필터(purpose) — 카드 늘어도 클라가 안 터짐. 3탭 미리 로드(전환 즉각).
//   정렬 = 최신순 단일(published_at desc, getDiscoverDrops 기본).
type ExploreLoaderData = {
  info: DropFeedItem[];
  coupon: DropFeedItem[];
  commerce: DropFeedItem[];
};

type ExploreTab = "info" | "coupon" | "commerce";

export const Route = createFileRoute("/_user/explore")({
  head: () => ({ meta: [{ title: "탐색" }] }),
  loader: async (): Promise<ExploreLoaderData> => {
    const empty: ExploreLoaderData = { info: [], coupon: [], commerce: [] };
    const supabase = await getAuthClient();
    if (!supabase) return empty;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.user.id) return empty;
    // 3탭 병렬 로드. 쿠폰 탭 = 쿠폰·예약(혜택) + 매장 연결(bizOnly).
    const [info, coupon, commerce] = await Promise.all([
      getDiscoverDrops(supabase, { purposes: ["정보"] }),
      getDiscoverDrops(supabase, { purposes: ["쿠폰", "예약"], bizOnly: true }),
      getDiscoverDrops(supabase, { purposes: ["구매"] }),
    ]);
    return { info, coupon, commerce };
  },
  component: ExplorePage,
});

const TABS: { key: ExploreTab; label: string; empty: string }[] = [
  { key: "info", label: "정보", empty: "아직 공개된 정보 카드가 없어요." },
  { key: "coupon", label: "쿠폰", empty: "아직 공개된 쿠폰 카드가 없어요." },
  { key: "commerce", label: "커머스", empty: "아직 공개된 상품 카드가 없어요." },
];

function ExplorePage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ExploreTab>("info");

  function handleOpenDrop(shareUuid: string) {
    navigate({ to: "/d/$shareUuid", params: { shareUuid } });
  }

  const active = TABS.find((t) => t.key === tab)!;
  const drops = data[tab];

  return (
    <div className="mx-auto max-w-md px-6 pt-6">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">탐색</h1>
        <p className="mt-2 text-sm font-medium tracking-ko text-[#737373]">
          공개된 카드를 둘러보세요.
        </p>
      </header>

      {/* 3탭 탭바 — 활성=밑줄+검정, 비활성=그레이. */}
      <div className="mb-3 flex items-center gap-5 border-b border-[#E5E5E5]">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px min-h-[44px] border-b-2 text-sm font-bold tracking-ko transition-colors ${
                on
                  ? "border-[#0A0A0A] text-[#0A0A0A]"
                  : "border-transparent text-[#A3A3A3] hover:text-[#525252]"
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
        <div className="space-y-3">
          {drops.map((drop) => (
            <DropFeedCard
              key={drop.shareUuid}
              {...drop}
              onClick={() => handleOpenDrop(drop.shareUuid)}
              onCtaClick={() => handleOpenDrop(drop.shareUuid)}
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
