"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductRegisterForm, EMPTY_PRODUCT, type ProductForm } from "@/components/product-register-form";
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
  Sparkles,
  Star,
  Check,
  Send,
  Eye,
  Play,
  Lock,
  ChevronRight,
  Store,
  X,
  Zap,
  Plus,
  Minus,
  Copy,
  MessageCircle,
  Wand2,
  Tag,
  Globe,
  GitBranch,
  ChevronDown,
  User,
  Users,
  ShoppingBag,
  Phone,
  MapPin,
  Mic,
  Truck,
  Trash2,
  Clapperboard,
  Loader2,
  LayoutTemplate,
  ArrowUp,
  Undo2,
  Pencil,
  ListOrdered,
} from "lucide-react";
import { CardBody, type CardModel, SHIP_STAGES } from "@/components/card-body";

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
    id: "aivideo",
    label: "AI 광고영상 제작",
    desc: "상품 사진 → 광고영상 자동 생성",
    detail: "상품 사진과 정보만 넣으면 AI가 짧은 광고영상을 자동으로 만들어요. 촬영·편집 없이 첫 3초를 잡는 본체 영상을 얻어요.",
    icon: Clapperboard,
    category: "content",
    power: 26,
  },
  {
    id: "coupon",
    label: "쿠폰 연결",
    desc: "내 매장 쿠폰 중 선택",
    detail: "내 매장에 등록된 쿠폰을 카드에 붙여 방문 동기를 만들어요. 할인폭이 클수록 전환이 올라가요.",
    icon: Ticket,
    category: "purpose",
    power: 18,
  },
  {
    id: "dock",
    label: "카드 도킹",
    desc: "다른 카드 연결해 함께 보내기",
    detail: "이미 만든 다른 카드를 이 카드에 연결해 함께 보내요. 관련 카드를 묶어 한 번에 더 많은 전환을 만들어요.",
    icon: Copy,
    category: "purpose",
    power: 12,
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
    label: "매장정보",
    desc: "전화 · 위치 · 문의 버튼",
    detail: "전화·위치·문의 버튼을 카드에 얹어요. 보는 사람이 바로 행동할 수 있게 길을 열어줘요.",
    icon: LinkIcon,
    category: "purpose",
    power: 8,
  },
  {
    id: "party",
    label: "인원 선택",
    desc: "예약 인원을 미리 받기",
    detail: "예약할 인원 수를 카드 안에서 바로 골라요. 방문 규모를 미리 알면 노쇼가 줄고 준비가 쉬워져요.",
    icon: Users,
    category: "purpose",
    power: 16,
  },
  {
    id: "review",
    label: "고객 후기",
    desc: "평점 · 리뷰로 신뢰 더하기",
    detail: "실제 방문·구매 고객의 평점과 한 줄 후기를 보여줘요. 사회적 증거가 처음 보는 사람의 확신을 만들어요.",
    icon: Star,
    category: "purpose",
    power: 20,
  },
  {
    id: "delivery",
    label: "배송 안내",
    desc: "택배사 · 배송 진행 추적",
    detail: "택배사를 고르고 배송이 어디까지 갔는지(준비·배송중·완료) 카드에 바로 보여줘요. 송장번호·배송비·도착 예정일까지 한눈에 확인돼요.",
    icon: Truck,
    category: "purpose",
    power: 14,
  },
  {
    id: "brand",
    label: "브랜드 소개",
    desc: "우리 가게 한 줄 스토리",
    detail: "우리 브랜드의 짧은 이야기를 카드에 담아요. 왜 특별한지 한 줄로 전해 기억에 남는 카드를 만들어요.",
    icon: Store,
    category: "content",
    power: 12,
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
    detail: "이미 잘 만든 카드를 더 많은 친구에게 실어줘요. 완성된 카드일 때만 효과가 커요.",
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
  { id: "forest", value: "#14532D", label: "포레스트" },
  { id: "navy", value: "#1E3A8A", label: "�����이비" },
  { id: "wine", value: "#7F1D1D", label: "와인" },
  { id: "sand", value: "#78350F", label: "샌드" },
  { id: "slate", value: "#334155", label: "슬레이트" },
];

const ENHANCE_UNLOCK = 75;
  const POINT = "#1D4ED8"; // 예약·쿠폰(reserve) 모드 포인트 컬러
const INK = "#0A0A0A";

// 블록 장착 시 인라인으로 채우는 설정 옵션들
const COUPON_OPTIONS = [
  { id: "c1", label: "평일 1만원 할인", short: "1만원 할인" },
  { id: "c2", label: "2인 이상 15% 할인", short: "15% 할인" },
  { id: "c3", label: "첫 방문 웰컴 음료", short: "웰컴 음료" },
];
const DOCK_OPTIONS = [
  { id: "d1", title: "가을 단풍 명소 카드", meta: "퍼블릭 · 영상" },
  { id: "d2", title: "우리 캠핑장 투어", meta: "퍼블릭 · 영상" },
  { id: "d3", title: "겨울 시즌 예약 카드", meta: "예약 · 캘린더" },
];
// 매장정보 시설 태그 — 빠른 추가용 추천 목록
const FACILITY_PRESETS = ["주차 가능", "무료 와이파이", "반려동물 동반", "단체석", "예약 가능", "포장·배달", "유아 의자", "휠체어 접근"];
// AI 광고영상 제작 옵션
const AIV_STYLES = [
  { id: "dynamic", label: "다이내믹", desc: "빠른 컷 · 활기찬 무드" },
  { id: "calm", label: "차분한", desc: "느린 전환 · 감성적" },
  { id: "clean", label: "깔끔한", desc: "제품 중심 · ���니��" },
];
const AIV_LENGTHS = [
  { id: "10s", label: "10초" },
  { id: "15s", label: "15초" },
  { id: "30s", label: "30초" },
];
type FacilityItem = { id: string; text: string };
let facilitySeq = 0;
const newFacility = (text: string): FacilityItem => ({ id: `fac-${Date.now()}-${facilitySeq++}`, text });
const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"];
function buildDateList(count: number) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const dow = d.getDay();
    return {
      label: `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KR[dow]})`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      dow,
    };
  });
}
const DATE_LIST = buildDateList(45);
const DATE_OPTIONS = DATE_LIST.map((d) => d.label);
// 09:00 ~ 21:00, 1시간 단위
const TIME_OPTIONS = Array.from({ length: 13 }, (_, i) => `${String(9 + i).padStart(2, "0")}:00`);
// 배송 택배사 선택지
const COURIERS = ["CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배", "직접 전달"];
// 설정 UI가 필요한 블록
const CONFIGURABLE = [
  "calendar",
  "seasonal",
  "coupon",
  "product",
  "dock",
  "link",
  "content",
  "aivideo",
  "image",
  "productimage",
  "party",
  "review",
  "delivery",
  "brand",
];

function getStage(score: number) {
  if (score >= ENHANCE_UNLOCK) return { stars: 3, label: "완성", tone: "전환 준비 완료" };
  if (score >= 40) return { stars: 2, label: "괜찮음", tone: "조금만 더" };
  return { stars: 1, label: "기본", tone: "아직 약해요" };
}

// 모드별 덱 구성 (주 제작 → 일반 레버 → 강화)
const DECK_IDS: Record<"general" | "reserve" | "commerce", string[]> = {
  general: ["content", "dock", "bgcolor", "top", "boost", "marketing"],
  reserve: ["calendar", "party", "content", "review", "coupon", "brand", "dock", "image", "link", "bgcolor", "top", "boost", "marketing"],
  commerce: ["product", "productimage", "aivideo", "seasonal", "review", "delivery", "coupon", "brand", "dock", "link", "bgcolor", "top", "boost", "marketing"],
};
// 모드별 "핵심" 블록 — 이 목록의 블록은 덱에서 핵심 배지로 강조됨
// 예약·쿠폰(reserve)은 예약 캘린더와 쿠폰 두 가지가 핵심
const MODE_MAIN_IDS: Record<"general" | "reserve" | "commerce", string[]> = {
  general: [],
  reserve: ["calendar", "coupon"],
  commerce: ["product", "productimage", "seasonal"],
};
const blockById = (id: string) => STUDIO_BLOCKS.find((b) => b.id === id)!;

