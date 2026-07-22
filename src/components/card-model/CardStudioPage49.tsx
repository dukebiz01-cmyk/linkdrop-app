import { useEffect, useMemo, useRef, useState } from "react";
import { ProductRegisterForm, EMPTY_PRODUCT, type ProductForm } from "@/components/card-studio/ProductRegisterForm49";
// UI-5-T2-E1 — 영상 검색 실배선(45 파이프 계승). 45 순수 모듈·공용 타입 import(45 컴포넌트 무수정).
import type { DiscoverCandidate } from "@/components/explore/DiscoverSection";
import { getSupabase } from "@/lib/supabase";
import {
  FINDER_EMPTY_MSG,
  FINDER_FAIL_MSG,
  mapYoutubeSearchCandidates,
  parseYouTubeId,
  type YoutubeSearchItem,
} from "@/components/card-model/video-finder45";
// UI-5-T2-E2 — lingo-chat 실배선. 계약 타입만 import(useLingoChat 무수정 · 훅 소비는 49 구조 비호환 → 경량 클라).
import type { LingoContext } from "@/components/card-model/useLingoChat";
import {
  Calendar,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Ticket,
  Rocket,
  Search,
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
// UI-5-T2-E3 — 위지윅: 미리보기 = 정본 CardModelBody(거울) + 어댑터. CardBody49(v0 목업) 폐기.
import { CardModelBody } from "@/components/card-model/CardModelBody";
import { SHIP_STAGES, type CardModel } from "@/components/card-model/card-model.types";
import { studio49ToCardModel } from "@/components/card-studio/studio49-to-card";
import { LingoAssembleOverlay } from "@/components/card-studio/LingoAssembleOverlay49";

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
  { id: "clean", label: "깔끔한", desc: "제품 중심 · 미니멀" },
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

// UI-5-T2-E3c — 모드 식별자 단일 정본. 전 소비 지점(Record 키·함수 인자·상태)이 이 타입만 사용.
//   실제 값 집합 = 이 세 리터럴. 하드코딩 유니온 제거 → 표기 불일치 원천 차단.
type StudioMode = "general" | "reserve" | "commerce";

// 모드별 덱 구성 (주 제작 → 일반 레버 → 강화)
const DECK_IDS: Record<StudioMode, string[]> = {
  general: ["content", "dock", "top", "boost", "marketing"],
  reserve: ["calendar", "party", "content", "review", "coupon", "brand", "dock", "image", "link", "top", "boost", "marketing"],
  commerce: ["product", "productimage", "aivideo", "seasonal", "review", "delivery", "coupon", "brand", "dock", "link", "top", "boost", "marketing"],
};

// UI-5-T1h — AI 액션 모드 권한 가드(§0 역할 경계). 허용 블록 = 그 모드의 덱 구성(DECK_IDS) 자체(임의 창작 아님).
//   퍼블릭(general)=content/dock/… → coupon·calendar·product·seasonal 등 매장 기능 사용 불가.
//   필드는 그 필드를 지배하는 블록으로 환산해 심사(엔진의 setField↔블록 결합 반영).
const FIELD_TO_BLOCK: Record<string, string> = {
  title: "content",
  subtitle: "content",
  clip: "content",
  date: "calendar",
  time: "calendar",
  coupon: "coupon",
  productName: "product",
  productPrice: "product",
  dock: "dock",
  phone: "link",
  map: "link",
};
function isAiActionAllowed(mode: StudioMode, a: any): boolean {
  if (!a || typeof a.type !== "string") return false;
  const allowed = DECK_IDS[mode];
  if (a.type === "switchMode") return false; // 사용자 확인 없는 AI 모드 전환 금지.
  if (a.type === "detach") return true; // 해제(제거)는 항상 안전.
  if (a.type === "equip") return typeof a.blockId === "string" && allowed.includes(a.blockId);
  if (a.type === "setField") {
    if (AI_BLOCKED_FIELDS.has(a.field)) return false; // T1k(D) — 구간 값 등 자동 설정 금지(선택은 대표님).
    const blk = FIELD_TO_BLOCK[a.field];
    return !blk || allowed.includes(blk); // 매핑 없는 필드는 블록 게이트 없음(허용).
  }
  return true;
}

// UI-5-T1j — 조립 마킹: 필드 표시 라벨 + 숫자 불가침(항상 확인) 필드/블록 집합.
const FIELD_LABEL: Record<string, string> = {
  title: "제목",
  subtitle: "한마디",
  clip: "핵심 구간",
  coupon: "쿠폰",
  productName: "상품명",
  productPrice: "가격",
  date: "예약일",
  time: "예약 시간",
  dock: "도킹 카드",
  phone: "전화",
  map: "지도",
};
const NUMBER_FIELDS = new Set(["productPrice", "date", "time"]); // 가격·기간 계열 → 항상 확인(숫자 불가침).
const NUMBER_CRITICAL_BLOCKS = new Set(["product", "seasonal", "calendar", "party"]); // 가격·수량·기간·인원.
// UI-5-T1k(D) — 핵심구간(clip): "장착은 링고, 선택은 대표님". content = 선택 필요(needsConfirm 동급).
//   구간 값(clip) setField 는 AI 화이트리스트에서 제외 → 링고가 시도해도 가드에 걸림(T-2 실배선 방어).
const CLIP_BLOCKS = new Set(["content"]); // 구간 선택 필요 블록(선택은 대표님).
// UI-5-T1m — 영상=조립 관문(content=영상·핵심구간 블록, hasVideo=applied.content). 이미지=선택 필요.
const IMAGE_BLOCKS = new Set(["image", "productimage"]); // 사진 선택 필요 블록.
// 링고 자동 설정 금지 필드: 구간(clip)·영상 링크·사진 = 콘텐츠 대리 선택 금지(장착·안내만).
const AI_BLOCKED_FIELDS = new Set(["clip", "video", "videoUrl", "videoLink", "image", "imageUrl", "photo"]);
// UI-5-T1m — 미확정 릴레이 큐 정렬 우선순위: 영상 → 이미지 → 숫자(product/party/…) → 구간(content) → 기타.
function confirmRank(id: string): number {
  if (id === "__video") return 0;
  if (IMAGE_BLOCKS.has(id)) return 1;
  if (NUMBER_CRITICAL_BLOCKS.has(id)) return 2;
  if (CLIP_BLOCKS.has(id)) return 3;
  return 4;
}

// UI-5-T2-E2a — 모드별 제작 순서 플랜(생활어 라벨 · 개발용어 화면 금지). 마지막 = 확인(훑어보기 · 발행 별개 수동).
type PlanStep = { key: string; label: string; block?: string };
const STEP_PLAN: Record<StudioMode, PlanStep[]> = {
  general: [
    { key: "video", label: "영상 담기", block: "content" },
    { key: "title", label: "제목·한마디", block: "content" },
    { key: "clip", label: "핵심 장면", block: "content" },
    { key: "review", label: "확인" },
  ],
  reserve: [
    { key: "video", label: "영상 담기", block: "content" },
    { key: "title", label: "제목·한마디", block: "content" },
    { key: "coupon", label: "쿠폰", block: "coupon" },
    { key: "calendar", label: "예약 날짜", block: "calendar" },
    { key: "review", label: "확인" },
  ],
  commerce: [
    { key: "photo", label: "상품 사진", block: "productimage" },
    { key: "title", label: "상품 이름", block: "product" },
    { key: "price", label: "가격", block: "product" },
    { key: "season", label: "판매 기간", block: "seasonal" },
    { key: "review", label: "확인" },
  ],
};

// UI-5-T2-E1 — 영상 슬롯·유틸(45 :561–594 동형 복제 — 45 컴포넌트 무수정 · 거울 파일 import 회피).
type VideoSlot49 = {
  videoId: string;
  thumbnailUrl: string;
  title: string;
  isShorts: boolean;
  durationLabel?: string;
  sourceLabel?: string;
};
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function parseClock(v: string): number | null {
  const t = v.trim();
  if (!t || !/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}
function toVideoSlot(c: DiscoverCandidate): VideoSlot49 {
  return {
    videoId: c.source_id,
    thumbnailUrl: c.source_id ? `https://i.ytimg.com/vi/${c.source_id}/mqdefault.jpg` : (c.thumbnail_url ?? ""),
    title: c.title ?? "영상",
    isShorts: (c.duration_sec ?? 999) <= 60,
    durationLabel: c.duration_sec ? formatDuration(c.duration_sec) : undefined,
    sourceLabel: "YouTube",
  };
}

// UI-5-T1k(B2) — 미확정 칸 도우미 안내(블록별). 값 제안·자동입력 금지 — 링고는 안내만(숫자 불가침).
const HELPER_COPY: Record<string, string> = {
  product: "가격과 수량을 정해 주세요 — 여기에 적으면 카드에 바로 들어가요.",
  seasonal: "판매 기간을 정해 주세요 — 시작일과 종료일을 골라요.",
  calendar: "예약 받을 날짜를 골라 주세요.",
  party: "예약 인원을 정해 주세요.",
  coupon: "할인 금액을 확인해 주세요.",
  content: "영상에서 가장 보여주고 싶은 장면을 골라 주세요 — 시작과 끝을 움직이면 카드에 바로 반영돼요.",
  video: "가게 이름이나 메뉴로 검색해도 되고, 유튜브·인스타 링크를 붙여넣어도 돼요.",
  image: "매장 사진을 올려 주세요 — 첫 사진이 대표 이미지가 돼요.",
  productimage: "상품 사진을 올려 주세요 — 첫 사진이 카드의 얼굴이 돼요.",
  dock: "함께 보낼 카드를 골라 주세요.",
  link: "전화·위치를 확인해 주세요.",
};

// UI-5-T1j — 링고 손길 배지(스튜디오 크롬 전용 — 카드 프리뷰 내부 렌더 금지). 확인 필요 = 주황.
function LingoTouchBadge({ needsConfirm }: { needsConfirm: boolean }) {
  return needsConfirm ? (
    <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full border border-[#FDBA74] bg-[#FFF4EC] px-1.5 py-0.5 text-[10px] font-bold text-[#C2410C]">
      ● 확인 필요
    </span>
  ) : (
    <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
      ✦ 링고
    </span>
  );
}
// 모드별 "핵심" 블록 — 이 목록의 블록은 덱에서 핵심 배지로 강조됨
// 예약·쿠폰(reserve)은 예약 캘린더와 쿠폰 두 가지가 핵심
const MODE_MAIN_IDS: Record<StudioMode, string[]> = {
  general: [],
  reserve: ["calendar", "coupon"],
  commerce: ["product", "productimage", "seasonal"],
};
const blockById = (id: string) => STUDIO_BLOCKS.find((b) => b.id === id)!;

// UI-5-T2-E3e — 기본 코스(STEP_PLAN) 밖 잔여 블록의 생활어 라벨(실블록 기준). 추가 스텝 편입용.
const EXTRA_LABELS: Record<string, string> = {
  review: "리뷰",
  link: "전화·위치",
  image: "사진",
  brand: "가게 소개",
  party: "인원",
  coupon: "쿠폰",
  dock: "다른 링크",
  delivery: "배송 안내",
  aivideo: "AI 영상",
};

// 해당 모드에서 STEP_PLAN에 없는, 붙일 수 있는 잔여 블록(강화/유료 제외 · 생활어 라벨 보유).
function extraBlocksFor(m: StudioMode): string[] {
  const planBlocks = new Set(STEP_PLAN[m].map((s) => s.block).filter(Boolean) as string[]);
  return DECK_IDS[m].filter((id) => {
    if (planBlocks.has(id)) return false;
    const b = blockById(id);
    if (!b || b.isPaid || b.category === "enhance") return false;
    return !!EXTRA_LABELS[id];
  });
}

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

// UI-5-T2-E2 — lingo-chat SSE 파서·경량 재가드(useLingoChat :110/116/126 동형 — 훅 비export 함수라 복제).
const LINGO_ACTION_TYPES = new Set(["switchMode", "equip", "detach", "setField", "goToBlock"]);
function safeJson(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const raw of block.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0 && event === "message") return null;
  return { event, data: dataLines.join("\n") };
}

export function CardStudioPage() {
  const [mode, setMode] = useState<StudioMode>("general");
  // UI-5-T2-E3c — 실모드 라이브 ref. 렌더마다 동기화 → stale 클로저(마운트 1회 음성 effect 등)도
  //   modeRef.current 로 현재 실모드를 본다. 요청·응답 간 전환·E3b 리셋 레이스 정합의 단일 근거.
  const modeRef = useRef<StudioMode>(mode);
  modeRef.current = mode;
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [dropped, setDropped] = useState(false);
  // UI-5-T2-E4 — 발행 실배선(45 handlePublish 계승 · 비커머스 지원 필드 한정). 오발행 방지·무언 실패 금지.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
  // 조립 연출 타이머 정리
  useEffect(() => () => { assembleTimers.current.forEach(clearTimeout); }, []);
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
  // 콘텐츠 편집값 (제목·설명·핵심구간)
  const [cfgTitle, setCfgTitle] = useState("");
  const [cfgSubtitle, setCfgSubtitle] = useState("");
  const [cfgClip, setCfgClip] = useState("0:42");
  // UI-5-T2-E1 — 영상 검색 실배선(45 파이프). hasVideo = !!selectedVideo. 결과 = DiscoverCandidate.
  const [videoQuery, setVideoQuery] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [videoResults, setVideoResults] = useState<DiscoverCandidate[]>([]);
  const [videoSearching, setVideoSearching] = useState(false);
  const [videoSearched, setVideoSearched] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoSlot49 | null>(null);
  const videoLeadRef = useRef<string | null>(null); // 요약 리드 취소용(영상 바뀌면 이전 무시).
  // UI-5-T2-E2a — 순차 진행: 현재 스텝·완료 집합·잠금 토스트.
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set());
  // UI-5-T2-E3e — 런타임 플랜 사본(기본 코스 + 사용자 유래 추가 스텝). 진행 지도·isStepDone·릴레이 통일 근거.
  const [stepPlanState, setStepPlanState] = useState<PlanStep[]>(() => STEP_PLAN.general);
  const stepPlanRef = useRef<PlanStep[]>(stepPlanState); // SSE 사슬·다중 삽입 정합(modeRef와 동일 패턴).
  stepPlanRef.current = stepPlanState;
  // 확인 스텝 잔여-블록 제안: 1회만(재진입 반복 금지). used=이번 카드에서 이미 제안함.
  const [showReviewSuggest, setShowReviewSuggest] = useState(false);
  const reviewSuggestUsedRef = useRef(false);
  const [stepToast, setStepToast] = useState<string | null>(null);
  // UI-5-T2-E3b — 작업물 있는 상태에서 목적 전환 시도 시 확인 대상 모드(null=게이트 닫힘).
  const [pendingModeSwitch, setPendingModeSwitch] = useState<StudioMode | null>(null);
  useEffect(() => {
    if (!stepToast) return;
    const t = setTimeout(() => setStepToast(null), 1800);
    return () => clearTimeout(t);
  }, [stepToast]);
  // UI-5-T2-E2a(2) — 진입 시 초기 모드 플랜 제시(패널 첫 메시지).
  useEffect(() => {
    setMessages((m) => (m.length === 0 ? [{ role: "assistant", text: stepPlanIntro(mode) }] : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // UI-5-T1j — 링고 손길 기록(blockId|fieldKey) · 연출 시작 스냅샷 · 적용 액션 로그 · 종료 요약.
  const [lingoTouched, setLingoTouched] = useState<Set<string>>(() => new Set());
  const assembleSnapshot = useRef<any>(null);
  const appliedActionsRef = useRef<any[]>([]);
  const [assembleSummary, setAssembleSummary] = useState<
    null | { count: number; items: { id: string; label: string; value: string; needsConfirm: boolean; select?: boolean }[] }
  >(null);
  const touch = (keys: string[]) =>
    setLingoTouched((s) => {
      const n = new Set(s);
      keys.forEach((k) => n.add(k));
      return n;
    });
  const untouch = (keys: string[]) =>
    setLingoTouched((s) => {
      const n = new Set(s);
      keys.forEach((k) => n.delete(k));
      return n;
    });
  // UI-5-T1k(B) — 미확정 칸 도우미 릴레이(동행 선행). 대상 블록·단계·미확정 큐·스포트라이트 깜빡.
  const [helperTarget, setHelperTarget] = useState<string | null>(null);
  const [helperCopyKey, setHelperCopyKey] = useState<string | null>(null); // T1m — 안내 문구 오버라이드(예: 영상 관문).
  const [helperPhase, setHelperPhase] = useState<"guide" | "done" | "allDone">("guide");
  const [pendingConfirm, setPendingConfirm] = useState<string[]>([]);
  const [blinkBlock, setBlinkBlock] = useState<string | null>(null);
  const helperTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // done 단계에 남은 미확정이 없으면 전체 완료로 승격.
  useEffect(() => {
    if (helperPhase === "done" && pendingConfirm.length === 0) setHelperPhase("allDone");
  }, [helperPhase, pendingConfirm]);
  // 전체 완료 말풍선 3s 후 소멸(발행 CTA 자동 트리거 없음 — 헌장 ⑨).
  useEffect(() => {
    if (helperPhase !== "allDone") return;
    const t = setTimeout(() => {
      setHelperTarget(null);
      setHelperCopyKey(null);
      setHelperPhase("guide");
    }, 3000);
    return () => clearTimeout(t);
  }, [helperPhase]);
  const deckRef = useRef<HTMLElement>(null);
  // 음성 대화
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  // UI-5-T2-E4b — 인사 행동 칩(1스텝 하러 가기 / 알아서 할게요) 노출. 마운트·모드전환 시 재개, 상호작용 시 닫힘.
  const [greetingChipsOpen, setGreetingChipsOpen] = useState(true);
  const lingoSessionRef = useRef<string | null>(null); // UI-5-T2-E2 — lingo-chat 세션 id(meta 수신 시 보관).
  // UI-5-T1(T-D) — 조립순서 번호도(lingoSteps) 미이식.
  // 링고AI 조립 연출 — 카드 위에서 손가락으로 가리키며 단계별로 조립
  const [assembling, setAssembling] = useState(false);
  const [assembleStep, setAssembleStep] = useState(0);
  const [assembleSteps, setAssembleSteps] = useState<{ label: string; note: string; anchor?: string }[]>([]);
  const assembleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [lingoText, setLingoText] = useState("");
  const recognitionRef = useRef<any>(null);
  // UI-5-T2-E3c — 음성 effect는 마운트 1회([] deps)라 onresult가 첫 렌더 sendToLingo(mode="general")를
  //   고정 캡처 → 상품판매에서도 퍼블릭으로 요청·가드되는 버그의 근원. 최신 sendToLingo를 ref로 릴레이.
  const sendToLingoRef = useRef<(t: string) => void>(() => {});
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
  // UI-5-T2-E3b — 목적 전환 = 새 카드 새로 시작(45 엔진 계약 "전환=전체 리셋" 계승).
  //   전 리셋을 단일 함수로 집약 — 흩어진 개별 set 나열 금지. 스냅샷 구조(1182~)와 키 정합.
  const MODE_NAME: Record<StudioMode, string> = {
    general: "퍼블릭",
    reserve: "예약·쿠폰",
    commerce: "상품판매",
  };

  function resetForMode(next: StudioMode) {
    // ── 카드 상태(스냅샷 키 + 나머지 전 필드) ───────────────────────
    setMode(next);
    setApplied({});
    setDropped(false);
    setSaving(false); // E4 — 발행 상태도 새 카드로 초기화.
    setSaveError(null);
    setSavedUrl(null);
    setCopied(false);
    setMirrorOpen(false);
    setVisibility("public");
    setDeckIndex(0);
    setBurstKey(0);
    setLastEquipped(null);
    // 미디어·검색
    setSelectedVideo(null);
    setVideoQuery("");
    setVideoLink("");
    setVideoResults([]);
    setVideoSearching(false);
    setVideoSearched(false);
    setVideoError(null);
    setCatImgReady(false);
    setCatStatus("idle");
    setAivStyle("dynamic");
    setAivLength("15s");
    setAivStatus("idle");
    // cfg 전 필드
    setCfgDate(DATE_OPTIONS[0]);
    setCfgTime(TIME_OPTIONS[1]);
    setSaleStartIdx(0);
    setSaleEndIdx(6);
    setCfgDates([DATE_OPTIONS[0]]);
    setCfgTimes([TIME_OPTIONS[1]]);
    setCfgSlotsByDate({ [DATE_OPTIONS[0]]: 4 });
    setDateRailIdx(0);
    setCfgCoupon(COUPON_OPTIONS[0].id);
    setCfgDock(DOCK_OPTIONS[0].id);
    setCfgProductName("");
    setCfgProductPrice("");
    setCfgProduct(EMPTY_PRODUCT);
    setCfgPhone(true);
    setCfgMap(true);
    setCfgFacilities([newFacility("주차 가능"), newFacility("무료 와이파이")]);
    setCfgTitle("");
    setCfgSubtitle("");
    setCfgClip("0:42");
    setCfgParty(2);
    setCfgRating(5);
    setCfgReview("");
    setCfgShipFee("무료");
    setCfgShipEta("2~3일");
    setCfgCourier(COURIERS[0]);
    setCfgShipStage(0);
    setCfgTrackingNo("");
    setCfgBrand("");
    // ── 진행 상태·마킹·연출 ─────────────────────────────────────────
    setCurrentStep(0);
    setCompletedSteps(new Set());
    // E3e — 런타임 플랜을 기본 코스로 복원(추가 스텝 폐기) + 제안 1회 플래그 리셋.
    setStepPlanState(STEP_PLAN[next]);
    stepPlanRef.current = STEP_PLAN[next];
    reviewSuggestUsedRef.current = false;
    setShowReviewSuggest(false);
    setLingoTouched(new Set());
    setPendingConfirm([]);
    setHelperTarget(null);
    setHelperCopyKey(null);
    setHelperPhase("guide");
    setBlinkBlock(null);
    setAssembleSummary(null);
    setAssembling(false);
    setAssembleSteps([]);
    setAssembleStep(0);
    assembleSnapshot.current = null; // 되돌리기 스냅샷 폐기(이전 목적 작업물 유입 차단)
    appliedActionsRef.current = [];
    // ── 링고 패널: 대화 이력 유지 + 새 플랜 인사 ───────────────────
    // E4b — 전환 인사도 행동 지시형(1화면 1행동). 나열문 폐지.
    setMessages((m) => [
      ...m,
      { role: "assistant", text: `새 ${MODE_NAME[next]} 카드를 시작해요. 먼저 ${STEP_PLAN[next][0].label}부터 — ${firstStepGuide(next)}` },
    ]);
    setGreetingChipsOpen(true); // 새 인사 → 행동 칩 재개.
    // ── 안내 토스트 ─────────────────────────────────────────────────
    setStepToast(`새 ${MODE_NAME[next]} 카드를 시작했어요`);
  }

  // 작업물 존재 판정 — 하나라도 있으면 전환 시 확인 게이트.
  function hasWork(): boolean {
    return (
      !!selectedVideo ||
      catImgReady ||
      videoSearched ||
      Object.values(applied).some(Boolean) ||
      completedSteps.size > 0 ||
      currentStep > 0 ||
      cfgTitle.trim() !== "" ||
      cfgSubtitle.trim() !== "" ||
      cfgProductName.trim() !== "" ||
      cfgProductPrice.trim() !== "" ||
      cfgBrand.trim() !== "" ||
      cfgReview.trim() !== ""
    );
  }

  // 모드 탭·전환 지점 단일 진입 — hasWork면 확인 게이트, 아니면 즉시 리셋.
  function attemptSwitchMode(next: StudioMode) {
    if (next === mode) return; // 같은 모드 재탭 = 무동작(리셋 금지).
    if (hasWork()) setPendingModeSwitch(next);
    else resetForMode(next);
  }

  // switchMode 경로 통일 — 리셋을 resetForMode로 경유(AI switchMode는 상위에서 이미 차단·T1h).
  const switchMode = (next: StudioMode) => {
    if (next === mode) return;
    resetForMode(next);
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
      return { text: "왜 지금 행동해야 하나요? 쿠폰 한 장이면 '누를 이유'가 생겨요.", action: "coupon" };
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
    untouch([block.id]); // UI-5-T1j — 직접 장착/해제 = 손길 소멸(AI 경로는 applyOneLingoAction 이 직후 재기록).
    confirmHelper(block.id); // UI-5-T1k — 도우미 대상 블록 직접 조작 = 확정(guide→done). 비대상이면 no-op.
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

  // UI-5-T1(T-D) — 추천 장착(lingoEquipSuggestion)·보조도구(lingoUndo/lingoEdit/canEdit) 미이식.

  // 링고AI 플로팅 버튼 드래그 — 손가락으로 자유롭게 옮기기
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

  // UI-5-T1f(2) — 역할별 예시 분리: 일반(퍼블릭=내 채널/개인)=개인 공유 문구,
  //   예약·상품(파트너/매장)=매장 문구. 매장 성격 문구의 일반 모드 오염 제거.
  const heroExamples = useMemo(() => {
    if (mode === "reserve") {
      // 매장(파트너) — 예약·쿠폰
      return [
        "가을 라떼 신메뉴 홍보하고 주말 예약도 받고 싶어",
        "네일샵 첫 방문 손님한테 웰컴 쿠폰 주고 예약받기",
      ];
    }
    if (mode === "commerce") {
      // 매장(파트너) — 상품 판매
      return [
        "우리 농장 사과 5kg 팔고 싶어, 무료배송으로",
        "핸드메이드 캔들 2만원에 판매하고 배송 안내까지",
      ];
    }
    // 일반(퍼블릭=내 채널/개인) — 개인 공유 문구(매장 문구 금지)
    return [
      "여행 브이로그 하이라이트만 모아 카드로 만들어줘",
      "친구들에게 맛집 영상 공유 카드 만들어줘",
    ];
  }, [mode]);

  // UI-5-T1(T-D) — 퀵명령(quickCommands) 미이식.

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
        sendToLingoRef.current(final.trim()); // E3c — 최신 sendToLingo(현재 실모드) 경유. stale 캡처 회피.
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

  // 링고AI가 반환한 액션들을 스튜디오 상태에 적용
  function applyLingoActions(actions: any[]) {
    for (const a of actions ?? []) applyOneLingoAction(a);
  }

  // 액션 하나를 적용 (조립 연출에서 단계별로 호출)
  function applyOneLingoAction(a: any) {
    // UI-5-T1h(1b) — 엔진 레벨 최종 가드: 현재 모드 비허용 액션은 무적용(mock·실배선 공통 방어).
    //   안내(말풍선)는 sendToLingo 사전 필터(1c)가 1회 담당 — 여기선 조용히 스킵(이중 방어).
    if (!isAiActionAllowed(modeRef.current, a)) return; // E3c — 연출은 setTimeout 지연 재생 → 실모드 라이브 가드.
    {
      if (a.type === "switchMode" && a.mode) {
        switchMode(a.mode);
      } else if (a.type === "equip" && a.blockId) {
        const b = STUDIO_BLOCKS.find((x) => x.id === a.blockId);
        if (b && !(b.isPaid && score < ENHANCE_UNLOCK)) {
          if (!applied[b.id]) equip(b); // 이미 장착(예: 영상 관문 선행)이면 요약·손길만 기록.
          jumpToBlock(b.id);
          appliedActionsRef.current.push(a); // T1j·T1m — 적용 로그(요약) — 선(先)장착 블록도 포함.
          touch([b.id]); // T1j — 링고 손길 기록.
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
        appliedActionsRef.current.push(a); // T1j — 적용 로그(요약).
        touch([a.field, ...(FIELD_TO_BLOCK[a.field] ? [FIELD_TO_BLOCK[a.field]] : [])]); // T1j — 필드+블록 손길 기록.
      }
    }
  }

  // 링고AI가 손가락으로 카드를 가리키며 단계별로 조립하는 연출을 재생
  function runAssembly(actions: any[], steps: { label: string; note: string; anchor?: string }[]) {
    // 이전 연출 타이머 정리
    assembleTimers.current.forEach(clearTimeout);
    assembleTimers.current = [];

    setLingoOpen(false); // 패널을 닫아 카드+연출이 온전히 보이게
    // T1m — 연출 시작 시 영상 관문 도우미(guide) 정리(장착 후 재요청으로 진입한 경우).
    setHelperTarget(null);
    setHelperCopyKey(null);
    setAssembleSteps(steps);
    setAssembleStep(0);
    setAssembling(true);
    // UI-5-T1j(2A) — 연출 시작 전 스냅샷 1회 저장(전체 되돌리기용) + 적용 액션 로그 초기화.
    assembleSnapshot.current = {
      applied: { ...applied },
      cfgTitle,
      cfgSubtitle,
      cfgClip,
      cfgCoupon,
      cfgProductName,
      cfgProductPrice,
      cfgDock,
      cfgDate,
      cfgTime,
      cfgDates: [...cfgDates],
      cfgTimes: [...cfgTimes],
      cfgPhone,
      cfgMap,
      saleStartIdx,
      saleEndIdx,
      selectedVideo, // T1n — 영상 선택도 스냅샷(전체 되돌리기 정합).
      currentStep, // T2-E2a(5) — 스텝 진행도 스냅샷.
      completedSteps: new Set(completedSteps),
      lingoTouched: new Set(lingoTouched),
      stepPlan: [...stepPlanState], // E3e — 추가 스텝 포함 플랜 스냅샷(되돌리기 정합).
    };
    appliedActionsRef.current = [];
    // 히어로 카드를 화면 중앙으로
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    const STEP_MS = 2200; // UI-5-T1d — 완속(과속 수정): 스텝당 체류 ≥2.2s(이동0.5s + 링·말풍선 + 읽기1.5s).
    const n = steps.length;
    const totalActions = actions.length;

    for (let i = 0; i < n; i++) {
      const t = setTimeout(() => {
        setAssembleStep(i);
        // 이 단계에 배정된 액션들을 적용 (액션을 단계 수에 맞춰 분배)
        for (let ai = 0; ai < totalActions; ai++) {
          if (Math.floor((ai * n) / totalActions) === i) {
            applyOneLingoAction(actions[ai]);
          }
        }
        setBurstKey((k) => k + 1);
      }, i * STEP_MS + 450);
      assembleTimers.current.push(t);
    }

    // 마무리 — 딤 유지한 채 요약 카드로 전환(T1j-2) + 패널 요약 1줄.
    const done = setTimeout(() => {
      setAssembling(false);
      const summary = buildAssembleSummary();
      setAssembleSummary(summary);
      setPendingConfirm(
        summary.items
          .filter((i) => i.needsConfirm)
          .map((i) => i.id)
          .sort((a, b) => planOrder(a) - planOrder(b)), // T2-E2a(8c) — 릴레이 큐 = STEP_PLAN 순서.
      ); // T1k·T1m — 미확정 큐(영상→이미지→숫자→구간→기타).
      const filled = summary.items.filter((i) => !i.needsConfirm).map((i) => i.label);
      const need = summary.items.filter((i) => i.needsConfirm).map((i) => i.label);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `조립 완료 — ${filled.join("·") || "구성"} 채움${need.length ? `, ${need.join("·")} 확인 필요` : ""}.`,
        },
      ]);
    }, n * STEP_MS + 800); // 마지막 스텝 후 0.8s 여운.
    assembleTimers.current.push(done);
  }

  // UI-5-T1j(2) — 적용 로그(appliedActionsRef)로 종료 요약 구성. 숫자·가격·기간은 항상 확인 줄.
  function buildAssembleSummary() {
    const seen = new Set<string>();
    const items: { id: string; label: string; value: string; needsConfirm: boolean; select?: boolean }[] = [];
    for (const a of appliedActionsRef.current) {
      if (a.type === "equip" && a.blockId) {
        if (seen.has("b:" + a.blockId)) continue;
        seen.add("b:" + a.blockId);
        const b = STUDIO_BLOCKS.find((x) => x.id === a.blockId);
        if (b) {
          const isClip = CLIP_BLOCKS.has(b.id); // 구간 = 선택 필요(장착은 링고, 선택은 대표님).
          const isImage = IMAGE_BLOCKS.has(b.id); // T1m — 사진 = 선택 필요.
          const isSelect = isClip || isImage;
          items.push({
            id: b.id,
            label: isClip ? "핵심구간" : isImage ? "매장 사진" : b.label,
            value: "장착 완료",
            needsConfirm: NUMBER_CRITICAL_BLOCKS.has(b.id) || isSelect,
            select: isSelect,
          });
        }
      } else if (a.type === "setField" && a.field) {
        if (seen.has("f:" + a.field)) continue;
        seen.add("f:" + a.field);
        const raw = String(a.value ?? "");
        items.push({
          id: FIELD_TO_BLOCK[a.field] ?? a.field, // T1k — 칩 탭 이동 대상 블록.
          label: FIELD_LABEL[a.field] ?? a.field,
          value: raw.length > 20 ? raw.slice(0, 20) + "…" : raw,
          needsConfirm: NUMBER_FIELDS.has(a.field),
          select: false,
        });
      }
    }
    return { count: items.length, items };
  }

  // UI-5-T1j(2A) — [전체 되돌리기]: 연출 시작 전 스냅샷으로 일괄 복원.
  function undoAssembly() {
    const s = assembleSnapshot.current;
    if (s) {
      setApplied(s.applied);
      setCfgTitle(s.cfgTitle);
      setCfgSubtitle(s.cfgSubtitle);
      setCfgClip(s.cfgClip);
      setCfgCoupon(s.cfgCoupon);
      setCfgProductName(s.cfgProductName);
      setCfgProductPrice(s.cfgProductPrice);
      setCfgDock(s.cfgDock);
      setCfgDate(s.cfgDate);
      setCfgTime(s.cfgTime);
      setCfgDates(s.cfgDates);
      setCfgTimes(s.cfgTimes);
      setCfgPhone(s.cfgPhone);
      setCfgMap(s.cfgMap);
      setSaleStartIdx(s.saleStartIdx);
      setSaleEndIdx(s.saleEndIdx);
      setSelectedVideo(s.selectedVideo ?? null); // T1n — 영상 선택 복원.
      if (typeof s.currentStep === "number") setCurrentStep(s.currentStep); // T2-E2a — 스텝 진행 복원.
      if (s.completedSteps) setCompletedSteps(new Set(s.completedSteps));
      if (s.stepPlan) {
        setStepPlanState(s.stepPlan); // E3e — 추가 스텝 포함 플랜 복원.
        stepPlanRef.current = s.stepPlan;
      }
      setLingoTouched(s.lingoTouched);
    }
    setAssembleSummary(null);
  }
  function confirmAssembly() {
    setAssembleSummary(null);
  }

  // UI-5-T1k(B1)·T1m — 칩 탭/관문 → 딤 종료 → 해당 블록 이동 + 스포트라이트 1회 깜빡 + 도우미 말풍선(guide).
  //   copyKey = 안내 문구 오버라이드(예: 영상 관문 "video"). 미지정 시 블록 기본 안내.
  function onEditField(blockId: string, copyKey?: string) {
    setAssembleSummary(null); // 딤 종료(오버레이 cleanup 이 스크롤 잠금 원복).
    if (typeof document !== "undefined") document.body.style.overflow = ""; // T1k(C) — B 진입 시 잠금 확실 원복.
    const b = STUDIO_BLOCKS.find((x) => x.id === blockId);
    jumpToBlock(blockId); // setActiveBlock + scrollIntoView(center).
    if (b && !applied[b.id]) equip(b); // 설정 패널이 뜨도록 장착(미장착 시).
    setBlinkBlock(blockId);
    if (helperTimer.current) clearTimeout(helperTimer.current);
    helperTimer.current = setTimeout(() => setBlinkBlock(null), 1600); // 0.8s×2 깜빡 후 상주 금지.
    setHelperTarget(blockId);
    setHelperCopyKey(copyKey ?? null);
    setHelperPhase("guide");
  }
  // 사용자가 그 칸을 직접 확정(장착/필드 확정) → 완료 말풍선 + 릴레이(강제 이동 없음).
  function confirmHelper(blockId: string) {
    if (helperTarget !== blockId || helperPhase !== "guide") return;
    untouch([blockId]); // 배지 소멸 로직 연동.
    setPendingConfirm((q) => q.filter((id) => id !== blockId));
    setHelperPhase("done"); // helperCopyKey 는 done 문구용으로 유지(다음 이동/닫기 시 갱신·소멸).
  }
  function dismissHelper() {
    setHelperTarget(null);
    setHelperCopyKey(null);
    setHelperPhase("guide");
  }

  // UI-5-T2-E1 — 영상 검색 실배선(45 handleVideoSearch :1977 계승). URL=oembed / 키워드=discover→youtube-search 폴백.
  const focusVideoLink = () => {
    if (typeof document !== "undefined") document.getElementById("video-link-49")?.focus?.();
  };
  async function runVideoSearch() {
    const k = videoQuery.trim();
    if (!k || videoSearching) return;
    // (c) URL 붙여넣기 — oembed 실값으로 후보 1건(45 :1983–2024).
    const pastedId = parseYouTubeId(k);
    if (pastedId) {
      setVideoSearching(true);
      setVideoError(null);
      try {
        const vUrl = `https://www.youtube.com/watch?v=${pastedId}`;
        const res = await fetch("/api/oembed?url=" + encodeURIComponent(vUrl));
        const meta = (await res.json()) as {
          title?: string | null;
          author_name?: string | null;
          thumbnail_url?: string | null;
          duration_sec?: number | null;
          message?: string;
        };
        if (!res.ok) {
          setVideoError(meta.message ?? "영상 정보를 불러올 수 없어요. 링크를 확인해 주세요.");
          setVideoResults([]);
          return;
        }
        setVideoResults([
          {
            provider: "youtube",
            source_url: vUrl,
            source_id: pastedId,
            canonical_url: vUrl,
            title: meta.title ?? null,
            thumbnail_url: meta.thumbnail_url ?? null,
            author_name: meta.author_name ?? null,
            duration_sec: meta.duration_sec ?? null,
            raw_meta: {},
          },
        ]);
      } catch {
        setVideoError("지금 검색이 잘 안돼요 — 링크를 직접 붙여넣어 주세요.");
        setVideoResults([]);
        focusVideoLink();
      } finally {
        setVideoSearching(false);
        setVideoSearched(true);
      }
      return;
    }
    // (a) 주 소스 /api/discover(45 :2028) → 실패/빈 결과면 (b) youtube-search 폴백.
    setVideoSearching(true);
    setVideoError(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: k }),
      });
      const json = (await res.json()) as { candidates?: DiscoverCandidate[]; message?: string };
      const cands = res.ok ? (json.candidates ?? []).filter((c) => (c.provider as string) === "youtube") : [];
      if (cands.length > 0) {
        setVideoResults(cands);
      } else {
        await runFinderFallback(k); // 45 handleFinderSearch(:2053) 동일 소스.
      }
    } catch {
      await runFinderFallback(k); // 네트워크 실패도 폴백 후 최종 에러 처리.
    } finally {
      setVideoSearching(false);
      setVideoSearched(true);
    }
  }
  // 도우미 폴백 — youtube-search Edge invoke(45 :2059, 유저 JWT 자동 첨부).
  async function runFinderFallback(k: string) {
    try {
      const { data, error } = await getSupabase().functions.invoke("youtube-search", { body: { q: k } });
      if (error || !data) {
        setVideoError(FINDER_FAIL_MSG);
        setVideoResults([]);
        focusVideoLink();
        return;
      }
      const items = (data as { candidates?: YoutubeSearchItem[] }).candidates ?? [];
      const mapped = mapYoutubeSearchCandidates(items);
      if (mapped.length === 0) {
        setVideoResults([]); // 0건 = T1n 문구 렌더(검색 완료 + 빈 결과).
        setVideoError(null);
        return;
      }
      setVideoResults(mapped);
      setVideoError(null);
    } catch {
      setVideoError(FINDER_FAIL_MSG);
      setVideoResults([]);
      focusVideoLink();
    }
  }
  // 영상 선택 — 45 handleSelectVideo(:2086) 계승 + T1n 통합(장착·관문·도우미). 선택은 대표님.
  async function selectVideo(c: DiscoverCandidate) {
    const slot = toVideoSlot(c);
    setSelectedVideo(slot);
    setCfgClip(""); // 구간 초기화(45 :2092/2097) — 영상 바뀌면 구간 잔존 방지.
    if (!applied["content"]) equip(blockById("content")); // content 장착 → hasVideo 충족(관문 통과).
    setCfgTitle((t) => (t.trim() ? t : slot.title)); // 제목 반영(비었을 때만 — 사용자 제목 존중).
    confirmHelper("content"); // 도우미 완료(영상 담김) + 배지·릴레이 연동.
    // oembed→요약 리드(45 :2103) — 백그라운드 best-effort. 결과 소비는 T-2 AI 포인트 UI 예정.
    videoLeadRef.current = slot.videoId;
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${slot.videoId}`;
      const oembedRes = await fetch("/api/oembed?url=" + encodeURIComponent(videoUrl));
      const oembedJson = (await oembedRes.json()) as { source_id?: string };
      const sourceId = oembedJson?.source_id;
      if (!oembedRes.ok || !sourceId || videoLeadRef.current !== slot.videoId) return;
      await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
    } catch {
      /* 요약 리드 실패는 조용히 — 영상 선택 자체는 이미 반영됨. */
    }
  }
  // 링크 직접 붙여넣기 — URL 감지 시 oembed 후보 1건 → 즉시 선택(45 :1983 경로).
  async function onVideoLinkChange(v: string) {
    setVideoLink(v);
    const id = parseYouTubeId(v.trim());
    if (!id || id === selectedVideo?.videoId) return; // 유효 URL·중복 처리 방지.
    try {
      const vUrl = `https://www.youtube.com/watch?v=${id}`;
      const res = await fetch("/api/oembed?url=" + encodeURIComponent(vUrl));
      const meta = (await res.json()) as {
        title?: string | null;
        author_name?: string | null;
        thumbnail_url?: string | null;
        duration_sec?: number | null;
        message?: string;
      };
      if (!res.ok) {
        setVideoError(meta.message ?? "영상 정보를 불러올 수 없어요. 링크를 확인해 주세요.");
        return;
      }
      void selectVideo({
        provider: "youtube",
        source_url: vUrl,
        source_id: id,
        canonical_url: vUrl,
        title: meta.title ?? null,
        thumbnail_url: meta.thumbnail_url ?? null,
        author_name: meta.author_name ?? null,
        duration_sec: meta.duration_sec ?? null,
        raw_meta: {},
      });
    } catch {
      setVideoError("지금 검색이 잘 안돼요 — 링크를 직접 붙여넣어 주세요.");
      focusVideoLink();
    }
  }

  function skipAssembly() {
    assembleTimers.current.forEach(clearTimeout);
    assembleTimers.current = [];
    setAssembling(false);
    const sum = buildAssembleSummary(); // 중단 = 적용된 데까지만 요약.
    setAssembleSummary(sum);
    setPendingConfirm(
      sum.items
        .filter((i) => i.needsConfirm)
        .map((i) => i.id)
        .sort((a, b) => planOrder(a) - planOrder(b)), // T2-E2a(8c) — 릴레이 큐 = STEP_PLAN 순서.
    );
  }

  // UI-5-T2-E2a — 스텝 완료 조건(블록별 확정 신호). review = 항상 완료(훑어보기).
  function isStepDone(idx: number): boolean {
    const s = stepPlanState[idx]; // E3e — 런타임 플랜(추가 스텝 포함) 기준.
    if (!s) return false;
    switch (s.key) {
      case "video":
        return !!selectedVideo;
      case "photo":
        return catImgReady;
      case "title":
        return cfgTitle.trim().length > 0 || cfgProductName.trim().length > 0;
      case "clip":
        return cfgClip.trim().length > 0;
      case "price":
        return cfgProductPrice.trim().length > 0;
      case "coupon":
        return !!applied["coupon"];
      case "calendar":
        return !!applied["calendar"];
      case "season":
        return !!applied["seasonal"];
      case "review":
        return true;
      default:
        return !!(s.block && applied[s.block]); // 추가 스텝(extra-*) = 해당 블록 장착 시 완료.
    }
  }
  // 잔여(붙일 수 있는) 블록 — 플랜에 없고 아직 미장착. 확인 스텝 제안·인트로 예시 공용.
  function remainingExtras(plan: PlanStep[]): string[] {
    const inPlan = new Set(plan.map((s) => s.block).filter(Boolean) as string[]);
    return extraBlocksFor(mode).filter((id) => !inPlan.has(id) && !applied[id]);
  }
  // 스텝 진입 = 해당 칸 이동 + 도우미(T1k 릴레이를 스텝 전환 기본 동작으로 승격).
  function enterStep(idx: number) {
    const plan = stepPlanState;
    if (idx < 0 || idx >= plan.length) return;
    setCurrentStep(idx);
    const s = plan[idx];
    if (s.block) onEditField(s.block, s.key === "video" ? "video" : undefined);
    // E3e(4) — 확인 스텝 진입 1회 제안(잔여 블록 있을 때만). 재진입 반복 금지.
    if (s.key === "review" && !reviewSuggestUsedRef.current && remainingExtras(plan).length > 0) {
      reviewSuggestUsedRef.current = true;
      setShowReviewSuggest(true);
    }
  }
  // 미니 번호열 탭: 완료/현재/이전 = 재방문 허용, 미완 미래 = 토스트(순서 강제 · 자동 점프 없음).
  function goToStep(idx: number) {
    if (idx === currentStep) return;
    if (idx > currentStep && !completedSteps.has(currentStep) && !isStepDone(currentStep)) {
      setStepToast(`순서대로 가요 — 지금은 ${stepPlanState[currentStep].label}부터`);
      return;
    }
    enterStep(idx);
  }
  // [다음]: 현재 스텝 완료 조건 충족 시에만 활성 → 탭으로만 진행.
  function nextStep() {
    if (!isStepDone(currentStep)) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    const plan = stepPlanState;
    if (currentStep < plan.length - 1) enterStep(currentStep + 1);
  }
  // E3e(2) — 추가 스텝 삽입: 확인(review) 앞에 편입 · 중복 시 이동만 · 다중 삽입 정합(ref 즉시 반영).
  //   트리거는 사용자 유래뿐 — 칩 탭(4) · 사용자 발화 유래 equip(3). 자동/타이머 호출 없음.
  function insertStep(blockId: string) {
    const cur = stepPlanRef.current;
    const existingIdx = cur.findIndex((s) => s.block === blockId);
    if (existingIdx >= 0) {
      // 이미 플랜에 있으면 그 칸으로 이동만(중복 삽입 방지).
      setCurrentStep(existingIdx);
      const s = cur[existingIdx];
      if (s.block) onEditField(s.block, s.key === "video" ? "video" : undefined);
      return;
    }
    const label = EXTRA_LABELS[blockId] ?? blockById(blockId)?.label ?? blockId;
    const reviewIdx = cur.findIndex((s) => s.key === "review");
    const at = reviewIdx < 0 ? cur.length : reviewIdx; // 확인 스텝 앞(없으면 끝).
    const step: PlanStep = { key: `extra-${blockId}`, label, block: blockId };
    const nextPlan = [...cur.slice(0, at), step, ...cur.slice(at)];
    stepPlanRef.current = nextPlan; // 즉시 반영 → 같은 tick 다중 삽입 인덱스 정합.
    setStepPlanState(nextPlan);
    setShowReviewSuggest(false);
    setStepToast(`${nextPlan.length}단계가 됐어요 — ${label}은 ${at + 1}번째에 채울게요.`);
    setCurrentStep(at);
    onEditField(blockId, undefined); // 새 칸 블록으로 이동·장착.
  }
  // 릴레이 큐·액션 정렬용 플랜 순서(블록 → 플랜 인덱스). 미포함 = 뒤로. ref = 렌더·SSE 사슬 공용.
  function planOrder(blockId: string): number {
    const idx = stepPlanRef.current.findIndex((s) => s.block === blockId);
    return idx < 0 ? 99 : idx;
  }
  // 연출 스텝 → data-assemble-anchor 도출(플랜 블록 1:1): content=hero / review=gauge / 그 외=deck.
  function planAnchor(s: PlanStep): string {
    if (s.key === "review") return "gauge";
    if (s.block === "content") return "hero";
    return "deck";
  }
  // UI-5-T2-E4b — 1스텝 행동 안내(HELPER_COPY 재사용). video 스텝 = 검색·링크 안내(content=구간 안내 아님).
  function firstStepGuide(m: StudioMode): string {
    const s0 = STEP_PLAN[m][0];
    const key = s0.key === "video" ? "video" : (s0.block ?? "");
    return HELPER_COPY[key] ?? "아래에서 시작해 주세요.";
  }
  // UI-5-T2-E4b — 행동 지시형 인사(1화면 1행동). 단계 나열·"더 넣고 싶으면" 폐지 —
  //   진행 지도(스텝 헤더)·확인 스텝 제안(E3e)이 각각 대체(정보 중복 금지). 총 2문장 이내.
  function stepPlanIntro(m: StudioMode): string {
    const s0 = STEP_PLAN[m][0];
    return `${MODE_NAME[m]} 카드를 만들어요. 먼저 ${s0.label}부터 — ${firstStepGuide(m)}`;
  }

  // UI-5-T2-E2 — 49 컨텍스트 → LingoContext(45 페이로드 형태 계승: studio_state + studio{deck,fields}).
  //   hasVideo 신호 = video_summary 존재. Edge v6 대본이 상황 인지.
  function buildLingoContext(): LingoContext & {
    step_plan?: string[];
    current_step?: { index: number; key: string; block: string | null };
  } {
    // E3c — 요청 mode = 실모드 라이브 ref(stale 클로저 방어). 아래 단언으로 클로저·실모드 정합 검증.
    const m = modeRef.current;
    if (m !== mode) console.error("[studio49] mode 클로저/실모드 desync — stale 경로 재발", { closure: mode, live: m });
    const applied_blocks = STUDIO_BLOCKS.filter((b) => applied[b.id]).map((b) => b.id);
    const cur = stepPlanRef.current[currentStep]; // E3e — 런타임 플랜(추가 스텝 포함) 라이브.
    const deck = DECK.map((b) => ({
      id: b.id,
      label: b.label,
      applied: !!applied[b.id],
      locked: !!b.isPaid && score < ENHANCE_UNLOCK,
    }));
    const fields: Record<string, string> = {
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
    return {
      studio_state: {
        mode: m, // E3c — 실모드 라이브(studio_state.mode 항상 현재 실모드와 일치).
        applied_blocks,
        score,
        card_title: cfgTitle.trim() || (applied["product"] && cfgProductName ? cfgProductName : content.title),
        ...(cfgProductName ? { product_name: cfgProductName } : {}),
        ...(cfgProductPrice ? { product_price: Number(cfgProductPrice.replace(/[^0-9]/g, "")) || undefined } : {}),
      },
      studio: { mode: m, deck, fields },
      ...(selectedVideo ? { video_summary: selectedVideo.title } : {}),
      // UI-5-T2-E2a(8a) — 현재 스텝 컨텍스트: Edge v6 대본이 "지금 몇 번째"를 인지.
      step_plan: stepPlanRef.current.map((s) => s.label),
      current_step: { index: currentStep, key: cur?.key ?? "", block: cur?.block ?? null },
    };
  }

  // UI-5-T2-E2·T1h(1c)·T1m — 응답 처리 정합(방어벽 실전 가동): 사전 필터(가드) → 관문 → runAssembly/즉시 적용.
  function dispatchProposal(rawActions: any[], rawSteps: { label: string; note?: string }[]) {
    // E3c — 응답 처리 = 수신 시점 실모드 라이브 ref(요청·응답 간 모드 전환·E3b 리셋 레이스 정합).
    const m = modeRef.current;
    const steps = (rawSteps ?? []).filter((s) => s && s.label);
    const okActions = (rawActions ?? []).filter((a: any) => isAiActionAllowed(m, a)); // AI_BLOCKED_FIELDS·MODE_ALLOWED·switchMode 차단.
    if (okActions.length < (rawActions?.length ?? 0)) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "이 기능은 매장 카드에서 쓸 수 있어요 — 퍼블릭 카드엔 적용하지 않았어요." },
      ]);
    }
    // 관문은 클라 선처리(T1m·T1n). 미디어 = general/reserve 영상(selectedVideo) · commerce 상품 사진(catImgReady).
    const mediaReady = m === "commerce" ? catImgReady : !!selectedVideo;
    if (steps.length >= 2 && !mediaReady) {
      const photo = m === "commerce";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: photo
            ? "상품 사진부터 담아야 카드가 시작돼요 — 사진을 올려 주세요."
            : "영상부터 담아야 카드가 시작돼요 — 검색하거나 링크를 붙여넣어 주세요.",
        },
      ]);
      onEditField(photo ? "productimage" : "content", photo ? "productimage" : "video");
      return;
    }
    // E3e(3) — 플랜 밖·모드 허용(DECK_IDS[m]) 블록 equip = 사용자 발화 유래 "추가 의사" → 스텝 편입.
    //   트리거는 유저 메시지 응답의 equip뿐(자동 증설 아님). stepPlanRef 즉시 반영 → 아래 connut 정합.
    {
      const inPlan = new Set(stepPlanRef.current.map((s) => s.block).filter(Boolean) as string[]);
      for (const a of okActions) {
        if (a?.type === "equip" && a.blockId && DECK_IDS[m].includes(a.blockId) && !inPlan.has(a.blockId) && EXTRA_LABELS[a.blockId]) {
          insertStep(a.blockId);
          inPlan.add(a.blockId);
        }
      }
    }
    // UI-5-T2-E2a(8b·8c·4) — 연출 = 런타임 플랜 순회(1:1). 실응답 액션도 플랜 순 정렬 후 재생.
    //   anchor = 플랜 블록 1:1 도출(content=hero/review=gauge/그 외=deck) → Edge anchor 부재 폴백 해소.
    if (steps.length >= 2) {
      const actionBlock = (a: any): string =>
        a?.type === "equip" ? (a.blockId ?? "") : a?.type === "setField" ? (FIELD_TO_BLOCK[a.field] ?? a.field ?? "") : (a?.blockId ?? "");
      const sortedActions = [...okActions].sort((x, y) => planOrder(actionBlock(x)) - planOrder(actionBlock(y)));
      const planConnut = stepPlanRef.current.map((s) => ({ label: s.label, note: "", anchor: planAnchor(s) }));
      runAssembly(sortedActions, planConnut); // 연출(T1b 분기 유지).
    } else {
      applyLingoActions(okActions); // 단순 편집 즉시 적용.
    }
  }

  // UI-5-T2-E2 — lingo-chat Edge SSE 직결(45 useLingoChat send :195–312 동형). 텍스트 delta 스트리밍 + event:actions 1회.
  async function sendToLingo(text: string) {
    if (!text || thinking) return;
    setGreetingChipsOpen(false); // E4b — 대화 시작 시 인사 칩 소멸.
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    setThinking(true);
    // 마지막 assistant(스트리밍 자리) 갱신 헬퍼.
    const appendBot = (t: string) =>
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant") {
            next[i] = { ...next[i], text: next[i].text + t };
            break;
          }
        }
        return next;
      });
    const setBot = (t: string) =>
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant") {
            next[i] = { ...next[i], text: t };
            break;
          }
        }
        return next;
      });
    let acc = "";
    let proposalActions: any[] = [];
    let proposalSteps: { label: string; note?: string }[] = [];
    try {
      const res = await fetch("/api/lingo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(lingoSessionRef.current ? { session_id: lingoSessionRef.current } : {}),
          message: text,
          context: buildLingoContext(),
          input_channel: "text",
          surface: "studio",
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) {
        // JSON 경로(quota·검증) — friendly 를 말풍선으로(무언 실패 금지).
        const json = (await res.json().catch(() => null)) as { friendly?: string } | null;
        setBot(json?.friendly ?? "링고가 잠깐 딴생각했어요 — 다시 말씀해 주세요.");
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setBot("링고가 잠깐 딴생각했어요 — 다시 말씀해 주세요.");
        return;
      }
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf("\n\n")) >= 0) {
          const ev = parseSseBlock(buf.slice(0, sep));
          buf = buf.slice(sep + 2);
          if (!ev) continue;
          if (ev.event === "meta") {
            const d = safeJson(ev.data);
            if (typeof d?.session_id === "string") lingoSessionRef.current = d.session_id;
          } else if (ev.event === "delta") {
            const d = safeJson(ev.data);
            if (typeof d?.text === "string" && d.text) {
              acc += d.text;
              appendBot(d.text); // 패널 대화 스트리밍.
            }
          } else if (ev.event === "actions") {
            // 액션 제안 수신(서버 §5 재검증분) → 클라 경량 재가드(type 5종 + 8개 상한, steps 5개 상한).
            const d = safeJson(ev.data);
            const raw = Array.isArray(d?.actions) ? (d!.actions as unknown[]) : [];
            const acts: any[] = [];
            for (const r of raw) {
              if (acts.length >= 8) break;
              if (!r || typeof r !== "object") continue;
              const a = r as { type?: unknown };
              if (typeof a.type !== "string" || !LINGO_ACTION_TYPES.has(a.type)) continue;
              acts.push(r);
            }
            const rs = Array.isArray(d?.steps) ? (d!.steps as unknown[]) : [];
            proposalActions = acts;
            proposalSteps = rs
              .filter((s): s is { label: string; note?: unknown } => !!s && typeof s === "object" && typeof (s as { label?: unknown }).label === "string")
              .slice(0, 5)
              .map((s) => ({ label: s.label, ...(typeof s.note === "string" && s.note ? { note: s.note } : {}) }));
          } else if (ev.event === "error") {
            const d = safeJson(ev.data);
            if (typeof d?.friendly === "string" && d.friendly && !acc) setBot(d.friendly);
          }
          // intent/done — 무시(done = reader 종료로 처리).
        }
      }
      if (!acc) setBot("네, 반영했어요."); // 텍스트 없으면 최소 응답(빈 말풍선 방지).
      speak(acc);
      // ── 응답 처리 정합(T-1 방어벽 실전 가동): proposal 디스패치(가드 → 관문 → 연출/적용). ──
      dispatchProposal(proposalActions, proposalSteps);
    } catch {
      setBot("링고가 잠깐 딴생각했어요 — 다시 말씀해 주세요."); // 무언 실패 금지 · 재시도 가능.
    } finally {
      setThinking(false);
    }
  }

  // E3c — 매 렌더 최신 sendToLingo를 ref에 게시(음성 onresult가 이 최신본을 호출).
  sendToLingoRef.current = sendToLingo;

  // UI-5-T2-E4 — 발행 실행(2단 수동의 2단째). 45 handlePublish(:2251) 비커머스 body 계승.
  //   지원 필드 한정: media_url·purpose·curator_message·is_public·partner_id. 45 계약 준수·오발행 방지.
  //   호출처 = 거울 시트 [발행하기] 버튼뿐(자동/링고/연출/타이머 유래 0 — 헌장 ⑨).
  async function doPublish(): Promise<boolean> {
    // 커머스 = 실 이미지·상품등록 인프라 부재 → 이번 슬라이스 보류(E5 승계).
    if (mode === "commerce") {
      setSaveError("상품 발행은 준비 중이에요");
      return false;
    }
    // 검증(45 :2252 계승 — 비커머스는 영상 필수).
    if (!selectedVideo) {
      setSaveError("영상을 먼저 담아 주세요");
      return false;
    }
    if (saving) return false; // 이중 탭 방지(45 :2271).
    setSaving(true);
    setSaveError(null);
    try {
      // 45 :2275·2277·2342 body 형태 동일(비커머스). 지원 필드만 — 45 대조 근거는 커밋 보고 대조표.
      const mediaUrl = `https://www.youtube.com/watch?v=${selectedVideo.videoId}`;
      const hasReservation = !!applied["calendar"];
      // 쿠폰 연결(실 UUID) 이번 생략 → 45의 selectedCouponId 부재 상태와 동형(hasCoupon=false) = purpose "예약"/"정보".
      const dropPurpose = hasReservation ? "예약" : "정보";
      const isPublic = visibility === "public";
      const body = {
        media_url: mediaUrl,
        purpose: dropPurpose,
        curator_message: cfgSubtitle.trim() || null,
        is_public: isPublic, // BUG-1(S1-b): 신규 생성 경로라 body.is_public 로 실려나감(재사용 분기 없음 = 함정 회피).
        partner_id: null, // 49 store=목업 문자열(실 파트너 id 없음) → 45의 store?.id ?? null 와 동형(null).
        // blocks 생략: 49 무 실입력(clip 초/구간·image·dock·custom_title) → 45 extraBlocks.length===0 분기와 동일(blocks 키 부재).
      };
      const res = await fetch("/api/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        drop?: { id?: string; share_uuid?: string };
        shareable_url?: string;
        message?: string;
      };
      if (!res.ok || !json.drop?.share_uuid) {
        setSaveError(json.message ?? "카드 저장에 실패했어요. 잠시 후 다시 시도해 주세요."); // 무언 실패 금지.
        return false;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
      setSavedUrl(json.shareable_url ?? `${origin}/d/${json.drop.share_uuid}`); // 45 :2471 동형.
      setDropped(true);
      setMirrorOpen(false);
      return true;
    } catch (e) {
      console.error("[studio49] doPublish", e);
      setSaveError("카드 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function copyShareLink() {
    if (!savedUrl) return;
    try {
      await navigator.clipboard.writeText(savedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const activeBlock = DECK[deckIndex];
  const activeApplied = !!applied[activeBlock.id];
  const activeLocked = !!activeBlock.isPaid && score < ENHANCE_UNLOCK;

  // UI-5-T2-E4 — 발행 게이트: 비커머스 지원 필드(영상+제목) 충족 시 활성. 커머스는 보류(비활성).
  //   쿠폰·예약 슬롯은 이번 생략 → 게이트에서 제외(쿠폰 없는 예약 카드 발행 허용).
  const hasTitleForPublish = cfgTitle.trim().length > 0 || cfgProductName.trim().length > 0;
  const canPublish = mode !== "commerce" && !dropped && !!selectedVideo && hasTitleForPublish;
  const publishGateMsg =
    mode === "commerce"
      ? "상품 발행은 준비 중이에요"
      : !selectedVideo
        ? "영상을 먼저 담아 주세요"
        : !hasTitleForPublish
          ? "제목·한마디를 채워 주세요"
          : null;

  // 화면 배경은 하나로 통일 — 목적(모드)별 포인트 컬러로만 카테고리를 분기
  const PAGE_BG = "#F7F7F9"; // UI-5-T1f(3) — 조용한 페이지 배경(흰 섹션 카드와 명도차로 구획).
  const MODE_SKIN = {
    general: { accent: "#475569" },
    reserve: { accent: POINT },
    commerce: { accent: "#0F766E" },
  } as const;
  // UI-5-T1d(T-C) — 색 다이어트: 크롬 유채색 전량 무채색화. 유채 역할 2개만 —
  //   cardAccent(카드/CardBody · WYSIWYG 유지) · LINGO(링고의 손길 · 블루).
  //   accent=CHROME 로 기존 크롬 사용처(69개)를 일괄 무채색화하고, 링고 요소만 LINGO 로 승격.
  const cardAccent = MODE_SKIN[mode].accent; // 카드 모드 색 — cardModel.accent 로만 소비(CardBody).
  const LINGO = "#1D4ED8"; // 링고의 손길(블루) — FAB·오브·연출 링·링고 패널 강조 전용.
  const CHROME = "#16161D"; // 스튜디오 크롬 강조(무채 잉크).
  const accent = CHROME;
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
      subtitle: "당일수확 · 부사 특품 · 무료배송",
      cta: "주문하기",
      price: "₩32,000",
      ctaIcon: Store,
      primaryAction: "주문하기",
      primaryIcon: Store,
    },
  } as const;
  const content = MODE_CONTENT[mode];

  // 제작=공유=수신 거울: 현재 스튜디오 상태를 단일 CardModel로 확정
  // UI-5-T2-E3 — 위지윅: 49 상태 → 정본 CardModel(어댑터). 미리보기 = /d 수신 렌더러(CardModelBody).
  const productUnitLabel =
    cfgProduct.saleUnit === "unit"
      ? "낱개 판매"
      : cfgProduct.saleUnit === "box"
        ? `박스·묶음${cfgProduct.boxCount ? ` (한 박스 ${cfgProduct.boxCount}개)` : ""}`
        : `무게 단위${cfgProduct.totalWeight ? ` (${cfgProduct.totalWeight}kg)` : ""}`;
  const cardModel: CardModel = studio49ToCardModel({
    mode,
    applied,
    title: cfgTitle,
    subtitle: cfgSubtitle,
    clip: cfgClip,
    brand: cfgBrand,
    party: cfgParty,
    couponLabel: applied["coupon"] ? (COUPON_OPTIONS.find((c) => c.id === cfgCoupon)?.label ?? null) : null,
    productName: cfgProductName,
    productPrice: cfgProductPrice,
    productHeadline: cfgProduct.headline,
    productPoints: cfgProduct.sellingPoints.map((p) => p.trim()).filter(Boolean),
    productUnitLabel,
    facilities: cfgFacilities.map((f) => f.text.trim()).filter(Boolean),
    saleStart: DATE_OPTIONS[saleStartIdx],
    saleEnd: DATE_OPTIONS[saleEndIdx],
    dates: cfgDates,
    times: cfgTimes,
    slotsByDate: cfgSlotsByDate,
    selectedVideo,
    shipping: applied["delivery"]
      ? {
          shipMethod: cfgCourier,
          freeShip: cfgShipFee === "무료",
          shipFeeKrw: cfgShipFee === "무료" ? null : Number(cfgShipFee.replace(/[^0-9]/g, "")) || null,
          shipNote: cfgShipEta,
        }
      : null,
    categoryLabel: content.category,
    categoryIcon: content.categoryIcon,
    source: content.source,
    storeName: content.store,
    titleFallback: content.title,
    subtitleFallback: content.subtitle,
    pageBg,
  });

  return (
      <div className="min-h-screen pb-[120px] transition-colors duration-300" style={{ backgroundColor: pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#E8E8EC] bg-white/90 backdrop-blur-lg">
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

      {/* UI-5-T1f(1a) — 스티키 조립 미니 미리보기 완전 삭제(평시 부유물 제거). 카드 확인 = 스크롤 업. */}

      {/* UI-5-T2-E2a(3·6) — 진행 지도(상시 1개 · sticky · h-11=44px). 부유물 원칙 내 유일 예외 = 지도.
          완료 ✓ 잉크 / 현재 블루 / 대기 회색 번호. 미니열 탭 = 재방문/토스트, [다음] = 완료 시만 활성. */}
      <div className="sticky top-0 z-[33] flex h-11 items-center gap-2 border-b border-[#E8E8EC] bg-[#F7F7F9]/95 px-4 backdrop-blur">
        <span className="shrink-0 text-[12px] font-bold text-[#16161D]">
          {currentStep + 1} / {stepPlanState.length} · {stepPlanState[currentStep]?.label}
        </span>
        <div className="mx-auto flex items-center gap-1">
          {stepPlanState.map((s, i) => {
            const done = completedSteps.has(i) || isStepDone(i);
            const cur = i === currentStep;
            return (
              <button
                key={s.key}
                onClick={() => goToStep(i)}
                aria-label={`${i + 1} ${s.label}`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors"
                style={
                  cur
                    ? { backgroundColor: "#1D4ED8", color: "#FFFFFF" }
                    : done
                      ? { backgroundColor: "#16161D", color: "#FFFFFF" }
                      : { backgroundColor: "#EDEDF0", color: "#9A9A9A" }
                }
              >
                {done && !cur ? "✓" : i + 1}
              </button>
            );
          })}
        </div>
        <button
          onClick={nextStep}
          disabled={!isStepDone(currentStep) || currentStep >= stepPlanState.length - 1}
          className="shrink-0 rounded-lg bg-[#16161D] px-2.5 py-1 text-[11px] font-bold text-white transition-transform active:scale-95 disabled:opacity-30"
        >
          다음
        </button>
      </div>
      {stepToast && (
        <div className="pointer-events-none fixed left-1/2 top-14 z-[60] -translate-x-1/2 rounded-full bg-[#16161D] px-3 py-1.5 text-[11px] font-bold text-white shadow-lg">
          {stepToast}
        </div>
      )}

      {/* UI-5-T2-E3b — 목적 전환 확인 게이트(Radix 금지 · 기존 시트/카드 패턴). */}
      {pendingModeSwitch && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-8">
          <div className="absolute inset-0 bg-black/35" onClick={() => setPendingModeSwitch(null)} />
          <div className="relative w-full max-w-[320px] rounded-2xl bg-white p-5 [box-shadow:0_24px_60px_-16px_rgba(10,14,22,0.5)]">
            <p className="text-[15px] font-extrabold tracking-ko text-[#16161D] [word-break:keep-all]">
              목적을 바꾸면 새 카드로 새로 시작해요
            </p>
            <p className="mt-2 text-[13px] font-medium leading-relaxed tracking-ko text-[#737373] [word-break:keep-all]">
              지금 만들던 <b className="font-bold text-[#525252]">{MODE_NAME[mode]}</b> 카드 내용은 사라져요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  const n = pendingModeSwitch;
                  setPendingModeSwitch(null);
                  if (n) resetForMode(n);
                }}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#16161D] text-[13px] font-bold text-white transition-transform active:scale-[0.98]"
              >
                새로 시작
              </button>
              <button
                onClick={() => setPendingModeSwitch(null)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[#E8E8EC] bg-white text-[13px] font-bold text-[#525252] transition-colors active:bg-[#F5F5F7]"
              >
                계속 만들기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-md px-5">
        {/* ───────── 모드 전환 (퍼블릭 / 예약·쿠폰 / 상품판매) ───────── */}
        <div className="mt-5 flex rounded-2xl bg-white p-1 [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)]">
          {[
            { key: "general", label: "퍼블릭", Icon: Globe },
            { key: "reserve", label: "예약·쿠폰", Icon: Calendar },
            { key: "commerce", label: "상품판매", Icon: Store },
          ].map(({ key, label, Icon }) => {
            const isOn = mode === key;
            return (
              <button
                key={key}
                onClick={() => attemptSwitchMode(key as StudioMode)}
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

        {/* UI-5-T1f(1b·1c) — 상단 AI 빌더 섹션 제거: AI 진입은 우하단 FAB→링고 패널 단일화.
            역할별 예시 문구(heroExamples)는 패널 첫 진입 화면으로 이동. 헤더 아래 = 바로 미리보기. */}

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
          {/* UI-5-T1c — 조립 포인터 앵커(hero): 제목·설명 스텝 지목 대상. */}
          <div className="relative" data-assemble-anchor="hero">
            <CardModelBody model={cardModel} variant="studio" burstKey={burstKey} />
            <LingoAssembleOverlay
              active={assembling}
              steps={assembleSteps}
              step={assembleStep}
              accent={LINGO}
              onSkip={skipAssembly}
              summary={assembleSummary}
              onUndo={undoAssembly}
              onConfirm={confirmAssembly}
              onEditField={onEditField}
            />
          </div>
        </section>

        {/* ───────── 전환력 게이지 ───────── */}
        {/* UI-5-T1c — 조립 포인터 앵커(gauge): 완성도 스텝 지목 대상. */}
        <section data-assemble-anchor="gauge" className="mt-5 rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)]">
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
          className="mt-3 flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)] transition-transform duration-150 active:scale-[0.99] animate-fade-in"
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
      {/* UI-5-T1c — 조립 포인터 앵커(deck): 쿠폰·판매기간 스텝 지목 대상. */}
      <section ref={deckRef} data-assemble-anchor="deck" className="mt-6">
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
                        : "0 16px 36px -14px rgba(15,23,42,0.22), 0 0 0 1px #E8E8EC"
                      : "0 8px 20px -12px rgba(15,23,42,0.18), 0 0 0 1px #E8E8EC",
                  }}
                >
                  {/* UI-5-T1j(3) — 덱 장착 표시 우상단 손길 배지(장착 + 링고 손길). 카드 프리뷰(CardBody) 아님 — 덱 크롬. */}
                  {isOn && lingoTouched.has(block.id) && (
                    <LingoTouchBadge needsConfirm={NUMBER_CRITICAL_BLOCKS.has(block.id)} />
                  )}
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
          {/* UI-5-T2-E3e(4) — 확인 스텝 1회 제안: 잔여 블록 칩(최대 3) + [이대로 좋아요]. 칩=insertStep. */}
          {showReviewSuggest && stepPlanState[currentStep]?.key === "review" && (
            <div className="mb-3 rounded-2xl bg-white p-3.5 animate-fade-in [box-shadow:inset_0_0_0_1px_#E8E8EC]">
              <p className="text-[13px] font-bold text-[#16161D] tracking-ko [word-break:keep-all]">
                더 넣고 싶은 게 있나요?
              </p>
              <p className="mt-1 text-[12px] font-medium text-[#737373] tracking-ko [word-break:keep-all]">
                원하는 걸 고르면 확인 앞에 한 칸 더 만들어요.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {remainingExtras(stepPlanState)
                  .slice(0, 3)
                  .map((id) => (
                    <button
                      key={id}
                      onClick={() => insertStep(id)}
                      className="min-h-[36px] rounded-xl bg-[#EEF2FF] px-3 text-[12px] font-bold text-[#1D4ED8] transition-transform active:scale-95"
                    >
                      + {EXTRA_LABELS[id]}
                    </button>
                  ))}
                <button
                  onClick={() => setShowReviewSuggest(false)}
                  className="min-h-[36px] rounded-xl border border-[#E8E8EC] px-3 text-[12px] font-bold text-[#525252] transition-colors active:bg-[#F5F5F7]"
                >
                  이대로 좋아요
                </button>
              </div>
            </div>
          )}

          {/* 블록 설정 패널 — 장착과 동시에 여기서 값을 채우면 카드에 바로 반영 */}
          {activeApplied && CONFIGURABLE.includes(activeBlock.id) && (
            <div
              className="relative mb-3 rounded-2xl bg-white p-3.5 animate-fade-in"
              style={{
                boxShadow: `inset 0 0 0 1px ${
                  lingoTouched.has(activeBlock.id) &&
                  (NUMBER_CRITICAL_BLOCKS.has(activeBlock.id) || CLIP_BLOCKS.has(activeBlock.id) || IMAGE_BLOCKS.has(activeBlock.id))
                    ? "#FDBA74"
                    : "#E8E8EC"
                }`,
                ...(blinkBlock === activeBlock.id ? { animation: "lingo-spot-blink 0.8s ease-in-out 2" } : {}),
              }}
            >
              {/* UI-5-T1k(B1) — 이동 직후 스포트라이트 1회 깜빡(0.8s×2, 상주 금지). */}
              {blinkBlock === activeBlock.id && (
                <style>{`@keyframes lingo-spot-blink{0%,100%{box-shadow:inset 0 0 0 1px #E8E8EC}50%{box-shadow:inset 0 0 0 2px #1D4ED8,0 0 0 5px rgba(29,78,216,0.28)}}`}</style>
              )}
              {/* UI-5-T1j(3) — 링고 손길 배지(폼 섹션 우상단). 숫자 계열 = 확인 필요(주황). 직접 수정 시 소멸. */}
              {lingoTouched.has(activeBlock.id) && (
                <LingoTouchBadge
                  needsConfirm={NUMBER_CRITICAL_BLOCKS.has(activeBlock.id) || CLIP_BLOCKS.has(activeBlock.id) || IMAGE_BLOCKS.has(activeBlock.id)}
                />
              )}
              {/* UI-5-T1k(B2·3·4·5) — 미확정 칸 도우미 말풍선(패널 상단 부착 · 화면 미추종). 값 자동입력 없음(안내만). */}
              {helperTarget === activeBlock.id && (
                <div className="absolute left-2 right-2 -top-2 z-20 -translate-y-full">
                  <div className="relative rounded-2xl bg-white p-3 [box-shadow:0_16px_36px_-14px_rgba(15,23,42,0.4),0_0_0_1px_#E8E8EC]">
                    <span className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 bg-white [box-shadow:2px_2px_0_#E8E8EC]" aria-hidden="true" />
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                        ✦ 링고
                      </span>
                      <div className="min-w-0 flex-1">
                        {helperPhase === "guide" && (
                          <p className="text-[12px] font-semibold leading-relaxed text-[#16161D] [word-break:keep-all]">
                            {HELPER_COPY[helperCopyKey ?? activeBlock.id] ?? HELPER_COPY[activeBlock.id] ?? "여기에서 값을 정해 주세요."}
                          </p>
                        )}
                        {helperPhase === "done" && (
                          <>
                            <p className="text-[12px] font-bold text-[#16161D] [word-break:keep-all]">
                              {helperCopyKey === "video" ? "좋아요, 영상이 담겼어요 ✓" : `좋아요, ${activeBlock.label} 정해졌어요 ✓`}
                            </p>
                            {pendingConfirm.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => onEditField(pendingConfirm[0])}
                                  className="inline-flex min-h-[36px] items-center rounded-full bg-[#16161D] px-3 text-[11px] font-bold text-white active:scale-95"
                                >
                                  다음: {STUDIO_BLOCKS.find((b) => b.id === pendingConfirm[0])?.label ?? "다음"} 정하러 가기
                                </button>
                                <button
                                  onClick={dismissHelper}
                                  className="inline-flex min-h-[36px] items-center rounded-full border border-[#E8E8EC] bg-white px-3 text-[11px] font-bold text-[#525252] active:scale-95"
                                >
                                  나중에 할게요
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        {helperPhase === "allDone" && (
                          <p className="text-[12px] font-bold text-[#16161D] [word-break:keep-all]">
                            이제 다 됐어요 — 발행 전에 한 번 훑어보세요.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                      <section className="rounded-xl border border-[#E8E8EC] p-2.5">
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
                      <section className="rounded-xl border border-[#E8E8EC] p-2.5">
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
                      <section className="rounded-xl border border-[#E8E8EC] p-2.5">
                        <div className="mb-2 flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A] text-[9px] font-extrabold text-white">
                            3
                          </span>
                          <p className="text-[11px] font-bold text-[#0A0A0A]">날짜별 잔여 자리</p>
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
                      onClick={() => {
                        setCfgCoupon(c.id);
                        confirmHelper("coupon"); // UI-5-T1k — 쿠폰 확정 = 도우미 완료.
                      }}
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
                    if (patch.price !== undefined) {
                      setCfgProductPrice(patch.price);
                      confirmHelper("product"); // UI-5-T1k — 가격 직접 입력 = 도우미 완료(숫자 사용자 확정).
                    }
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
                  {/* UI-5-T1n — 영상 검색 흐름(45 계승·49 디자인). 실검색은 T-2(45 /api/discover 파이프). */}
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        value={videoQuery}
                        onChange={(e) => setVideoQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            runVideoSearch();
                          }
                        }}
                        placeholder="가게 이름·메뉴로 영상 검색"
                        className="min-w-0 flex-1 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
                      />
                      <button
                        onClick={runVideoSearch}
                        disabled={videoSearching || !videoQuery.trim()}
                        className="flex shrink-0 items-center gap-1 rounded-xl bg-[#16161D] px-3 text-[12px] font-bold text-white transition-transform active:scale-95 disabled:opacity-40"
                      >
                        <Search className="h-4 w-4" strokeWidth={2.5} />
                        검색
                      </button>
                    </div>
                    <input
                      id="video-link-49"
                      value={videoLink}
                      onChange={(e) => onVideoLinkChange(e.target.value)}
                      placeholder="또는 유튜브·인스타 링크 붙여넣기"
                      className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2 text-[12px] font-medium text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] focus:bg-white"
                    />
                    {videoSearching && (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-3 text-[12px] font-semibold text-[#8A8A8A]">
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                        영상을 찾고 있어요…
                      </div>
                    )}
                    {/* UI-5-T2-E1(5) — 에러 폴백(무언 실패 금지): 링크 직접 입력 유도(input 포커스 연동). */}
                    {!videoSearching && videoError && (
                      <p className="rounded-xl bg-[#FFF4EC] px-3 py-3 text-center text-[12px] font-semibold text-[#C2410C] [box-shadow:inset_0_0_0_1px_#FDBA74]">
                        {videoError}
                      </p>
                    )}
                    {videoSearched && !videoSearching && !videoError && videoResults.length === 0 && (
                      <p className="rounded-xl bg-[#F4F4F5] px-3 py-3 text-center text-[12px] font-medium text-[#8A8A8A]">
                        검색 결과가 없어요 — 다른 말로 찾아볼까요?
                      </p>
                    )}
                    {!videoSearching && videoResults.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {videoResults.slice(0, 5).map((c) => {
                          const slot = toVideoSlot(c);
                          const on = selectedVideo?.videoId === slot.videoId;
                          return (
                            <button
                              key={c.source_id}
                              onClick={() => void selectVideo(c)}
                              className="flex min-h-[56px] items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 text-left transition-transform active:scale-[0.99]"
                              style={{ boxShadow: `inset 0 0 0 1px ${on ? "#1D4ED8" : "#E8E8EC"}` }}
                            >
                              {/* 썸네일 = 실데이터(i.ytimg mqdefault, toVideoSlot 계승). */}
                              <span className="relative flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0F172A]">
                                {slot.thumbnailUrl ? (
                                  <img src={slot.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : null}
                                <Play className="absolute h-4 w-4 text-white drop-shadow" strokeWidth={2.5} fill="currentColor" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-bold text-[#0A0A0A]">{c.title ?? "영상"}</span>
                                <span className="mt-0.5 block truncate text-[11px] font-medium text-[#8A8A8A]">
                                  {c.author_name ?? "YouTube"}
                                  {slot.durationLabel ? ` · ${slot.durationLabel}` : ""}
                                </span>
                              </span>
                              {on && <Check className="h-4 w-4 shrink-0 text-[#1D4ED8]" strokeWidth={2.5} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selectedVideo && (
                      <div className="flex items-center gap-2 rounded-xl bg-[#EEF3FE] px-2.5 py-2 [box-shadow:inset_0_0_0_1px_#C7D7FB]">
                        <span className="relative flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#0F172A]">
                          {selectedVideo.thumbnailUrl ? (
                            <img src={selectedVideo.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : null}
                          <Play className="absolute h-3.5 w-3.5 text-white drop-shadow" strokeWidth={2.5} fill="currentColor" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#1D4ED8]">담긴 영상: {selectedVideo.title}</span>
                      </div>
                    )}
                  </div>
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
                      onChange={(e) => {
                        setCfgClip(e.target.value.replace(/[^0-9:]/g, ""));
                        confirmHelper("content"); // UI-5-T1k(D) — 구간 직접 조작 = 도우미 완료(선택은 대표님).
                      }}
                      inputMode="numeric"
                      className="ml-auto w-16 rounded-lg bg-white px-2 py-1 text-center text-[12px] font-bold tabular-nums text-[#0A0A0A] outline-none"
                      style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                    />
                  </div>
                </div>
              )}

              {activeBlock.id === "aivideo" && (
                <div className="space-y-3">
                  {/* 영상 스타일 선택 */}
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
                      onClick={() => {
                        if (activeBlock.id === "productimage") setCatImgReady(true);
                        confirmHelper(activeBlock.id); // UI-5-T1m — 사진 선택 = 도우미 완료(콘텐츠 선택은 대표님).
                      }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold text-white transition-transform active:translate-y-px"
                      style={{ backgroundColor: accent }}
                    >
                      <ImageIcon className="h-4 w-4" strokeWidth={2.25} />
                      갤러리에서 선택
                    </button>
                    <button
                      onClick={() => {
                        if (activeBlock.id === "productimage") setCatImgReady(true);
                        confirmHelper(activeBlock.id); // UI-5-T1m — 사진 선택 = 도우미 완료(콘텐츠 선택은 대표님).
                      }}
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
                            {catStatus === "done" ? "다시 생성" : "AI 카탈로그 생성"}
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
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#A3A3A3] transition-colors hover:bg-[#F0F0F0] hover:text-[#525252] active:scale-90"
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

                  {/* 송장번호 (선택) */}
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
                    <span className="text-[12px] font-semibold text-[#525252]">도착 예정</span>
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
                ? "cursor-not-allowed bg-white text-[#C4C4C4] [box-shadow:0_0_0_1px_#E8E8EC]"
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
          className="group flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left transition-transform active:translate-y-px [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)]"
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
      {/* UI-5-T1f(4) — 연출 중 개별 숨김 제거: 딤(오버레이 z-70)이 하단 CTA를 덮어 무대화 대체. */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E8E8EC] pb-[env(safe-area-inset-bottom)]"
        style={{ backgroundColor: pageBg }}
      >
        <div style={{ backgroundColor: pageBg }}>
          <div className="mx-auto flex max-w-md flex-col gap-3 px-5 pb-5 pt-4">
            {/* UI-5-T2-E4 — 발행 실배선(2단 수동 1단째). 조건 충족 시 활성 → 거울 시트에서 최종 확인.
                미충족·커머스 = 비활성 + 사유 1줄(45 게이트 문구 계승). 자동 트리거 없음(탭 유래만). */}
            <button
              type="button"
              disabled={!canPublish}
              onClick={() => canPublish && setMirrorOpen(true)}
              aria-label={canPublish ? "발행하기 (확인 화면으로)" : "발행 조건 미충족"}
              className={
                canPublish
                  ? "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold tracking-[-0.01em] text-white transition-transform active:translate-y-px"
                  : "flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#E5E5E5] bg-[#F0F0F0] text-[14px] font-bold tracking-[-0.01em] text-[#9A9A9A]"
              }
              style={canPublish ? { backgroundColor: accent, boxShadow: `0 10px 30px -8px ${accent}80` } : undefined}
            >
              {canPublish ? <Send className="h-4 w-4" strokeWidth={2.25} /> : <Lock className="h-4 w-4" strokeWidth={2.25} />}
              {canPublish ? "발행하기" : "발행하기 · 조건 미충족"}
            </button>
            {!canPublish && publishGateMsg && (
              <p className="text-center text-[12px] font-medium text-[#8A8A8A] tracking-ko">{publishGateMsg}</p>
            )}
          </div>
        </div>
      </div>

      {/* ───────── 수신자 거울 시트 (보이는 그대로 = 받는 그대로) ───────── */}
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
              <CardModelBody model={cardModel} variant="share" />
            </div>

            <div className="border-t border-[#EAEAEA] bg-white px-5 py-3.5">
              {/* UI-5-T2-E4 — 2단 수동의 2단째(재확인). 탭 = doPublish 실행. 발행 중 이중 탭 방지·무언 실패 금지. */}
              {saveError && (
                <p className="mb-2 text-center text-[12px] font-medium text-[#DC2626] tracking-ko">{saveError}</p>
              )}
              <button
                type="button"
                disabled={saving || mode === "commerce"}
                onClick={() => doPublish()}
                aria-label="발행하기"
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition-transform active:translate-y-px disabled:opacity-60"
                style={{ backgroundColor: accent, boxShadow: `0 10px 30px -8px ${accent}80` }}
              >
                <Send className="h-[18px] w-[18px]" strokeWidth={2.25} />
                {saving ? "발행하는 중…" : "발행하기"}
              </button>
              <p className="mt-2 text-center text-[11px] font-medium text-[#8A8A8A] tracking-ko">
                발행은 대표님이 직접 눌러야 나가요
              </p>
            </div>
          </div>
        </div>
      )}

      {/* UI-5-T2-E4 — 발행 성공: share 링크 표시·복사(45 :2471 savedUrl 계승). 오버레이 1개. */}
      {dropped && savedUrl && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-8">
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5 [box-shadow:0_24px_60px_-16px_rgba(10,14,22,0.5)]">
            <p className="text-[16px] font-extrabold tracking-ko text-[#16161D]">발행 완료! 🎉</p>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed tracking-ko text-[#737373] [word-break:keep-all]">
              이 링크로 카드를 공유하세요.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#525252]">{savedUrl}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={copyShareLink}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#16161D] text-[13px] font-bold text-white transition-transform active:scale-[0.98]"
              >
                {copied ? "복사됨 ✓" : "링크 복사"}
              </button>
              <button
                onClick={() => {
                  setDropped(false);
                  setSavedUrl(null);
                }}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[#E8E8EC] bg-white text-[13px] font-bold text-[#525252] transition-colors active:bg-[#F5F5F7]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────── 링고AI 플로팅 어시스턴트 (스튜디오 어디서나 따라다녀요) ───────── */}
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
                  className={`mx-auto max-w-md rounded-3xl bg-white p-4 [box-shadow:0_24px_60px_-16px_rgba(15,23,42,0.4),0_0_0_1px_#E8E8EC] ${
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
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LINGO }} />
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
                        {/* UI-5-T1f(1b·2) — 역할별 AI 제안(구 상단 heroExamples 이동): 탭 = 바로 생성. */}
                        <p className="mt-2 text-[11px] font-semibold text-[#6B7686]">이렇게 부탁해보세요</p>
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {heroExamples.map((ex) => (
                            <button
                              key={ex}
                              onClick={() => submitLingoText(ex)}
                              disabled={thinking}
                              className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-left text-[12px] font-medium text-[#404040] transition-transform active:scale-[0.98] disabled:opacity-40 [word-break:keep-all] [box-shadow:0_0_0_1px_#E8E8EC]"
                            >
                              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#A3A3A3]" strokeWidth={2.5} />
                              <span className="min-w-0 flex-1 text-pretty">{ex}</span>
                            </button>
                          ))}
                        </div>
                        {/* UI-5-T1(T-D) — 퀵명령 칩 미이식. */}
                        {/* UI-5-T2-E2 — mock 데모 칩("조립 연출 보기") 제거: 실 lingo-chat 응답으로 대체. */}
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
                    {/* UI-5-T2-E4b — 인사 행동 칩(1화면 1행동): [1스텝 하러 가기](enterStep(0)) · [내가 알아서 할게요]. */}
                    {greetingChipsOpen && messages.length > 0 && !thinking && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        <button
                          onClick={() => {
                            setGreetingChipsOpen(false);
                            enterStep(0); // 1스텝 칸 이동 + 포커스.
                          }}
                          className="min-h-[44px] rounded-xl bg-[#EEF2FF] px-3.5 text-[13px] font-bold text-[#1D4ED8] transition-transform active:scale-95"
                        >
                          {stepPlanState[0]?.label} 하러 가기
                        </button>
                        <button
                          onClick={() => setGreetingChipsOpen(false)}
                          className="min-h-[44px] rounded-xl border border-[#E8E8EC] px-3.5 text-[13px] font-bold text-[#525252] transition-colors active:bg-[#F5F5F7]"
                        >
                          내가 알아서 할게요
                        </button>
                      </div>
                    )}
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

                  {/* UI-5-T1(T-D) — 조립순서 번호도 · 추천 장착 버튼 · 대화 중 퀵명령 미이식. */}

                  {/* 입력 컴포저 — 텍스트가 기본, 음성은 보조 */}
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
                          style={{ backgroundColor: listening ? "#DC2626" : LINGO }}
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
                          style={{ backgroundColor: LINGO }}
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

                  {/* UI-5-T1(T-D) — 보조도구 3종(담기·편집·되돌리기) 미이식. */}
                </div>
              </div>
            </>
          )}

          {/* UI-5-T1f(4) — 연출 중 개별 숨김 제거: 딤이 FAB를 덮어 무대화 대체(중복 로직 정리). */}
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
                  ? { left: fabPos.x, top: fabPos.y, backgroundColor: LINGO, boxShadow: `0 14px 30px -8px ${LINGO}, 0 4px 12px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.25)` }
                  : { right: 20, bottom: 196, backgroundColor: LINGO, boxShadow: `0 14px 30px -8px ${LINGO}, 0 4px 12px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.25)` }
              }
            >
              <MessageCircle className="h-6 w-6" strokeWidth={2} />
              {lingo.action && !applied[lingo.action] && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                  <span
                    className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold"
                    style={{ color: LINGO }}
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
