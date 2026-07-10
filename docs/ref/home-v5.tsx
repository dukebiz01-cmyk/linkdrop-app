import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Bell,
  Target,
  Gift,
  Sparkles,
  Heart,
  TrendingUp,
  Layers,
  Store,
  Video,
  ShoppingBag,
  Compass,
  ArrowRight,
  Play,
  Link2,
  Ticket,
  Calendar,
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

// ── 색 규율: 모노크롬 잉크 + "전환력"에만 블루 포인트 ──────────
const POINT = "#2563EB";
const INK = "#0F172A";

// ─────────────────────────────────────────────────────────────
// 라이브 모핑 프리뷰 (인트로의 "이미지" 그대로) — 소스 → 완성 카드 순환
// ─────────────────────────────────────────────────────────────

interface Scene {
  source: string;
  sourceIcon: typeof Link2;
  bg: string;
  fg: string;
  sub: string;
  badge: string;
  title: string;
  action: string;
  actionIcon: typeof Ticket;
  metric: string;
  power: number;
}

const SCENES: Scene[] = [
  {
    source: "youtu.be/aZ8x…",
    sourceIcon: Play,
    bg: "#0B1F3A",
    fg: "#FFFFFF",
    sub: "rgba(255,255,255,0.62)",
    badge: "캠핑장",
    title: "노을 명당 사이트 예약",
    action: "날짜 골라 예약하기",
    actionIcon: Calendar,
    metric: "예약 37건",
    power: 88,
  },
  {
    source: "내 가게 · 한끼식당",
    sourceIcon: Store,
    bg: "#14532D",
    fg: "#FFFFFF",
    sub: "rgba(255,255,255,0.62)",
    badge: "맛집",
    title: "평일 점심 1만원 쿠폰",
    action: "쿠폰 받기",
    actionIcon: Ticket,
    metric: "사용 124장",
    power: 76,
  },
  {
    source: "instagram.com/p/Cx…",
    sourceIcon: Video,
    bg: "#3B1D60",
    fg: "#FFFFFF",
    sub: "rgba(255,255,255,0.62)",
    badge: "공방",
    title: "원데이 클래스 모집",
    action: "문의하고 신청",
    actionIcon: Link2,
    metric: "문의 52건",
    power: 81,
  },
  {
    source: "내 상품 · 산지직송",
    sourceIcon: ShoppingBag,
    bg: "#14532D",
    fg: "#FFFFFF",
    sub: "rgba(255,255,255,0.62)",
    badge: "스토어",
    title: "산지직송 제철 식재료",
    action: "바로 주문하기",
    actionIcon: ShoppingBag,
    metric: "주문 218건",
    power: 84,
  },
];

