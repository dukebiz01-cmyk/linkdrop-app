import { useState, useRef, useEffect } from "react";
import {
  LayoutGrid,
  LayoutList,
  Clock,
  Compass,
  Layers,
  Newspaper,
  TicketPercent,
  Tag,
  Send,
  Diamond,
  Check,
  ChevronDown,
} from "lucide-react";
import { ShareCardTile, ShareCardTileSkeleton, type DropFeedItem } from "./share-card-tile";

// ── 프리뷰용 mock 기본값 (실제 앱에서는 props로 주입) ──────────
const inHours = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

const MOCK_DROPS: DropFeedItem[] = [
  {
    shareUuid: "s1",
    maker: { name: "포레스트 커피" },
    videoThumbnailUrl: "https://picsum.photos/seed/cafe-latte/400/400",
    videoDurationSec: 92,
    intent: "정보",
    title: "숲속 감성 카페, 평일 오후가 가장 한가해요",
    localName: "양평",
    shareCount: 48,
  },
  {
    shareUuid: "s2",
    maker: { name: "노을재 막걸리" },
    videoThumbnailUrl: "https://picsum.photos/seed/makgeolli/400/400",
    videoDurationSec: 47,
    intent: "쿠폰",
    title: "첫 방문 막걸리 1병 무료 쿠폰",
    localName: "괴산",
    expiresAt: inHours(18),
    remainingStock: 4,
    dropyReward: 120,
    shareCount: 312,
  },
  {
    shareUuid: "s3",
    maker: { name: "산지직송 농부장터" },
    videoThumbnailUrl: "https://picsum.photos/seed/farm/400/400",
    videoDurationSec: 63,
    intent: "구매",
    title: "오늘 수확한 햇사과 5kg 산지직송",
    localName: "충주",
    expiresAt: inHours(72),
    remainingStock: 27,
    dropyReward: 450,
    shareCount: 96,
  },
  {
    shareUuid: "s4",
    maker: { name: "성수동 작은 책방" },
    videoThumbnailUrl: "https://picsum.photos/seed/books/400/400",
    videoDurationSec: 0,
    intent: "정보",
    title: "이번 주 큐레이션: 느리게 읽는 에세이",
    localName: "성수",
    shareCount: 12,
  },
];

// 하단 탭바의 컴퍼스(탐색) 마크 — 외부 컴포넌트 대신 인라인 SVG (동일 아이콘)
function ExploreMark({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="#0F172A" />
      <path d="m15.4 8.6-1.5 4.4a1.4 1.4 0 0 1-.9.9l-4.4 1.5 1.5-4.4a1.4 1.4 0 0 1 .9-.9l4.4-1.5Z" fill="#FFFFFF" />
      <circle cx="12" cy="12" r="1.15" fill="#0F172A" />
    </svg>
  );
}

const TABS = [
  { key: "all", label: "전체", icon: Layers },
  { key: "info", label: "정보", icon: Newspaper },
  { key: "coupon", label: "쿠폰", icon: TicketPercent },
  { key: "commerce", label: "상품판매", icon: Tag }, // 라벨만 "상품판매"(내부 purpose는 "구매")
] as const;

