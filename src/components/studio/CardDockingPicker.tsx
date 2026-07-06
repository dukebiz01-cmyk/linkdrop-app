import { useEffect, useState } from "react";
import { Search, Plus, Check, X, Loader2, Layers, Image as ImageIcon } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getDockCandidates, type DockCandidate } from "@/lib/feed-queries";
import type { AttachedProduct } from "@/components/create/types";

// ════════════════════════ DOCK-2 카드 도킹 피커 (v1) ════════════════════════
// 이미 발행된 공개 카드(내 것+남의 것)를 검색·목적필터로 찾아 지금 만드는 카드에
//   ref 블록으로 연결(도킹)한다. §0: 원본 외부 그대로 — 여기서는 참조 재료만 담고,
//   주문·전환은 원본 카드(/d/{refShareUuid})가 받는다(분배·전환 로직 0터치).
// 패턴: DiscoverSection(검색+리스트+선택 콜백) × ProductAttachSection(value/onChange
//   + 담은 목록) 증분 합성. 데이터소스만 getDockCandidates(공개 발행 카드)로 교체.
// SSR 락: Radix Dialog/Sheet 금지 — 인라인 아코디언 펼침 전용 + mounted 게이트(#418).

/** 도킹 1건 — AttachedProduct(기존 ref 블록 재료) + 출처 생산자명 스냅샷. */
export type DockedProduct = AttachedProduct & {
  /** 도킹 시점 원본 카드 owner 의 public_profiles.display_name 스냅샷. */
  producerName?: string;
  /** 도킹 시점 원본 카드 purpose — 스튜디오 미리보기 표시 전용(block_data 미전송). */
  purpose?: string;
};

// 목적 필터 칩 — 탐색 4탭(explore.tsx:47-52)과 동일 분류: 전체 / 정보 / 쿠폰·예약(묶음) /
//   상품판매(구매). 상담 제외. null = 전체(미지정).
const PURPOSE_CHIPS: Array<{ label: string; purposes: string[] | null }> = [
  { label: "전체", purposes: null },
  { label: "정보", purposes: ["정보"] },
  { label: "쿠폰·예약", purposes: ["쿠폰", "예약"] },
  { label: "상품판매", purposes: ["구매"] },
];

function priceLabel(krw: number | null): string {
  return krw != null ? `${Number(krw).toLocaleString("ko-KR")}원` : "";
}

