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
  ChevronRight,
  Store,
  Video,
  ShoppingBag,
  Compass,
  Wallet,
} from "lucide-react";

/**
 * LingoStarter — 라이브 모핑 히어로 + AI 카드제작 도우미(5항목 아코디언).
 *
 * 양 분기(유저·상인) 홈 최상단(헤더 다음)에 모두에게 렌더. /start 온보딩과 별개(홈 요소).
 * 디자인 락: 무채색 + 포인트 1색 #2563EB · 이모지 0 · Lucide만 · blink/pulse 금지.
 * 데이터·mock 없음(순수 프레젠테이션). 액션만 주입: onStartPurpose→/studio-build?purpose=,
 *   onWallet→/me, onExplore→/explore. (create-wizard 배선 폐기.)
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

// ─────────────────────────────────────────────────────────────
// 인텐트 스와이프 히어로 — "무엇부터 시작할까요?"(4목적 아코디언) + 정적 CTA 알약.
// ─────────────────────────────────────────────────────────────

// 링고 스타터 = AI 카드제작 도우미. 5항목(①영상 ②우리가게 ③상품 ④받은혜택관리 ⑤둘러보기).
//   master-detail — 목적 리스트(단순 탭 행) 선택 → 상단 링고AI 말풍선이 그 목적 가이드로 갱신.
//   (내부 아코디언 없음 — 가이드는 상단 말풍선에만.) §0 — 드로피는 친구가 사용/주문/예약을 완료(전환)할 때.
export type StarterPurpose = "정보" | "쿠폰" | "구매";
type StarterKind = "purpose" | "wallet" | "explore";

interface StarterItem {
  key: string;
  icon: typeof Video;
  title: string;
  sub: string; // 목적 행 짧은 서브
  kind: StarterKind;
  purpose?: StarterPurpose; // kind=purpose 일 때 studio-build 진입 목적
  badgeFor?: "business" | "user"; // 역할별 자동 추천 배지
  // 선택 시 상단 말풍선에 표시할 한 단락 안내(짧게). §0 프레임(전환=사용/주문/예약 완료) 반영.
  blurb: string;
  cta: string;
}

const STARTER_ITEMS: StarterItem[] = [
  {
    key: "video",
    icon: Video,
    title: "영상·콘텐츠로 카드를 만들래요",
    sub: "영상 링크 한 줄로 카드 완성",
    kind: "purpose",
    purpose: "정보",
    badgeFor: "user",
    blurb:
      "유튜브·인스타 링크만 붙이면 핵심을 카드로 정리해드려요. 공개하면 탐색에서 사람들이 보고 공유해요.",
    cta: "이 목적으로 시작하기",
  },
  {
    key: "store",
    icon: Store,
    title: "우리 가게를 알리고 싶어요",
    sub: "가게 등록 → 쿠폰·예약 카드",
    kind: "purpose",
    purpose: "쿠폰",
    badgeFor: "business",
    blurb:
      "쿠폰·예약 카드를 함께 만들어요. 친구가 쿠폰을 쓰거나 예약을 완료하면 드로피를 받아요.",
    cta: "이 목적으로 시작하기",
  },
  {
    key: "product",
    icon: ShoppingBag,
    title: "상품을 팔고 싶어요",
    sub: "상품을 주문 카드로",
    kind: "purpose",
    purpose: "구매",
    blurb: "상품을 주문 카드로 만들어요. 친구가 실제로 주문하면 드로피가 쌓여요.",
    cta: "이 목적으로 시작하기",
  },
  {
    key: "wallet",
    icon: Wallet,
    title: "받은 혜택을 관리할래요",
    sub: "쿠폰·캐시·드로피 한곳에",
    kind: "wallet",
    blurb: "받은 쿠폰·캐시·드로피가 한곳에 모여 있어요.",
    cta: "내 지갑 보기",
  },
  {
    key: "browse",
    icon: Compass,
    title: "먼저 둘러볼래요",
    sub: "다른 사람들의 카드 구경",
    kind: "explore",
    blurb: "다른 사람 카드를 구경하고 공유해요. 친구가 쓰면 나도 드로피를 받아요.",
    cta: "둘러보기",
  },
];

// 상단 링고AI 말풍선 — 선택에 따라 동적(master-detail 의 detail). 미선택=안내 / 선택=해당 목적
//   한 단락 blurb + CTA(3블록 없음 — 내용만 swap). 링고AI 페르소나(아바타+AI 뱃지) 유지.
function LingoBubble({
  selected,
  onStart,
}: {
  selected: StarterItem | null;
  onStart: (item: StarterItem) => void;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl rounded-tl-md bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      {/* 링고 아바타 */}
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
        {/* 동적 본문 — selectedKey 로 리마운트해 부드럽게 전환(intro-rise: 살짝 떠오름, blink/pulse 아님). */}
        <div key={selected?.key ?? "default"} className="intro-rise mt-1.5">
          {!selected ? (
            <p className="text-[12.5px] font-medium leading-relaxed text-[#475569] text-pretty">
              어떤 걸 시작할지 모르겠다면, 목적만 골라주세요. 나머지는 제가 도와드릴게요.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* 한 단락 안내(짧게) — 3블록 없이 내용만 swap. */}
              <p className="text-[12.5px] font-medium leading-relaxed text-[#475569] text-pretty">
                {selected.blurb}
              </p>
              {/* CTA — 세모 방향(›, ChevronRight) 통일. 목적형=studio-build, ④=내 지갑, ⑤=둘러보기. */}
              <button
                type="button"
                onClick={() => onStart(selected)}
                className="mt-0.5 inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[#0F172A] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1E293B] active:scale-[0.99]"
              >
                {selected.cta}
                <ChevronRight className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 목적 행 — 단순 탭(내부 아코디언·셰브론·추천배지 없음). 탭 → selectedKey → 상단 말풍선 갱신.
//   ★ 배경은 어떤 조건에서도 밝게(어두운 INK 배경 금지) · 텍스트 항상 진한색 · 선택 시 우측 체크(✓)만.
function StarterTabRow({
  item,
  selected,
  onSelect,
}: {
  item: StarterItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      // 배경: 비선택 #FFFFFF / 선택 연한 파랑 #EEF3FE (둘 다 밝음). border 항상 2px(색만 스왑) → 밀림 0.
      className="flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 transition-colors"
      style={{
        borderColor: selected ? `${POINT}59` : "transparent",
        backgroundColor: selected ? "#EEF3FE" : "#FFFFFF",
        boxShadow: selected ? "none" : "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      {/* 아이콘 — 왼쪽 유지(밝은 파란 칩, 어두운 배경 아님). */}
      <span
        className="flex size-11 flex-none items-center justify-center rounded-xl"
        style={{ backgroundColor: `${POINT}14`, color: POINT }}
      >
        <Icon className="size-[22px]" strokeWidth={2} />
      </span>
      {/* 텍스트 블록 — 가로 센터. 라벨 17px/#0F172A · 서브 14px/#334155 (항상 진하게, 밝은 배경 위 또렷). */}
      <span className="min-w-0 flex-1 text-center">
        <span className="block truncate text-[17px] font-bold text-[#0F172A]">{item.title}</span>
        <span className="mt-0.5 block truncate text-[14px] font-medium text-[#334155]">
          {item.sub}
        </span>
      </span>
      {/* 우측 슬롯 — 선택 시 체크(파란 원+흰 체크)만. 미선택 = 빈 자리(폭 고정 size-6 → 센터 안정). */}
      <span className="flex size-6 flex-none items-center justify-center" aria-hidden={!selected}>
        {selected ? (
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={{ backgroundColor: POINT }}
            aria-label="선택됨"
          >
            <Check className="size-4 text-white" strokeWidth={3} />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function StarterList({
  onStartPurpose,
  onWallet,
  onExplore,
}: {
  onStartPurpose: (purpose: StarterPurpose) => void;
  onWallet: () => void;
  onExplore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // master-detail: 선택 목적
  const selected = STARTER_ITEMS.find((it) => it.key === selectedKey) ?? null;

  const runItem = (item: StarterItem) => {
    if (item.kind === "purpose" && item.purpose) onStartPurpose(item.purpose);
    else if (item.kind === "wallet") onWallet();
    else onExplore();
  };

  return (
    <section className="mb-6">
      <div
        className="overflow-hidden rounded-[22px]"
        style={{ backgroundColor: INK, boxShadow: "0 16px 36px -16px rgba(15,23,42,0.55)" }}
      >
        {/* 헤더 — 아바타+문구 토글 + 셰브론 토글(리스트 열림). */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="starter-list-panel"
            className="flex min-w-0 flex-1 items-center gap-3 text-left transition-transform active:scale-[0.99]"
          >
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

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="starter-list-panel"
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

        <div
          id="starter-list-panel"
          className="grid transition-all duration-300 ease-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
              {/* 상단 — 링고AI 말풍선(동적: 선택에 따라 안내↔가이드+CTA). */}
              <div className="mb-0.5">
                <LingoBubble selected={selected} onStart={runItem} />
              </div>

              {/* 아래 — 목적 5행(단순 탭). 탭 → selectedKey → 상단 말풍선 갱신. */}
              {STARTER_ITEMS.map((item) => (
                <StarterTabRow
                  key={item.key}
                  item={item}
                  selected={selectedKey === item.key}
                  onSelect={() => setSelectedKey(item.key)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * LingoStarter — 라이브 모핑 히어로 + AI 카드제작 도우미(5항목 master-detail). 양 분기 최상단에 렌더.
 *   라우팅: 목적형(①②③) → studio-build?purpose=, ④ → /me(내 지갑), ⑤ → /explore.
 *   추천 배지 제거(선택 시 우측 체크만). isBusiness 는 호출부 계약 유지용(현재 미사용).
 */
export function LingoStarter({
  onStartPurpose,
  onWallet,
  onExplore,
}: {
  isBusiness: boolean;
  onStartPurpose: (purpose: StarterPurpose) => void;
  onWallet: () => void;
  onExplore: () => void;
}) {
  return (
    <>
      <LiveMorphHero />
      <StarterList onStartPurpose={onStartPurpose} onWallet={onWallet} onExplore={onExplore} />
    </>
  );
}