const SORTS = [
  { key: "recent", label: "최신순", icon: Clock },
  { key: "shared", label: "공유순", icon: Send },
  { key: "dropy", label: "dropy 순", icon: Diamond },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

type ExploreScreenProps = {
  // TODO: 탭별 loader 데이터로 교체 (전부 props/TODO)
  drops?: DropFeedItem[];
  loading?: boolean;
  onShare?: (shareUuid: string) => void;
  onSelectDrop?: (shareUuid: string) => void;
  onSortChange?: (sort: SortKey) => void;
};

export default function ExploreScreen({
  drops = MOCK_DROPS, // TODO: 데이터 바인딩
  loading = false,
  onShare,
  onSelectDrop,
  onSortChange,
}: ExploreScreenProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<SortKey>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const activeSort = SORTS.find((s) => s.key === sort) ?? SORTS[0];
  const ActiveSortIcon = activeSort.icon;

  // 외부 클릭 시 정렬 메뉴 닫기
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sortOpen]);

  const selectSort = (key: SortKey) => {
    setSort(key);
    setSortOpen(false);
    onSortChange?.(key);
  };

  return (
    <div className="min-h-screen bg-white px-4 pb-24">
      {/* 헤더: 컴퍼스 마크 + 라벨 + 그리드/리스트 토글 */}
      <header className="flex items-center justify-between pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#F1F5F9]" aria-hidden="true">
            <ExploreMark className="h-[22px] w-[22px]" />
          </span>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">탐색</h1>
        </div>
        <div className="flex items-center gap-0.5 rounded-xl border border-[#EAEEF3] bg-[#F1F5F9] p-1">
          <button
            onClick={() => setView("grid")}
            className={`flex h-8 w-9 items-center justify-center rounded-lg transition-all duration-150 ${
              view === "grid"
                ? "bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.1)]"
                : "text-[#94A3B8] hover:text-[#475569]"
            }`}
            aria-label="그리드 보기"
          >
            <LayoutGrid className="size-[18px]" strokeWidth={2} />
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex h-8 w-9 items-center justify-center rounded-lg transition-all duration-150 ${
              view === "list"
                ? "bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.1)]"
                : "text-[#94A3B8] hover:text-[#475569]"
            }`}
            aria-label="리스트 보기"
          >
            <LayoutList className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* 카테고리 탭 (아이콘 + 라벨, 블루 활성) — 가로 스크롤 허용 */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex min-h-[40px] flex-shrink-0 items-center gap-1.5 rounded-full pl-3 pr-4 text-[13px] font-semibold transition-all duration-150 ${
                active
                  ? "bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.28)]"
                  : "border border-[#EAEEF3] bg-white text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
              }`}
            >
              <Icon className="size-4" strokeWidth={2.25} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 카운트 + 정렬 드롭다운 */}
      <div className="mb-3 flex items-center justify-between px-0.5">
        <span className="text-[12.5px] font-medium text-[#64748B]">
          {drops.length > 0 ? (
            <>
              <b className="font-bold tabular-nums text-[#0F172A]">{drops.length}</b>개의 카드
            </>
          ) : (
            ""
          )}
        </span>
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-[#EAEEF3] bg-white py-1.5 pl-3 pr-2.5 text-[12px] font-semibold text-[#475569] transition-colors duration-150 hover:bg-[#F8FAFC] active:scale-95"
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
          >
            <ActiveSortIcon className="size-3.5 text-[#2563EB]" strokeWidth={2.25} />
            {activeSort.label}
            <ChevronDown
              className={`size-3.5 text-[#94A3B8] transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
              strokeWidth={2.25}
            />
          </button>

          {sortOpen && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-20 w-40 overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)]"
              role="listbox"
            >
              {SORTS.map((s) => {
                const Icon = s.icon;
                const selected = s.key === sort;
                return (
                  <button
                    key={s.key}
                    onClick={() => selectSort(s.key)}
                    role="option"
                    aria-selected={selected}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 ${
                      selected ? "bg-[#EEF3FE] text-[#1D4ED8]" : "text-[#475569] hover:bg-[#F1F5F9]"
                    }`}
                  >
                    <Icon
                      className={`size-4 ${selected ? "text-[#2563EB]" : "text-[#94A3B8]"}`}
                      strokeWidth={2.25}
                    />
                    <span className="flex-1 text-left">{s.label}</span>
                    {selected && <Check className="size-4 text-[#2563EB]" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 그리드/리스트 */}
      {loading ? (
        <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2.5"}>
          {Array.from({ length: 4 }).map((_, i) => (
            <ShareCardTileSkeleton key={i} />
          ))}
        </div>
      ) : drops.length > 0 ? (
        <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2.5"}>
          {drops.map((d) => (
            <ShareCardTile
              key={d.shareUuid}
              drop={d}
              purpose={d.intent}
              layout={view === "grid" ? "grid" : "row"}
              onShare={onShare}
              onClick={() => onSelectDrop?.(d.shareUuid)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7DEE7] bg-[#F8FAFC] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-[#EAEEF3] bg-white">
            <Compass className="size-5 text-[#94A3B8]" strokeWidth={1.75} />
          </div>
          <p className="text-[13px] font-semibold text-[#475569]">아직 공개된 카드가 없어요</p>
          <p className="mt-1 text-[12px] text-[#94A3B8]">다른 카테고리를 둘러보세요</p>
        </div>
      )}
    </div>
  );
}
