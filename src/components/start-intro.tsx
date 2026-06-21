
import { useEffect, useRef, useState } from "react";
import { Store, Video, Compass, ArrowRight, Sparkles, Ticket, Calendar, Play, Link2, Check, ShoppingBag } from "lucide-react";

type IntroChoice = "owner" | "creator" | "seller" | "browse" | "skip";

interface StartIntroProps {
  onSelect?: (choice: IntroChoice) => void;
}

/* ── 색 규율: 모노크롬 잉크 + "전환력"에만 블루 포인트 ────────── */
const POINT = "#2563EB";
const INK = "#0F172A";

/* ── 라이브 프리뷰가 순환할 시나리오 (결과 카드는 컬러풀, UI는 모노) ── */
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

const OPTIONS = [
  {
    choice: "creator" as const,
    icon: Video,
    title: "영상·콘텐츠로 카드를 만들래요",
    subtitle: "영상 링크 한 줄로 카드 완성",
  },
  {
    choice: "owner" as const,
    icon: Store,
    title: "우리 가게를 알리고 싶어요",
    subtitle: "가게 등록 → 첫 쿠폰·예약 카드",
    featured: true,
  },
  {
    choice: "seller" as const,
    icon: ShoppingBag,
    title: "상품을 팔고 싶어요",
    subtitle: "산지직송 제철 식재료 → 주문 카드",
  },
  {
    choice: "browse" as const,
    icon: Compass,
    title: "먼저 둘러볼래요",
    subtitle: "다른 사람들의 카드 구경하기",
  },
];

const GREETING = "링크 하나가, 손님을 부르는 카드로.";

