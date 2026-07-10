import { useMemo, useRef, useState } from "react";
import {
  Calendar,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Palette,
  Ticket,
  Rocket,
  TrendingUp,
  Megaphone,
  Lightbulb,
  Sparkles,
  Star,
  Check,
  Send,
  Play,
  Lock,
  ChevronRight,
  Store,
  X,
  Zap,
  Plus,
  Copy,
  MessageCircle,
  Wand2,
  Tag,
  Globe,
  GitBranch,
  ChevronDown,
  User,
  ShoppingBag,
} from "lucide-react";

// =============================================================================
// LinkDrop "카드 스튜디오" — 게임 카드 강화(포지) 경험.
// 하단 강화 카드 덱을 스와이프해서 고르고, 탭하면 메인 카드에 장착된다.
// 장착할수록 전환력(완성도) 게이지가 차오르고 카드 등급(별)이 올라간다.
// 블록은 데이터 배열 → 추가 시 UI/완성도/링고AI/덱이 자동 반영.
// =============================================================================

type BlockCategory = "content" | "purpose" | "enhance";

interface StudioBlock {
  id: string;
  label: string;
  desc: string;
  /** 카드를 누르면 떠오르는 아크릴 패널 안내 문구 */
  detail: string;
  icon: typeof Calendar;
  category: BlockCategory;
  /** 전환 레버 점수 = 완성도(전환력) 기여도. 강화 블록은 0(도달만 늘림). */
  power: number;
  isMain?: boolean;
  isPaid?: boolean;
}

const STUDIO_BLOCKS: StudioBlock[] = [
  {
    id: "calendar",
    label: "예약 캘린더",
    desc: "날짜 고르고 바로 예약",
    detail: "고객이 카드 안에서 날짜·시간을 골라 바로 예약해요. 전화나 DM 없이 전환되는 가장 강한 레버예요.",
    icon: Calendar,
    category: "purpose",
    power: 30,
    isMain: true,
  },
  {
    id: "product",
    label: "상품 등록",
    desc: "이름 · 가격 한 번에",
    detail: "판매할 상품의 이름과 가격을 입력해 카드에 담아요. 보는 사람이 바로 가격을 확인하고 주문할 수 있어요.",
    icon: Tag,
    category: "purpose",
    power: 30,
    isMain: true,
  },
  {
    id: "seasonal",
    label: "판매 캘린더",
    desc: "판매 기간·가능일을 한눈에",
    detail: "상품을 살 수 있는 기간과 판매 가능일을 캘린더로 보여줘요. 지금이 구매 적기라는 걸 알려 주문을 앞당겨요.",
    icon: Calendar,
    category: "purpose",
    power: 30,
    isMain: true,
  },
  {
    id: "productimage",
    label: "이미지 등록",
    desc: "본체 이미지로 상품을 보여줘요",
    detail: "영상 대신 상품 사진이 카드의 본체가 돼요. 신선도와 품질이 잘 드러난 한 장이 주문을 부릅니다.",
    icon: ImageIcon,
    category: "content",
    power: 28,
    isMain: true,
  },
  {
    id: "content",
    label: "영상 · 핵심구간",
    desc: "TimeLink로 0:42 명장면만 콕",
    detail: "긴 영상에서 가장 설득력 있는 구간만 골라 보여줘요. 첫 3초에 눈길을 잡아 이탈을 막아요.",
    icon: Video,
    category: "content",
    power: 28,
  },
  {
    id: "coupon",
    label: "쿠폰 붙이기",
    desc: "내 매장 쿠폰 중 선택",
    detail: "내 매장에 등록된 쿠폰을 카드에 붙여 방문 동기를 만들어요. 할인폭이 클수록 전환이 올라가요.",
    icon: Ticket,
    category: "purpose",
    power: 18,
  },
  {
    id: "image",
    label: "대표 이미지",
    desc: "썸네일 한 장으로 눈길",
    detail: "피드에서 가장 먼저 보이는 한 장이에요. 분위기가 잘 드러난 사진일수록 클릭률이 높아져요.",
    icon: ImageIcon,
    category: "content",
    power: 10,
  },
  {
    id: "link",
    label: "행동 링크",
    desc: "전화 · 위치 · 문의 버튼",
    detail: "전화·위치·문의 버튼을 카드에 얹어요. 보는 사람이 바로 행동할 수 있게 길을 열어줘요.",
    icon: LinkIcon,
    category: "purpose",
    power: 8,
  },
  {
    id: "bgcolor",
    label: "카드 배경색",
    desc: "내 카드 분위기 고르기",
    detail: "브랜드 톤에 맞는 배경색을 골라 카드 분위기를 완성해요. 작은 차이가 신뢰감을 만들어요.",
    icon: Palette,
    category: "content",
    power: 6,
  },
  {
    id: "top",
    label: "상위노출",
    desc: "피드 상단에 먼저 보이기",
    detail: "완성도 75점을 넘기면 열려요. 피드 상단에 먼저 노출돼 더 많은 사람이 카드를 봐요.",
    icon: TrendingUp,
    category: "enhance",
    power: 0,
    isPaid: true,
  },
  {
    id: "boost",
    label: "부스트",
    desc: "더 많은 친구에게 도달",
    detail: "이미 잘 만든 카드를 더 많은 친구에게 밀어줘요. 완성된 카드일 때만 효과가 커요.",
    icon: Rocket,
    category: "enhance",
    power: 0,
    isPaid: true,
  },
  {
    id: "marketing",
    label: "마케팅 강화",
    desc: "광고 슬롯으로 확장",
    detail: "외부 광고 슬롯까지 확장해 도달을 넓혀요. 전환 설계가 끝난 뒤 마지막으로 더하는 단계예요.",
    icon: Megaphone,
    category: "enhance",
    power: 0,
    isPaid: true,
  },
];

