import { useState } from "react";
import { Search, Sparkles, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { YouTubeEmbedModal } from "@/components/receiver/YouTubeEmbedModal";

export type DiscoverCandidate = {
  provider: "youtube";
  source_url: string;
  source_id: string;
  canonical_url: string;
  title: string | null;
  thumbnail_url: string | null;
  author_name: string | null;
  duration_sec: number | null;
  raw_meta: Record<string, unknown>;
};

type DiscoverResponse = {
  rawQuery?: string;
  enhancedQuery?: string;
  candidates?: DiscoverCandidate[];
  cached?: boolean;
  error?: string;
  message?: string;
};

function extractDescription(raw: Record<string, unknown>): string {
  const d = raw.description;
  if (typeof d === "string") return d.trim();
  return "";
}

/** 키워드 → YouTube 검색 + 후보 등록(claim). 사업자는 매장 키워드 보강, 손님은 관심 주제 검색. */
export function DiscoverSection({
  partnerId,
  onRegistered,
  isBusiness = false,
  onImport,
}: {
  partnerId: string | null;
  onRegistered: () => void;
  isBusiness?: boolean;
  /** STEP1-fix: 만들기 '가져오기' 모드 — 후보 등록(claim) 후 이 콜백으로 위저드 prefill 진입.
   *  미지정(explore 등록 모드)이면 기존처럼 '등록됨' 배지로 끝. */
  onImport?: (candidate: DiscoverCandidate) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [enhanced, setEnhanced] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  // 현재 uid 가 claim 한 source_id 집합. 검색 결과 받은 직후 한 번에 조회.
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  // 작업 B: 인앱 임베드 모달 — discover 후보의 source_id 는 youtube videoId 자체.
  const [embedState, setEmbedState] = useState<{
    open: boolean;
    videoId: string;
    originalUrl: string;
    title: string;
  } | null>(null);

  function openEmbed(c: DiscoverCandidate) {
    if (c.provider !== "youtube" || !c.source_id) {
      toast.info("이 영상은 인앱 재생을 지원하지 않아요.");
      return;
    }
    setEmbedState({
      open: true,
      videoId: c.source_id,
      originalUrl: c.source_url,
      title: c.title?.trim() || "영상 재생",
    });
  }

  async function handleSearch() {
    const k = query.trim();
    if (!k || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: k,
          ...(partnerId ? { partner_id: partnerId } : {}),
        }),
      });
      const json = (await res.json()) as DiscoverResponse;
      if (!res.ok) {
        setError(json.message ?? "검색에 실패했어요.");
        setCandidates([]);
        return;
      }
      // 실제 보강이 일어났을 때만(enhancedQuery !== rawQuery) 안내를 띄운다.
      // 손님은 보강이 없어 둘이 같으므로 자동으로 안 뜬다.
      const eq = json.enhancedQuery ?? null;
      setEnhanced(eq && eq !== k ? eq : null);
      const cs = json.candidates ?? [];
      setCandidates(cs);
      // 보강된 키워드를 입력창에 prefill — 사장님이 직접 수정 가능.
      if (json.enhancedQuery && json.enhancedQuery !== k) {
        setQuery(json.enhancedQuery);
      }
      // claim 상태 한 번에 조회 (N+1 쿼리 금지).
      if (cs.length > 0) {
        const supabase = getSupabase();
        if (supabase) {
          const { data: sess } = await supabase.auth.getSession();
          const uid = sess.session?.user.id;
          if (uid) {
            const ids = cs.map((c) => c.source_id);
            const { data: claimed } = await supabase
              .from("content_sources")
              .select("source_id")
              .eq("provider", "youtube")
              .eq("registered_by_user_id", uid)
              .in("source_id", ids);
            const next = new Set<string>();
            for (const row of claimed ?? []) {
              if (row.source_id) next.add(row.source_id);
            }
            setClaimedIds(next);
          }
        }
      } else {
        setClaimedIds(new Set());
      }
    } catch {
      setError("네트워크 오류로 검색하지 못했어요.");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(c: DiscoverCandidate) {
    setRegisteringId(c.source_id);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        toast.error("로그인 정보를 확인하지 못했어요.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        toast.error("로그인이 필요해요.");
        return;
      }
      // UPSERT: UNIQUE(provider, source_id) 충돌 시 UPDATE 분기로 registered_by_user_id
      // 가 본인 uid 로 박힘 (claim). RLS v5.8 (NULL 또는 본인) 허용.
      const { error: upsertErr } = await supabase
        .from("content_sources")
        .upsert(
          {
            provider: c.provider,
            source_url: c.source_url,
            source_id: c.source_id,
            canonical_url: c.canonical_url,
            title: c.title,
            thumbnail_url: c.thumbnail_url,
            author_name: c.author_name,
            duration_sec: c.duration_sec,
            source_mode: "user_submitted",
            rights_status: "unclaimed",
            registered_by_user_id: uid,
            raw_meta: {
              ...c.raw_meta,
              enhanced_query: enhanced,
              discovered_via: "discover-content",
            },
          },
          { onConflict: "provider,source_id", ignoreDuplicates: false },
        );
      if (upsertErr) {
        // 가져오기 모드 — claim 은 best-effort. 기존 행 등 RLS(403)로 막혀도 import 진행
        //   (위저드가 ?url= 에서 oembed 로 소스 해석 → source_url 만 있으면 됨). RLS 무변경.
        if (onImport) {
          console.warn("[discover] claim 실패(무시, import 진행):", upsertErr.message);
        } else {
          // 등록(explore) 모드 — claim 이 목적이므로 실패는 에러 표시 후 중단.
          console.error("[discover] claim upsert failed:", upsertErr);
          toast.error(`담지 못했어요: ${upsertErr.message}`);
          return;
        }
      }
      // 가져오기 모드 — claim(성공/실패 무관) 후 위저드 prefill 로 합류.
      if (onImport) {
        onImport(c);
        return;
      }
      setClaimedIds((prev) => {
        const next = new Set(prev);
        next.add(c.source_id);
        return next;
      });
      toast.success("내 콘텐츠에 담았어요");
      onRegistered();
    } finally {
      setRegisteringId(null);
    }
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-bold tracking-ko text-[#0A0A0A]">콘텐츠 자동 찾기</h2>
      <div className="flex gap-2">
        <div className="flex h-12 min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 transition-colors focus-within:border-[#0A0A0A]">
          <Search className="h-[18px] w-[18px] shrink-0 text-[#A3A3A3]" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
            placeholder={isBusiness ? "매장 키워드 (예: 모래재)" : "관심 주제로 영상 찾기 (예: 캠핑 요리)"}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-[#0A0A0A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#171717] disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
        >
          {loading ? "찾는 중…" : "찾기"}
        </button>
      </div>

      {enhanced && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#0A0A0A]" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-ko text-[#0A0A0A]">
              검색어를 이렇게 보강했어요
            </p>
            <p className="mt-1 truncate text-sm font-medium tracking-ko text-[#525252]">
              {enhanced}
            </p>
            <p className="mt-1 text-[11px] font-medium tracking-ko text-[#A3A3A3]">
              수정해서 다시 찾을 수 있어요
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" strokeWidth={2} />
          <p className="text-sm font-medium tracking-ko text-[#7F1D1D]">{error}</p>
        </div>
      )}

      {!loading && candidates.length === 0 && enhanced && !error && (
        <div className="mt-4 rounded-2xl border border-[#E5E5E5] bg-white p-6 text-center">
          <p className="text-sm font-medium tracking-ko text-[#737373]">
            검색 결과가 없어요. 다른 키워드로 해보세요.
          </p>
        </div>
      )}

      {candidates.length > 0 && (
        <ul className="mt-4 space-y-3">
          {candidates.map((c) => {
            const isRegistered = claimedIds.has(c.source_id);
            const isBusy = registeringId === c.source_id;
            const description = extractDescription(c.raw_meta);
            return (
              <li key={`${c.provider}|${c.source_id}`}>
                <article className="flex w-full items-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-3">
                  <button
                    type="button"
                    onClick={() => openEmbed(c)}
                    aria-label="영상 재생"
                    className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5] transition-opacity hover:opacity-90"
                  >
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#A3A3A3]">
                        <Search className="size-5" strokeWidth={2} />
                      </div>
                    )}
                    <span className="absolute left-1 top-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold tracking-ko text-white">
                      유튜브
                    </span>
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => openEmbed(c)}
                      className="block w-full min-w-0 text-left"
                    >
                      <p className="line-clamp-2 text-sm font-bold tracking-ko text-[#0A0A0A] hover:underline">
                        {c.title ?? "제목 없음"}
                      </p>
                    </button>
                    {c.author_name && (
                      <p className="truncate text-xs font-medium tracking-ko text-[#737373]">
                        {c.author_name}
                      </p>
                    )}
                    {description && (
                      <p className="line-clamp-2 text-[11px] font-medium leading-snug tracking-ko text-[#A3A3A3]">
                        {description}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRegister(c)}
                      disabled={isBusy || (!onImport && isRegistered)}
                      className="mt-1 inline-flex h-9 min-h-[36px] w-fit items-center justify-center gap-1 rounded-lg bg-[#0A0A0A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#171717] disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
                    >
                      {isBusy ? (
                        onImport ? (
                          "가져오는 중…"
                        ) : (
                          "등록 중…"
                        )
                      ) : onImport ? (
                        "가져오기"
                      ) : isRegistered ? (
                        <>
                          <Check className="size-3.5" strokeWidth={2.5} />
                          등록됨
                        </>
                      ) : (
                        "등록"
                      )}
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

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