function LiveMorphHero() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [built, setBuilt] = useState(false);
  const scene = SCENES[sceneIdx];
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBuilt(false);
    timers.current.push(setTimeout(() => setBuilt(true), 520));
    timers.current.push(setTimeout(() => setSceneIdx((s) => (s + 1) % SCENES.length), 3000));
    return () => timers.current.forEach(clearTimeout);
  }, [sceneIdx]);

  const SourceIcon = scene.sourceIcon;
  const ActionIcon = scene.actionIcon;

  return (
    <section className="mb-5">
      {/* 태그라인 — 카피만, 가볍게 */}
      <h2 className="mb-2.5 px-0.5 text-[15px] font-bold leading-snug tracking-[-0.01em] text-[#0F172A] text-balance">
        내가 만든 링크카드로 혜택과 보너스를.
      </h2>

      {/* 소스 → 완성 상태 표시 — 가볍게 떠 있는 한 줄 */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <SourceIcon className="h-3.5 w-3.5 flex-none text-[#94A3B8]" strokeWidth={2} />
        <span key={scene.source} className="intro-rise min-w-0 flex-1 truncate text-[12px] font-medium text-[#94A3B8]" style={{ animationDuration: "0.4s" }}>
          {scene.source}
        </span>
        <ArrowRight className="h-3.5 w-3.5 flex-none text-[#CBD5E1]" strokeWidth={2} />
        <span
          className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors duration-300"
          style={{
            backgroundColor: built ? `${POINT}14` : "#F1F5F9",
            color: built ? POINT : "#94A3B8",
          }}
        >
          {built ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <Sparkles className="h-3 w-3" strokeWidth={2.5} />}
          {built ? "카드 완성" : "변환 중"}
        </span>
      </div>

      {/* 결과 카드 (컬러풀) — 인트로 그대로 */}
      <div
        className="relative overflow-hidden rounded-[22px] p-5 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]"
        style={{ backgroundColor: scene.bg, boxShadow: "0 20px 44px -16px rgba(15,23,42,0.4)" }}
      >
        <span className="holo-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative flex items-center justify-between">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur"
            style={{ backgroundColor: "rgba(255,255,255,0.16)", color: scene.fg }}
          >
            {scene.badge}
          </span>
          <span
            className={`flex items-center gap-1 text-[11px] font-bold transition-opacity duration-300 ${built ? "opacity-100" : "opacity-0"}`}
            style={{ color: scene.fg }}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
            링고 제작
          </span>
        </div>

        <h2 key={scene.title} className="relative mt-4 text-[19px] font-bold leading-snug text-balance" style={{ color: scene.fg }}>
          {scene.title}
        </h2>

        <div className="relative mt-4">
          <div className="flex items-center justify-between text-[11px] font-medium" style={{ color: scene.sub }}>
            <span>전환력</span>
            <span className="tabular-nums" style={{ color: scene.fg }}>{built ? scene.power : 0}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: built ? `${scene.power}%` : "0%", backgroundColor: scene.fg }}
            />
          </div>
        </div>

        <div
          className="relative mt-4 flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]"
          style={{
            backgroundColor: scene.fg,
            opacity: built ? 1 : 0,
            transform: built ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <span className="flex items-center gap-2 text-[14px] font-bold" style={{ color: scene.bg }}>
            <ActionIcon className="h-[18px] w-[18px]" strokeWidth={2.25} />
            {scene.action}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: scene.bg, opacity: 0.7 }}>
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            {scene.metric}
          </span>
        </div>
      </div>

      {/* 씬 도트 */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {SCENES.map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: i === sceneIdx ? 18 : 6, backgroundColor: i === sceneIdx ? POINT : "#E2E8F0" }}
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────��─�����─────────────────────────────────
// 인텐트 스와이프 히어로 — "무엇부터 시작할까요?"
// (Start의 온보딩 선택지를 홈 맥락의 세로 목록 카드로)
// ─────────────────────────────────────────────────────────────

type IntentAction = "create" | "explore";

interface Intent {
  key: string;
  icon: typeof Video;
  title: string;
  result: string;
  cta: string;
  action: IntentAction;
  accent: string;
  tag?: string;
}

// 앱의 모드 팔레트 재사용: public=slate, coupon/reserve=blue, commerce=emerald
const INTENTS: Intent[] = [
  {
    key: "video",
    icon: Video,
    title: "영상·콘텐츠로 카드를 만들래요",
    result: "영상 링크 한 줄로 카드 완성",
    cta: "링크 붙여넣기",
    action: "create",
    accent: "#2563EB",
  },
  {
    key: "store",
    icon: Store,
    title: "우리 가게를 알리고 싶어요",
    result: "가게 등록 → 첫 쿠폰·예약 카드",
    cta: "가게 등록하기",
    action: "create",
    accent: "#2563EB",
    tag: "추천",
  },
  {
    key: "product",
    icon: ShoppingBag,
    title: "상품을 팔고 싶어요",
    result: "산지직송 제철 식재료 → 주문 카드",
    cta: "상품 올리기",
    action: "create",
    accent: "#0F766E",
  },
  {
    key: "browse",
    icon: Compass,
    title: "먼저 둘러볼래요",
    result: "다른 사람들의 카드 구경하기",
    cta: "카드 구경하기",
    action: "explore",
    accent: "#475569",
  },
];

