import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Play,
  Link2,
  Ticket,
  Calendar,
  Check,
  ChevronDown,
  Store,
  Video,
  ShoppingBag,
  Compass,
} from "lucide-react";

/**
 * LingoStarter — STEP 3 v0(home-v5) 포트: 라이브 모핑 히어로 + 링고 스타터 아코디언(4목적) + 정적 CTA 알약.
 *
 * 양 분기(유저·상인) 홈 최상단(헤더 다음)에 모두에게 렌더. /start 온보딩과 별개(홈 요소).
 * 디자인 락: 무채색 + 포인트 1색 #2563EB · 이모지 0 · Lucide만 · CTA 알약은 정적(blink/pulse 금지).
 *   v0 emerald(#0F766E)는 단색 락 위반 → create 계열 파란·browse 슬레이트로 매핑.
 * 데이터·mock 없음(순수 프레젠테이션). 액션만 주입: onCreate→/create-wizard, onExplore→/explore.
 */

const POINT = "#2563EB";
const INK = "#0F172A";

// ─────────────────────────────────────────────────────────────
// 라이브 모핑 프리뷰 — 소스 → 완성 카드 순환(쇼케이스). 애니메이션은 styles.css 등재분 재사용.
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
      {/* 태그라인 — v0 원본 카피 유지. */}
      <h2 className="mb-2.5 px-0.5 text-[15px] font-bold leading-snug tracking-[-0.01em] text-[#0F172A] text-balance">
        내가 만든 링크카드로 혜택과 보너스를.
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

// ─────────────────────────────────────────────────────────────
// 인텐트 스와이프 히어로 — "무엇부터 시작할까요?"(4목적 아코디언) + 정적 CTA 알약.
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

// 디자인 락(단색 #2563EB) 반영 — create 계열 파란 · browse 슬레이트(v0 emerald 폐기).
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
    accent: "#2563EB",
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
      {/* 링고 스타터 박스 — 아코디언 트리거(헤더) + 정적 CTA 알약. */}
      <div
        className="overflow-hidden rounded-[22px]"
        style={{ backgroundColor: INK, boxShadow: "0 16px 36px -16px rgba(15,23,42,0.55)" }}
      >
        {/* 헤더 — [토글(아바타+문구)] · [셰브론 토글]. 중첩 button 회피 위해 분할(CTA 알약 제거). */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="intent-list-panel"
            className="flex min-w-0 flex-1 items-center gap-3 text-left transition-transform active:scale-[0.99]"
          >
            {/* 링고 아바타 */}
            <span className="relative flex size-11 flex-none items-center justify-center">
              <span
                className="ai-breathe absolute inset-0 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
              />
              <span
                className="relative flex size-11 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
              >
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
              <span className="block text-[16px] font-bold text-white text-balance">
                링크드롭을 시작해 볼까요?
              </span>
              <span
                className="mt-0.5 block text-[12.5px] font-medium"
                style={{ color: "rgba(255,255,255,0.64)" }}
              >
                링고 AI와 같이 카드를 만들어 보세요
              </span>
            </span>
          </button>

          {/* 펼침 어포던스(셰브론) — 토글. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="intent-list-panel"
            aria-label={open ? "접기" : "펼치기"}
            className="flex size-8 flex-none items-center justify-center rounded-full transition-all duration-300"
            style={{ backgroundColor: open ? POINT : "rgba(255,255,255,0.14)" }}
          >
            <ChevronDown
              className="size-[18px] text-white transition-transform duration-300"
              strokeWidth={2.5}
              style={{ transform: open ? "rotate(180deg)" : "none" }}
            />
          </button>
        </div>

        {/* 접었다 펴지는 목적 리스트(박스 내부 상단). */}
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
                <span
                  className="relative mt-0.5 flex size-7 flex-none items-center justify-center rounded-full"
                  style={{ backgroundColor: INK }}
                >
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
                    type="button"
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
                        <span className="truncate text-[14.5px] font-bold text-[#0F172A]">
                          {it.title}
                        </span>
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
                        <ArrowRight
                          className="size-3 flex-none"
                          strokeWidth={2.25}
                          style={{ color: it.accent }}
                        />
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

/**
 * LingoStarter — 라이브 모핑 히어로 + 4목적 스타터(+CTA). 양 분기 최상단(헤더 다음)에 렌더.
 */
export function LingoStarter({ onCreate, onExplore }: { onCreate: () => void; onExplore: () => void }) {
  return (
    <>
      <LiveMorphHero />
      <IntentList onCreate={onCreate} onExplore={onExplore} />
    </>
  );
}
