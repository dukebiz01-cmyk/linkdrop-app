import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { ContentSourceCard, type ContentSourceCardData } from "@/components/explore/ContentSourceCard";
import { ExploreSearchBar } from "@/components/explore/ExploreSearchBar";

// chunk1 — 탐색 라우트.
//   비지니스 인증된 owner 만 본문 노출. 일반 사용자는 안내 카드만.
//   본문: 내가 등록(content_sources.registered_by_user_id=uid) 한 콘텐츠 목록 +
//         "콘텐츠 자동 찾기" (chunk2 에서 외부 검색) placeholder.

type ContentSourceRow = {
  id: string;
  title: string | null;
  caption: string | null;
  author_name: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
};

type ExploreLoaderData = {
  isBusiness: boolean;
  partnerId: string | null;
  sources: ContentSourceRow[];
};

export const Route = createFileRoute("/_user/explore")({
  head: () => ({ meta: [{ title: "탐색" }] }),
  loader: async (): Promise<ExploreLoaderData> => {
    const supabase = await getAuthClient();
    const empty = { isBusiness: false, partnerId: null, sources: [] };
    if (!supabase) return empty;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? null;
    if (!uid) return empty;

    const { data: isBusiness } = await supabase.rpc("is_active_partner_owner", {
      _user_id: uid,
    });
    if (!isBusiness) return empty;

    // chunk1 1d — partner_id 동시 fetch. 카드 만들기 시 자동 연결용.
    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("owner_user_id", uid)
      .eq("verification_status", "approved")
      .limit(1)
      .maybeSingle();

    const { data: rows } = await supabase
      .from("content_sources")
      .select("id, title, caption, author_name, thumbnail_url, duration_sec")
      .eq("registered_by_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);

    return {
      isBusiness: true,
      partnerId: partner?.id ?? null,
      sources: (rows ?? []) as ContentSourceRow[],
    };
  },
  component: ExplorePage,
});

function NotBusinessNotice() {
  return (
    <div className="mx-auto max-w-md px-6 pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">탐색</h1>
        <p className="mt-2 text-sm font-medium tracking-ko text-[#737373]">
          매장 사장님이 모은 콘텐츠로 카드를 만들어요.
        </p>
      </header>

      <section className="rounded-2xl border border-[#E5E5E5] bg-white p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F5F5]">
          <Lock className="h-5 w-5 text-[#525252]" strokeWidth={2} />
        </div>
        <h2 className="text-base font-bold tracking-ko text-[#0A0A0A]">
          비지니스 인증 후 이용할 수 있어요
        </h2>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-[#737373]">
          매장 사장님을 위한 탐색이에요. 매장 등록 후 인증되면
          <br />
          모아둔 영상으로 카드를 만들 수 있어요.
        </p>
      </section>
    </div>
  );
}

function ExplorePage() {
  const { isBusiness, partnerId, sources } = Route.useLoaderData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((r) => {
      const t = (r.title ?? "").toLowerCase();
      const c = (r.caption ?? "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [sources, query]);

  if (!isBusiness) {
    return <NotBusinessNotice />;
  }

  function handleCreate(sourceId: string) {
    navigate({
      to: "/create-wizard",
      search: {
        source_id: sourceId,
        ...(partnerId ? { partner_id: partnerId } : {}),
      } as never,
    });
  }

  return (
    <div className="mx-auto max-w-md px-6 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">탐색</h1>
        <p className="mt-2 text-sm font-medium tracking-ko text-[#737373]">
          모아둔 콘텐츠로 바로 카드를 만들어요.
        </p>
      </header>

      <ExploreSearchBar value={query} onChange={setQuery} />

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold tracking-ko text-[#0A0A0A]">
          콘텐츠 자동 찾기
        </h2>
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-[#FAFAFA] p-4 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white">
            <Search className="h-4 w-4 text-[#A3A3A3]" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium tracking-ko text-[#737373]">
            준비 중이에요
          </p>
          <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-[#A3A3A3]">
            매장 키워드로 영상을 자동으로 찾아드려요.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-ko text-[#0A0A0A]">
            내가 모은 콘텐츠
          </h2>
          <span className="text-xs font-medium tracking-ko text-[#A3A3A3]">
            {filtered.length}개
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 text-center">
            <p className="text-sm font-medium tracking-ko text-[#737373]">
              {query.trim()
                ? "검색 결과가 없어요"
                : "아직 모아둔 콘텐츠가 없어요. 카드 만들기로 영상을 등록해 보세요."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => {
              const card: ContentSourceCardData = {
                id: r.id,
                title: r.title,
                authorName: r.author_name,
                thumbnailUrl: r.thumbnail_url,
                durationSec: r.duration_sec,
              };
              return (
                <li key={r.id}>
                  <ContentSourceCard source={card} onCreate={handleCreate} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