function IntentList({ onCreate, onExplore }: { onCreate?: () => void; onExplore?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);

  return (
    <section className="mb-6">
      {/* 링고 스타터 박스 — 아코디언 트리거(헤더) */}
      <div
        className="overflow-hidden rounded-[22px]"
        style={{ backgroundColor: INK, boxShadow: "0 16px 36px -16px rgba(15,23,42,0.55)" }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="intent-list-panel"
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition-transform active:scale-[0.99]"
        >
          {/* 링고 아바타 */}
          <span className="relative flex size-11 flex-none items-center justify-center">
            <span className="ai-breathe absolute inset-0 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.16)" }} />
            <span className="relative flex size-11 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
              <span className="text-[15px] font-bold leading-none text-white">링</span>
              <span
                className="absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full border-2"
                style={{ backgroundColor: POINT, borderColor: INK }}
              >
                <Sparkles className="size-2.5 text-white" strokeWidth={2.5} />
              </span>
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-white text-balance">링크드롭을 시작해 볼까요?</span>
            <span className="mt-0.5 block text-[12.5px] font-medium" style={{ color: "rgba(255,255,255,0.64)" }}>
              링고 AI와 같이 카드를 만들어 보세요
            </span>
          </span>

          {/* ��침 어포던스 */}
          <span
            className="flex size-8 flex-none items-center justify-center rounded-full transition-all duration-300"
            style={{ backgroundColor: open ? POINT : "rgba(255,255,255,0.14)" }}
          >
            <ChevronDown
              className="size-[18px] text-white transition-transform duration-300"
              strokeWidth={2.5}
              style={{ transform: open ? "rotate(180deg)" : "none" }}
            />
          </span>
        </button>

        {/* 접었다 펴지는 목적 리스트 (박스 내부 상단) */}
        <div
          id="intent-list-panel"
          className="grid transition-all duration-300 ease-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div key={open ? "open" : "closed"} className="flex flex-col gap-2 px-3 pb-3 pt-1">
              {/* 링고 AI 말풍선 — 목적 리스트 상단 안내 */}
              <div
                className={`mb-0.5 flex items-start gap-2.5 rounded-2xl rounded-tl-md bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${open ? "intro-rise" : "opacity-0"}`}
                style={{ animationDelay: open ? "40ms" : undefined }}
              >
                <span className="relative mt-0.5 flex size-7 flex-none items-center justify-center rounded-full" style={{ backgroundColor: INK }}>
                  <span className="text-[12px] font-bold leading-none text-white">링</span>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full border-[1.5px] border-white"
                    style={{ backgroundColor: POINT }}
                  >
                    <Sparkles className="size-1.5 text-white" strokeWidth={2.5} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-bold text-[#0F172A]">링고</span>
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none"
                      style={{ backgroundColor: `${POINT}14`, color: POINT }}
                    >
                      <Sparkles className="size-2" strokeWidth={2.5} />
                      AI
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-[#475569] text-pretty">
                    어떤 걸 시작할지 모르겠다면, 목적만 골라주세요. 나머지는 제가 도와드릴게요.
                  </p>
                </div>
              </div>
              {INTENTS.map((it, i) => {
                const Icon = it.icon;
                const isPressed = pressed === it.key;
                return (
                  <button
                    key={it.key}
                    onClick={it.action === "explore" ? onExplore : onCreate}
                    onPointerDown={() => setPressed(it.key)}
                    onPointerUp={() => setPressed(null)}
                    onPointerLeave={() => setPressed(null)}
                    className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-150 ${open ? "intro-rise" : "opacity-0"}`}
                    style={{
                      animationDelay: open ? `${130 + i * 70}ms` : undefined,
                      backgroundColor: isPressed ? `${it.accent}14` : "#FFFFFF",
                      borderColor: isPressed ? `${it.accent}59` : "#EEF2F6",
                      transform: isPressed ? "scale(0.98)" : "scale(1)",
                      boxShadow: isPressed ? "none" : "0 1px 2px rgba(15,23,42,0.04)",
                    }}
                  >
                    <span
                      className="flex size-11 flex-none items-center justify-center rounded-2xl transition-colors duration-150"
                      style={{
                        backgroundColor: isPressed ? it.accent : `${it.accent}14`,
                        color: isPressed ? "#FFFFFF" : it.accent,
                      }}
                    >
                      <Icon className="size-[22px]" strokeWidth={2} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[14.5px] font-bold text-[#0F172A]">{it.title}</span>
                        {it.tag && (
                          <span
                            className="flex-none rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ backgroundColor: it.accent, color: "#fff" }}
                          >
                            {it.tag}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-[#64748B]">
                        <ArrowRight className="size-3 flex-none" strokeWidth={2.25} style={{ color: it.accent }} />
                        {it.result}
                      </span>
                    </span>

                    <span
                      className="flex size-7 flex-none items-center justify-center rounded-full transition-all duration-150"
                      style={{
                        backgroundColor: isPressed ? it.accent : `${it.accent}12`,
                        color: isPressed ? "#FFFFFF" : it.accent,
                      }}
                    >
                      <ArrowRight className="size-[16px]" strokeWidth={2.5} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ────────────────���────────────────────────────────────────────
// 성과 셀 (그룹 카드 안에서 헤어라인으로 구분)
// ─────────────────────────────────────────────────────────────

function StatCell({
  icon: Icon,
  label,
  value,
  unit,
  accent = false,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string | number;
  unit: string;
  accent?: boolean;
}) {
  const display = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 py-4">
      <div className="mb-2 flex items-center gap-1">
        <Icon className={`size-3.5 ${accent ? "text-[#2563EB]" : "text-[#94A3B8]"}`} strokeWidth={2} />
        <span className="text-[11.5px] font-medium text-[#64748B]">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-[25px] font-bold leading-none tracking-[-0.02em] tabular-nums"
          style={{ color: accent ? "#2563EB" : "#0F172A" }}
        >
          {display}
        </span>
        <span className="text-[11.5px] font-semibold text-[#94A3B8]">{unit}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 세그먼트 토글 (흰색 활성 칩 — iOS 세그먼트 톤)
// ─────────────────────────────────────────────────────────────

function SegmentToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[#EAEEF3] bg-[#F6F8FB] p-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`min-h-[30px] rounded-full px-3.5 text-[12.5px] font-bold transition-all duration-200 ${
            value === o.key
              ? "bg-[#0F172A] text-white shadow-[0_2px_8px_rgba(15,23,42,0.24)]"
              : "text-[#64748B] active:text-[#0F172A]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 섹션 헤더
// ─────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  badge,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  badge?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 px-0.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-[#EEF3FE]">
        <Icon className="size-4 text-[#2563EB]" strokeWidth={2} />
      </span>
      <h2 className="text-[15px] font-bold text-[#0F172A]">{title}</h2>
      {badge && (
        <span className="rounded-md bg-[#EFF4FE] px-1.5 py-0.5 text-[10px] font-bold text-[#2563EB]">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HomeScreenV5 — Start(라이브 쇼케이스) × Home v4(기능 홈)
// ─────────────────────────────────────────────────────────────

type ActivityTab = "sent" | "subscribed" | "made";

type HomeScreenV5Props = {
  isBusiness?: boolean;
  recommendedDrops?: DropFeedItem[];
  activityDrops?: DropFeedItem[];
  initialActivityTab?: ActivityTab;
  loading?: boolean;
  monthlyConversions?: number | string;
  dropyBalance?: number | string;
  subscriberCount?: number;
  newReservationsCount?: number;
  partnerName?: string;
  onOpenNotifications?: () => void;
  onShare?: (shareUuid: string) => void;
  onCreate?: () => void;
  onExplore?: () => void;
};

export default function HomeScreenV5({
  isBusiness = true,
  recommendedDrops = MOCK_DROPS,
  activityDrops = MOCK_DROPS.slice(0, 2),
  initialActivityTab = "sent",
  loading = false,
  monthlyConversions = 37,
  dropyBalance = 1240,
  subscriberCount = 86,
  newReservationsCount = 3,
  partnerName = "포레스트 커피",
  onOpenNotifications,
  onShare,
  onCreate,
  onExplore,
}: HomeScreenV5Props) {
  return (
    <div className="min-h-screen bg-white px-4 pb-24">
      {/* 헤더: 로고 마크 + LinkDrop (+ 비즈는 매장명) + 알림 */}
      <header className="flex items-center justify-between pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#0F172A] shadow-[0_6px_16px_-4px_rgba(15,23,42,0.35)]">
            <span className="text-[18px] font-bold leading-none tracking-[-0.02em] text-white">L</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[19px] font-bold leading-none tracking-[-0.02em] text-[#0F172A]">
              Link<span className="text-[#2563EB]">Drop</span>
            </span>
            {isBusiness && (
              <span className="rounded-full bg-[#F1F5F9] px-2 py-1 text-[11px] font-semibold leading-none text-[#475569]">
                {partnerName}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onOpenNotifications}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#EAEEF3] bg-white text-[#0F172A] transition-colors duration-150 hover:bg-[#F1F5F9] active:scale-95"
          aria-label="알림"
        >
          <Bell className="size-[18px]" strokeWidth={2} />
          {(isBusiness ? newReservationsCount : 0) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white">
              {newReservationsCount}
            </span>
          )}
        </button>
      </header>

      {/* 상단: 인트로의 라이브 모핑 프리뷰(이미지) 그대로 */}
      <LiveMorphHero />

      {/* 링고 스타터 — 링고 AI 안내 + 목적 아코디언 통합 */}
      <IntentList onCreate={onCreate} onExplore={onExplore} />

      {/* 성과 스트립: 그룹 카드 + 헤어라인 구분 */}
      <div className="mb-6 flex divide-x divide-[#EAEEF3] overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
        <StatCell icon={Target} label="이번 달 전환" value={monthlyConversions} unit="건" accent />
        <StatCell icon={Gift} label="적립" value={dropyBalance} unit="dropy" />
        {isBusiness && <StatCell icon={Heart} label="구독자" value={subscriberCount} unit="명" />}
      </div>

      {/* 오늘 공유하기 좋은 — 가로 스와이프 */}
      <section className="mb-7">
        <SectionHeader icon={TrendingUp} title="오늘 공유하기 좋은" badge="NEW" />
        {loading ? (
          <HScrollRow>
            <SwipeItem>
              <ShareCardTileSkeleton />
            </SwipeItem>
            <SwipeItem>
              <ShareCardTileSkeleton />
            </SwipeItem>
          </HScrollRow>
        ) : recommendedDrops.length > 0 ? (
          <HScrollRow>
            {recommendedDrops.map((d) => (
              <SwipeItem key={d.shareUuid}>
                <ShareCardTile drop={d} onShare={onShare} />
              </SwipeItem>
            ))}
          </HScrollRow>
        ) : (
          <EmptyState title="공유할 카드가 곧 채워져요" subtitle="추천 카드가 준비되면 여기에 떠요" />
        )}
      </section>

      {/* 내 활동 세그먼트: [공유한 | 구독한 | 내가만든] */}
      <HomeActivitySegment
        drops={activityDrops}
        loading={loading}
        onShare={onShare}
        initialTab={initialActivityTab}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 세그먼트 (홈 활동)
// ────────────────────────────���────────────────────────────────

function HomeActivitySegment({
  drops,
  loading,
  onShare,
  initialTab = "sent",
}: {
  drops: DropFeedItem[];
  loading?: boolean;
  onShare?: (shareUuid: string) => void;
  initialTab?: ActivityTab;
}) {
  const [tab, setTab] = useState<ActivityTab>(initialTab);

  // 다른 화면(내페이지)에서 특정 탭으로 진입 시 동기화
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const empty: Record<ActivityTab, { title: string; subtitle: string }> = {
    sent: { title: "아직 공유한 카드가 없어요", subtitle: "마음에 드는 카드를 공유해 보세요" },
    subscribed: { title: "구독한 매장의 새 카드가 여기에 떠요", subtitle: "관심 매장을 구독하면 알림을 받아요" },
    made: { title: "아직 만든 카드가 없어요", subtitle: "첫 카드를 만들어 손님을 불러보세요" },
  };

  return (
    <section id="home-activity">
      <div className="mb-4 flex items-center gap-2 px-0.5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[#EEF3FE]">
          <Layers className="size-4 text-[#2563EB]" strokeWidth={2} />
        </span>
        <h2 className="text-[15px] font-bold text-[#0F172A]">내 활동</h2>
      </div>
      <div className="mb-4">
        <SegmentToggle
          options={[
            { key: "sent", label: "공유한" },
            { key: "subscribed", label: "구독한" },
            { key: "made", label: "내가만든" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {loading ? (
        <HScrollRow>
          <SwipeItem>
            <ShareCardTileSkeleton />
          </SwipeItem>
          <SwipeItem>
            <ShareCardTileSkeleton />
          </SwipeItem>
        </HScrollRow>
      ) : drops.length > 0 ? (
        <HScrollRow>
          {drops.map((d) => (
            <SwipeItem key={d.shareUuid}>
              <ShareCardTile drop={d} onShare={onShare} />
            </SwipeItem>
          ))}
        </HScrollRow>
      ) : (
        <EmptyState title={empty[tab].title} subtitle={empty[tab].subtitle} />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 가로 스와이프 행 — 카드가 세로로 길어지지 않게 옆으로 흐르게
// ─────────────────────────────────────────────────────────────

function HScrollRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="hide-scrollbar -mx-4 flex touch-pan-x snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}

function SwipeItem({ children }: { children: ReactNode }) {
  return <div className="w-[46%] shrink-0 snap-start sm:w-[42%]">{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// 빈 상태
// ─────────────────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7DEE7] bg-[#F8FAFC] px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-[#EAEEF3] bg-white">
        <Sparkles className="size-5 text-[#94A3B8]" strokeWidth={1.75} />
      </div>
      <p className="text-[13px] font-semibold text-[#475569]">{title}</p>
      {subtitle && <p className="mt-1 text-[12px] text-[#94A3B8]">{subtitle}</p>}
    </div>
  );
}
