import { useState } from "react";
import { Search, Sparkles, Check, AlertCircle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type DiscoverCandidate = {
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

/** 매장 키워드 → YouTube 검색 + 자동 보강 + 후보 등록. */
export function DiscoverSection({
  partnerId,
  onRegistered,
}: {
  partnerId: string | null;
  onRegistered: () => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [enhanced, setEnhanced] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [registerError, setRegisterError] = useState<string | null>(null);

  async function handleSearch() {
    const k = query.trim();
    if (!k || loading) return;
    setLoading(true);
    setError(null);
    setRegisterError(null);
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
      setEnhanced(json.enhancedQuery ?? null);
      setCandidates(json.candidates ?? []);
      // 보강된 키워드를 입력창에 prefill — 사장님이 직접 수정 가능.
      if (json.enhancedQuery && json.enhancedQuery !== k) {
        setQuery(json.enhancedQuery);
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
    setRegisterError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setRegisterError("로그인 정보를 확인하지 못했어요.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setRegisterError("로그인이 필요해요.");
        return;
      }
      const { error: insErr } = await supabase.from("content_sources").insert({
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
      });
      if (insErr) {
        // UNIQUE(provider, source_id) 충돌 = 이미 등록됨
        if ((insErr.code as string) === "23505" || /duplicate|unique/i.test(insErr.message)) {
          setRegisteredIds((prev) => new Set(prev).add(c.source_id));
          setRegisterError("이미 등록된 콘텐츠예요. 아래 '내가 모은 콘텐츠'에 있어요.");
          onRegistered();
          return;
        }
        setRegisterError("등록에 실패했어요.");
        return;
      }
      setRegisteredIds((prev) => new Set(prev).add(c.source_id));
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
            placeholder="매장 키워드 (예: 모래재)"
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
        <>
          {registerError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-3">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-[#92400E]"
                strokeWidth={2}
              />
              <p className="text-sm font-medium tracking-ko text-[#78350F]">{registerError}</p>
            </div>
          )}
          <ul className="mt-4 space-y-3">
            {candidates.map((c) => {
              const isRegistered = registeredIds.has(c.source_id);
              const isBusy = registeringId === c.source_id;
              return (
                <li key={`${c.provider}|${c.source_id}`}>
                  <article className="flex w-full items-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-3">
                    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5]">
                      {c.thumbnail_url ? (
                        <img
                          src={c.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#A3A3A3]">
                          <Search className="size-5" strokeWidth={2} />
                        </div>
                      )}
                      <span className="absolute left-1 top-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold tracking-ko text-white">
                        유튜브
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="line-clamp-2 text-sm font-bold tracking-ko text-[#0A0A0A]">
                        {c.title ?? "제목 없음"}
                      </p>
                      {c.author_name && (
                        <p className="truncate text-xs font-medium tracking-ko text-[#737373]">
                          {c.author_name}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleRegister(c)}
                        disabled={isBusy || isRegistered}
                        className="mt-1 inline-flex h-9 min-h-[36px] w-fit items-center justify-center gap-1 rounded-lg bg-[#0A0A0A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#171717] disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
                      >
                        {isRegistered ? (
                          <>
                            <Check className="size-3.5" strokeWidth={2.5} />
                            등록됨
                          </>
                        ) : isBusy ? (
                          "등록 중…"
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
        </>
      )}
    </section>
  );
}
