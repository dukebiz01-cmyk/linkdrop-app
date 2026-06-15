import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { ContentSourceCard, type ContentSourceCardData } from "@/components/explore/ContentSourceCard";
import { ExploreSearchBar } from "@/components/explore/ExploreSearchBar";
import { DiscoverSection } from "@/components/explore/DiscoverSection";
import { YouTubeEmbedModal } from "@/components/receiver/YouTubeEmbedModal";
import { parseVideoUrl } from "@/lib/video-metadata";
import { DropFeedCard } from "@/components/drop-feed-card";
import { getDiscoverDrops } from "@/lib/feed-queries";
import type { DropFeedItem } from "@/components/home-page";

function extractYouTubeVideoIdFromThumb(thumb: string | null | undefined): string | null {
  if (!thumb) return null;
  const m = thumb.match(/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

// chunk1 — 탐색 라우트.
//   로그인 유저 전체에 본문 노출 (사업자 게이트 해제). isBusiness 는 wizard 의
//   purpose 소프트게이트(손님=정보만)용으로만 전달.
//   본문: 내가 등록(content_sources.registered_by_user_id=uid) 한 콘텐츠 목록 +
//         "콘텐츠 자동 찾기" (chunk2 에서 외부 검색) placeholder.

type ContentSourceRow = {
  id: string;
  title: string | null;
  caption: string | null;
  author_name: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  source_url: string | null;
  raw_meta: Record<string, unknown> | null;
};

type ExploreLoaderData = {
  isBusiness: boolean;
  partnerId: string | null;
  sources: ContentSourceRow[];
  // Slice 1 발견 피드 — info_drops status='published' 공개 카드 (getDiscoverDrops).
  discoverDrops: DropFeedItem[];
};

export const Route = createFileRoute("/_user/explore")({
  head: () => ({ meta: [{ title: "탐색" }] }),
  loader: async (): Promise<ExploreLoaderData> => {
    const supabase = await getAuthClient();
    const empty = { isBusiness: false, partnerId: null, sources: [], discoverDrops: [] };
    if (!supabase) return empty;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? null;
    if (!uid) return empty;

    // 일반 손님 개방 — isBusiness 플래그는 세팅하되 단락하지 않음.
    //   사업자 아니어도 로그인 유저면 본인 content_sources 를 항상 반환한다.
    //   isBusiness 는 DiscoverSection/wizard 의 purpose 소프트게이트용으로만 전달.
    const { data: isBusiness } = await supabase.rpc("is_active_partner_owner", {
      _user_id: uid,
    });

    // chunk1 1d — partner_id 동시 fetch. 카드 만들기 시 자동 연결용.
    //   손님(approved partner 없음)이면 null → wizard 가 partner_id 생략.
    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("owner_user_id", uid)
      .eq("verification_status", "approved")
      .limit(1)
      .maybeSingle();

    const { data: rows } = await supabase
      .from("content_sources")
      .select("id, title, caption, author_name, thumbnail_url, duration_sec, source_url, raw_meta")
      .eq("registered_by_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);

    // Slice 1 — 공개 발견 피드(info_drops status='published'). 기존 plumbing 재사용.
    //   실패해도 빈 배열 graceful — "내가 모은 콘텐츠" 흐름은 영향 없음.
    const discoverDrops = await getDiscoverDrops(supabase);

    return {
      isBusiness: Boolean(isBusiness),
      partnerId: partner?.id ?? null,
      sources: (rows ?? []) as ContentSourceRow[],
      discoverDrops,
    };
  },
  component: ExplorePage,
});

function ExplorePage() {
  const { isBusiness, partnerId, sources, discoverDrops } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const [query, setQuery] = useState("");
  // 작업 B: 내 콘텐츠 카드 썸네일/제목 탭 → 인앱 임베드 모달.
  const [embedState, setEmbedState] = useState<{
    open: boolean;
    videoId: string;
    originalUrl: string;
    title: string;
  } | null>(null);

  function handlePlay(card: ContentSourceCardData) {
    const fromUrl = card.sourceUrl ? parseVideoUrl(card.sourceUrl) : null;
    const videoId = fromUrl?.videoId ?? extractYouTubeVideoIdFromThumb(card.thumbnailUrl);
    if (!videoId) {
      toast.info("이 영상은 인앱 재생을 지원하지 않아요.");
      return;
    }
    setEmbedState({
      open: true,
      videoId,
      originalUrl: card.sourceUrl ?? `https://www.youtube.com/watch?v=${videoId}`,
      title: card.title?.trim() || "영상 재생",
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((r) => {
      const t = (r.title ?? "").toLowerCase();
      const c = (r.caption ?? "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [sources, query]);

  function handleCreate(sourceId: string) {
    navigate({
      to: "/create-wizard",
      search: {
        source_id: sourceId,
        ...(partnerId ? { partner_id: partnerId } : {}),
      } as never,
    });
  }

  // Slice 1 — 발견 카드 탭 → 수신 화면(/d) 재사용. 신규 라우트 없음.
  function handleOpenDrop(shareUuid: string) {
    navigate({ to: "/d/$shareUuid", params: { shareUuid } });
  }

  async function handleRemove(sourceId: string) {
    if (typeof window === "undefined") return;
    const ok = window.confirm("내 콘텐츠에서 뺄까요? 만든 카드는 영향 없어요");
    if (!ok) return;
    const supabase = getSupabase();
    if (!supabase) {
      toast.error("로그인 정보를 확인하지 못했어요.");
      return;
    }
    // claim 해제 — 하드 DELETE 는 info_drops FK 위반이라 불가.
    // RLS v5.8: 본인 행 또는 NULL 행만 UPDATE 가능.
    const { error } = await supabase
      .from("content_sources")
      .update({ registered_by_user_id: null })
      .eq("id", sourceId);
    if (error) {
      console.error("[explore] un-claim failed:", error);
      toast.error(`제거하지 못했어요: ${error.message}`);
      return;
    }
    toast.success("내 콘텐츠에서 뺐어요");
    void router.invalidate();
  }

  return (
    <div className="mx-auto max-w-md px-6 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-ko text-[#0A0A0A]">탐색</h1>
        <p className="mt-2 text-sm font-medium tracking-ko text-[#737373]">
          공개된 카드를 둘러보고, 모아둔 콘텐츠로 바로 카드를 만들어요.
        </p>
      </header>

      {/* Slice 1 — 발견 피드(공개 published 카드). 기존 DropFeedCard 재사용,
          카드 탭 → /d 수신 화면. 비어 있으면 섹션 자체를 숨김(빈 박스 방지). */}
      {discoverDrops.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold tracking-ko text-[#0A0A0A]">발견</h2>
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
        </section>
      ) : null}

      <ExploreSearchBar value={query} onChange={setQuery} />

      <DiscoverSection
        partnerId={partnerId}
        isBusiness={isBusiness}
        onRegistered={() => {
          // 등록 직후 "내가 모은 콘텐츠" 리스트 갱신.
          void router.invalidate();
        }}
      />

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
              const rawDesc =
                r.raw_meta && typeof r.raw_meta === "object" && "description" in r.raw_meta
                  ? String(((r.raw_meta as Record<string, unknown>).description as string) ?? "")
                  : "";
              const card: ContentSourceCardData = {
                id: r.id,
                title: r.title,
                authorName: r.author_name,
                thumbnailUrl: r.thumbnail_url,
                durationSec: r.duration_sec,
                sourceUrl: r.source_url,
                description: r.caption?.trim() || rawDesc || null,
              };
              return (
                <li key={r.id}>
                  <ContentSourceCard
                    source={card}
                    onCreate={handleCreate}
                    onRemove={handleRemove}
                    onPlay={handlePlay}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {embedState ? (
        <YouTubeEmbedModal
          open={embedState.open}
          onOpenChange={(open) => {
            if (!open) setEmbedState(null);
          }}
          videoId={embedState.videoId}
          originalUrl={embedState.originalUrl}
          title={embedState.title}
        />
      ) : null}
    </div>
  );
}
