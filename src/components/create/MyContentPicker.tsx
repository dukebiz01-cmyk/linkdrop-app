import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Package, ChevronDown, ChevronUp } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import {
  ContentSourceCard,
  type ContentSourceCardData,
} from "@/components/explore/ContentSourceCard";
import { YouTubeEmbedModal } from "@/components/receiver/YouTubeEmbedModal";
import { parseVideoUrl } from "@/lib/video-metadata";

// 만들기 입력 — '내 콘텐츠에서 가져오기' 경로 (explore 에서 이전).
//   본인 등록 content_sources(registered_by_user_id=uid) 목록을 ContentSourceCard 로
//   렌더. 카드 [카드 만들기] 탭 → /create-wizard?source_id=(+partner_id/purpose) navigate →
//   기존 source_id prefill 경로로 합류(url+메타 자동, partner 자동연결 보존).
//   재생/제거 동작 보존. 내용 없으면 섹션 숨김(빈 박스 방지).

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

function extractYouTubeVideoIdFromThumb(thumb: string | null | undefined): string | null {
  if (!thumb) return null;
  const m = thumb.match(/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

function toCard(r: ContentSourceRow): ContentSourceCardData {
  const rawDesc =
    r.raw_meta && typeof r.raw_meta === "object" && "description" in r.raw_meta
      ? String(((r.raw_meta as Record<string, unknown>).description as string) ?? "")
      : "";
  return {
    id: r.id,
    title: r.title,
    authorName: r.author_name,
    thumbnailUrl: r.thumbnail_url,
    durationSec: r.duration_sec,
    sourceUrl: r.source_url,
    description: r.caption?.trim() || rawDesc || null,
  };
}

/** purposeEn = 현재 선택 목적(영문). 가져오기 진입 시 목적 보존용(source_id navigate 합류). */
export function MyContentPicker({ purposeEn }: { purposeEn?: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ContentSourceRow[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [embedState, setEmbedState] = useState<{
    open: boolean;
    videoId: string;
    originalUrl: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user.id ?? null;
        if (!uid) {
          if (!cancelled) setLoading(false);
          return;
        }
        const [{ data: partner }, { data: srcRows }] = await Promise.all([
          supabase
            .from("partners")
            .select("id")
            .eq("owner_user_id", uid)
            .eq("verification_status", "approved")
            .limit(1)
            .maybeSingle(),
          supabase
            .from("content_sources")
            .select(
              "id, title, caption, author_name, thumbnail_url, duration_sec, source_url, raw_meta",
            )
            .eq("registered_by_user_id", uid)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);
        if (cancelled) return;
        setPartnerId((partner as { id: string } | null)?.id ?? null);
        setRows((srcRows ?? []) as ContentSourceRow[]);
      } catch (e) {
        console.error("[MyContentPicker] load failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // 카드 [카드 만들기] = 이 콘텐츠 가져오기 → source_id prefill 경로로 navigate.
  function handlePick(sourceId: string) {
    navigate({
      to: "/create-wizard",
      search: {
        source_id: sourceId,
        ...(partnerId ? { partner_id: partnerId } : {}),
        ...(purposeEn ? { purpose: purposeEn } : {}),
      } as never,
    });
  }

  async function handleRemove(sourceId: string) {
    if (typeof window === "undefined") return;
    const ok = window.confirm("내 콘텐츠에서 뺄까요? 만든 카드는 영향 없어요");
    if (!ok) return;
    const supabase = getSupabase();
    // claim 해제 — 하드 DELETE 는 FK 위반이라 불가. RLS v5.8: 본인/NULL 행만 UPDATE.
    const { error } = await supabase
      .from("content_sources")
      .update({ registered_by_user_id: null })
      .eq("id", sourceId);
    if (error) {
      console.error("[MyContentPicker] un-claim failed:", error);
      toast.error(`제거하지 못했어요: ${error.message}`);
      return;
    }
    toast.success("내 콘텐츠에서 뺐어요");
    setRows((prev) => prev.filter((r) => r.id !== sourceId));
  }

  // 로딩 중 또는 가진 콘텐츠 없으면 섹션 자체를 숨김(직접 입력만 노출).
  if (loading || rows.length === 0) return null;

  return (
    <section className="px-6 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold tracking-ko text-text-strong transition-colors hover:border-text-muted"
        aria-expanded={expanded}
      >
        <span className="inline-flex items-center gap-2">
          <Package className="size-4" strokeWidth={2} />내 콘텐츠에서 가져오기 {rows.length}
        </span>
        {expanded ? (
          <ChevronUp className="size-4 text-text-muted" strokeWidth={2} />
        ) : (
          <ChevronDown className="size-4 text-text-muted" strokeWidth={2} />
        )}
      </button>

      {expanded ? (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <ContentSourceCard
                source={toCard(r)}
                onCreate={handlePick}
                onRemove={handleRemove}
                onPlay={handlePlay}
              />
            </li>
          ))}
        </ul>
      ) : null}

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
    </section>
  );
}