const CARD_COLORS = [
  { id: "ink", value: "#0F172A", label: "잉크" },
  { id: "forest", value: "#14532D", label: "�����레스트" },
  { id: "navy", value: "#1E3A8A", label: "네이비" },
  { id: "wine", value: "#7F1D1D", label: "와인" },
  { id: "sand", value: "#78350F", label: "샌드" },
  { id: "slate", value: "#334155", label: "슬레이트" },
];

const ENHANCE_UNLOCK = 75;
const POINT = "#1D4ED8"; // 전환력 지표(게이지·별·파워)에만
const INK = "#0A0A0A";

function getStage(score: number) {
  if (score >= ENHANCE_UNLOCK) return { stars: 3, label: "완성", tone: "전환 준비 완료" };
  if (score >= 40) return { stars: 2, label: "괜찮음", tone: "조금만 더" };
  return { stars: 1, label: "기본", tone: "아직 약해요" };
}

// 모드별 덱 구성 (주 제작 → 일반 레버 → 강화)
const DECK_IDS: Record<"general" | "reserve" | "commerce", string[]> = {
  general: ["content", "image", "link", "bgcolor", "top", "boost", "marketing"],
  reserve: ["calendar", "content", "coupon", "image", "link", "bgcolor", "top", "boost", "marketing"],
  commerce: ["product", "productimage", "seasonal", "coupon", "link", "bgcolor", "top", "boost", "marketing"],
};
const blockById = (id: string) => STUDIO_BLOCKS.find((b) => b.id === id)!;

// 공유지도(공유 여정) — 익명 노드 체인. 신원 마스킹 + 기여도만 집계(모집 개념 없음)
const SHARE_JOURNEY: {
  name: string;
  role: string;
  kind: "peer" | "me" | "buyer";
  emphasis?: boolean;
}[] = [
  { name: "lee***9a", role: "개척 · 전송", kind: "peer" },
  { name: "par***k2", role: "전달", kind: "peer" },
  { name: "나", role: "결정타 · 전송", kind: "me", emphasis: true },
  { name: "구매자", role: "구매 성사 · 트리거", kind: "buyer" },
];

// 둥둥 떠 있는 기본 프레임 배경 — 모드와 무관하게 화이트 베이스로 통일
const CARD_BASE = "#FFFFFF";
const MODE_CARD_COLOR: Record<"general" | "reserve" | "commerce", string> = {
  general: CARD_BASE,
  reserve: CARD_BASE,
  commerce: CARD_BASE,
};

