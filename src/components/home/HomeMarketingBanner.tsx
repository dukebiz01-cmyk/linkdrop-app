import { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowRight, Play, Link2, Ticket, Calendar, Check, Store, Video, ShoppingBag } from "lucide-react";

/**
 * HomeMarketingBanner — 홈 상단 마케팅 배너(라이브 모핑 히어로).
 *
 * Duke 락(상단 배너 카드 제거 금지) 복원분. 원래 LingoStarter 최상단의 LiveMorphHero 였고,
 * HOME-LINGO 커밋1(fb5a946)에서 LingoStarter 흡수·제거에 딸려 사라졌음 → 독립 컴포넌트로 부활.
 * LingoStarter 본체(5목적 아코디언 StarterList)는 LingoHomeBox 로 흡수 유지 — 배너만 원형 복원.
 * 문구·데모 카드·숫자·애니메이션 전부 원형 보존(순수 프레젠테이션, 데이터·mock 없음).
 * 디자인 락: 무채색 + 포인트 1색 #2563EB · 이모지 0 · Lucide만.
 */

const POINT = "#2563EB";

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

export function HomeMarketingBanner() {
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
      {/* 태그라인 — §0 프레임(공유 → 전환 보상). */}
      <h2 className="mb-2.5 px-0.5 text-[15px] font-bold leading-snug tracking-[-0.01em] text-[#0F172A] text-balance">
        내가 만든 링크카드를 공유하여 수많은 혜택과 보너스를
      </h2>

      {/* 소스 → 완성 상태 표시 — 가볍게 떠 있는 한 줄 */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <SourceIcon className="h-3.5 w-3.5 flex-none text-[#94A3B8]" strokeWidth={2} />
        <span
          key={scene.source}
          className="intro-rise min-w-0 flex-1 truncate text-[12px] font-medium text-[#94A3B8]"
          style={{ animationDuration: "0.4s" }}
        >
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
          {built ? (
            <Check className="h-3 w-3" strokeWidth={2.5} />
          ) : (
            <Sparkles className="h-3 w-3" strokeWidth={2.5} />
          )}
          {built ? "카드 완성" : "변환 중"}
        </span>
      </div>

      {/* 결과 카드(컬러풀) */}
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

        <h2
          key={scene.title}
          className="relative mt-4 text-[19px] font-bold leading-snug text-balance"
          style={{ color: scene.fg }}
        >
          {scene.title}
        </h2>

        <div className="relative mt-4">
          <div
            className="flex items-center justify-between text-[11px] font-medium"
            style={{ color: scene.sub }}
          >
            <span>전환력</span>
            <span className="tabular-nums" style={{ color: scene.fg }}>
              {built ? scene.power : 0}
            </span>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
          >
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
          <span
            className="flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: scene.bg, opacity: 0.7 }}
          >
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
