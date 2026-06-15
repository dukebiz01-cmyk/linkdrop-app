import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import { DropFeedCard } from "@/components/drop-feed-card";
import { getDiscoverDrops } from "@/lib/feed-queries";
import type { DropFeedItem } from "@/components/home-page";

// 탐색 = 발견 전용(pull). 공개 published 카드(getDiscoverDrops) 피드만.
//   '내 콘텐츠 / 자동 찾기 / 검색'은 만들기 입력부(MyContentPicker)로 이전 — 여기선 제거.
type ExploreLoaderData = {
  discoverDrops: DropFeedItem[];
};

export const Route = createFileRoute("/_user/explore")({
  head: () => ({ meta: [{ title: "탐색" }] }),
  loader: async (): Promise<ExploreLoaderData> => {
    const supabase = await getAuthClient();
    if (!supabase) return { discoverDrops: [] };
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.user.id) return { discoverDrops: [] };
    const discoverDrops = await getDiscoverDrops(supabase);
    return { discoverDrops };
  },
  component: ExplorePage,
});

function ExplorePage() {
  const { discoverDrops } = Route.useLoaderData();
  const navigate = useNavigate();

  function handleOpenDrop(shareUuid: string) {
    navigate({ to: "/d/$shareUuid", params: { shareUuid } });
  }

  return (
    <div className="mx-auto max-w-md px-6 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">탐색</h1>
        <p className="mt-2 text-sm font-medium tracking-ko text-[#737373]">
          공개된 카드를 둘러보세요.
        </p>
      </header>

      {discoverDrops.length > 0 ? (
        <div className="space-y-3">
          {discoverDrops.map((drop) => (
            <DropFeedCard
              key={drop.shareUuid}
              {...drop}
              onClick={() => handleOpenDrop(drop.shareUuid)}
              onCtaClick={() => handleOpenDrop(drop.shareUuid)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 text-center">
          <p className="text-sm font-medium tracking-ko text-[#737373]">
            아직 공개된 카드가 없어요.
          </p>
        </div>
      )}
    </div>
  );
}