export function CardStudioPage() {
  const [mode, setMode] = useState<"general" | "reserve" | "commerce">("general");
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [cardColor, setCardColor] = useState(MODE_CARD_COLOR.general);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [deckIndex, setDeckIndex] = useState(0);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [shareMapOpen, setShareMapOpen] = useState(false);

  const touchStart = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHold = useRef(false);

  // 모드별 덱
  const DECK = useMemo(() => DECK_IDS[mode].map(blockById), [mode]);

  // 모드 전환: 장착·진행 상태를 초기화해 새 덱부터 시작
  const switchMode = (next: "general" | "reserve" | "commerce") => {
    if (next === mode) return;
    setMode(next);
    setApplied({});
    setDeckIndex(0);
    setDropped(false);
    setShowColorPicker(false);
    setCardColor(MODE_CARD_COLOR[next]); // 모드별 고정 배경색 적용
  };

  const score = useMemo(
    () =>
      Math.min(
        100,
        STUDIO_BLOCKS.reduce((sum, b) => (applied[b.id] ? sum + b.power : sum), 0)
      ),
    [applied]
  );

  const stage = getStage(score);
  const appliedCount = STUDIO_BLOCKS.filter((b) => applied[b.id] && !b.isPaid).length;

  const lingo = useMemo(() => {
    const deckBlocks = DECK_IDS[mode].map(blockById);
    const nextLever = deckBlocks
      .filter((b) => !b.isPaid && !applied[b.id])
      .sort((a, b) => b.power - a.power)[0];

    // 모드별 핵심 블록 안내 (덱에 없는 블록은 건너뜀)
    const firstMissingMain = deckBlocks.find((b) => b.isMain && !applied[b.id]);
    if (firstMissingMain) {
      const HINTS: Record<string, string> = {
        content: "친구가 0.5초 안에 멈추게 하려면 영상 핵심구간부터. 후크가 없으면 아무도 안 눌러요.",
        image: "본체 이미지 한 장이면 카드가 확 살아나요. 가장 잘 나온 컷부터 올려보세요.",
        calendar: "예약 카드인데 누를 곳이 없어요. 예약 캘린더를 장착해야 친구가 바로 행동해요.",
        product: "팔 상품의 이름과 가격부터 등록해요. 가격이 보여야 친구가 주문을 결심해요.",
        productimage: "상품 사진이 본체��� 돼요. 신선도와 품질이 드러난 한 장이 주문을 부릅니다.",
        seasonal: "지금이 구매 적기라는 걸 판매 캘린더로 보여주면 주문이 앞당겨져요.",
      };
      return { text: HINTS[firstMissingMain.id] ?? `${firstMissingMain.label}부터 장착해보세요.`, action: firstMissingMain.id };
    }
    if (deckBlocks.some((b) => b.id === "coupon") && !applied["coupon"]) {
      return { text: "왜 지금 행동해야 하죠? 쿠폰 한 장이면 '누를 이유'가 생겨요.", action: "coupon" };
    }
    if (score < ENHANCE_UNLOCK) {
      return {
        text: nextLever
          ? `${nextLever.label}까지 더하면 전환력이 확 올라가요.`
          : "거의 다 됐어요. 마무리만 하면 완성!",
        action: nextLever?.id ?? null,
      };
    }
    return {
      text: "전환 레버가 충분해요. 이제 강화(부스트)를 켜면 도달이 늘어요. 지금이 쓸 타이밍.",
      action: null,
    };
  }, [applied, score, mode]);

  function equip(block: StudioBlock) {
    if (block.isPaid && score < ENHANCE_UNLOCK) return;
    if (block.id === "bgcolor") {
      setShowColorPicker((v) => !v);
      setApplied((p) => ({ ...p, bgcolor: true }));
      setBurstKey((k) => k + 1);
      return;
    }
    setApplied((p) => ({ ...p, [block.id]: !p[block.id] }));
    if (!applied[block.id]) setBurstKey((k) => k + 1);
  }

  // 길게 누르면 아크릴 안내 패널, 짧게 탭하면 장착
  function startPress(id: string) {
    wasHold.current = false;
    holdTimer.current = setTimeout(() => {
      wasHold.current = true;
      setPressedId(id);
    }, 180);
  }
  function endPress() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPressedId(null);
  }

  function jumpTo(i: number) {
    setDeckIndex(Math.max(0, Math.min(DECK.length - 1, i)));
  }
  function onDeckTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX;
  }
  function onDeckTouchEnd(e: React.TouchEvent) {
    const d = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(d) < 40) return;
    jumpTo(deckIndex + (d < 0 ? 1 : -1));
  }

  const activeBlock = DECK[deckIndex];
  const activeApplied = !!applied[activeBlock.id];
  const activeLocked = !!activeBlock.isPaid && score < ENHANCE_UNLOCK;

  // 화면 배경은 하나로 통일 — 포인트(액센트) 컬러로만 카테고리를 분기
  const PAGE_BG = "#FAFAFA";
  const MODE_SKIN = {
    general: { accent: "#475569" },
    reserve: { accent: POINT },
    commerce: { accent: "#0F766E" },
  } as const;
  const accent = MODE_SKIN[mode].accent;
  const pageBg = PAGE_BG;

  // 모드별 카드 내용 (category = 상단 카드에 표시할 카테고리)
  const MODE_CONTENT = {
    general: {
      // 일반(퍼블릭) — 영상·콘텐츠를 카드로 공유
      badge: "퍼블릭",
      category: "퍼블릭 카드",
      categoryIcon: Globe,
      store: "내 채널",
      source: "YouTube · 공유 콘텐츠",
      title: "괴산 가을 여행 브이로그",
      subtitle: "노지 감성 영상 · 누구나 보기 공개",
      cta: "영상 보러가기",
      price: null as string | null,
      ctaIcon: Play,
      primaryAction: "영상 만들기",
      primaryIcon: Wand2,
    },
    reserve: {
      // 예약·쿠폰 — 예약을 받고 쿠폰 혜택을 더함
      badge: "예약·쿠폰",
      category: "예약 · 쿠폰 카드",
      categoryIcon: Calendar,
      store: "모래재캠핑장",
      source: "YouTube · 괴산 호수 캠핑",
      title: "모래재캠핑장",
      subtitle: "노지 감성 · 첫 예약 3,000원 쿠폰",
      cta: "날짜 골라 예약하기",
      price: null as string | null,
      ctaIcon: Calendar,
      primaryAction: "영상 만들기",
      primaryIcon: Wand2,
    },
    commerce: {
      // 내 상품 판매 — 농산물 직거래
      badge: "내 상품",
      category: "커머스 카드",
      categoryIcon: Store,
      store: "괴산 햇사과 농장",
      source: "내 농장 · 산지직송",
      title: "괴산 햇사과 5kg 산지직송",
      subtitle: "당일수확 · 부사 특품 · 무료배송",
      cta: "주문하기",
      price: "₩32,000",
      ctaIcon: Store,
      primaryAction: "주문하기",
      primaryIcon: Store,
    },
  } as const;
  const content = MODE_CONTENT[mode];

  return (
    <div className="min-h-screen pb-[150px] transition-colors duration-300" style={{ backgroundColor: pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#EDEDED] bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#525252] transition-colors hover:bg-[#F5F5F5]">
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_4px_12px_rgba(15,23,42,0.18)]"
              style={{ backgroundColor: INK }}
              aria-hidden="true"
            >
              <Sparkles className="h-[18px] w-[18px] text-white" strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-[15px] font-bold leading-tight text-[#0A0A0A]">카드 스튜디오</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#737373]">
                  <Store className="h-3 w-3" strokeWidth={2} />
                  {content.store}
                </span>
                <span className="text-[#D4D4D4]">·</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white transition-colors duration-300"
                  style={{ backgroundColor: accent }}
                >
                  {content.badge}
                </span>
              </div>
            </div>
          </div>
          {/* 등급 별 */}
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <Star
                key={i}
                className="h-4 w-4 transition-all duration-300"
                style={{
                  fill: i < stage.stars ? accent : "transparent",
                  color: i < stage.stars ? accent : "#D4D4D4",
                }}
                strokeWidth={2}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* ───────── 모드 전환 (일반 / 예약·쿠폰 / 커머스) ───────── */}
        <div className="mt-5 flex rounded-2xl bg-white p-1 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          {[
            { key: "general", label: "퍼블릭", Icon: Globe },
            { key: "reserve", label: "예약·쿠폰", Icon: Calendar },
            { key: "commerce", label: "커머스", Icon: Store },
          ].map(({ key, label, Icon }) => {
            const isOn = mode === key;
            return (
              <button
                key={key}
                onClick={() => switchMode(key as "general" | "reserve" | "commerce")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all duration-200 ${
                  isOn ? "text-white" : "text-[#737373]"
                }`}
                style={
                  isOn
                    ? {
                        backgroundColor: accent,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(15,23,42,0.14)",
                      }
                    : undefined
                }
                aria-pressed={isOn}
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ───────── 라이브 프리뷰 라벨 (WYSIWYG 캔버스 안내) ───────── */}
        <div className="mt-5 flex items-center justify-between px-0.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8A8A8A]">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: accent }}
              />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            </span>
            실시간 미리보기
          </span>
          <span className="text-[11px] font-medium text-[#B4B4B4]">보이는 그대로 공유돼요</span>
        </div>

        {/* ───────── 히어로: 라이브 캔버스 카드 ───────── */}
        <section className="pt-2.5">
          <div>
            <div
              className="relative mx-auto w-full select-none overflow-hidden rounded-[26px] p-5 text-[#0A0A0A] antialiased subpixel-antialiased"
              style={{
                backgroundColor: cardColor,
                boxShadow: `0 22px 60px -14px rgba(15,23,42,${0.14 + stage.stars * 0.04}), 0 0 0 1px #EDEDED`,
              }}
            >
              {/* 레벨업 버스트 */}
              <div
                key={burstKey}
                className="pointer-events-none absolute right-5 top-5 z-10"
              >
                {burstKey > 0 && (
                  <div
                    className="forge-burst flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: accent }}
                  >
                    <Zap className="h-4 w-4 text-white" strokeWidth={2.5} fill="#fff" />
                  </div>
                )}
              </div>

              {/* 콘텐츠 */}
              <div className="relative">
                {/* 카테고리 영역 — 포인트 컬러로 분기, 상단 카드에 표시 */}
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: `${accent}14`, color: accent }}
                  >
                    <content.categoryIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {content.category}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#8A8A8A]">
                    <Play className="h-3 w-3 fill-[#8A8A8A]" strokeWidth={0} />
                    {content.source}
                  </span>
                </div>

                {applied["content"] || applied["image"] ? (
                  <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-[#F4F4F5] ring-1 ring-[#EDEDED]">
                    <div className="relative flex h-full w-full items-center justify-center">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full animate-scale-in"
                        style={{ backgroundColor: accent }}
                      >
                        <Play className="ml-0.5 h-5 w-5 fill-white text-white" strokeWidth={0} />
                      </div>
                      {applied["content"] && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          0:42 핵심
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-3 flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed"
                    style={{ borderColor: `${accent}30`, backgroundColor: `${accent}08` }}
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${accent}16`, color: accent }}
                    >
                      <ImageIcon className="h-[22px] w-[22px]" strokeWidth={2} />
                    </span>
                    <span className="text-[11px] font-semibold text-[#8A8A8A]">덱에서 콘텐츠를 장착하세요</span>
                  </div>
                )}

                <h3 className="mt-4 text-xl font-bold tracking-tight text-[#0A0A0A]">{content.title}</h3>
                <p className="mt-0.5 text-[13px] text-[#737373]">{content.subtitle}</p>

                <div className="mt-4 space-y-2">
                  {applied["coupon"] && (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 animate-slide-up"
                      style={{ backgroundColor: `${accent}12`, color: accent }}
                    >
                      <Ticket className="h-4 w-4 shrink-0" strokeWidth={2} />
                      <span className="text-[13px] font-semibold">평일 1만원 할인 쿠폰</span>
                    </div>
                  )}
                  {applied["calendar"] && (
                    <button
                      className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-white animate-slide-up transition-transform duration-150 active:translate-y-px"
                      style={{
                        backgroundColor: accent,
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(15,23,42,0.14)",
                      }}
                    >
                      <span className="flex items-center gap-2 text-[14px] font-bold">
                        <content.ctaIcon className="h-4 w-4" strokeWidth={2.25} />
                        {content.cta}
                      </span>
                      {content.price ? (
                        <span className="text-[14px] font-bold tabular-nums">{content.price}</span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-white/70" strokeWidth={2.5} />
                      )}
                    </button>
                  )}
                  {applied["link"] && (
                    <div className="flex gap-2 animate-slide-up">
                      <span className="flex-1 rounded-lg bg-[#F4F4F5] py-2 text-center text-[12px] font-semibold text-[#0A0A0A]">
                        전화
                      </span>
                      <span className="flex-1 rounded-lg bg-[#F4F4F5] py-2 text-center text-[12px] font-semibold text-[#0A0A0A]">
                        위치
                      </span>
                    </div>
                  )}
                  {!applied["calendar"] && !applied["coupon"] && !applied["link"] && (
                    <div className="rounded-xl border border-dashed border-[#E0E0E0] py-3 text-center text-[12px] text-[#A3A3A3]">
                      목적 카드를 장착하면 여기에 행동 버튼이 생겨요
                    </div>
                  )}
                </div>

                {/* 모드별 하단 액션 — 레이즈드 키 스타일 (선명한 이너 하이라이트 + 타이트 섀도) */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition-transform duration-150 active:translate-y-px"
                    style={{
                      backgroundColor: accent,
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 1px rgba(15,23,42,0.16), 0 2px 4px rgba(15,23,42,0.12)",
                    }}
                  >
                    <content.primaryIcon className="h-[19px] w-[19px]" strokeWidth={2.5} />
                    {content.primaryAction}
                  </button>
                  <button
                    aria-label="링크 복사"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#404040] transition-transform duration-150 active:translate-y-px"
                    style={{ boxShadow: "inset 0 0 0 1px #E5E5E5, 0 1px 2px rgba(15,23,42,0.06)" }}
                  >
                    <Copy className="h-[20px] w-[20px]" strokeWidth={2.25} />
                  </button>
                  <button
                    aria-label="친구에게 보내기"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#404040] transition-transform duration-150 active:translate-y-px"
                    style={{ boxShadow: "inset 0 0 0 1px #E5E5E5, 0 1px 2px rgba(15,23,42,0.06)" }}
                  >
                    <MessageCircle className="h-[20px] w-[20px]" strokeWidth={2.25} />
                  </button>
                </div>

                {/* FTC 고지 */}
                <p className="mt-3 text-center text-[11px] leading-relaxed text-[#8A8A8A]">
                  본 콘텐츠는 LinkDrop 광고/제휴 안내가 적용됩니다. (FTC 권고 사항)
                </p>

                {/* ───────── 공유지도 · CardBody 프레임 (하단 탭 → 펼침) ───────── */}
                <div className="mt-3.5 border-t border-[#F0F0F0] pt-1">
                  <button
                    type="button"
                    onClick={() => setShareMapOpen((v) => !v)}
                    aria-expanded={shareMapOpen}
                    aria-controls="share-journey-panel"
                    className="flex w-full items-center justify-between rounded-xl px-1 py-2.5 text-left transition-colors active:bg-[#F7F7F8]"
                  >
                    <span className="flex items-center gap-2 text-[13px] font-bold text-[#404040]">
                      <GitBranch className="h-4 w-4" strokeWidth={2.25} style={{ color: accent }} />
                      공유 여정 보기
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                        style={{ backgroundColor: `${accent}14`, color: accent }}
                      >
                        12명 확산
                      </span>
                      <ChevronDown
                        className="h-4 w-4 text-[#A3A3A3] transition-transform duration-300"
                        strokeWidth={2.5}
                        style={{ transform: shareMapOpen ? "rotate(180deg)" : "none" }}
                      />
                    </span>
                  </button>

                  <div
                    id="share-journey-panel"
                    className="grid transition-all duration-300 ease-out"
                    style={{ gridTemplateRows: shareMapOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-1.5">
                        {SHARE_JOURNEY.map((node, i) => {
                          const isLast = i === SHARE_JOURNEY.length - 1;
                          const isMe = node.kind === "me";
                          const isBuyer = node.kind === "buyer";
                          return (
                            <div key={i} className="flex gap-2.5">
                              <div className="flex flex-none flex-col items-center">
                                <span
                                  className="flex h-8 w-8 items-center justify-center rounded-full"
                                  style={
                                    isMe
                                      ? { backgroundColor: accent, color: "#fff" }
                                      : isBuyer
                                      ? { backgroundColor: "#fff", color: accent, boxShadow: `0 0 0 2px ${accent}` }
                                      : { backgroundColor: "#F1F1F2", color: "#A3A3A3" }
                                  }
                                >
                                  {isBuyer ? (
                                    <ShoppingBag className="h-4 w-4" strokeWidth={2.25} />
                                  ) : (
                                    <User className="h-4 w-4" strokeWidth={2.25} />
                                  )}
                                </span>
                                {!isLast && <span className="my-0.5 w-0.5 flex-1 rounded-full bg-[#E8E8EA]" style={{ minHeight: 14 }} />}
                              </div>
                              <div className="flex-1 pb-3">
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                  <span
                                    className={`text-[13px] font-bold tabular-nums ${isMe ? "text-[#0A0A0A]" : "text-[#9A9A9A]"}`}
                                  >
                                    {node.name}
                                  </span>
                                  <span
                                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={
                                      node.emphasis
                                        ? { backgroundColor: accent, color: "#fff" }
                                        : isBuyer
                                        ? { backgroundColor: `${accent}18`, color: accent }
                                        : { backgroundColor: "#F1F1F2", color: "#737373" }
                                    }
                                  >
                                    {node.role}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        <p className="px-0.5 text-[12px] text-[#525252]">
                          이 드랍은 지금까지 <b className="font-bold text-[#0A0A0A]">12명</b>에게 퍼졌어요
                        </p>
                        <p className="mt-1.5 flex items-start gap-1.5 px-0.5 text-[11px] leading-relaxed text-[#A3A3A3]">
                          <Lock className="mt-0.5 h-3 w-3 flex-none" strokeWidth={2} />
                          타인 익명 · 구매·수령은 익명 유지 · 기여도만 집계(모집 없음)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── 전환력 게이지 ───────── */}
        <section className="mt-5 rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}14`, color: accent }}
              >
                <TrendingUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-[#0A0A0A]">{stage.label}</span>
                <span className="text-[11px] text-[#A3A3A3]">전환력 · {stage.tone}</span>
              </div>
            </div>
            <span className="text-[22px] font-bold tabular-nums" style={{ color: accent }}>
              {score}
              <span className="text-[13px] font-semibold text-[#A3A3A3]">/100</span>
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#F0F0F0]">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${score}%`,
                backgroundColor: accent,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-[#A3A3A3]">
            레버 {appliedCount}개 장착 · 강화는 {ENHANCE_UNLOCK}점부터 열려요
          </p>
        </section>

        {/* ───────── 링고AI 코칭 ───────── */}
        <section className="mt-3 flex items-start gap-3 rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)] animate-fade-in">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accent}14`, color: accent }}
          >
            <Lightbulb className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-[#0A0A0A]">링고AI</span>
              <span className="rounded-full border border-[#E5E5E5] px-1.5 py-0.5 text-[9px] font-bold text-[#737373]">
                전환 코칭
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-[#525252]">{lingo.text}</p>
          </div>
        </section>
      </div>

      {/* ───────── 강화 카드 덱 (스와이프 → 탭 장착) ───────── */}
      <section className="mt-6">
        <div className="mx-auto flex max-w-md items-center justify-between px-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#737373]">강화 카드 덱</p>
          <span className="text-[11px] font-medium text-[#9A9A9A]">밀어서 고르고 · 탭해서 장착</span>
        </div>

        {/* Coverflow */}
        <div
          className="relative mt-3 h-[268px] overflow-x-hidden overflow-y-visible"
          style={{ perspective: "1200px" }}
          onTouchStart={onDeckTouchStart}
          onTouchEnd={onDeckTouchEnd}
        >
          {DECK.map((block, i) => {
            const offset = i - deckIndex;
            const abs = Math.abs(offset);
            if (abs > 2) return null;
            const Icon = block.icon;
            const isOn = !!applied[block.id];
            const locked = !!block.isPaid && score < ENHANCE_UNLOCK;
            const isCenter = offset === 0;
            return (
              <button
                key={block.id}
                onClick={() => {
                  if (isCenter) {
                    if (wasHold.current) {
                      wasHold.current = false;
                      return;
                    }
                    equip(block);
                  } else {
                    jumpTo(i);
                  }
                }}
                onPointerDown={() => isCenter && startPress(block.id)}
                onPointerUp={endPress}
                onPointerLeave={endPress}
                onPointerCancel={endPress}
                className="absolute left-1/2 top-1/2 w-[200px] transition-all duration-300 ease-[cubic-bezier(0.19,1,0.22,1)]"
                style={{
                  transform: `translate(-50%, -50%) translateX(${offset * 56}%) rotateY(${offset * -24}deg) scale(${
                    isCenter ? 1 : 0.8
                  })`,
                  zIndex: 50 - abs,
                  opacity: abs >= 2 ? 0.3 : 1,
                  filter: isCenter ? "none" : "brightness(0.95)",
                }}
                aria-label={block.label}
              >
                <div
                  className="relative flex h-[240px] flex-col rounded-3xl bg-white p-5 text-left"
                  style={{
                    boxShadow: isCenter
                      ? isOn
                        ? `0 16px 36px -14px rgba(15,23,42,0.28), 0 0 0 2px ${accent}`
                        : "0 16px 36px -14px rgba(15,23,42,0.22), 0 0 0 1px #EDEDED"
                      : "0 8px 20px -12px rgba(15,23,42,0.18), 0 0 0 1px #EDEDED",
                  }}
                >
                  {/* 상단: 파워 + 카테고리 */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        block.isPaid
                          ? "bg-[#F5F5F5] text-[#737373]"
                          : block.isMain
                          ? "text-white"
                          : "bg-[#F5F5F5] text-[#525252]"
                      }`}
                      style={block.isMain && !block.isPaid ? { backgroundColor: accent } : undefined}
                    >
                      {block.isPaid ? "강화" : block.isMain ? "핵심" : "레버"}
                    </span>
                    {block.power > 0 ? (
                      <span
                        className="flex items-center gap-0.5 text-[15px] font-bold tabular-nums"
                        style={{ color: accent }}
                      >
                        <Zap className="h-4 w-4" strokeWidth={2.5} fill={accent} />+{block.power}
                      </span>
                    ) : (
                      <span className="text-[12px] font-bold text-[#A3A3A3]">도달↑</span>
                    )}
                  </div>

                  {/* 아이콘 */}
                  <div className="mt-2 flex flex-1 items-center justify-center">
                    <div
                      className="flex h-[76px] w-[76px] items-center justify-center rounded-2xl transition-colors"
                      style={
                        locked
                          ? { backgroundColor: "#F5F5F5", color: "#C4C4C4" }
                          : isOn
                          ? { backgroundColor: `${accent}16`, color: accent }
                          : { backgroundColor: "rgba(10,10,10,0.05)", color: "#0A0A0A" }
                      }
                    >
                      <Icon className="h-9 w-9" strokeWidth={1.75} />
                    </div>
                  </div>

                  {/* 라벨/설명 */}
                  <div>
                    <p className="text-[16px] font-bold leading-tight text-[#0A0A0A]">{block.label}</p>
                    <p className="mt-1 text-[12px] leading-[1.45] text-[#5C5C5C]">{block.desc}</p>
                  </div>

                  {/* 잠금 / 장착 상태 */}
                  {locked && (
                    <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#F0F0F0]">
                      <Lock className="h-3 w-3 text-[#A3A3A3]" strokeWidth={2.25} />
                    </div>
                  )}
                  {isOn && !locked && (
                    <div
                      className="chip-pop absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: accent, boxShadow: "0 1px 3px rgba(15,23,42,0.2), 0 0 0 2px #fff" }}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </div>
                  )}

                  {/* 아크릴 안내 패널 — 카드를 누르고 있는 동안 떠오름 */}
                  <div
                    className={`absolute inset-0 flex flex-col justify-end rounded-3xl p-5 transition-all duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] ${
                      pressedId === block.id
                        ? "pointer-events-none opacity-100"
                        : "pointer-events-none opacity-0"
                    }`}
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.62) 55%, rgba(255,255,255,0.86) 100%)",
                      backdropFilter: "blur(14px) saturate(140%)",
                      WebkitBackdropFilter: "blur(14px) saturate(140%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 0 1px rgba(255,255,255,0.55)",
                      transform: pressedId === block.id ? "translateY(0)" : "translateY(6px)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" style={{ color: accent }} strokeWidth={2.5} />
                      <span className="text-[12px] font-bold text-[#0A0A0A]">{block.label}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] font-medium leading-[1.5] text-[#1F2937]">
                      {block.detail}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 덱 네비 점 */}
        <div className="mx-auto mt-3 flex max-w-md items-center justify-center gap-1.5">
          {DECK.map((b, i) => (
            <button
              key={b.id}
              onClick={() => jumpTo(i)}
              aria-label={`${b.label}로 이동`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === deckIndex ? 20 : 6,
                backgroundColor: i === deckIndex ? accent : "#D4D4D4",
              }}
            />
          ))}
        </div>

        {/* 장착 액션 (가운데 카드 대상) */}
        <div className="mx-auto mt-4 max-w-md px-5">
          {/* 배경색 팔레트 (배경색 카드가 가운데일 때) */}
          {activeBlock.id === "bgcolor" && showColorPicker && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2 animate-fade-in">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCardColor(c.value)}
                  className="h-8 w-8 rounded-full ring-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    // @ts-expect-error css var
                    "--tw-ring-color": cardColor === c.value ? accent : "transparent",
                  }}
                  aria-label={c.label}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => equip(activeBlock)}
            disabled={activeLocked}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold transition-transform duration-150 active:translate-y-px ${
              activeLocked
                ? "cursor-not-allowed bg-white text-[#C4C4C4] [box-shadow:0_0_0_1px_#EDEDED]"
                : activeApplied
                ? "bg-white"
                : "text-white"
            }`}
            style={
              !activeLocked && !activeApplied
                ? {
                    backgroundColor: accent,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(15,23,42,0.16)",
                  }
                : activeApplied
                ? { color: accent, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                : undefined
            }
          >
            {activeLocked ? (
              <>
                <Lock className="h-4 w-4" strokeWidth={2.25} />
                완성 {ENHANCE_UNLOCK}점부터 열려요
              </>
            ) : activeApplied ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.5} />
                장착됨 · 탭하면 해제
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                {activeBlock.label} 장착
              </>
            )}
          </button>
        </div>
      </section>

      {/* ───────── 카드 드롭하기 ───────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div
          className="pointer-events-none h-6 bg-gradient-to-t to-transparent"
          style={{ ["--tw-gradient-from" as string]: pageBg, backgroundImage: `linear-gradient(to top, ${pageBg}, transparent)` }}
        />
        <div className="backdrop-blur-md" style={{ backgroundColor: `${pageBg}F2` }}>
          <div className="mx-auto max-w-md px-5 pb-4">
            <button
              onClick={() => setDropped(true)}
              disabled={score < 40}
              className={`group flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-bold transition-all duration-300 ${
                score >= 40
                  ? "text-white shadow-[0_8px_24px_rgba(15,23,42,0.22)] active:scale-[0.985]"
                  : "border border-[#EDEDED] bg-white text-[#A3A3A3]"
              }`}
              style={score >= 40 ? { backgroundColor: accent } : undefined}
            >
              {dropped ? (
                <>
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                  카톡으로 드롭했어요!
                </>
              ) : score >= 40 ? (
                <>
                  <Send
                    className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={2}
                  />
                  카드 드롭하기
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" strokeWidth={1.75} />
                  레버를 더 채워주세요
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CardStudioPageDemo() {
  return <CardStudioPage />;
}