// 공유지도(공유 여정) — 익명 노드 체인. 신원 마스킹 + 기여도만 집계(모집 개념 없음)
const SHARE_JOURNEY: {
  name: string;
  role: string;
  kind: "peer" | "me" | "buyer";
  emphasis?: boolean;
}[] = [
  { name: "lee***9a", role: "개척 · 발송", kind: "peer" },
  { name: "par***k2", role: "전달", kind: "peer" },
  { name: "나", role: "최고 공헌자 · 전송", kind: "me", emphasis: true },
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
  const [mirrorOpen, setMirrorOpen] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  // 공개/비공개 — 손가락으로 좌우로 밀어서 전환
  const visTrackRef = useRef<HTMLDivElement>(null);
  const [visDragPct, setVisDragPct] = useState<number | null>(null); // 0=공개, 1=비공개, null=드래그 안 함
  const visDrag = useRef({ active: false, startX: 0, base: 0 });
  const [deckIndex, setDeckIndex] = useState(0);
  // 블록별 설정값 (장착과 동시에 채움 → 카드에 실시간 반영)
  const [cfgDate, setCfgDate] = useState(DATE_OPTIONS[0]);
  const [cfgTime, setCfgTime] = useState(TIME_OPTIONS[1]);
  // 판매 캘린더 — 판매 기간(시작일 인덱스 ~ 종료일 인덱스)
  const [saleStartIdx, setSaleStartIdx] = useState(0);
  const [saleEndIdx, setSaleEndIdx] = useState(6);
  // 복수 날짜 · 시간대 · 잔여 자리 (예약 설정과 동일한 개념)
  const [cfgDates, setCfgDates] = useState<string[]>([DATE_OPTIONS[0]]);
  const [cfgTimes, setCfgTimes] = useState<string[]>([TIME_OPTIONS[1]]);
  // 날짜별 잔여 좌석 (날짜마다 다르게)
  const [cfgSlotsByDate, setCfgSlotsByDate] = useState<Record<string, number>>({ [DATE_OPTIONS[0]]: 4 });
  const setSlotForDate = (date: string, next: number) =>
    setCfgSlotsByDate((prev) => ({ ...prev, [date]: Math.max(0, Math.min(20, next)) }));
  const dateRailRef = useRef<HTMLDivElement>(null);
  const [dateRailIdx, setDateRailIdx] = useState(0);
  const [cfgCoupon, setCfgCoupon] = useState(COUPON_OPTIONS[0].id);
  const [cfgDock, setCfgDock] = useState(DOCK_OPTIONS[0].id);
  const [cfgProductName, setCfgProductName] = useState("");
  const [cfgProductPrice, setCfgProductPrice] = useState("");
  // AI 광고영상 제작 (스타일·길이 선택 후 생성)
  const [aivStyle, setAivStyle] = useState("dynamic");
  const [aivLength, setAivLength] = useState("15s");
  const [aivStatus, setAivStatus] = useState<"idle" | "generating" | "done">("idle");
  const aivTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAivideo = () => {
    if (aivStatus === "generating") return;
    setAivStatus("generating");
    if (aivTimer.current) clearTimeout(aivTimer.current);
    aivTimer.current = setTimeout(() => setAivStatus("done"), 2600);
  };
  useEffect(() => () => { if (aivTimer.current) clearTimeout(aivTimer.current); }, []);
  // 이미지 등록 → AI 원페이지 상품 카탈로그 제작
  const [catImgReady, setCatImgReady] = useState(false);
  const [catStatus, setCatStatus] = useState<"idle" | "generating" | "done">("idle");
  const catTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startCatalog = () => {
    if (!catImgReady || catStatus === "generating") return;
    setCatStatus("generating");
    if (catTimer.current) clearTimeout(catTimer.current);
    catTimer.current = setTimeout(() => setCatStatus("done"), 2600);
  };
  useEffect(() => () => { if (catTimer.current) clearTimeout(catTimer.current); }, []);
  // 상품 등록 상세 (유형·원산지·판매단위·수량·셀링포인트 등)
  const [cfgProduct, setCfgProduct] = useState<ProductForm>(EMPTY_PRODUCT);
  const [cfgPhone, setCfgPhone] = useState(true);
  const [cfgMap, setCfgMap] = useState(true);
  // 매장정보 시설 태그 (추가·수정·삭제 가능)
  const [cfgFacilities, setCfgFacilities] = useState<FacilityItem[]>([
    newFacility("주차 가능"),
    newFacility("무료 와이파이"),
  ]);
  const addFacility = (text = "") => setCfgFacilities((prev) => [...prev, newFacility(text)]);
  const editFacility = (id: string, text: string) =>
    setCfgFacilities((prev) => prev.map((f) => (f.id === id ? { ...f, text } : f)));
  const removeFacility = (id: string) => setCfgFacilities((prev) => prev.filter((f) => f.id !== id));
  // 콘텐츠 편집��� (제목·설명·핵심구간)
  const [cfgTitle, setCfgTitle] = useState("");
  const [cfgSubtitle, setCfgSubtitle] = useState("");
  const [cfgClip, setCfgClip] = useState("0:42");
  // 추가 카드 편집값
  const [cfgParty, setCfgParty] = useState(2);
  const [cfgRating, setCfgRating] = useState(5);
  const [cfgReview, setCfgReview] = useState("");
  const [cfgShipFee, setCfgShipFee] = useState("무료");
  const [cfgShipEta, setCfgShipEta] = useState("2~3일");
  // 배송 안내 — 택배사 · 진행 단계 · 송장번호
  const [cfgCourier, setCfgCourier] = useState(COURIERS[0]);
  const [cfgShipStage, setCfgShipStage] = useState(0);
  const [cfgTrackingNo, setCfgTrackingNo] = useState("");
  const [cfgBrand, setCfgBrand] = useState("");
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  // 링고AI 플로팅 어시스턴트 — 어디서나 따라다니며 장착·탈착·편집을 도움
  const [lingoOpen, setLingoOpen] = useState(false);
  const [lastEquipped, setLastEquipped] = useState<string | null>(null);
  const deckRef = useRef<HTMLElement>(null);
  // 음성 대화
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  // 링고AI가 목적에 맞게 카드를 조립한 순서(번호 순서도 + 부연설명)
  const [lingoSteps, setLingoSteps] = useState<{ label: string; note: string }[]>([]);
  const [lingoText, setLingoText] = useState("");
  const recognitionRef = useRef<any>(null);
  const lingoLogRef = useRef<HTMLDivElement>(null);
  // 링고AI 플로팅 버튼 — 손가락으로 옮기기
  const FAB_SIZE = 56;
  const FAB_MARGIN = 12;
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null); // null = 기본 위치
  const [fabDragging, setFabDragging] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const fabDrag = useRef({ active: false, moved: false, dx: 0, dy: 0 });
  // 링고AI 패널 — 손가락으로 옮기기 (기본 위치 대비 오프셋)
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const [panelDragging, setPanelDragging] = useState(false);
  const panelDrag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  // 상단 AI 빌더 — 한 줄로 말하면 카드를 통째로 만들어줌
  const [heroPrompt, setHeroPrompt] = useState("");

  // 히어로 카드가 화면에서 벗어나면 상단에 조립 미니 미리보기를 띄운다
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { rootMargin: "-58px 0px -68% 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const touchStart = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHold = useRef(false);

  // 모드별 덱
  const DECK = useMemo(() => DECK_IDS[mode].map(blockById), [mode]);
  // 현재 모드에서 "핵심" 블록인지 (모드별 목록 기준)
  const isMainBlock = (id: string) => MODE_MAIN_IDS[mode].includes(id);

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

  // 공개/비공개 스와이프 — 손가락으로 좌우로 밀어서 전환
  function onVisPointerDown(e: React.PointerEvent) {
    visDrag.current = { active: true, startX: e.clientX, base: visibility === "public" ? 0 : 1 };
    setVisDragPct(visDrag.current.base);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onVisPointerMove(e: React.PointerEvent) {
    if (!visDrag.current.active) return;
    const track = visTrackRef.current;
    if (!track) return;
    const travel = track.clientWidth / 2; // 인디케이터가 이동하는 거리
    const delta = (e.clientX - visDrag.current.startX) / travel;
    setVisDragPct(Math.min(1, Math.max(0, visDrag.current.base + delta)));
  }
  function onVisPointerUp() {
    if (!visDrag.current.active) return;
    visDrag.current.active = false;
    setVisDragPct((pct) => {
      if (pct !== null) setVisibility(pct < 0.5 ? "public" : "private");
      return null;
    });
  }

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
    const firstMissingMain = deckBlocks.find((b) => isMainBlock(b.id) && !applied[b.id]);
    if (firstMissingMain) {
      const HINTS: Record<string, string> = {
        content: "친구가 0.5초 안에 멈추게 하려면 영상 핵심구간부터. 후크가 없으면 아무도 안 눌러요.",
        image: "본체 이미지 한 장이면 카드가 확 살아나요. 가장 잘 나온 컷부터 올려보세요.",
        calendar: "예약 카드인데 누를 곳이 없어요. 예약 캘린더를 장착해야 친구가 바로 행동해요.",
        product: "팔 상품의 이름과 가격부터 등록해요. 가격이 보여야 친구가 주문을 결심해요.",
        productimage: "상품 사진이 본체가 돼요. 신선도와 품질이 드러난 한 장이 주문을 부릅니다.",
        seasonal: "지금이 구매 적기라는 걸 판매 캘린더로 보여주면 주문이 앞당겨져요.",
      };
      return { text: HINTS[firstMissingMain.id] ?? `${firstMissingMain.label}부터 장착해보세요.`, action: firstMissingMain.id };
    }
    if (deckBlocks.some((b) => b.id === "coupon") && !applied["coupon"]) {
      return { text: "왜 지금 행동해야 하나요? 쿠폰 한 장이면 '누를 이유'가 ��겨요.", action: "coupon" };
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
    if (!applied[block.id]) {
      setBurstKey((k) => k + 1);
      setLastEquipped(block.id);
    } else {
      setLastEquipped((prev) => (prev === block.id ? null : prev));
    }
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

  // ── 링고AI 실행 헬퍼: 덱으로 스크롤·특정 블록으로 이동·추천 장착·탈착·편집 ──
  const scrollToDeck = () =>
    deckRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  function jumpToBlock(id: string) {
    const idx = DECK.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    setDeckIndex(idx);
    setTimeout(scrollToDeck, 60);
    return true;
  }

  // 추천 블록을 덱으로 옮기고 바로 장착
  function lingoEquipSuggestion() {
    if (!lingo.action) {
      scrollToDeck();
      setLingoOpen(false);
      return;
    }
    const idx = DECK.findIndex((b) => b.id === lingo.action);
    if (idx < 0) {
      scrollToDeck();
      setLingoOpen(false);
      return;
    }
    setDeckIndex(idx);
    const block = DECK[idx];
    if (!applied[block.id] && !(block.isPaid && score < ENHANCE_UNLOCK)) equip(block);
    setTimeout(scrollToDeck, 60);
    setLingoOpen(false);
  }

  // 방금 장착한 블록 탈착 (되돌리기)
  function lingoUndo() {
    if (!lastEquipped) return;
    setApplied((p) => ({ ...p, [lastEquipped]: false }));
    jumpToBlock(lastEquipped);
    setLastEquipped(null);
    setLingoOpen(false);
  }

  // 편집 가능한 블록으로 이동 (콘텐츠·상품 우선)
  function lingoEdit() {
    const priority = ["content", "product", "productimage", "image", "calendar", "seasonal", "coupon", "dock", "link"];
    const target =
      priority.find((id) => DECK.some((b) => b.id === id) && applied[id]) ??
      DECK.find((b) => CONFIGURABLE.includes(b.id))?.id;
    if (target) {
      if (!applied[target] && !(blockById(target).isPaid && score < ENHANCE_UNLOCK)) equip(blockById(target));
      jumpToBlock(target);
    } else {
      scrollToDeck();
    }
    setLingoOpen(false);
  }

  const canEdit = DECK.some((b) => CONFIGURABLE.includes(b.id));

  // 링고AI 플로팅 버튼 드래그 — 손가락으로 자��롭게 옮기기
  function clampFab(x: number, y: number) {
    const maxX = window.innerWidth - FAB_SIZE - FAB_MARGIN;
    const maxY = window.innerHeight - FAB_SIZE - FAB_MARGIN;
    return {
      x: Math.min(Math.max(FAB_MARGIN, x), maxX),
      y: Math.min(Math.max(FAB_MARGIN, y), maxY),
    };
  }
  function onFabPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = fabRef.current?.getBoundingClientRect();
    if (!rect) return;
    fabDrag.current = { active: true, moved: false, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onFabPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!fabDrag.current.active) return;
    const nx = e.clientX - fabDrag.current.dx;
    const ny = e.clientY - fabDrag.current.dy;
    const rect = fabRef.current?.getBoundingClientRect();
    if (rect && !fabDrag.current.moved) {
      const dist = Math.hypot(e.clientX - (rect.left + fabDrag.current.dx), e.clientY - (rect.top + fabDrag.current.dy));
      if (dist > 6) {
        fabDrag.current.moved = true;
        setFabDragging(true);
      }
    }
    if (fabDrag.current.moved) setFabPos(clampFab(nx, ny));
  }
  function onFabPointerUp() {
    if (!fabDrag.current.active) return;
    const wasDrag = fabDrag.current.moved;
    fabDrag.current.active = false;
    fabDrag.current.moved = false;
    setFabDragging(false);
    if (wasDrag) {
      // 가까운 좌/우 가장자리에 붙이기
      setFabPos((prev) => {
        if (!prev) return prev;
        const mid = window.innerWidth / 2;
        const snapX = prev.x + FAB_SIZE / 2 < mid ? FAB_MARGIN : window.innerWidth - FAB_SIZE - FAB_MARGIN;
        return clampFab(snapX, prev.y);
      });
    } else {
      setPanelOffset({ x: 0, y: 0 });
      setLingoOpen(true);
    }
  }

  // 링고AI 패널 드래그 — 상단 핸들로 자유롭게 옮기기
  function onPanelPointerDown(e: React.PointerEvent) {
    panelDrag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: panelOffset.x, oy: panelOffset.y };
    setPanelDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPanelPointerMove(e: React.PointerEvent) {
    if (!panelDrag.current.active) return;
    const dx = panelDrag.current.ox + (e.clientX - panelDrag.current.sx);
    const dy = panelDrag.current.oy + (e.clientY - panelDrag.current.sy);
    // 화면 밖으로 과하게 벗어나지 않도록 제한
    const maxX = window.innerWidth * 0.4;
    const maxY = window.innerHeight * 0.5;
    setPanelOffset({
      x: Math.min(Math.max(-maxX, dx), maxX),
      y: Math.min(Math.max(-maxY, dy), maxY),
    });
  }
  function onPanelPointerUp() {
    panelDrag.current.active = false;
    setPanelDragging(false);
  }

  // 텍스트로 링고에게 보내기 (입력창·칩 공용)
  function submitLingoText(text?: string) {
    const t = (text ?? lingoText).trim();
    if (!t || thinking) return;
    setLingoText("");
    sendToLingo(t);
  }

  // 상단 AI 빌더 — 한 줄 설명으로 카드를 통째로 구성 (패널을 열고 링고에게 전달)
  function buildWithAI(text?: string) {
    const t = (text ?? heroPrompt).trim();
    if (!t || thinking) return;
    setHeroPrompt("");
    setPanelOffset({ x: 0, y: 0 });
    setLingoOpen(true);
    sendToLingo(t);
  }

  // 모드별 "한 줄 설명" 예시 — 성과 중심 문장 (탭하면 바로 생성)
  const heroExamples = useMemo(() => {
    if (mode === "reserve") {
      return [
        "가을 라떼 신메뉴 홍보하고 주말 예약도 받고 싶어",
        "네일샵 첫 방문 손님한테 웰컴 쿠폰 주고 예약받기",
      ];
    }
    if (mode === "commerce") {
      return [
        "우리 농장 사과 5kg 팔고 싶어, 무료배송으로",
        "핸드메이드 캔들 2만원에 판매하고 배송 안내까지",
      ];
    }
    return [
      "신메뉴 ��개 영상 카드 만들어줘, 핵심구간부터 보이게",
      "우리 가게 오픈 소식 카드로 알리고 싶어",
    ];
  }, [mode]);

  // 상황별 빠른 명령 — 탭하면 즉시 ��행 (모드·��천 반영)
  const quickCommands = useMemo(() => {
    const cmds: string[] = [];
    if (mode === "reserve") {
      cmds.push("예약 캘린더 넣어줘", "쿠폰 넣어줘", "제목 바꿔줘");
    } else if (mode === "commerce") {
      cmds.push("상품 이름이랑 가격 넣어줘", "판��� 기간 설정해줘", "배송 안내 넣어줘");
    } else {
      cmds.push("영상 핵심구간 넣어줘", "제목 바꿔줘", "배경색 바꿔줘");
    }
    return cmds;
  }, [mode]);

  // 대화가 늘어나면 로그 맨 아래로 스크롤
  useEffect(() => {
    if (!lingoOpen) return;
    const el = lingoLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, interim, lingoOpen]);

  // ── 음성 대화: 브라우저 음성인식 초기화 ──
  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let final = "";
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else live += t;
      }
      setInterim(live);
      if (final) {
        setInterim("");
        sendToLingo(final.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function toggleListening() {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    try {
      window.speechSynthesis?.cancel();
      setInterim("");
      rec.start();
      setListening(true);
    } catch {}
  }

  // ��고AI가 반환한 액션들을 스튜디오 상태에 적용
  function applyLingoActions(actions: any[]) {
    for (const a of actions ?? []) {
      if (a.type === "switchMode" && a.mode) {
        switchMode(a.mode);
      } else if (a.type === "equip" && a.blockId) {
        const b = STUDIO_BLOCKS.find((x) => x.id === a.blockId);
        if (b && !applied[b.id] && !(b.isPaid && score < ENHANCE_UNLOCK)) {
          equip(b);
          jumpToBlock(b.id);
        }
      } else if (a.type === "detach" && a.blockId) {
        if (applied[a.blockId]) setApplied((p) => ({ ...p, [a.blockId]: false }));
      } else if (a.type === "setField" && a.field) {
        const v = a.value ?? "";
        switch (a.field) {
          case "title":
            setCfgTitle(v);
            if (!applied["content"]) equip(blockById("content"));
            break;
          case "subtitle":
            setCfgSubtitle(v);
            if (!applied["content"]) equip(blockById("content"));
            break;
          case "clip":
            setCfgClip(v);
            break;
          case "date":
            setCfgDate(v);
            setCfgDates((prev) => (prev.includes(v) ? prev : [...prev, v]));
            break;
          case "time":
            setCfgTime(v);
            setCfgTimes((prev) => (prev.includes(v) ? prev : [...prev, v]));
            break;
          case "coupon":
            setCfgCoupon(v);
            break;
          case "productName":
            setCfgProductName(v);
            break;
          case "productPrice":
            setCfgProductPrice(v.replace(/[^0-9,]/g, ""));
            break;
          case "dock":
            setCfgDock(v);
            break;
          case "phone":
            setCfgPhone(v === "true");
            break;
          case "map":
            setCfgMap(v === "true");
            break;
        }
      }
    }
  }

  async function sendToLingo(text: string) {
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setLingoSteps([]); // 새 요청 시작 — 이전 조립 순서 초기화
    setThinking(true);
    try {
      const deck = DECK.map((b) => ({
        id: b.id,
        label: b.label,
        desc: b.desc,
        applied: !!applied[b.id],
        locked: !!b.isPaid && score < ENHANCE_UNLOCK,
      }));
      const fields = {
        title: cfgTitle,
        subtitle: cfgSubtitle,
        date: cfgDate,
        time: cfgTime,
        saleStart: DATE_OPTIONS[saleStartIdx],
        saleEnd: DATE_OPTIONS[saleEndIdx],
        coupon: cfgCoupon,
        productName: cfgProductName,
        productPrice: cfgProductPrice,
        clip: cfgClip,
        dock: cfgDock,
      };
      const res = await fetch("/api/lingo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, mode, deck, fields, history: messages }),
      });
      const data = await res.json();
      applyLingoActions(data.actions);
      if (Array.isArray(data.steps) && data.steps.length >= 2) {
        setLingoSteps(data.steps.filter((s: any) => s && s.label));
      }
      const reply = data.reply || "네, 반영했어요.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      speak(reply);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "연결이 잠깐 끊겼어요. 다시 말씀해 주세요." }]);
    } finally {
      setThinking(false);
    }
  }

  const activeBlock = DECK[deckIndex];
  const activeApplied = !!applied[activeBlock.id];
  const activeLocked = !!activeBlock.isPaid && score < ENHANCE_UNLOCK;

  // 화면 배경은 하나로 통일 — 목적(모드)별 포인트 컬러로만 카테고리를 분기
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
      // 일반(퍼블릭) — 영상·콘텐츠를 카드로 공��
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
      // ���������약��쿠폰 — 예약을 받고 쿠폰 혜택을 더함
      badge: "예약·쿠폰",
      category: "예약 · 쿠폰 카드",
      categoryIcon: Calendar,
      store: "모래재캠핑장",
      source: "YouTube · 괴산 호수 캠핑",
      title: "모래재캠핑장",
      subtitle: "노지 감성 · 첫 예약 3,000원 쿠폰",
      cta: "예약하기",
      price: null as string | null,
      ctaIcon: Calendar,
      primaryAction: "영상 만들기",
      primaryIcon: Wand2,
    },
    commerce: {
      // 내 상품 판매 — 농산물 직거래
      badge: "내 상품",
      category: "상품판매 카드",
      categoryIcon: Store,
      store: "괴산 햇사과 농장",
      source: "내 농장 · 산지직송",
      title: "괴산 햇사과 5kg 산지직송",
      subtitle: "당일수확 · 부사 특품 · 무��배송",
      cta: "주문하기",
      price: "₩32,000",
      ctaIcon: Store,
      primaryAction: "주문하기",
      primaryIcon: Store,
    },
  } as const;
  const content = MODE_CONTENT[mode];

  // 제작=공유=수신 거울: 현재 스튜디오 상태를 단일 CardModel로 확정
  const cardModel: CardModel = {
    accent,
    cardColor,
    pageBg,
    category: content.category,
    categoryIcon: content.categoryIcon,
    source: content.source,
    ctaIcon: content.ctaIcon,
    store: content.store,
    applied,
    titleText: cfgTitle.trim()
      ? cfgTitle
      : applied["product"] && cfgProductName
      ? cfgProductName
      : content.title,
    subtitleText: cfgSubtitle.trim()
      ? cfgSubtitle
      : applied["product"] && cfgProduct.headline.trim()
      ? cfgProduct.headline
      : content.subtitle,
    clip: cfgClip,
    brandText: cfgBrand.trim() ? cfgBrand : `${content.store} · 우리 가게만의 이야기를 들려주세요`,
    priceText: cfgProductPrice ? `₩${cfgProductPrice}` : content.price ?? "",
    productType:
      cfgProduct.type === "fresh" ? "신선식품" : cfgProduct.type === "processed" ? "가공식품" : "공산품·잡화",
    productOrigin: cfgProduct.origin.trim(),
    productUnitLabel:
      cfgProduct.saleUnit === "unit"
        ? "낱개 판매"
        : cfgProduct.saleUnit === "box"
        ? `박스·묶음${cfgProduct.boxCount ? ` (한 박스 ${cfgProduct.boxCount}개)` : ""}`
        : `무게 단위${cfgProduct.totalWeight ? ` (${cfgProduct.totalWeight}kg)` : ""}`,
    productQty: cfgProduct.quantity.trim(),
    productPoints: cfgProduct.sellingPoints.map((p) => p.trim()).filter(Boolean),
    shipFee: cfgShipFee,
    shipEta: cfgShipEta,
    courier: cfgCourier,
    shipStage: cfgShipStage,
    trackingNo: cfgTrackingNo.trim(),
    rating: cfgRating,
    reviewText: cfgReview.trim() ? `“${cfgReview}”` : "“한 줄 후기로 신뢰를 더해보세요”",
    date: cfgDate,
    time: cfgTime,
    saleStart: DATE_OPTIONS[saleStartIdx],
    saleEnd: DATE_OPTIONS[saleEndIdx],
    dates: cfgDates,
    times: cfgTimes,
    slotsByDate: cfgSlotsByDate,
    party: cfgParty,
    couponLabel: COUPON_OPTIONS.find((c) => c.id === cfgCoupon)?.label ?? "쿠폰 혜택",
    couponShort: COUPON_OPTIONS.find((c) => c.id === cfgCoupon)?.short ?? "쿠폰",
    phone: cfgPhone,
    map: cfgMap,
    facilities: cfgFacilities.map((f) => f.text.trim()).filter(Boolean),
    dockTitle: DOCK_OPTIONS.find((d) => d.id === cfgDock)?.title ?? DOCK_OPTIONS[0].title,
    dockMeta: DOCK_OPTIONS.find((d) => d.id === cfgDock)?.meta ?? DOCK_OPTIONS[0].meta,
    journey: SHARE_JOURNEY,
    spreadCount: 12,
  };

  return (
      <div className="min-h-screen pb-[120px] transition-colors duration-300" style={{ backgroundColor: pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#EDEDED] bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3">
          <button
            aria-label="닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#525252] transition-colors hover:bg-[#F5F5F5]"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>

          <span className="h-6 w-px shrink-0 bg-[#EAEAEA]" aria-hidden="true" />

          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-[0_4px_12px_rgba(15,23,42,0.18)]"
            style={{ backgroundColor: INK }}
            aria-hidden="true"
          >
            <Sparkles className="h-[18px] w-[18px] text-white" strokeWidth={2.25} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-[#0A0A0A]">카드 스튜디오</p>
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#737373]">
              <Store className="h-3 w-3 shrink-0" strokeWidth={2} />
              <span className="truncate">{content.store}</span>
            </span>
          </div>

          {/* 등급 칩 — 별점 + 라벨 */}
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#F4F4F5] py-1 pl-2 pr-2.5">
            <span className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5 transition-all duration-300"
                  style={{
                    fill: i < stage.stars ? accent : "transparent",
                    color: i < stage.stars ? accent : "#D4D4D4",
                  }}
                  strokeWidth={2.25}
                />
              ))}
            </span>
            <span className="text-[11px] font-bold text-[#0A0A0A]">{stage.label}</span>
          </span>
        </div>
      </header>

      {/* ───────── 스티키 조립 미니 미리보기 (히어로 카드가 화면 밖일 때 등장) ───────── */}
      <div
        aria-hidden={heroVisible}
        className={`pointer-events-none fixed inset-x-0 top-[57px] z-30 transition-all duration-300 ease-out ${
          heroVisible ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="mx-auto max-w-md px-5 pt-2">
          <div className="flex items-center gap-3 rounded-2xl bg-white/95 p-2.5 pr-3 backdrop-blur-lg [box-shadow:0_10px_28px_-10px_rgba(15,23,42,0.22),0_0_0_1px_#EAEAEA]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F5] text-[#525252]">
              <content.categoryIcon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-[#0A0A0A]">{content.title}</p>
              <div className="mt-1 flex items-center gap-1">
                {DECK.filter((b) => applied[b.id]).length ? (
                  <>
                    {DECK.filter((b) => applied[b.id])
                      .slice(0, 4)
                      .map((b) => {
                        const BIcon = b.icon;
                        return (
                          <span
                            key={b.id}
                            className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F0F0F0] text-[#525252]"
                            title={b.label}
                          >
                            <BIcon className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                        );
                      })}
                    {DECK.filter((b) => applied[b.id]).length > 4 && (
                      <span className="text-[10px] font-bold text-[#A3A3A3]">
                        +{DECK.filter((b) => applied[b.id]).length - 4}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] font-medium text-[#8A8A8A]">덱에서 블록을 장착하면 여기 조립돼요</span>
                )}
              </div>
            </div>
            <span className="flex shrink-0 items-baseline gap-0.5 rounded-full bg-[#F4F4F5] px-2.5 py-1 text-[13px] font-bold tabular-nums text-[#0A0A0A]">
              {score}
              <span className="text-[10px] font-semibold text-[#A3A3A3]">/100</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5">
        {/* ───────── 모드 전환 (퍼블릭 / 예약·쿠폰 / 상품판매) ───────── */}
        <div className="mt-5 flex rounded-2xl bg-white p-1 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          {[
            { key: "general", label: "퍼블릭", Icon: Globe },
            { key: "reserve", label: "예약·쿠폰", Icon: Calendar },
            { key: "commerce", label: "상품판매", Icon: Store },
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

        {/* ───────── AI 빌더 — 한 줄로 말하면 카드를 만들어줌 ───────── */}
        <section className="mt-4 rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <span
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accent }}
            >
              <MessageCircle className="h-[17px] w-[17px]" strokeWidth={2.25} />
              <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3" strokeWidth={2.5} fill="currentColor" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold leading-tight text-[#0A0A0A]">AI로 카드 만들기</p>
              <p className="text-[11px] font-medium text-[#8A8A8A]">한 줄로 설명하면 카드를 통째로 구성해드려요</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 rounded-full bg-[#F4F4F5] py-1.5 pl-4 pr-1.5">
            <input
              value={heroPrompt}
              onChange={(e) => setHeroPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && (e as any).keyCode !== 229) {
                  e.preventDefault();
                  buildWithAI();
                }
              }}
              disabled={thinking}
              placeholder="어떤 카드를 만들까요?"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#9A9A9A]"
            />
            <button
              onClick={() => buildWithAI()}
              disabled={thinking || heroPrompt.trim() === ""}
              aria-label="AI로 카드 만들기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              {thinking ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.5} />
              ) : (
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
              )}
            </button>
          </div>

          <div className="mt-2.5 flex flex-col gap-1.5">
            {heroExamples.map((ex) => (
              <button
                key={ex}
                onClick={() => buildWithAI(ex)}
                disabled={thinking}
                className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-left text-[12px] font-medium text-[#404040] transition-transform active:scale-[0.98] disabled:opacity-40 [word-break:keep-all] [box-shadow:0_0_0_1px_#EDEDED]"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#A3A3A3]" strokeWidth={2.5} />
                <span className="min-w-0 flex-1 text-pretty">{ex}</span>
                <ArrowUp className="h-3.5 w-3.5 shrink-0 rotate-45 text-[#C4C4C4]" strokeWidth={2.5} />
              </button>
            ))}
          </div>
        </section>

        {/* ───────── 라이브 프리뷰 라벨 (WYSIWYG 캔버스 안내) ───────── */}
        <div className="mt-5 flex items-center justify-between px-0.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#525252]">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: accent }}
              />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            </span>
            실시간 미리보기
          </span>
              <span className="text-[11px] font-medium text-[#8A8A8A]">보이는 그대로 공유돼요</span>
        </div>

        {/* ───────── 히어로: 라이브 캔버스 카드 ───────── */}
        <section ref={heroRef} className="pt-2.5">
          <div>
            <CardBody model={cardModel} variant="studio" burstKey={burstKey} />
          </div>
        </section>

        {/* ───────── 전환력 게이지 ───────── */}
        <section className="mt-5 rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F4F5] text-[#525252]">
                <TrendingUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-[#0A0A0A]">{stage.label}</span>
                <span className="text-[11px] text-[#8A8A8A]">전환력 · {stage.tone}</span>
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
          <p className="mt-2 text-[11px] text-[#8A8A8A]">
            레버 {appliedCount}개 장착 · 강화는 {ENHANCE_UNLOCK}점부터 열려요
          </p>
        </section>

        {/* ───────── 링고AI 코칭 (탭하면 어시스턴트 열림) ───────── */}
        <button
          onClick={() => setLingoOpen(true)}
          className="mt-3 flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)] transition-transform duration-150 active:scale-[0.99] animate-fade-in"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
            <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
            <Sparkles className="absolute -right-0.5 -top-0.5 h-[11px] w-[11px]" strokeWidth={2.5} fill="currentColor" />
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
          <span className="mt-0.5 flex shrink-0 items-center gap-0.5 rounded-full bg-[#F4F4F5] px-2 py-1 text-[11px] font-bold text-[#525252]">
            도움받기
            <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </button>
      </div>

      {/* ───────── 강화 카드 덱 (스와이프 → 탭 장착) ───────── */}
      <section ref={deckRef} className="mt-6">
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
                          : isMainBlock(block.id)
                          ? "text-white"
                          : "bg-[#F5F5F5] text-[#525252]"
                      }`}
                      style={isMainBlock(block.id) && !block.isPaid ? { backgroundColor: accent } : undefined}
                    >
                      {block.isPaid ? "강화" : isMainBlock(block.id) ? "핵심" : "레버"}
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

                  {/* 아크�� 안내 패널 — 카드를 누르고 있는 동���� 떠오름 */}
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
                      <Sparkles className="h-3.5 w-3.5 text-[#737373]" strokeWidth={2.5} />
                      <span className="text-[12px] font-bold text-[#0A0A0A]">{block.label}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] font-medium leading-[1.5] text-[#1F2937]">
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

          {/* 블록 설정 패널 — 장착과 동시에 여기서 값을 채우면 카드에 바로 반영 */}
          {activeApplied && CONFIGURABLE.includes(activeBlock.id) && (
            <div
              className="mb-3 rounded-2xl bg-white p-3.5 animate-fade-in"
              style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}
            >
              <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-bold text-[#0A0A0A]">
                <activeBlock.icon className="h-3.5 w-3.5 text-[#525252]" strokeWidth={2.5} />
                {activeBlock.label} 설정
                <span className="ml-auto text-[10px] font-semibold text-[#8A8A8A]">카드에 바로 반영돼요</span>
              </p>

              {/* 폼이 길어도 페이지가 그대로 스크롤되도록 자연 흐름 유지 (내부 스크롤 트랩 제거) */}
              <div>
              {(activeBlock.id === "calendar" || activeBlock.id === "seasonal") && (
                <div className="space-y-2.5">
                  {activeBlock.id === "seasonal" ? (
                    // 판매 캘린더 — 판매 기간(시작일 ~ 종료일)
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                        <Calendar className="h-4 w-4 shrink-0 text-[#525252]" strokeWidth={2.25} />
                        <span className="text-[12px] font-semibold text-[#525252]">판매 기간</span>
                        <span className="ml-auto text-[12px] font-bold tabular-nums text-[#0A0A0A]">
                          {DATE_OPTIONS[saleStartIdx]}
                          {saleEndIdx !== saleStartIdx ? ` ~ ${DATE_OPTIONS[saleEndIdx]}` : ""}
                          <span className="ml-1.5 text-[11px] font-semibold text-[#8A8A8A]">
                            ({saleEndIdx - saleStartIdx + 1}일간)
                          </span>
                        </span>
                      </div>

                      {/* 시작일 */}
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">시작일</p>
                        <div className="flex flex-wrap gap-1.5">
                          {DATE_OPTIONS.slice(0, 10).map((d, i) => (
                            <button
                              key={d}
                              onClick={() => {
                                setSaleStartIdx(i);
                                if (i > saleEndIdx) setSaleEndIdx(i);
                              }}
                              className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                              style={
                                saleStartIdx === i
                                  ? { backgroundColor: accent, color: "#fff" }
                                  : { backgroundColor: "#F4F4F5", color: "#525252" }
                              }
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 종료일 — 시작일 이후만 선택 가능 */}
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">종료일</p>
                        <div className="flex flex-wrap gap-1.5">
                          {DATE_OPTIONS.slice(0, 10).map((d, i) => {
                            const disabled = i < saleStartIdx;
                            return (
                              <button
                                key={d}
                                disabled={disabled}
                                onClick={() => setSaleEndIdx(i)}
                                className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-35"
                                style={
                                  saleEndIdx === i
                                    ? { backgroundColor: accent, color: "#fff" }
                                    : { backgroundColor: "#F4F4F5", color: "#525252" }
                                }
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // 예약 캘린더 — 정돈된 3단계: 날짜 → 시간 → 자리수
                    <div className="space-y-3">
                      {/* STEP 1 — 날짜: 좌우로 밀어서 선택 */}
                      <section className="rounded-xl border border-[#EDEDED] p-2.5">
                        <div className="mb-2 flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A] text-[9px] font-extrabold text-white">
                            1
                          </span>
                          <p className="text-[11px] font-bold text-[#0A0A0A]">예약 가능일</p>
                          <span className="rounded-md bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#525252]">
                            {DATE_LIST[dateRailIdx].year}.{String(DATE_LIST[dateRailIdx].month).padStart(2, "0")}
                          </span>
                          <span className="ml-auto text-[10px] font-semibold text-[#8A8A8A]">
                            {cfgDates.length}일 선택
                          </span>
                        </div>

                        <div className="relative">
                          <div
                            ref={dateRailRef}
                            onScroll={(e) =>
                              setDateRailIdx(
                                Math.min(
                                  DATE_LIST.length - 1,
                                  Math.max(0, Math.round(e.currentTarget.scrollLeft / 46)),
                                ),
                              )
                            }
                            className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            {DATE_LIST.map((d) => {
                              const on = cfgDates.includes(d.label);
                              const dowColor = "#8A8A8A";
                              const seats = cfgSlotsByDate[d.label] ?? 0;
                              return (
                                <button
                                  key={d.label}
                                  onClick={() =>
                                    setCfgDates((prev) => {
                                      const isOn = prev.includes(d.label);
                                      const next = isOn
                                        ? prev.filter((x) => x !== d.label)
                                        : [...prev, d.label];
                                      const ordered = DATE_OPTIONS.filter((o) => next.includes(o));
                                      if (ordered.length) setCfgDate(ordered[0]);
                                      // 날짜별 좌석 기본값 부여 / 해제
                                      setCfgSlotsByDate((m) => {
                                        const copy = { ...m };
                                        if (isOn) delete copy[d.label];
                                        else copy[d.label] = copy[d.label] ?? 4;
                                        return copy;
                                      });
                                      return ordered;
                                    })
                                  }
                                  className="relative flex h-[50px] w-10 flex-none snap-start flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors"
                                  style={{
                                    backgroundColor: on ? "#0A0A0A" : "#F7F7F8",
                                    borderColor: on ? "#0A0A0A" : "transparent",
                                  }}
                                >
                                  <span
                                    className="text-[9px] font-bold leading-none"
                                    style={{ color: on ? "rgba(255,255,255,0.75)" : dowColor }}
                                  >
                                    {WEEKDAY_KR[d.dow]}
                                  </span>
                                  <span
                                    className="text-[15px] font-extrabold leading-none tabular-nums"
                                    style={{ color: on ? "#fff" : "#0A0A0A" }}
                                  >
                                    {d.day}
                                  </span>
                                  {on && (
                                    <span
                                      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold tabular-nums text-white"
                                      style={{ backgroundColor: accent }}
                                    >
                                      {seats}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {/* 우측 페이드 */}
                          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
                        </div>
                      </section>

                      {/* STEP 2 — 시간: 좌우로 밀어서 선택 */}
                      <section className="rounded-xl border border-[#EDEDED] p-2.5">
                        <div className="mb-2 flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A] text-[9px] font-extrabold text-white">
                            2
                          </span>
                          <p className="text-[11px] font-bold text-[#0A0A0A]">예약 가능 시간</p>
                          <span className="ml-auto text-[10px] font-semibold text-[#8A8A8A]">
                            {cfgTimes.length === 0 ? "시간 미지정" : `${cfgTimes.length}개 시간대`}
                          </span>
                        </div>
                        <div className="relative">
                          <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {/* 해당없음 — 시간 구분 없는 종일 예약 */}
                            {(() => {
                              const on = cfgTimes.length === 0;
                              return (
                                <button
                                  onClick={() => {
                                    setCfgTimes([]);
                                    setCfgTime("");
                                  }}
                                  className="flex h-10 flex-none snap-start items-center justify-center rounded-xl border px-4 text-[12px] font-bold transition-colors"
                                  style={
                                    on
                                      ? { backgroundColor: "#0A0A0A", borderColor: "#0A0A0A", color: "#fff" }
                                      : { backgroundColor: "#fff", borderColor: "#E5E5E5", color: "#8A8A8A" }
                                  }
                                >
                                  해당없음
                                </button>
                              );
                            })()}
                            {TIME_OPTIONS.map((t) => {
                              const on = cfgTimes.includes(t);
                              return (
                                <button
                                  key={t}
                                  onClick={() =>
                                    setCfgTimes((prev) => {
                                      const next = prev.includes(t)
                                        ? prev.filter((x) => x !== t)
                                        : [...prev, t];
                                      const ordered = TIME_OPTIONS.filter((o) => next.includes(o));
                                      if (ordered.length) setCfgTime(ordered[0]);
                                      return ordered;
                                    })
                                  }
                                  className="flex h-10 flex-none snap-start items-center justify-center rounded-xl border px-4 text-[12px] font-bold tabular-nums transition-colors"
                                  style={
                                    on
                                      ? { backgroundColor: "#0A0A0A", borderColor: "#0A0A0A", color: "#fff" }
                                      : { backgroundColor: "#F7F7F8", borderColor: "transparent", color: "#525252" }
                                  }
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
                        </div>
                      </section>

                      {/* STEP 3 — 날짜별 잔여 자리 */}
                      <section className="rounded-xl border border-[#EDEDED] p-2.5">
                        <div className="mb-2 flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A] text-[9px] font-extrabold text-white">
                            3
                          </span>
                          <p className="text-[11px] font-bold text-[#0A0A0A]">날짜별 잔�� 자리</p>
                          <span className="ml-auto text-[10px] text-[#8A8A8A]">날짜마다 다르게</span>
                        </div>
                        <div className="space-y-1.5">
                          {DATE_OPTIONS.filter((d) => cfgDates.includes(d)).map((d) => {
                            const seats = cfgSlotsByDate[d] ?? 4;
                            return (
                              <div
                                key={d}
                                className="flex items-center justify-between rounded-lg bg-[#F7F7F8] py-1.5 pl-2.5 pr-2.5"
                              >
                                <span className="text-[12px] font-bold tabular-nums text-[#0A0A0A]">{d}</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSlotForDate(d, seats - 1)}
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#0A0A0A] shadow-sm disabled:opacity-40"
                                    disabled={seats <= 0}
                                    aria-label={`${d} 좌석 감소`}
                                  >
                                    <Minus className="h-3 w-3" strokeWidth={2.5} />
                                  </button>
                                  <span
                                    className="w-11 text-center text-[13px] font-extrabold tabular-nums"
                                    style={{ color: seats === 0 ? "#A3A3A3" : accent }}
                                  >
                                    {seats === 0 ? "마감" : `${seats}석`}
                                  </span>
                                  <button
                                    onClick={() => setSlotForDate(d, seats + 1)}
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0A0A0A] text-white shadow-sm"
                                    aria-label={`${d} 좌석 증가`}
                                  >
                                    <Plus className="h-3 w-3" strokeWidth={2.5} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {cfgDates.length === 0 && (
                            <p className="py-2 text-center text-[11px] text-[#A3A3A3]">
                              위에서 예약 가능일을 먼저 선택하세요
                            </p>
                          )}
                        </div>
                      </section>

                      {/* 거울 요약 — 수신자에게 이렇게 보인다 */}
                      <div className="flex items-start gap-1.5 rounded-xl bg-[#F7F7F8] px-3 py-2.5">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-[#A3A3A3]" strokeWidth={2.5} />
                        <p className="text-[11px] font-medium leading-relaxed text-[#404040] [word-break:keep-all]">
                          수신자에게{" "}
                          <b className="font-bold text-[#0A0A0A]">
                            {cfgDates.length}일 · {cfgTimes.length === 0 ? "시간 미지정" : `${cfgTimes.length}개 시간대`}
                          </b>
                          , 날짜별 잔여 좌석까지 그대로 보여요
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeBlock.id === "coupon" && (
                <div className="space-y-1.5">
                  {COUPON_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCfgCoupon(c.id)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
                      style={
                        cfgCoupon === c.id
                          ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                          : { backgroundColor: "#F4F4F5" }
                      }
                    >
                      <Ticket
                        className="h-4 w-4 shrink-0"
                        style={{ color: cfgCoupon === c.id ? accent : "#A3A3A3" }}
                        strokeWidth={2.25}
                      />
                      <span className="flex-1 text-[13px] font-semibold text-[#0A0A0A]">{c.label}</span>
                      {cfgCoupon === c.id && <Check className="h-4 w-4" style={{ color: accent }} strokeWidth={2.5} />}
                    </button>
                  ))}
                </div>
              )}

              {activeBlock.id === "product" && (
                <ProductRegisterForm
                  accent={accent}
                  value={{ ...cfgProduct, name: cfgProductName, price: cfgProductPrice }}
                  onChange={(patch) => {
                    if (patch.name !== undefined) setCfgProductName(patch.name);
                    if (patch.price !== undefined) setCfgProductPrice(patch.price);
                    const rest = { ...patch };
                    delete rest.name;
                    delete rest.price;
                    if (Object.keys(rest).length) setCfgProduct((p) => ({ ...p, ...rest }));
                  }}
                />
              )}

              {activeBlock.id === "dock" && (
                <div className="space-y-1.5">
                  {DOCK_OPTIONS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setCfgDock(d.id)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors"
                      style={
                        cfgDock === d.id
                          ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                          : { backgroundColor: "#F4F4F5" }
                      }
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAEAEA] text-[#525252]">
                        <Play className="ml-0.5 h-3.5 w-3.5 fill-current" strokeWidth={0} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-[#0A0A0A]">{d.title}</span>
                        <span className="block text-[10px] text-[#8A8A8A]">{d.meta}</span>
                      </span>
                      {cfgDock === d.id && <Check className="h-4 w-4" style={{ color: accent }} strokeWidth={2.5} />}
                    </button>
                  ))}
                </div>
              )}

              {activeBlock.id === "content" && (
                <div className="space-y-2">
                  <input
                    value={cfgTitle}
                    onChange={(e) => setCfgTitle(e.target.value)}
                    placeholder={content.title}
                    className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
                    onFocus={(e) => (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`)}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  />
                  <textarea
                    value={cfgSubtitle}
                    onChange={(e) => setCfgSubtitle(e.target.value)}
                    placeholder={content.subtitle}
                    rows={2}
                    className="w-full resize-none rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-medium text-[#404040] outline-none placeholder:text-[#A3A3A3] focus:bg-white"
                    onFocus={(e) => (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`)}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  />
                  <div className="flex items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                    <Video className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                    <span className="text-[12px] font-semibold text-[#525252]">핵심 구간 시작</span>
                    <input
                      value={cfgClip}
                      onChange={(e) => setCfgClip(e.target.value.replace(/[^0-9:]/g, ""))}
                      inputMode="numeric"
                      className="ml-auto w-16 rounded-lg bg-white px-2 py-1 text-center text-[12px] font-bold tabular-nums text-[#0A0A0A] outline-none"
                      style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                    />
                  </div>
                </div>
              )}

              {activeBlock.id === "aivideo" && (
                <div className="space-y-3">
                  {/* 영상 스타일 ���택 */}
                  <div>
                    <p className="mb-1.5 text-[12px] font-bold text-[#404040]">영상 스타일</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {AIV_STYLES.map((s) => {
                        const on = aivStyle === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setAivStyle(s.id);
                              if (aivStatus === "done") setAivStatus("idle");
                            }}
                            className="rounded-xl px-2 py-2 text-left transition-colors"
                            style={
                              on
                                ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                                : { backgroundColor: "#F4F4F5" }
                            }
                          >
                            <span
                              className="block text-[12px] font-bold"
                              style={{ color: on ? accent : "#0A0A0A" }}
                            >
                              {s.label}
                            </span>
                            <span className="mt-0.5 block text-[10px] font-medium leading-tight text-[#8A8A8A]">
                              {s.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 영상 길이 선택 */}
                  <div>
                    <p className="mb-1.5 text-[12px] font-bold text-[#404040]">영상 길이</p>
                    <div className="flex gap-1.5">
                      {AIV_LENGTHS.map((l) => {
                        const on = aivLength === l.id;
                        return (
                          <button
                            key={l.id}
                            onClick={() => {
                              setAivLength(l.id);
                              if (aivStatus === "done") setAivStatus("idle");
                            }}
                            className="flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors"
                            style={
                              on
                                ? { backgroundColor: accent, color: "#fff" }
                                : { backgroundColor: "#F4F4F5", color: "#525252" }
                            }
                          >
                            {l.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 생성 결과 미리보기 */}
                  <div
                    className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl"
                    style={{ backgroundColor: aivStatus === "done" ? "#0F172A" : "#F4F4F5", boxShadow: aivStatus === "done" ? "none" : "inset 0 0 0 1px #E5E5E5" }}
                  >
                    {aivStatus === "idle" && (
                      <span className="flex flex-col items-center gap-1.5 text-[#8A8A8A]">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6E6E6] text-[#525252]">
                          <Clapperboard className="h-5 w-5" strokeWidth={2} />
                        </span>
                        <span className="text-[11px] font-semibold">상품 정보로 광고영상을 만들어요</span>
                      </span>
                    )}
                    {aivStatus === "generating" && (
                      <span className="flex flex-col items-center gap-2" style={{ color: accent }}>
                        <Loader2 className="h-7 w-7 animate-spin" strokeWidth={2.25} />
                        <span className="text-[11px] font-bold">AI가 영상을 만드는 중…</span>
                      </span>
                    )}
                    {aivStatus === "done" && (
                      <>
                        <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} />
                        <button
                          className="flex flex-col items-center gap-2 text-white"
                          aria-label="생성된 광고영상 재생"
                        >
                          <span
                            className="flex h-12 w-12 items-center justify-center rounded-full"
                            style={{ backgroundColor: accent }}
                          >
                            <Play className="ml-0.5 h-5 w-5 fill-white" strokeWidth={0} />
                          </span>
                          <span className="text-[11px] font-semibold text-white/80">
                            {AIV_STYLES.find((s) => s.id === aivStyle)?.label} · {aivLength} 광고영상
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* 생성 / 재생성 버튼 */}
                  <button
                    onClick={startAivideo}
                    disabled={aivStatus === "generating"}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold text-white transition-transform active:translate-y-px disabled:opacity-60"
                    style={{ backgroundColor: accent }}
                  >
                    {aivStatus === "generating" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                        생성 중…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" strokeWidth={2.5} />
                        {aivStatus === "done" ? "다시 생성" : "AI 광고영상 생성"}
                      </>
                    )}
                  </button>
                  <p className="text-center text-[10px] font-medium text-[#A3A3A3]">
                    상품 등록·이미지 정보를 바탕으로 만들어져요
                  </p>
                </div>
              )}

              {(activeBlock.id === "image" || activeBlock.id === "productimage") && (
                <div className="space-y-2">
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#F4F4F5]">
                    <span className="flex flex-col items-center gap-1.5 text-[#8A8A8A]">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={
                          catImgReady && activeBlock.id === "productimage"
                            ? { backgroundColor: `${accent}16`, color: accent }
                            : { backgroundColor: "#E6E6E6", color: "#525252" }
                        }
                      >
                        {catImgReady && activeBlock.id === "productimage" ? (
                          <Check className="h-5 w-5" strokeWidth={2.5} style={{ color: accent }} />
                        ) : (
                          <ImageIcon className="h-5 w-5" strokeWidth={2} />
                        )}
                      </span>
                      <span className="text-[11px] font-semibold">
                        {catImgReady && activeBlock.id === "productimage"
                          ? "상품 이미지 등록됨"
                          : `${activeBlock.id === "productimage" ? "상품 사진" : "대표 이미지"} 미리보기`}
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => activeBlock.id === "productimage" && setCatImgReady(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold text-white transition-transform active:translate-y-px"
                      style={{ backgroundColor: accent }}
                    >
                      <ImageIcon className="h-4 w-4" strokeWidth={2.25} />
                      갤러리에서 선택
                    </button>
                    <button
                      onClick={() => activeBlock.id === "productimage" && setCatImgReady(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[12px] font-semibold text-[#404040] transition-transform active:translate-y-px"
                    >
                      촬영
                    </button>
                  </div>

                  {/* 이미지 등록 → AI 원페이지 상품 카탈로그 제작 */}
                  {activeBlock.id === "productimage" && (
                    <div className="mt-1 rounded-xl bg-[#F4F4F5] p-3">
                      <div className="mb-1 flex items-center gap-1.5">
                        <LayoutTemplate className="h-4 w-4 shrink-0 text-[#525252]" strokeWidth={2.25} />
                        <span className="flex-1 text-[13px] font-bold text-[#0A0A0A]">AI 원페이지 카탈로그</span>
                        <span className="rounded-full bg-[#E6E6E6] px-2 py-0.5 text-[10px] font-bold text-[#525252]">
                          AI
                        </span>
                      </div>
                      <p className="mb-2.5 text-[11px] font-medium leading-relaxed text-[#8A8A8A]">
                        등록한 이미지를 분석해 제목·설명·특징까지 갖춘 한 장짜리 상품 카탈로그를 자동으로 만들어요.
                      </p>

                      {/* 결과 미리보기 */}
                      <div
                        className="relative mb-2.5 flex min-h-[132px] items-center justify-center overflow-hidden rounded-lg"
                        style={{ backgroundColor: catStatus === "done" ? "#fff" : "#fff", boxShadow: "inset 0 0 0 1px #ECECEC" }}
                      >
                        {catStatus === "idle" && (
                          <span className="flex flex-col items-center gap-1.5 px-4 text-center text-[#A3A3A3]">
                            <LayoutTemplate className="h-6 w-6 text-[#C4C4C4]" strokeWidth={1.75} />
                            <span className="text-[11px] font-semibold">
                              {catImgReady ? "생성 버튼을 눌러 카탈로그를 만들어요" : "먼저 상품 이미지를 등록해 주세요"}
                            </span>
                          </span>
                        )}
                        {catStatus === "generating" && (
                          <span className="flex flex-col items-center gap-2" style={{ color: accent }}>
                            <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2.25} />
                            <span className="text-[11px] font-bold">AI가 카탈로그를 만드는 중…</span>
                          </span>
                        )}
                        {catStatus === "done" && (
                          <div className="w-full p-2.5 text-left">
                            <div className="flex gap-2.5">
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-[#F0F0F0]">
                                <ImageIcon className="h-6 w-6 text-[#A3A3A3]" strokeWidth={1.75} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-bold text-[#0A0A0A]">
                                  {cfgProductName.trim() || "우리 매장 대표 상품"}
                                </p>
                                <p className="mt-0.5 text-[12px] font-bold text-[#0A0A0A]">
                                  {cfgProductPrice.trim() ? `${cfgProductPrice}원` : "가격 문의"}
                                </p>
                                <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-relaxed text-[#8A8A8A]">
                                  신선한 재료와 정성으로 준비한 대표 상품이에요. 지금 카드 한 장으로 바로 확인해 보세요.
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {["대표 상품", "신선함", "빠른 준비"].map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                                  style={{ backgroundColor: "#F4F4F5", color: "#525252" }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 생성 / 재생성 버튼 */}
                      <button
                        onClick={startCatalog}
                        disabled={!catImgReady || catStatus === "generating"}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold text-white transition-transform active:translate-y-px disabled:opacity-50"
                        style={{ backgroundColor: accent }}
                      >
                        {catStatus === "generating" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                            생성 중…
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4" strokeWidth={2.5} />
                            {catStatus === "done" ? "다시 생성" : "AI 카����그 생성"}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeBlock.id === "link" && (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    {[
                      { on: cfgPhone, set: setCfgPhone, icon: Phone, label: "전화 걸기" },
                      { on: cfgMap, set: setCfgMap, icon: MapPin, label: "위치 보기" },
                    ].map((row) => (
                      <button
                        key={row.label}
                        onClick={() => row.set((v) => !v)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
                        style={
                          row.on
                            ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                            : { backgroundColor: "#F4F4F5" }
                        }
                      >
                        <row.icon
                          className="h-4 w-4 shrink-0"
                          style={{ color: row.on ? accent : "#A3A3A3" }}
                          strokeWidth={2.25}
                        />
                        <span className="flex-1 text-[13px] font-semibold text-[#0A0A0A]">{row.label}</span>
                        <span
                          className="flex h-5 w-9 items-center rounded-full px-0.5 transition-colors"
                          style={{ backgroundColor: row.on ? accent : "#D4D4D4" }}
                        >
                          <span
                            className="h-4 w-4 rounded-full bg-white transition-transform"
                            style={{ transform: row.on ? "translateX(16px)" : "translateX(0)" }}
                          />
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* 시설 정보 — 추가·수정·삭제 */}
                  <div className="rounded-xl bg-[#F4F4F5] p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Store className="h-4 w-4 shrink-0 text-[#525252]" strokeWidth={2.25} />
                      <span className="flex-1 text-[13px] font-bold text-[#0A0A0A]">시설 정보</span>
                      <span className="text-[11px] font-medium text-[#A3A3A3]">{cfgFacilities.length}개</span>
                    </div>

                    {/* 추가된 시설 목록 (인라인 수정 + 삭제) */}
                    <div className="space-y-1.5">
                      {cfgFacilities.length === 0 && (
                        <p className="rounded-lg bg-white px-3 py-2.5 text-center text-[12px] font-medium text-[#A3A3A3]">
                          시설 정보를 추가해 보세요
                        </p>
                      )}
                      {cfgFacilities.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5"
                          style={{ boxShadow: "inset 0 0 0 1px #ECECEC" }}
                        >
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#737373]" strokeWidth={2.75} />
                          <input
                            value={f.text}
                            onChange={(e) => editFacility(f.id, e.target.value)}
                            placeholder="예: 주차 가능"
                            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#C4C4C4]"
                          />
                          <button
                            onClick={() => removeFacility(f.id)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#A3A3A3] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626] active:scale-90"
                            aria-label="시설 삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* 직접 추가 */}
                    <button
                      onClick={() => addFacility()}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#E6E6E6] py-2 text-[12px] font-bold text-[#404040] transition-transform active:translate-y-px"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                      시설 추가
                    </button>

                    {/* 빠른 추가 추천 태그 (이미 담긴 건 숨김) */}
                    {FACILITY_PRESETS.filter((p) => !cfgFacilities.some((f) => f.text.trim() === p)).length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">빠른 추가</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FACILITY_PRESETS.filter(
                            (p) => !cfgFacilities.some((f) => f.text.trim() === p),
                          ).map((p) => (
                            <button
                              key={p}
                              onClick={() => addFacility(p)}
                              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#525252] transition-transform active:scale-95"
                              style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                            >
                              <Plus className="h-3 w-3" strokeWidth={2.5} />
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeBlock.id === "party" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                    <span className="text-[12px] font-semibold text-[#525252]">예약 인원</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setCfgParty((n) => Math.max(1, n - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[16px] font-bold text-[#404040]"
                        style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                        aria-label="인원 줄이기"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-[15px] font-bold tabular-nums text-[#0A0A0A]">
                        {cfgParty}명
                      </span>
                      <button
                        onClick={() => setCfgParty((n) => Math.min(20, n + 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] font-bold text-white"
                        style={{ backgroundColor: accent }}
                        aria-label="인원 늘리기"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeBlock.id === "review" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                    <span className="text-[12px] font-semibold text-[#525252]">평점</span>
                    <div className="ml-auto flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setCfgRating(n)} aria-label={`${n}점`}>
                          <Star
                            className="h-5 w-5"
                            strokeWidth={2}
                            style={{
                              color: n <= cfgRating ? accent : "#D4D4D4",
                              fill: n <= cfgRating ? accent : "transparent",
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    value={cfgReview}
                    onChange={(e) => setCfgReview(e.target.value)}
                    placeholder="한 줄 후기를 입력하세요"
                    className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-medium text-[#404040] outline-none placeholder:text-[#A3A3A3] focus:bg-white"
                    onFocus={(e) => (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`)}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  />
                </div>
              )}

              {activeBlock.id === "delivery" && (
                <div className="space-y-3">
                  {/* 택배사 선택 */}
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">택배사</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COURIERS.map((c) => {
                        const on = cfgCourier === c;
                        return (
                          <button
                            key={c}
                            onClick={() => setCfgCourier(c)}
                            className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                            style={
                              on
                                ? { backgroundColor: accent, color: "#fff" }
                                : { backgroundColor: "#F4F4F5", color: "#525252" }
                            }
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 배송 진행 단계 — 어디까지 갔는지 */}
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">배송 진행 상태</p>
                    <div className="flex gap-1.5">
                      {SHIP_STAGES.map((label, i) => {
                        const on = cfgShipStage === i;
                        return (
                          <button
                            key={label}
                            onClick={() => setCfgShipStage(i)}
                            className="flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors"
                            style={
                              on
                                ? { backgroundColor: accent, color: "#fff" }
                                : { backgroundColor: "#F4F4F5", color: "#525252" }
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ���장���호 (선택) */}
                  <div className="flex items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                    <Truck className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                    <span className="text-[12px] font-semibold text-[#525252]">송장번호</span>
                    <input
                      value={cfgTrackingNo}
                      onChange={(e) => setCfgTrackingNo(e.target.value)}
                      placeholder="선택 입력"
                      inputMode="numeric"
                      className="ml-auto w-32 rounded-lg bg-white px-2 py-1 text-right text-[12px] font-bold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#B4B4B4]"
                      style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                    />
                  </div>

                  {/* 배송비 · 도착 예정 */}
                  <div className="flex items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                    <Truck className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                    <span className="text-[12px] font-semibold text-[#525252]">배송비</span>
                    <input
                      value={cfgShipFee}
                      onChange={(e) => setCfgShipFee(e.target.value)}
                      className="ml-auto w-24 rounded-lg bg-white px-2 py-1 text-right text-[12px] font-bold text-[#0A0A0A] outline-none"
                      style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                    <Calendar className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                    <span className="text-[12px] font-semibold text-[#525252]">���착 예정</span>
                    <input
                      value={cfgShipEta}
                      onChange={(e) => setCfgShipEta(e.target.value)}
                      className="ml-auto w-24 rounded-lg bg-white px-2 py-1 text-right text-[12px] font-bold text-[#0A0A0A] outline-none"
                      style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                    />
                  </div>
                </div>
              )}

              {activeBlock.id === "brand" && (
                <div className="space-y-2">
                  <textarea
                    value={cfgBrand}
                    onChange={(e) => setCfgBrand(e.target.value)}
                    placeholder="우리 가게를 한 줄로 소개해 주세요"
                    rows={2}
                    className="w-full resize-none rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-medium text-[#404040] outline-none placeholder:text-[#A3A3A3] focus:bg-white"
                    onFocus={(e) => (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`)}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  />
                </div>
              )}
              </div>
            </div>
          )}

          <button
            onClick={() => equip(activeBlock)}
            disabled={activeLocked}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold tracking-[-0.01em] transition-all duration-200 active:scale-[0.98] ${
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
                    boxShadow: `0 6px 18px -8px ${accent}80`,
                  }
                : activeApplied
                ? { color: accent, boxShadow: `inset 0 0 0 1.5px ${accent}`, backgroundColor: `${accent}0A` }
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

      {/* ───────── 공개 범위 · 미리보기 (일반 흐름) ───────── */}
      <div className="mx-auto mt-3 flex max-w-md flex-col gap-3 px-5">
        {/* 공개 범위 레버 (세그먼트 토글) — 손가락으로 좌우로 밀어서 전환 */}
        {(() => {
          const pct = visDragPct !== null ? visDragPct : visibility === "public" ? 0 : 1;
          const dragging = visDragPct !== null;
          return (
            <div
              ref={visTrackRef}
              onPointerDown={onVisPointerDown}
              onPointerMove={onVisPointerMove}
              onPointerUp={onVisPointerUp}
              onPointerCancel={onVisPointerUp}
              className="relative flex touch-none select-none rounded-2xl bg-[#F1F0EE] p-1"
            >
              <span
                className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-[0_2px_8px_rgba(15,23,42,0.10)] ${
                  dragging ? "" : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                }`}
                style={{ transform: `translateX(${pct * 100}%)` }}
              />
              <button
                onClick={() => setVisibility("public")}
                className="relative z-10 flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold transition-colors duration-200"
                style={{ color: pct < 0.5 ? accent : "#8A8A8A" }}
                aria-pressed={visibility === "public"}
              >
                <Globe className="h-4 w-4" strokeWidth={2.25} />
                공개
              </button>
              <button
                onClick={() => setVisibility("private")}
                className="relative z-10 flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold transition-colors duration-200"
                style={{ color: pct >= 0.5 ? "#0F172A" : "#8A8A8A" }}
                aria-pressed={visibility === "private"}
              >
                <Lock className="h-4 w-4" strokeWidth={2.25} />
                비공개
              </button>
            </div>
          );
        })()}
        <p className="-mt-0.5 px-1 text-center text-[11px] font-medium text-[#8A8A8A]">
          {visibility === "public" ? "누구나 볼 수 있고 검색·추천에 노출돼요" : "링크를 받은 사람만 볼 수 있어요"}
        </p>

        {/* 수신자 화면 미리보기 — 눈에 띄게 강조 */}
        <button
          onClick={() => setMirrorOpen(true)}
          className="group flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left transition-transform active:translate-y-px [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#F4F4F5] text-[#525252]">
            <Eye className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-[#0A0A0A]">수신자 화면 미리보기</span>
            <span className="block text-[11px] font-medium text-[#8A8A8A]">
              받는 사람에게 보이는 그대로 확인하기
            </span>
          </span>
          <ChevronRight className="h-4 w-4 flex-none text-[#C4C4C4] transition-transform group-active:translate-x-0.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* ───────── 카드 드롭하기 (기본 CTA만 고정) ───────── */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EDEDED] pb-[env(safe-area-inset-bottom)]" style={{ backgroundColor: pageBg }}>
        <div style={{ backgroundColor: pageBg }}>
          <div className="mx-auto flex max-w-md flex-col gap-3 px-5 pb-5 pt-4">
            {/* 전송 버튼 */}
            <button
              onClick={() => (dropped ? undefined : setMirrorOpen(true))}
              className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[14px] font-bold tracking-[-0.01em] text-white transition-all duration-300 active:scale-[0.98]"
              style={{
                backgroundColor: accent,
                boxShadow: `0 6px 18px -8px ${accent}80`,
              }}
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              {dropped ? (
                <>
                  <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
                  전송 완료
                </>
              ) : (
                <>
                  <Send
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={2.25}
                  />
                  전송
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ───────── 수��자 거울 시트 (보이는 그대로 = 받는 그대로) ───────── */}
      {mirrorOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/45 animate-fade-in" onClick={() => setMirrorOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[92vh] max-w-md animate-slide-up overflow-hidden rounded-t-3xl bg-[#F5F5F5] [box-shadow:0_-20px_60px_-20px_rgba(15,23,42,0.5)]">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] bg-white px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
                  <Send className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div>
                  <p className="text-[14px] font-bold leading-tight text-[#0A0A0A]">수신자에게 보이는 그대로</p>
                  <p className="text-[11px] text-[#8A8A8A]">지금 보이는 화면이 받는 사람 화면과 같아요</p>
                </div>
              </div>
              <button
                onClick={() => setMirrorOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#525252] transition-colors hover:bg-[#F5F5F5]"
                aria-label="닫기"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-4 pt-4" style={{ maxHeight: "calc(92vh - 154px)" }}>
              <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-[#F0F0F0] px-3 py-2 text-[11px] font-medium text-[#525252]">
                <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />
                {visibility === "public" ? "공개 드롭 · 누구나 열람 가능" : "비공개 드롭 · 링크 받은 사람만"}
              </div>
              <CardBody model={cardModel} variant="share" />
            </div>

            <div className="border-t border-[#EAEAEA] bg-white px-5 py-3.5">
              <button
                onClick={() => {
                  setDropped(true);
                  setMirrorOpen(false);
                }}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition-transform duration-150 active:scale-[0.98]"
                style={{ backgroundColor: accent, boxShadow: `0 10px 30px -8px ${accent}80` }}
              >
                <Send className="h-[18px] w-[18px]" strokeWidth={2.25} />
                전송하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────── 링고AI 플로팅 어시스턴트 (스튜디오 어디서나 따라다��) ───────── */}
      {!dropped && (
        <>
          {lingoOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/25 animate-fade-in"
                onClick={() => setLingoOpen(false)}
              />
              <div className="fixed inset-x-0 bottom-[188px] z-40 px-5 animate-slide-up">
                <div
                  className={`mx-auto max-w-md rounded-3xl bg-white p-4 [box-shadow:0_24px_60px_-16px_rgba(15,23,42,0.4),0_0_0_1px_#EDEDED] ${
                    panelDragging ? "" : "transition-transform duration-200 ease-out"
                  }`}
                  style={{ transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)` }}
                >
                  {/* 드래그 핸들 — 손가락으로 패널 옮기기 */}
                  <div
                    onPointerDown={onPanelPointerDown}
                    onPointerMove={onPanelPointerMove}
                    onPointerUp={onPanelPointerUp}
                    onPointerCancel={onPanelPointerUp}
                    className="mx-auto mb-2 flex h-4 w-full max-w-[120px] cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                    aria-label="패널 옮기기"
                  >
                    <span className="h-1.5 w-10 rounded-full bg-[#E0E0E0]" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
                      <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
                      <Sparkles className="absolute -right-0.5 -top-0.5 h-[11px] w-[11px]" strokeWidth={2.5} fill="currentColor" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold leading-tight text-[#0A0A0A]">링고AI</p>
                      <p className="flex items-center gap-1 text-[11px] font-medium text-[#9A9A9A]">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                        입력하거나 말하면 카드를 편집해드려요
                      </p>
                    </div>
                    <button
                      aria-label="닫기"
                      onClick={() => setLingoOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] transition-transform active:scale-90"
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* 대화 로그 */}
                  <div ref={lingoLogRef} className="mt-3 max-h-[34vh] space-y-2 overflow-y-auto">
                    {messages.length === 0 && (
                      <div className="rounded-2xl bg-[#F7F7F8] p-3.5">
                        <p className="flex items-start gap-1.5 text-[13px] font-medium leading-relaxed text-[#404040] [word-break:keep-all] text-pretty">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A3A3A3]" strokeWidth={2.5} fill="currentColor" />
                          <span>{lingo.text}</span>
                        </p>
                        <p className="mt-2.5 text-[11px] font-semibold text-[#9A9A9A]">이렇게 부탁해보세요 · 눌러도 돼요</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {quickCommands.map((ex) => (
                            <button
                              key={ex}
                              onClick={() => submitLingoText(ex)}
                              className="rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#404040] transition-transform active:scale-95 [word-break:keep-all] [box-shadow:0_0_0_1px_#EDEDED]"
                            >
                              {ex}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <div
                        key={i}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <span
                          className="max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed [word-break:keep-all]"
                          style={
                            m.role === "user"
                              ? { backgroundColor: accent, color: "#fff" }
                              : { backgroundColor: "#F4F4F5", color: "#404040" }
                          }
                        >
                          {m.text}
                        </span>
                      </div>
                    ))}
                    {interim && (
                      <div className="flex justify-end">
                        <span className="max-w-[82%] rounded-2xl bg-[#F4F4F5] px-3 py-2 text-[13px] italic text-[#A3A3A3]">
                          {interim}
                        </span>
                      </div>
                    )}
                    {thinking && (
                      <div className="flex justify-start">
                        <span className="flex items-center gap-1 rounded-2xl bg-[#F4F4F5] px-3 py-2.5">
                          {[0, 1, 2].map((d) => (
                            <span
                              key={d}
                              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A3A3A3]"
                              style={{ animationDelay: `${d * 0.15}s` }}
                            />
                          ))}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 조립 순서 — AI가 목적에 맞게 카드를 구성한 번호 순서도 + 부연설명 */}
                  {lingoSteps.length >= 2 && (
                    <div className="mt-3 rounded-2xl bg-[#F7F7F8] p-3.5 [box-shadow:inset_0_0_0_1px_#EDEDED]">
                      <div className="mb-2.5 flex items-center gap-1.5">
                        <ListOrdered className="h-4 w-4 text-[#525252]" strokeWidth={2.25} />
                        <p className="text-[12px] font-bold text-[#0A0A0A]">이 순서로 카드를 만들었어요</p>
                      </div>
                      <ol className="relative flex flex-col gap-3">
                        {lingoSteps.map((s, i) => (
                          <li key={i} className="relative flex gap-2.5">
                            {/* 연결선 */}
                            {i < lingoSteps.length - 1 && (
                              <span className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-[#D4D4D4]" />
                            )}
                            <span
                              className="relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                              style={{ backgroundColor: accent }}
                            >
                              {i + 1}
                            </span>
                            <div className="min-w-0 pt-0.5">
                              <p className="text-[12.5px] font-bold leading-tight text-[#0A0A0A] [word-break:keep-all]">
                                {s.label}
                              </p>
                              {s.note && (
                                <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all] text-pretty">
                                  {s.note}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* 추천 장착 — 눈에 띄는 한 줄 제안 (블록 고유 아이콘 사용) */}
                  {lingo.action && !applied[lingo.action] && (() => {
                    const SuggestIcon = blockById(lingo.action).icon;
                    return (
                      <button
                        onClick={lingoEquipSuggestion}
                        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#F4F4F5] text-[13px] font-bold text-[#0A0A0A] transition-transform active:scale-[0.98] [box-shadow:inset_0_0_0_1px_#E5E5E5]"
                      >
                        <SuggestIcon className="h-4 w-4 text-[#525252]" strokeWidth={2.25} />
                        {blockById(lingo.action).label} 바로 장착
                      </button>
                    );
                  })()}

                  {/* 상황별 빠른 명령 — 대화 중에도 가로 스크롤로 노출 */}
                  {messages.length > 0 && (
                    <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {quickCommands.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => submitLingoText(ex)}
                          disabled={thinking}
                          className="shrink-0 rounded-full bg-[#F4F4F5] px-3 py-1.5 text-[11px] font-semibold text-[#404040] transition-transform active:scale-95 disabled:opacity-40 [word-break:keep-all]"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 입력 컴포저 — 텍스트가 기본, 음성��� 보조 */}
                  <div className="mt-3">
                    <div
                      className="flex items-center gap-1.5 rounded-full bg-[#F4F4F5] py-1.5 pl-4 pr-1.5"
                      style={listening ? { boxShadow: "0 0 0 2px #DC2626" } : undefined}
                    >
                      <input
                        value={lingoText}
                        onChange={(e) => setLingoText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing && (e as any).keyCode !== 229) {
                            e.preventDefault();
                            submitLingoText();
                          }
                        }}
                        disabled={thinking}
                        placeholder={listening ? "듣고 있어요…" : "링고에게 편집을 부탁해보세요"}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#9A9A9A]"
                      />
                      {voiceSupported && lingoText.trim() === "" ? (
                        <button
                          onClick={toggleListening}
                          disabled={thinking}
                          aria-label={listening ? "음성 입력 종료" : "음성으로 말하기"}
                          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-50"
                          style={{ backgroundColor: listening ? "#DC2626" : accent }}
                        >
                          {listening && (
                            <span className="absolute inset-0 animate-ping rounded-full" style={{ backgroundColor: "rgba(220,38,38,0.4)" }} />
                          )}
                          <Mic className="relative h-[18px] w-[18px]" strokeWidth={2.25} />
                        </button>
                      ) : (
                        <button
                          onClick={() => submitLingoText()}
                          disabled={thinking || lingoText.trim() === ""}
                          aria-label="보내기"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-40"
                          style={{ backgroundColor: accent }}
                        >
                          <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                    {!voiceSupported && (
                      <p className="mt-1.5 text-center text-[10px] font-medium text-[#B4B4B4]">
                        음성은 크롬에서 쓸 수 있어요. 지금은 입력으로 편집해요.
                      </p>
                    )}
                  </div>

                  {/* 보조 도구 — 담기·편집·되돌리기 */}
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {[
                      {
                        key: "add",
                        icon: Plus,
                        label: "블록 담기",
                        onClick: () => {
                          scrollToDeck();
                          setLingoOpen(false);
                        },
                        disabled: false,
                      },
                      {
                        key: "edit",
                        icon: Pencil,
                        label: "내용 편집",
                        onClick: lingoEdit,
                        disabled: !canEdit,
                      },
                      {
                        key: "undo",
                        icon: Undo2,
                        label: "되돌리기",
                        onClick: lingoUndo,
                        disabled: !lastEquipped,
                      },
                    ].map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.key}
                          onClick={tool.onClick}
                          disabled={tool.disabled}
                          className="group flex flex-col items-center gap-1.5 rounded-2xl bg-[#F7F7F8] py-2.5 transition-all active:scale-[0.97] disabled:opacity-40 [box-shadow:inset_0_0_0_1px_#EDEDED]"
                        >
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                            style={{ backgroundColor: tool.disabled ? "#ECECEC" : "#EAEAEA", color: tool.disabled ? "#B4B4B4" : "#525252" }}
                          >
                            <Icon className="h-[17px] w-[17px]" strokeWidth={2.25} />
                          </span>
                          <span className="text-[11px] font-semibold text-[#404040] [word-break:keep-all]">
                            {tool.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {!lingoOpen && (
            <button
              ref={fabRef}
              aria-label="링고AI 열기 · 길게 눌러 옮기기"
              onPointerDown={onFabPointerDown}
              onPointerMove={onFabPointerMove}
              onPointerUp={onFabPointerUp}
              onPointerCancel={onFabPointerUp}
              className={`fixed z-40 flex h-14 w-14 touch-none items-center justify-center rounded-full text-white ring-[3px] ring-white ${fabDragging ? "scale-110 cursor-grabbing" : "cursor-grab transition-all duration-300 ease-out active:scale-90"}`}
              style={
                fabPos
                  ? { left: fabPos.x, top: fabPos.y, backgroundColor: accent, boxShadow: `0 14px 30px -8px ${accent}, 0 4px 12px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.25)` }
                  : { right: 20, bottom: 196, backgroundColor: accent, boxShadow: `0 14px 30px -8px ${accent}, 0 4px 12px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.25)` }
              }
            >
              <MessageCircle className="h-6 w-6" strokeWidth={2} />
              {lingo.action && !applied[lingo.action] && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                  <span
                    className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold"
                    style={{ color: accent }}
                  >
                    !
                  </span>
                </span>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function CardStudioPageDemo() {
  return <CardStudioPage />;
}