export function CardDockingPicker({
  value,
  onChange,
  onDone,
}: {
  value: DockedProduct[];
  onChange: (next: DockedProduct[]) => void;
  /** 완료(확정) — 부모 아코디언 접기. 미지정 시 버튼 미렌더. */
  onDone?: () => void;
}) {
  // mounted 게이트 — SSR/hydration 시 데이터 의존 UI 미렌더(#418 차단, 캘린더 인라인 관례).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [query, setQuery] = useState("");
  const [chipIdx, setChipIdx] = useState(0);
  const [candidates, setCandidates] = useState<DockCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(term: string, purposes: string[] | null) {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const rows = await getDockCandidates(supabase, {
        ...(term.trim() ? { searchTerm: term.trim() } : {}),
        ...(purposes ? { purposes } : {}),
        currentUserId: sess.session?.user.id ?? null,
      });
      setCandidates(rows);
      setSearched(true);
    } catch (e) {
      console.error("[CardDockingPicker] search failed:", e);
      setError("카드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  // 첫 펼침 시 최근 공개 카드 20개 로드(검색 전 빈 화면 방지).
  useEffect(() => {
    if (!mounted) return;
    void runSearch("", PURPOSE_CHIPS[chipIdx].purposes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  const dockedIds = new Set(value.map((p) => p.refDropId));

  function handleDock(c: DockCandidate) {
    if (dockedIds.has(c.refDropId)) return;
    onChange([
      ...value,
      {
        refDropId: c.refDropId,
        refShareUuid: c.refShareUuid,
        name: c.name,
        priceKrw: c.priceKrw,
        imageUrl: c.imageUrl,
        ...(c.producerName ? { producerName: c.producerName } : {}),
        ...(c.purpose ? { purpose: c.purpose } : {}),
      },
    ]);
  }

  function handleUndock(refDropId: string) {
    onChange(value.filter((p) => p.refDropId !== refDropId));
  }

  function handleChip(idx: number) {
    setChipIdx(idx);
    void runSearch(query, PURPOSE_CHIPS[idx].purposes);
  }

  return (
    <div className="space-y-3">
      {/* 검색바 — Enter/버튼 실행(DiscoverSection 관례) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(query, PURPOSE_CHIPS[chipIdx].purposes);
        }}
        className="flex items-center gap-2"
      >
        <div className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg bg-white px-3 [box-shadow:0_0_0_1px_#E5E5E5]">
          <Search className="h-4 w-4 shrink-0 text-[#A3A3A3]" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="카드 제목·품목 검색"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#0A0A0A] px-3 text-[13px] font-bold text-white disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
        >
          검색
        </button>
      </form>

      {/* 목적 필터 칩 */}
      <div className="flex flex-wrap gap-1.5">
        {PURPOSE_CHIPS.map((chip, i) => {
          const active = chipIdx === i;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleChip(i)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                active ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252]"
              }`}
              style={active ? undefined : { boxShadow: "0 0 0 1px #E5E5E5" }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 후보 리스트 */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[#A3A3A3]">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          카드 찾는 중…
        </div>
      ) : error ? (
        <p className="py-4 text-center text-[12px] text-[#EF4444]">{error}</p>
      ) : candidates.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-[#A3A3A3]">
          {searched ? "조건에 맞는 공개 카드가 없어요" : "검색어를 입력해 보세요"}
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {candidates.map((c) => {
            const docked = dockedIds.has(c.refDropId);
            return (
              <li
                key={c.refDropId}
                className="flex items-center gap-2.5 rounded-lg bg-white p-2 [box-shadow:0_0_0_0.5px_#E5E5E5]"
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
                    <ImageIcon className="h-5 w-5 text-[#A3A3A3]" strokeWidth={2} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#737373]">
                    {c.purpose ? (
                      <span className="rounded-full bg-[#F5F5F5] px-1.5 py-0.5 font-semibold">
                        {c.purpose}
                      </span>
                    ) : null}
                    <span className="truncate">
                      {c.producerName ?? "익명"}
                      {c.isMine ? " · 내 카드" : ""}
                    </span>
                    {c.priceKrw != null ? (
                      <span className="shrink-0 font-semibold text-[#0A0A0A]">
                        {priceLabel(c.priceKrw)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDock(c)}
                  disabled={docked}
                  aria-label={docked ? "도킹됨" : "도킹"}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0A0A0A] text-white disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
                >
                  {docked ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 도킹한 카드 — 다건. 발행 시 ref 블록(관련 상품)으로 합류(미리보기 배열 = 이 목록). */}
      {value.length > 0 ? (
        <div className="border-t border-dashed border-[#D4D4D4] pt-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-[#0A0A0A]">
            <Layers className="h-3.5 w-3.5" strokeWidth={2} />
            도킹한 카드 {value.length}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {value.map((p) => (
              <li
                key={p.refDropId}
                className="flex items-center gap-2.5 rounded-lg bg-white p-2 [box-shadow:0_0_0_0.5px_#E5E5E5]"
              >
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
                    <ImageIcon className="h-4 w-4 text-[#A3A3A3]" strokeWidth={2} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">{p.name}</p>
                  <p className="truncate text-[11px] text-[#737373]">
                    {p.producerName ? `${p.producerName} 님의 카드` : "출처 미확인"}
                    {p.priceKrw != null ? ` · ${priceLabel(p.priceKrw)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUndock(p.refDropId)}
                  aria-label="도킹 해제"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#A3A3A3] hover:text-[#0A0A0A]"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 완료(확정) — 쿠폰 블록 "확인" 버튼(studio-build :1815-1824) 톤 동일. 도킹은 즉시
          미리보기 반영이라 완료 = 확정·아코디언 접기 역할만. */}
      {onDone ? (
        <button
          type="button"
          onClick={onDone}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0A0A0A] py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#171717]"
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          완료{value.length > 0 ? ` (${value.length}개 도킹됨)` : ""}
        </button>
      ) : null}
    </div>
  );
}
