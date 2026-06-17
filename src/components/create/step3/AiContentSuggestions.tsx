import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { CardShell } from "@/components/cards/CardShell";
import type { CardConfig } from "@/components/cards/types";
import {
  PROVIDER_META,
  type DiscoverCandidate,
  type DiscoverProvider,
} from "@/components/explore/DiscoverSection";

// 3-A 큐레이션 제안 — "콘텐츠 담기" 안의 AI 추천 섹션.
//   마운트(또는 topic 변경) 시 대표 영상 제목으로 멀티소스(youtube+naver) 자동 검색하고
//   ai_suggested 카드로 보여준다. "그대로 사용" → 기존 반입 경로(onImport) → 드롭에 추가(모셔오기).
//   신규 생성 아님 = 기존 콘텐츠를 찾아 제안하는 것. discover-content edge 무변경(호출만).
//
//   회귀 차단:
//   - topic:true 로 /api/discover 호출 → 워커가 매장 보강(buildEnhancedQuery) 생략(토픽 그대로).
//   - 빈 제목 / 빈 결과 / 실패 = 섹션 숨김(에러 노출 X). 직접 검색으로 폴백.
//   - 이미 담은 콘텐츠(provider+source_id) · 대표 영상은 제안에서 제외.

type DiscoverResponse = {
  candidates?: DiscoverCandidate[];
  storeResolved?: boolean;
  error?: string;
  message?: string;
};

const MAX_SUGGESTIONS = 4;

