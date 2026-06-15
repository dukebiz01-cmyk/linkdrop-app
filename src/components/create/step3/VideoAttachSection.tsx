import { useState } from "react";
import { Film, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { StepBadge } from "@/components/create/StepBadge";
import { DiscoverSection } from "@/components/explore/DiscoverSection";
import type { AttachedVideo } from "@/components/create/types";

// Slice2 멀티영상 담기 — primary 영상 1(읽기 전용) + 추가 영상 N.
//   "+ 영상 더 담기" → DiscoverSection 검색(onImport=state push, navigate 아님 → state 유지).
//   중복 source_id(primary 또는 기존 추가) skip. 제출 시 위저드가 video 블록으로 빌드.

export function VideoAttachSection({
  primary,
  primarySourceId,
  isBusiness,
  value,
  onChange,
}: {
  primary: { title: string; thumbnailUrl: string } | null;
  primarySourceId: string | null;
  isBusiness?: boolean;
  value: AttachedVideo[];
  onChange: (next: AttachedVideo[]) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  function handleImport(c: {
    provider: string;
    source_id: string;
    source_url: string;
    canonical_url: string;
    title: string | null;
    thumbnail_url: string | null;
    author_name: string | null;
  }) {
    // 중복 방지 — primary 또는 이미 담은 영상과 같으면 skip.
    if (c.source_id === primarySourceId) return;
    if (value.some((v) => v.sourceId === c.source_id)) return;
    onChange([
      ...value,
      {
        provider: c.provider,
        sourceId: c.source_id,
        sourceUrl: c.source_url,
        canonicalUrl: c.canonical_url,
        title: c.title,
        thumbnailUrl: c.thumbnail_url,
        authorName: c.author_name,
      },
    ]);
  }

  function handleRemove(sourceId: string) {
    onChange(value.filter((v) => v.sourceId !== sourceId));
  }

  return (
    <section className="px-6 pb-28 pt-6">
      <StepBadge n={2} />
      <h2 className="mt-3 text-lg font-extrabold tracking-ko text-text-strong">
        이 카드에 담긴 영상 <span className="text-sm font-medium text-text-subtle">(선택)</span>
      </h2>
      <p className="mt-1 text-sm font-medium tracking-ko text-text-muted">
        대표 영상에 다른 영상을 더 담을 수 있어요.
      </p>

      <ul className="mt-4 space-y-2">
        {/* 대표(primary) — 읽기 전용 */}
        {primary ? (
          <li className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2">
            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
              {primary.thumbnailUrl ? (
                <img src={primary.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-text-subtle">
                  <Film className="size-5" strokeWidth={2} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold tracking-ko text-text-strong">
                {primary.title || "대표 영상"}
              </p>
              <span className="mt-0.5 inline-block rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold tracking-ko text-text-muted">
                대표
              </span>
            </div>
          </li>
        ) : null}

        {/* 추가 영상 */}
        {value.map((v) => (
          <li
            key={v.sourceId}
            className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2"
          >
            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
              {v.thumbnailUrl ? (
                <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-text-subtle">
                  <Film className="size-5" strokeWidth={2} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold tracking-ko text-text-strong">
                {v.title || "담은 영상"}
              </p>
              {v.authorName ? (
                <p className="mt-0.5 truncate text-xs font-medium tracking-ko text-text-muted">
                  {v.authorName}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(v.sourceId)}
              aria-label="영상 빼기"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-surface hover:text-text-muted"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>

      {/* + 영상 더 담기 — 검색 토글 */}
      <button
        type="button"
        onClick={() => setSearchOpen((v) => !v)}
        className="mt-3 flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold tracking-ko text-text-strong transition-colors hover:border-text-muted"
        aria-expanded={searchOpen}
      >
        <span className="inline-flex items-center gap-2">
          <Plus className="size-4" strokeWidth={2} />영상 더 담기
        </span>
        {searchOpen ? (
          <ChevronUp className="size-4 text-text-muted" strokeWidth={2} />
        ) : (
          <ChevronDown className="size-4 text-text-muted" strokeWidth={2} />
        )}
      </button>

      {searchOpen ? (
        <div className="mt-2">
          <DiscoverSection
            partnerId={null}
            isBusiness={Boolean(isBusiness)}
            onRegistered={() => {}}
            onImport={handleImport}
          />
        </div>
      ) : null}
    </section>
  );
}