export default function StartIntro({ onSelect }: StartIntroProps) {
  // phase: 0 = thinking, 1 = typing greeting, 2 = options revealed
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState("");

  // 라이브 프리뷰 모핑: building(소스) → built(카드) 반복 순환
  const [sceneIdx, setSceneIdx] = useState(0);
  const [built, setBuilt] = useState(false);
  const scene = SCENES[sceneIdx];

  // 시작 시퀀스: 생각 → 타이핑
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 850);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(GREETING.slice(0, i));
      if (i >= GREETING.length) {
        clearInterval(id);
        setTimeout(() => setPhase(2), 240);
      }
    }, 34);
    return () => clearInterval(id);
  }, [phase]);

  // 프리뷰 자동 순환 (build 0.6s 후 → 2.2s 유지 → 다음 씬)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBuilt(false);
    timers.current.push(setTimeout(() => setBuilt(true), 520));
    timers.current.push(
      setTimeout(() => setSceneIdx((s) => (s + 1) % SCENES.length), 3000)
    );
    return () => timers.current.forEach(clearTimeout);
  }, [sceneIdx]);

  const SourceIcon = scene.sourceIcon;
  const ActionIcon = scene.actionIcon;

  return (
    <div className="flex min-h-screen flex-col bg-white px-6 pb-7 pt-12">
      {/* AI identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center">
          <span className="ai-breathe absolute inset-0 rounded-full" style={{ backgroundColor: "rgba(37,99,235,0.25)" }} />
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: INK }}>
            <span className="text-[13px] font-bold text-white">링</span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold leading-tight" style={{ color: INK }}>링고AI</span>
          <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: POINT }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: POINT }} />
            지금 카드를 만드는 중
          </span>
        </div>
      </div>

      {/* ── 라이브 모핑 프리뷰: 소스 → 완성 카드 ─────────────── */}
      <div className="mt-6">
        <div className="flex items-center gap-2 pl-1">
          <SourceIcon className="h-3.5 w-3.5 text-[#94A3B8]" strokeWidth={2} />
          <span key={scene.source} className="intro-rise text-[12px] font-medium text-[#94A3B8]" style={{ animationDuration: "0.4s" }}>
            {scene.source}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-[#CBD5E1]" strokeWidth={2} />
          <span className="text-[12px] font-semibold" style={{ color: built ? POINT : "#CBD5E1" }}>
            {built ? "카드 완성" : "변환 중…"}
          </span>
        </div>

        {/* 결과 카드 (컬러풀) */}
        <div
          className="relative mt-2 overflow-hidden rounded-[22px] p-5 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]"
          style={{
            backgroundColor: scene.bg,
            boxShadow: "0 20px 44px -16px rgba(15,23,42,0.4)",
          }}
        >
          {/* holographic sweep */}
          <span className="holo-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* badge + sparkle */}
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

          {/* title */}
          <h2
            key={scene.title}
            className="relative mt-4 text-[19px] font-bold leading-snug text-balance"
            style={{ color: scene.fg }}
          >
            {scene.title}
          </h2>

          {/* conversion power bar */}
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

          {/* action button morphs in */}
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

        {/* scene dots */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {SCENES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === sceneIdx ? 18 : 6,
                backgroundColor: i === sceneIdx ? POINT : "#E2E8F0",
              }}
            />
          ))}
        </div>
      </div>

      {/* Streaming greeting */}
      <div className="mt-6 min-h-[30px]">
        {phase === 0 ? (
          <span className="dot-loading inline-flex text-[#CBD5E1]" aria-label="링고가 입력 중">
            <span /><span /><span />
          </span>
        ) : (
          <p className="text-[17px] font-semibold leading-snug tracking-tight text-balance" style={{ color: INK }}>
            {typed}
            {phase === 1 && (
              <span className="caret-blink ml-0.5 inline-block h-[16px] w-[2px] translate-y-[2px]" style={{ backgroundColor: POINT }} />
            )}
          </p>
        )}
      </div>

      {/* Choices */}
      <div className="mt-5 flex flex-col gap-2.5">
        {OPTIONS.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.choice}
              onClick={() => onSelect?.(opt.choice)}
              className={`group flex min-h-[62px] items-center gap-3.5 rounded-2xl bg-white px-4 py-3 text-left intro-rise transition-all active:scale-[0.99] ${
                opt.featured
                  ? "[box-shadow:0_0_0_1.5px_#2563EB,0_4px_16px_rgba(37,99,235,0.1)]"
                  : "[box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)] hover:[box-shadow:0_0_0_1px_#CBD5E1,0_4px_14px_rgba(15,23,42,0.06)]"
              }`}
              style={{
                animationDelay: `${i * 90}ms`,
                opacity: phase === 2 ? undefined : 0,
                pointerEvents: phase === 2 ? undefined : "none",
              }}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  opt.featured ? "text-[#1D4ED8]" : "bg-[#F1F5F9] text-[#0F172A]"
                }`}
                style={opt.featured ? { backgroundColor: "#EFF6FF" } : undefined}
              >
                <Icon className="h-[21px] w-[21px]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold leading-snug" style={{ color: INK }}>{opt.title}</span>
                  {opt.featured && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]" style={{ backgroundColor: "#EFF6FF" }}>
                      추천
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12.5px] text-[#94A3B8]">{opt.subtitle}</p>
              </div>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                  opt.featured
                    ? "text-white group-hover:translate-x-0.5"
                    : "bg-[#F1F5F9] text-[#94A3B8] group-hover:bg-[#0F172A] group-hover:text-white group-hover:translate-x-0.5"
                }`}
                style={opt.featured ? { backgroundColor: INK } : undefined}
              >
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Skip */}
      <div
        className="mt-auto flex justify-center pt-6 intro-rise"
        style={{ animationDelay: "320ms", opacity: phase === 2 ? undefined : 0 }}
      >
        <button
          onClick={() => onSelect?.("skip")}
          className="px-4 py-2 text-[14px] font-medium text-[#94A3B8] transition-colors hover:text-[#64748B]"
        >
          나중에 할게
        </button>
      </div>
    </div>
  );
}