// 대표 영상 제목 → best-effort 검색 키워드(폴백 전용).
//   첫 "|" 앞 구간 → 해시태그 제거 → 특수문자 제거 → 앞쪽 의미있는 단어 일부.
//   예) "Vlog : 캠핑 브이로그 | 노을맛집… | 괴산모래재캠핑장" → "Vlog 캠핑 브이로그".
function cleanTitleKeyword(raw: string): string {
  if (!raw) return "";
  const head = raw.split("|")[0] ?? raw;
  const noTags = head.replace(/#[^\s#]+/g, " ");
  const alnum = noTags.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const words = alnum.split(/\s+/).filter(Boolean).slice(0, 6);
  return words.join(" ").slice(0, 60).trim();
}

export function AiContentSuggestions({
  topic,
  partnerId,
  excludeSourceIds,
  onImport,
}: {
  /** 대표 영상 제목(oEmbed). 매장 데이터 없을 때 폴백 키워드로만 사용. */
  topic: string;
  /** 이 드롭이 타깃하는 매장. store 모드 키워드를 이 매장으로 해석(없으면 워커 first-approved 폴백). */
  partnerId?: string | null;
  /** 이미 담은 콘텐츠 + 대표 영상의 source_id — 제안에서 제외. */
  excludeSourceIds: string[];
  /** "그대로 사용" → 직접 검색 가져오기와 동일 경로. */
  onImport: (candidate: DiscoverCandidate) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DiscoverCandidate[]>([]);
  // 중복 fetch 가드 — "마지막으로 fetch 한 runKey". cleanup 에서 리셋하므로
  //   재실행/재마운트를 막지 않는다(=state 세팅을 절대 막지 않음). 같은 runKey 의
  //   불필요한 재호출만 방지.
  const fetchedRef = useRef<string | null>(null);

  const trimmedTopic = topic.trim();
  // 제목 없어도 매장 키워드로 검색 가능 → "__store__" 키로 1회 실행.
  //   partnerId 가 늦게 도착하면(라우트 prop) 매장이 바뀐 것 → runKey 에 포함해 재검색.
  const runKey = `${partnerId ?? ""}|${trimmedTopic || "__store__"}`;

  useEffect(() => {
    if (fetchedRef.current === runKey) return;
    fetchedRef.current = runKey;

    let cancelled = false;
    const exclude = new Set(excludeSourceIds.filter(Boolean));
    const pick = (cands?: DiscoverCandidate[]) =>
      (cands ?? [])
        .filter((c) => c.source_id && !exclude.has(c.source_id))
        .slice(0, MAX_SUGGESTIONS);

    async function search(reqBody: Record<string, unknown>): Promise<DiscoverResponse | null> {
      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        });
        if (!res.ok) return null; // 실패 = graceful(에러 노출 X).
        return (await res.json()) as DiscoverResponse;
      } catch {
        return null;
      }
    }

    setLoading(true);
    (async () => {
      try {
        // 1) 매장 키워드(매장명 + 지역) 우선 — 이 드롭의 매장(partnerId) 으로 해석.
        //    partnerId 없으면 워커가 first-approved 폴백.
        const store = await search({
          keywordSource: "store",
          ...(partnerId ? { partner_id: partnerId } : {}),
        });
        if (cancelled) return;
        if (store?.storeResolved) {
          // 매장 데이터 있음 → 그 결과만 사용(제목 폴백 안 함). 0개면 섹션 숨김.
          setSuggestions(pick(store.candidates));
          return;
        }
        // 2) 매장 데이터 없음 → 대표 영상 제목 정제 폴백(topic:true = 매장 보강 우회).
        const kw = cleanTitleKeyword(trimmedTopic);
        if (!kw) {
          setSuggestions([]);
          return;
        }
        const byTitle = await search({ keyword: kw, topic: true });
        if (cancelled) return;
        setSuggestions(pick(byTitle?.candidates));
      } finally {
        // 성공/매장폴백/0개/예외 어떤 경로든 로딩 해제 → 스켈레톤 고착 방지.
        //   (취소된 stale run 은 제외 — 후속 run 이 자기 finally 에서 해제).
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // 가드 리셋 — 재실행/재마운트가 fetch·state 세팅을 못 하게 막지 않도록.
      fetchedRef.current = null;
    };
    // exclude 스냅샷은 최초 fetch 에만 영향 + 렌더 시점 재필터로 라이브 반영 → runKey 만 의존.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  function removeFromList(sourceId: string) {
    setSuggestions((prev) => prev.filter((c) => c.source_id !== sourceId));
  }

  function handleAccept(c: DiscoverCandidate) {
    onImport(c); // 직접 검색 가져오기와 동일 경로(handleImport) → attachedVideos push.
    removeFromList(c.source_id);
  }

  // 렌더 시점에도 exclude 재적용 — 직접 검색으로 같은 항목을 담으면 AI 목록에서도 즉시 사라짐.
  const excludeSet = new Set(excludeSourceIds.filter(Boolean));
  const visible = suggestions.filter((c) => !excludeSet.has(c.source_id));

  // 로딩도 결과도 없으면 숨김(빈 카드 남기지 않음 → 직접 검색만 노출).
  if (!loading && visible.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-text-strong" strokeWidth={2} />
        <h3 className="text-sm font-bold tracking-ko text-text-strong">AI 추천 콘텐츠</h3>
      </div>
      <p className="mb-3 text-xs font-medium tracking-ko text-text-muted">
        대표 영상과 어울리는 콘텐츠예요. 마음에 들면 그대로 담아보세요.
      </p>

      {loading ? (
        <ul className="space-y-3" aria-hidden>
          {[0, 1].map((i) => (
            <li key={i} className="rounded-2xl border border-border bg-white p-4">
              <div className="flex gap-3">
                <div className="h-16 w-24 shrink-0 animate-pulse rounded-lg bg-surface" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-surface" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-surface" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          {visible.map((c) => {
            const provider = c.provider as DiscoverProvider;
            const meta = PROVIDER_META[provider] ?? PROVIDER_META.youtube;
            const ProviderIcon = meta.Icon;
            const config: CardConfig = {
              id: `ai-sug-${c.provider}-${c.source_id}`,
              type: "message", // CardShell 렌더에 미사용 — ai_suggested 카드 셸만 재사용.
              required: false,
              enabled: true,
              position: 0,
              status: "ai_suggested",
              data: {},
              label: meta.label,
            };
            return (
              <CardShell
                key={`${c.provider}|${c.source_id}`}
                config={config}
                onAccept={() => handleAccept(c)}
                onDismiss={() => removeFromList(c.source_id)}
              >
                <div className="flex gap-3">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-subtle">
                        <ProviderIcon className="size-5" strokeWidth={2} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex w-fit items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-semibold tracking-ko text-text-muted">
                      <ProviderIcon className="size-3" strokeWidth={2} />
                      {meta.label}
                    </span>
                    <p className="mt-1 line-clamp-2 text-sm font-bold tracking-ko text-text-strong">
                      {c.title ?? "제목 없음"}
                    </p>
                    {c.snippet ? (
                      <p className="mt-1 line-clamp-1 text-[11px] font-medium tracking-ko text-text-subtle">
                        {c.snippet}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardShell>
            );
          })}
        </div>
      )}
    </div>
  );
}
