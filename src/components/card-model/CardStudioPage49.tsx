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
  Youtube,
  PenLine,
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
  Volume2,
  VolumeX,
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
// UI-5-T3-L1 — 오브=마이크(45 S2b 이식): 즉시 청취 시퀀스·사운드·게이트(보존 lib 무수정 소비만).
import { primeAudio, playListenStart, playListenStop } from "@/lib/lingo-sound";
import { canUseSpeechRecognition, VOICE_UNSUPPORTED_NOTICE, speakThenProceed } from "@/lib/lingo-voice-tap";
import { LingoAvatar } from "@/components/brand/LingoMascot";
// UI-5-T3-L2 — 기록실 시트(구 패널 대체 · 직접 구현).
import { LingoRecordSheet49 } from "@/components/lingo/LingoRecordSheet49";
// UI-5-T2-E3 — 위지윅: 미리보기 = 정본 CardModelBody(거울) + 어댑터. CardBody49(v0 목업) 폐기.
import { CardModelBody } from "@/components/card-model/CardModelBody";
import { SHIP_STAGES, type CardModel } from "@/components/card-model/card-model.types";
import { studio49ToCardModel } from "@/components/card-studio/studio49-to-card";
import { LingoAssembleOverlay } from "@/components/card-studio/LingoAssembleOverlay49";
import { InlineDatePicker } from "@/components/lingo/InlineDatePicker"; // UI-5-T2-E5g — 공용 캘린더 재사용(무수정).
import { resizeToJpegBlob } from "@/lib/image-upload"; // UI-5-T2-E5a — 45 업로드 파이프 공용 리사이저.

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

// UI-5-T2-E5d — 가짜 COUPON_OPTIONS(c1~c3) 폐기 → 파트너 실쿠폰(UUID). 형태 = get_active_store_coupons
//   v5.11 반환(studio-build.tsx:25-36 StudioBuildCoupon 동형 — 45 파이프 계승).
type StudioCoupon = {
  id: string;
  title: string | null;
  discount_value: number | null;
  discount_unit: string | null;
  coupon_type?: string | null;
  gift_item?: string | null;
  valid_until?: string | null;
};
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

// UI-5-T2-E5g — ISO("YYYY-MM-DD") ↔ 라벨("M/D(요)") 정본(45 UI-4f isoOfDate/labelOfIso 바이트 동일).
//   구 인덱스(saleStartIdx) 폐기 락 계승 — 저장·표기 포맷 불변.
const isoOfDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const labelOfIso = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}(${WEEKDAY_KR[new Date(y, m - 1, d).getDay()]})`;
};
// UI-5-T2-E5g2 — 기간 표기: "수확 7/25(토) ~ 7/28(화) (4일간)" · 같은 날 = "수확 7/25(토) 하루".
//   미선택("") = 빈 문자열(캡션 미렌더). 날짜 라벨 = labelOfIso 정본(포맷 불변).
function rangeLabel(prefix: string, startIso: string, endIso: string): string {
  if (!startIso) return "";
  const end = endIso || startIso;
  if (end === startIso) return `${prefix} ${labelOfIso(startIso)} 하루`;
  const days = Math.round((Date.parse(end) - Date.parse(startIso)) / 86400000) + 1;
  return `${prefix} ${labelOfIso(startIso)} ~ ${labelOfIso(end)} (${days}일간)`;
}
// UI-5-T4-D2 — 튜토리얼 졸업 카운트(localStorage · DB 신설 금지 준수). 키 설계:
//   "lingo49_tutorial_seen" = { assembleCount(정상 완주 횟수 — 스킵 제외), doneCount(do 수행 성공 횟수),
//   skipStreak(연속 스킵 — 완주 시 0 리셋) }. 시크릿창 = 매번 신규(테스트 이점 · 계정 동기화 = post-pilot 한계).
const TUT_SEEN_KEY = "lingo49_tutorial_seen";
type TutSeen = { assembleCount: number; doneCount: number; skipStreak: number };
function readTutSeen(): TutSeen {
  try {
    if (typeof window === "undefined") return { assembleCount: 0, doneCount: 0, skipStreak: 0 };
    const p = JSON.parse(window.localStorage.getItem(TUT_SEEN_KEY) ?? "null") as Partial<TutSeen> | null;
    return {
      assembleCount: Number(p?.assembleCount) || 0,
      doneCount: Number(p?.doneCount) || 0,
      skipStreak: Number(p?.skipStreak) || 0,
    };
  } catch {
    return { assembleCount: 0, doneCount: 0, skipStreak: 0 };
  }
}
function writeTutSeen(patch: Partial<TutSeen>) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TUT_SEEN_KEY, JSON.stringify({ ...readTutSeen(), ...patch }));
  } catch {
    // 저장 실패(프라이빗 모드 등) = 조용히 — 매번 풀 연출일 뿐(기능 무해).
  }
}
// UI-5-T4-D3 — 첫 사용 온보딩(1회성 · D2 키 체계 확장: lingo49_*). done = 제안 미재노출.
const ONBOARD_DONE_KEY = "lingo49_onboarding_done";
function readOnboardingDone(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(ONBOARD_DONE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeOnboardingDone() {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(ONBOARD_DONE_KEY, "1");
  } catch {
    // 저장 실패 = 다음 진입에 재제안될 뿐(무해).
  }
}
// D3(2b) — 진행 격려 사전(스텝 진입마다 1줄 · 진행률 구간 매핑). 발행 언급 0(헌장 ⑨).
const ONBOARD_CHEER: string[] = [
  "먼저 여기부터 — 제가 옆에서 도와드릴게요",
  "좋아요, 잘하고 계세요",
  "벌써 절반이에요 — 이 흐름 그대로예요",
  "거의 다 왔어요 — 조금만 더요",
];
function defaultSaleRange(): { start: string; end: string } {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 6);
  return { start: isoOfDate(base), end: isoOfDate(end) };
}
// 상품 유형 축 — 신선(제철)·가공(생산)·공산(판매). 유형 = 라벨·칸 구성만 전환(날짜 상태 유지).
type ProductKind = "fresh" | "processed" | "manufactured";
const PRODUCT_KIND_META: Record<ProductKind, { chip: string; calendar: string; extra: "harvest" | "produce" | null }> = {
  fresh: { chip: "신선", calendar: "제철 캘린더", extra: "harvest" },
  processed: { chip: "가공", calendar: "생산 캘린더", extra: "produce" },
  manufactured: { chip: "공산", calendar: "판매 캘린더", extra: null },
};
// 도우미 문구 유형 분기(날짜 = 숫자 불가침 · AI 창작 금지 · needsConfirm).
// E5g2 — 범위 어투(하루도 자연 포함: 시작=종료). 값 제안·자동입력 금지 유지.
const SEASONAL_HELPER: Record<ProductKind, string> = {
  fresh: "수확은 언제부터 언제까지 예정이세요? 제철 캘린더로 판매·수확·발송 기간을 정해요.",
  processed: "만드는 기간 기준으로 — 생산 캘린더로 판매·생산·발송 기간을 정해요.",
  manufactured: "언제까지 파실 건가요? 판매 캘린더로 판매 기간과 발송 기간을 정해요.",
};
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
  headline: "product", // L4(A2) — 상품 한마디(커머스 카피 — product 덱 게이트).
  clip: "content",
  date: "calendar",
  time: "calendar",
  coupon: "coupon",
  productName: "product",
  productPrice: "product",
  // F2③ — Edge FIX-48+50 방출 필드의 블록 환산(commerce 덱 게이트 정합).
  origin: "product",
  stockQty: "product",
  dock: "dock",
  phone: "link",
  map: "link",
};
// F2③ — 카드 공통 카피 필드: 제목·한마디는 전 모드 실필드(커머스 titleText·부제 폴백 포함).
//   FIELD_TO_BLOCK 환산(content)이 commerce 덱에 없어 카피 요청이 통째로 차단되던 결함 해소.
const COPY_FIELDS = new Set(["title", "subtitle"]);
function isAiActionAllowed(mode: StudioMode, a: any): boolean {
  if (!a || typeof a.type !== "string") return false;
  const allowed = DECK_IDS[mode];
  if (a.type === "switchMode") return false; // 사용자 확인 없는 AI 모드 전환 금지.
  if (a.type === "detach") return true; // 해제(제거)는 항상 안전.
  if (a.type === "equip") return typeof a.blockId === "string" && allowed.includes(a.blockId);
  if (a.type === "setField") {
    if (AI_BLOCKED_FIELDS.has(a.field)) return false; // T1k(D) — 구간 값 등 자동 설정 금지(선택은 대표님).
    if (COPY_FIELDS.has(a.field)) return true; // F2③ — 카피(제목·한마디)는 전 모드 허용.
    const blk = FIELD_TO_BLOCK[a.field];
    return !blk || allowed.includes(blk); // 매핑 없는 필드는 블록 게이트 없음(허용).
  }
  return true;
}

// UI-5-T1j — 조립 마킹: 필드 표시 라벨 + 숫자 불가침(항상 확인) 필드/블록 집합.
const FIELD_LABEL: Record<string, string> = {
  title: "제목",
  subtitle: "한마디",
  headline: "상품 한마디", // L4(A2).
  clip: "핵심 구간",
  coupon: "쿠폰",
  productName: "상품명",
  productPrice: "가격",
  date: "예약일",
  time: "예약 시간",
  dock: "도킹 카드",
  origin: "원산지", // F2③ — Edge 방출 필드 라벨.
  stockQty: "수량",
  phone: "전화",
  map: "지도",
};
const NUMBER_FIELDS = new Set(["productPrice", "date", "time", "stockQty"]); // 가격·기간·수량 → 항상 확인(숫자 불가침). F2③ — stockQty 편입.
const NUMBER_CRITICAL_BLOCKS = new Set(["product", "seasonal", "calendar", "party"]); // 가격·수량·기간·인원.
// UI-5-T1k(D) — 핵심구간(clip): "장착은 링고, 선택은 대표님". content = 선택 필요(needsConfirm 동급).
//   구간 값(clip) setField 는 AI 화이트리스트에서 제외 → 링고가 시도해도 가드에 걸림(T-2 실배선 방어).
const CLIP_BLOCKS = new Set(["content"]); // 구간 선택 필요 블록(선택은 대표님).
// UI-5-T1m — 영상=조립 관문(content=영상·핵심구간 블록, hasVideo=applied.content). 이미지=선택 필요.
const IMAGE_BLOCKS = new Set(["image", "productimage"]); // 사진 선택 필요 블록.
// 링고 자동 설정 금지 필드: 구간(clip)·영상 링크·사진 = 콘텐츠 대리 선택 금지(장착·안내만).
// E5d — coupon 편입: 실쿠폰(UUID) 전환으로 쿠폰 선택 = 대표님 탭만(AI 대리 선택 차단 — Edge 개정 목록 대상).
const AI_BLOCKED_FIELDS = new Set(["clip", "video", "videoUrl", "videoLink", "image", "imageUrl", "photo", "coupon"]);
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
  // UI-5-T2-E5g — 판매 캘린더 = ISO 기간(구 인덱스 폐기). 유형별(제철·생산·판매) 단일일 캘린더 병설.
  const [productKind, setProductKind] = useState<ProductKind>("fresh");
  const [saleStartIso, setSaleStartIso] = useState("");
  const [saleEndIso, setSaleEndIso] = useState("");
  // UI-5-T2-E5g2 — 수확·생산·발송 = 기간(범위) 상태. 구 단일 *Iso 키 폐기 — 하루 = 시작=종료(범위의 특수형).
  const [harvestStartIso, setHarvestStartIso] = useState(""); // 신선 = 수확 예정 기간.
  const [harvestEndIso, setHarvestEndIso] = useState("");
  const [produceStartIso, setProduceStartIso] = useState(""); // 가공 = 생산 기간.
  const [produceEndIso, setProduceEndIso] = useState("");
  const [shipStartIso, setShipStartIso] = useState(""); // 전 유형 = 발송 예정 기간.
  const [shipEndIso, setShipEndIso] = useState("");
  // 판매기간 기본값(오늘~+6, 45 :806 동형). SSR 안전: 마운트 후 확정.
  useEffect(() => {
    const r = defaultSaleRange();
    setSaleStartIso((s) => s || r.start);
    setSaleEndIso((s) => s || r.end);
  }, []);
  // 복수 날짜 · 시간대 · 잔여 자리 (예약 설정과 동일한 개념)
  const [cfgDates, setCfgDates] = useState<string[]>([DATE_OPTIONS[0]]);
  const [cfgTimes, setCfgTimes] = useState<string[]>([TIME_OPTIONS[1]]);
  // 날짜별 잔여 좌석 (날짜마다 다르게)
  const [cfgSlotsByDate, setCfgSlotsByDate] = useState<Record<string, number>>({ [DATE_OPTIONS[0]]: 4 });
  const setSlotForDate = (date: string, next: number) =>
    setCfgSlotsByDate((prev) => ({ ...prev, [date]: Math.max(0, Math.min(20, next)) }));
  const dateRailRef = useRef<HTMLDivElement>(null);
  const [dateRailIdx, setDateRailIdx] = useState(0);
  // UI-5-T2-E5d — 파트너 실쿠폰(45 selectedCouponId :820-822 동형): 목록 = get_active_store_coupons(소유 매장).
  //   선택 = 실 UUID 보관 · 기본 선택 없음(가짜 c1 기본값 폐기 — 쿠폰은 대표님이 골라야 확정).
  const [coupons, setCoupons] = useState<StudioCoupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsError, setCouponsError] = useState<string | null>(null);
  const couponsLoadedRef = useRef(false); // 1회 로드(패널 재진입 반복 호출 방지 — DB 정본 캐시).
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId) ?? null;
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
  // UI-5-T2-E5a — 상품 사진 실배선(product-images 버킷). productImageUrl = 실 URL(가짜 불리언 catImgReady 폐기).
  //   첫 사진 = 카드 얼굴 = 발행 image_url 예정 단일 소스(E5b). 스텝 1(productimage)이 유일 입구.
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null); // 로컬 미리보기(업로드 중).
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // AI 원페이지 카탈로그(별도 목업 — E5a 범위 밖). 게이트만 실 사진(productImageUrl)으로 전환.
  const [catStatus, setCatStatus] = useState<"idle" | "generating" | "done">("idle");
  const catTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startCatalog = () => {
    if (!productImageUrl || catStatus === "generating") return;
    setCatStatus("generating");
    if (catTimer.current) clearTimeout(catTimer.current);
    catTimer.current = setTimeout(() => setCatStatus("done"), 2600);
  };
  useEffect(() => () => { if (catTimer.current) clearTimeout(catTimer.current); }, []);
  // UI-5-T2-E5a — 상품 사진 업로드(45 handleHeroImageChange :2132 파이프 계승). 갤러리·촬영 공용.
  //   BUG-5 방어: 오직 input change(사용자 제스처)에서만 실행 · effect 동기화 없음 · objectURL revoke ·
  //   조건 없는 setState 렌더 루프 없음(setApplied/confirmHelper 는 성공 1회). 크기/형식 = resizeToJpegBlob 가드.
  async function handleProductImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용 + 재-onChange 방지.
    if (!file) return;
    setImageUploadError(null);
    const localUrl = URL.createObjectURL(file);
    setProductImagePreview(localUrl);
    setImageUploading(true);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        setImageUploadError("로그인이 필요해요.");
        setProductImagePreview(null);
        return;
      }
      const blob = await resizeToJpegBlob(file); // 형식 정규화(JPEG)+크기 상한(1200px) 45 정책.
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) {
        console.error("[studio49] product image upload failed:", upErr);
        setImageUploadError("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setProductImagePreview(null);
        return;
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setProductImageUrl(pub.publicUrl); // 실 URL = 정본 소스(isStepDone·관문·어댑터·발행 예정).
      setProductImagePreview(pub.publicUrl);
      setApplied((p) => ({ ...p, productimage: true }));
      confirmHelper("productimage"); // 사진 확정 = 도우미 완료.
    } catch (err) {
      console.error("[studio49] product image unexpected:", err);
      setImageUploadError(err instanceof Error ? err.message : "사진 처리 중 문제가 생겼어요.");
      setProductImagePreview(null);
    } finally {
      setImageUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }
  // UI-5-T2-E5b — 상품 실등록(45 submitStudioProduct :2177-2248 동형 · blockData 45 :958-1036 보유 필드 계승).
  //   저장 시점 = 45 관례 계승: 폼 [상품 등록하기] 확정 시 즉시 /api/drops(self_upload) — 발행 일괄 아님.
  //   호출처 = 폼 버튼 onClick 1곳뿐(자동/링고/연출 트리거 0). 시세 = price_band_enabled:false 고정(§0 락).
  async function registerProduct() {
    if (productSaving) return;
    const digits = (v: string) => v.replace(/[^0-9]/g, "");
    const priceNum = Number(digits(cfgProductPrice)) || 0;
    // 검증(무언 실패 금지) — /api/drops 필수(사진·가격) + 이름(45 handlePublish :2256-2270 3종 동형).
    if (!productImageUrl) {
      setProductSaveError("상품 사진을 먼저 올려 주세요 — 1스텝(상품 사진)에서 올릴 수 있어요.");
      return;
    }
    if (!cfgProductName.trim()) {
      setProductSaveError("상품 이름을 입력해 주세요.");
      return;
    }
    if (priceNum <= 0) {
      setProductSaveError("가격을 입력해 주세요.");
      return;
    }
    const p = cfgProduct;
    const isFresh = p.type === "fresh";
    const dateVal = p.harvestDate.trim() || null;
    const dateEndRaw = p.type !== "processed" ? p.harvestDateEnd.trim() : "";
    if (dateVal && dateEndRaw && dateEndRaw < dateVal) {
      setProductSaveError("종료일은 시작일보다 빠를 수 없어요."); // 45 :946 계승.
      return;
    }
    const dateEndVal = dateVal && dateEndRaw && dateEndRaw > dateVal ? dateEndRaw : null;
    const md = (iso: string) => {
      const [, m, d] = iso.split("-");
      return `${Number(m)}/${Number(d)}`;
    };
    const dateRangeLabel = dateVal && dateEndVal ? `${md(dateVal)}~${md(dateEndVal)} 순차 발송` : null; // 45 :955.
    const points = p.sellingPoints.map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const qty = p.quantity && Number(digits(p.quantity)) > 0 ? Math.floor(Number(digits(p.quantity))) : null;
    // block_data — 45 :958-1036 키 정합(49 폼 보유 필드만 · 미보유 키는 미주입=미렌더).
    const blockData: Record<string, unknown> = {
      name: cfgProductName.trim(),
      price_krw: priceNum,
      ...(p.headline.trim() ? { headline: p.headline.trim() } : {}),
      ...(points.length > 0 ? { selling_points: points } : {}),
      is_fresh: isFresh,
      ...(isFresh && dateVal ? { harvest_date: dateVal } : {}),
      ...(qty != null ? { stock_limit: qty } : {}),
      price_band_enabled: false, // §0 시세 노출 영구 금지.
      ...(isFresh && p.kamisItemCode ? { kamis_item_code: p.kamisItemCode } : {}),
      origin: p.origin.trim(),
      ...(p.itemCategory.trim() ? { category: p.itemCategory.trim() } : {}),
      product_type: p.type,
      sale_unit: p.saleUnit,
      ...(isFresh && p.saleUnit === "box" && p.boxCount ? { box_count: Math.floor(Number(p.boxCount)) } : {}),
      ...(isFresh && p.saleUnit !== "unit" && !p.weightUnknown && p.totalWeight
        ? { total_weight_kg: Number(p.totalWeight) }
        : {}),
      ...(p.type !== "goods" ? { storage_method: p.storage } : {}),
      ...(p.type === "processed" && dateVal ? { expiry_date: dateVal } : {}),
      ...(p.type === "goods" && dateVal ? { ship_date: dateVal } : {}),
      ...(isFresh && dateEndVal ? { harvest_date_end: dateEndVal } : {}),
      ...(p.type === "goods" && dateEndVal ? { ship_date_end: dateEndVal } : {}),
      ...(dateRangeLabel ? { date_range_label: dateRangeLabel } : {}),
      ...(p.type === "goods" ? { made_in: p.origin.trim() } : {}),
      ...(p.type === "goods" && p.brand.trim() ? { brand: p.brand.trim() } : {}),
      ...(p.type === "goods" && p.spec.trim() ? { spec: p.spec.trim() } : {}),
      free_ship: p.freeShip,
      ...(!p.freeShip && p.shipFee ? { ship_fee_krw: Math.floor(Number(digits(p.shipFee))) } : {}),
    };
    setProductSaving(true);
    setProductSaveError(null);
    try {
      const res = await fetch("/api/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          self_upload: true,
          image_url: productImageUrl, // E5a — 실 사진 URL 단일 소스.
          name: cfgProductName.trim(),
          price_krw: priceNum,
          headline: p.headline.trim(),
          selling_points: points,
          is_fresh: isFresh,
          harvest_date: isFresh ? dateVal : null,
          stock_limit: qty,
          price_band_enabled: false,
          ...(isFresh && p.kamisItemCode ? { kamis_item_code: p.kamisItemCode } : {}),
          blocks: [{ block_kind: "product", position: 0, block_data: blockData }],
        }),
      });
      const json = (await res.json()) as { drop?: { id?: string; share_uuid?: string }; message?: string };
      if (!res.ok || !json.drop?.share_uuid) throw new Error(json.message ?? "DROP_CREATE_FAILED");
      setRegisteredProduct({ dropId: json.drop.id ?? null, shareUuid: json.drop.share_uuid, name: cfgProductName.trim() });
      setApplied((prev) => ({ ...prev, product: true }));
      confirmHelper("product"); // 등록 확정 = 도우미 ✓·릴레이/견인 연동.
      setStepToast("상품을 등록했어요 — 카드에 연결됐어요");
    } catch (err) {
      console.error("[studio49] product register:", err);
      setProductSaveError("상품 등록에 실패했어요. 잠시 후 다시 시도해 주세요."); // 45 :1061 동형.
    } finally {
      setProductSaving(false);
    }
  }
  // UI-5-T2-E5d — 파트너 실쿠폰 로드(45 studio-build loader :102-148 동형을 클라 1회 실행):
  //   partners(owner_user_id) → get_active_store_coupons(p_partner_id). 매장 없음 = 0건(안내).
  async function loadCoupons() {
    if (couponsLoading || couponsLoadedRef.current) return;
    setCouponsLoading(true);
    setCouponsError(null);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setCouponsError("로그인이 필요해요.");
        return;
      }
      const { data: storeRaw } = await supabase
        .from("partners")
        .select("id")
        .eq("owner_user_id", uid)
        .maybeSingle();
      const storeId = (storeRaw as { id: string } | null)?.id;
      if (!storeId) {
        couponsLoadedRef.current = true;
        setCoupons([]); // 매장 없음 = 0건 안내(무언 실패 아님).
        return;
      }
      const { data: rowsRaw, error: rowsErr } = (await supabase.rpc(
        "get_active_store_coupons" as never,
        { p_partner_id: storeId } as never,
      )) as { data: unknown; error: unknown };
      if (rowsErr) throw rowsErr;
      couponsLoadedRef.current = true;
      setCoupons(Array.isArray(rowsRaw) ? (rowsRaw as StudioCoupon[]) : []);
    } catch (err) {
      console.error("[studio49] coupons load:", err);
      setCouponsError("쿠폰 목록을 불러오지 못했어요."); // 무언 실패 금지.
    } finally {
      setCouponsLoading(false);
    }
  }
  // E5d — 쿠폰 칸 진입 시 1회 로드(자동 선택 없음 — 로드만·선택은 대표님 탭).
  useEffect(() => {
    if (DECK[deckIndex]?.id === "coupon") void loadCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckIndex, mode]);
  // E5b — 재사용 목록 로드(partner.products.index :260-281 동형 쿼리 · 자체업로드분만). 탭 시 1회.
  async function loadMyProducts() {
    if (myProductsLoading) return;
    setMyProductsLoading(true);
    setMyProductsError(null);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setMyProductsError("로그인이 필요해요.");
        return;
      }
      const { data: rows, error: qErr } = await supabase
        .from("info_drops")
        .select(
          `id, created_at,
           source:content_sources!inner ( title, thumbnail_url, price_krw, source_url ),
           share_events ( share_uuid ),
           blocks:component_blocks ( block_kind, block_data )`,
        )
        .eq("owner_user_id", uid)
        .eq("purpose", "구매")
        .order("created_at", { ascending: false })
        .limit(30);
      if (qErr) throw qErr;
      type Row = {
        id: string;
        source: { title: string | null; thumbnail_url: string | null; price_krw: number | null; source_url: string | null } | null;
        share_events: { share_uuid: string | null }[] | null;
        blocks: { block_kind: string | null; block_data: Record<string, unknown> | null }[] | null;
      };
      const mapped = ((rows ?? []) as unknown as Row[])
        .filter((r) => r.source?.source_url?.startsWith("https://app.drop.how/p/")) // 자체업로드만(:278-281 동형).
        .map((r) => {
          const pb = r.blocks?.find((b) => b.block_kind === "product" && !b.block_data?.ref_drop_id) ?? null;
          return {
            dropId: r.id,
            shareUuid: r.share_events?.[0]?.share_uuid ?? null,
            name:
              (typeof pb?.block_data?.name === "string" && pb.block_data.name) || r.source?.title || "이름 없는 상품",
            priceKrw:
              typeof pb?.block_data?.price_krw === "number" ? pb.block_data.price_krw : (r.source?.price_krw ?? null),
            imageUrl: r.source?.thumbnail_url ?? null,
            blockData: pb?.block_data ?? null,
          };
        });
      setMyProducts(mapped);
      if (mapped.length === 0) setMyProductsError("등록한 상품이 아직 없어요.");
    } catch (err) {
      console.error("[studio49] my products load:", err);
      setMyProductsError("상품 목록을 불러오지 못했어요.");
    } finally {
      setMyProductsLoading(false);
    }
  }
  // E5b — 재사용 선택: 폼 자동 채움 + 참조 연결(registeredProduct). ⚠️ BUG-1 방어: 이 드롭은
  //   is_public=false 로 잠들어 있음 — E5f 발행 시 45 S1-b(:2385-2411) update 패턴 필수(위 상태 주석 참조).
  function applyReusedProduct(row: MyProductRow) {
    const bd = row.blockData ?? {};
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    setRegisteredProduct({ dropId: row.dropId, shareUuid: row.shareUuid ?? "", name: row.name });
    setCfgProductName(row.name);
    setCfgProductPrice(row.priceKrw != null ? String(row.priceKrw) : "");
    setCfgProduct((p) => ({
      ...p,
      type: bd.product_type === "processed" || bd.product_type === "goods" ? bd.product_type : "fresh",
      headline: str(bd.headline),
      sellingPoints: Array.isArray(bd.selling_points)
        ? (bd.selling_points.filter((s): s is string => typeof s === "string") as string[])
        : [""],
      origin: str(bd.origin),
      itemCategory: str(bd.category),
      kamisItemCode: str(bd.kamis_item_code),
      quantity: typeof bd.stock_limit === "number" ? String(bd.stock_limit) : "",
      harvestDate: str(bd.harvest_date) || str(bd.ship_date) || str(bd.expiry_date),
      harvestDateEnd: str(bd.harvest_date_end) || str(bd.ship_date_end),
      saleUnit: bd.sale_unit === "box" || bd.sale_unit === "weight" ? bd.sale_unit : "unit",
      freeShip: bd.free_ship !== false,
      shipFee: typeof bd.ship_fee_krw === "number" ? String(bd.ship_fee_krw) : "",
      storage: bd.storage_method === "cold" || bd.storage_method === "frozen" ? bd.storage_method : "room",
      brand: str(bd.brand),
      spec: str(bd.spec),
    }));
    if (row.imageUrl) {
      // E5a 정합 — 재사용 = 기존 실 URL 재연결(업로드 아님 · 단일 소스 유지).
      setProductImageUrl(row.imageUrl);
      setProductImagePreview(row.imageUrl);
      setApplied((prev) => ({ ...prev, productimage: true }));
    }
    setApplied((prev) => ({ ...prev, product: true }));
    confirmHelper("product");
    setMyProductsOpen(false);
    setStepToast(`불러왔어요 — ${row.name}`);
  }
  // 조립 연출 타이머 정리
  useEffect(() => () => { assembleTimers.current.forEach(clearTimeout); }, []);
  // 상품 등록 상세 (유형·원산지·판매단위·수량·셀링포인트 등)
  const [cfgProduct, setCfgProduct] = useState<ProductForm>(EMPTY_PRODUCT);
  // UI-5-T2-E5b — 상품 실등록 상태: 등록 결과 참조(드롭 id·uuid) = E5f 발행 재사용·BUG-1 방어의 근거.
  //   ⚠️ BUG-1(45 S1-b): 등록 드롭은 is_public=false(서버 기본)로 생성 — E5f 재사용 발행 시 45 :2385-2411
  //   패턴(is_public·published_at best-effort update)을 이 dropId 에 반드시 적용할 것.
  const [registeredProduct, setRegisteredProduct] = useState<null | { dropId: string | null; shareUuid: string; name: string }>(null);
  const [productSaving, setProductSaving] = useState(false);
  const [productSaveError, setProductSaveError] = useState<string | null>(null);
  // E5b — 재사용: 내 등록 상품 목록(자체업로드분 · 탭 = 폼 자동 채움 + 참조 연결).
  type MyProductRow = {
    dropId: string;
    shareUuid: string | null;
    name: string;
    priceKrw: number | null;
    imageUrl: string | null;
    blockData: Record<string, unknown> | null;
  };
  const [myProducts, setMyProducts] = useState<MyProductRow[]>([]);
  const [myProductsLoading, setMyProductsLoading] = useState(false);
  const [myProductsOpen, setMyProductsOpen] = useState(false);
  const [myProductsError, setMyProductsError] = useState<string | null>(null);
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
  // UI-5-T2-E5e — 비커머스 셀링포인트(45 pickedPoints :853 동형 · 이번엔 수동 입력만 — AI 초안 제안은 L4 소관).
  //   저장 형태 = string[] · 소비 시 trim·filter·slice(0,5)(45 관례). lingoTouched 호환: 후일 AI 초안 채택 시
  //   touch(["keyPoints","content"]) 경로 재사용 예정(필드 키 예약 — 지금은 수동뿐이라 미기록).
  const [pickedPoints, setPickedPoints] = useState<string[]>([]);
  const cleanKeyPoints = () => pickedPoints.map((s) => s.trim()).filter(Boolean).slice(0, 5);
  // UI-5-T4-D3b — 비커머스 정본 복원(45 :2100-2129·:4707-4732 계승): 영상 요약 기반 "영상 포인트" 픽.
  //   ai_key_points = 후보 칩(자동 주입 0 — 채택은 사용자 탭) · ai_summary = 한마디 "제안" 칩(자동 주입 금지).
  //   "셀링포인트" 용어 = 커머스 전용(비커머스 라벨 = 영상 포인트 — 생활어).
  const [aiKeyPoints, setAiKeyPoints] = useState<string[]>([]);
  const [aiSummaryLead, setAiSummaryLead] = useState<string | null>(null);
  const [customPointDraft, setCustomPointDraft] = useState("");
  // D3b — 후보 채택 토글(45 :4722 동형) · 5개 상한(cleanKeyPoints slice(0,5)와 정합).
  function togglePickedPoint(p: string) {
    setPickedPoints((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      if (prev.filter((x) => x.trim()).length >= 5) {
        setStepToast("포인트는 최대 5개까지 실을 수 있어요");
        return prev;
      }
      return [...prev, p];
    });
  }
  // D3b(c) — [직접 추가] 보조 1개: trim·중복 제외·5개 상한.
  function addCustomPoint() {
    const t = customPointDraft.trim();
    if (!t) return;
    setPickedPoints((prev) => {
      if (prev.includes(t)) return prev;
      if (prev.filter((x) => x.trim()).length >= 5) {
        setStepToast("포인트는 최대 5개까지 실을 수 있어요");
        return prev;
      }
      return [...prev, t];
    });
    setCustomPointDraft("");
  }
  // 콘텐츠 편집값 (제목·설명·핵심구간)
  const [cfgTitle, setCfgTitle] = useState("");
  const [cfgSubtitle, setCfgSubtitle] = useState("");
  const [cfgClip, setCfgClip] = useState("0:42");
  // UI-5-T2-E5c(B) — 핵심구간 직접 입력 초안(시작·끝). 확정(blur/Enter) 시 검증 → cfgClip("시작~끝") 커밋.
  const [clipStartDraft, setClipStartDraft] = useState("");
  const [clipEndDraft, setClipEndDraft] = useState("");
  const [clipError, setClipError] = useState<string | null>(null);
  // cfgClip(정본 값) → 초안 동기(외부 변경: 영상 교체 초기화·되돌리기·리셋 포함). "a~b" 분해, 단일값 = 시작만.
  useEffect(() => {
    const [a, b] = cfgClip.split("~");
    setClipStartDraft(a?.trim() ?? "");
    setClipEndDraft(b?.trim() ?? "");
    setClipError(null);
  }, [cfgClip]);
  // UI-5-T2-E1 — 영상 검색 실배선(45 파이프). hasVideo = !!selectedVideo. 결과 = DiscoverCandidate.
  const [videoQuery, setVideoQuery] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [videoResults, setVideoResults] = useState<DiscoverCandidate[]>([]);
  // UI-5-T2-E5c(A) — 영상 확정 2단: 행 탭 = 선택 표시(pending)만, [이 영상으로 확정]에서 selectVideo 실행.
  const [pendingVideo, setPendingVideo] = useState<DiscoverCandidate | null>(null);
  const [videoShowCount, setVideoShowCount] = useState(12); // UI-5-T2-E1b — 클라 노출 상한(구 5 → 12) + [더 보기] 증분.
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
  // UI-5-T2-E2b — 완료 견인·AI 레인 정합 상태.
  //   stepChip: done=현재 스텝 완료 견인(A1) / ai=조립 요약·릴레이 종료 후 첫 미확정 제안(B2·B3). target=이동 제안 스텝.
  const [stepChip, setStepChip] = useState<null | { kind: "done" | "ai"; target: number }>(null);
  const prevStepDoneRef = useRef<{ idx: number; done: boolean } | null>(null); // A1 — 에지 감지(prev ref, E3c 교훈).
  const [nextPulseKey, setNextPulseKey] = useState(0); // A2 — 진행 헤더 [다음] 완료 순간 1회 펄스(key 재마운트).
  const [aiLane, setAiLane] = useState(false); // B4 — AI 실적용 후에만 미래 완료 스텝 잠금 완화(수동 레인 무영향 B5).
  const [aiSyncPending, setAiSyncPending] = useState(0); // B1 — AI 적용 후 재검증 트리거(카운터 = 다중 조립 대응).
  const prevPendingRef = useRef(0); // B2 — 릴레이 큐 비움(비→공) 에지 감지.
  // UI-5-T2-E3b — 작업물 있는 상태에서 목적 전환 시도 시 확인 대상 모드(null=게이트 닫힘).
  const [pendingModeSwitch, setPendingModeSwitch] = useState<StudioMode | null>(null);
  useEffect(() => {
    if (!stepToast) return;
    const t = setTimeout(() => setStepToast(null), 1800);
    return () => clearTimeout(t);
  }, [stepToast]);
  // UI-5-T2-E2b(A1) — 스텝 완료 에지 감지: 현재 스텝 isStepDone false→true 순간 1회 발화(effect+prev ref).
  //   발화 = 완료 칩 제시 + 헤더 [다음] 펄스(A2)뿐 — 자동 점프·자동 발행 없음(탭이 의사).
  //   연출·요약 중엔 침묵(AI 채움 구간은 B1·B2가 담당) · review 스텝 제외(항상 done인 훑어보기).
  useEffect(() => {
    const done = isStepDone(currentStep);
    const prev = prevStepDoneRef.current;
    if (
      prev && prev.idx === currentStep && !prev.done && done &&
      !assembling && !assembleSummary &&
      stepPlanState[currentStep]?.key !== "review"
    ) {
      setStepChip({ kind: "done", target: Math.min(currentStep + 1, stepPlanState.length - 1) });
      setNextPulseKey((k) => k + 1); // A2 — 두 진입점(칩·헤더) 동일 경로 = nextStep.
    }
    prevStepDoneRef.current = { idx: currentStep, done };
  });
  // E2b — 스텝 이동 = 칩 소비/무효(다음 스텝 에지가 새로 발화).
  useEffect(() => {
    setStepChip(null);
  }, [currentStep]);
  // UI-5-T2-E2b(B1) — AI 적용 후 재검증 동기화: 적용 액션이 "실제로" 충족시킨 스텝만 completedSteps 자동 ✓.
  //   판정 = 상태 커밋 후 isStepDone 재검증뿐 — 문구만 채워진 척 금지. review 제외 · currentStep 불변(자동 점프 0).
  useEffect(() => {
    if (!aiSyncPending) return;
    const adds: number[] = [];
    stepPlanState.forEach((s, i) => {
      if (s.key !== "review" && !completedSteps.has(i) && isStepDone(i)) adds.push(i);
    });
    if (adds.length) {
      setCompletedSteps((prev) => new Set([...prev, ...adds]));
      setAiLane(true); // B4 — 잠금 완화는 AI 실충족 발생 이후에만.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSyncPending]);
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
  // UI-5-T2-E4c — 자동 양보: 링고가 화면 조작을 요구하면 패널이 스스로 닫힘. 닫힘 직후 FAB 옆 재소환 말풍선 1회.
  const [yieldBubble, setYieldBubble] = useState(false);
  const yieldBubbleShownRef = useRef(false); // 1회성(반복 금지).
  const yieldBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // UI-5-T2-E2b(B2) — 고치기 릴레이 실종료(미확정 큐 비→공)에만 다음 코스 제안(수동 단건 확정 오발화 방지).
  //   pendingConfirm 선언 이후 위치(TDZ) — 제안 = 칩 세우기뿐, 이동은 사용자 탭에서만.
  useEffect(() => {
    if (prevPendingRef.current > 0 && pendingConfirm.length === 0) suggestNextUnsettled();
    prevPendingRef.current = pendingConfirm.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConfirm]);
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
  // UI-5-T3-L1 — 오브=마이크 상태 언어: 낭독 중(speaking)·눌림 피드백·길게(500ms) 타이머·음성 고스트 안내.
  const [speaking, setSpeaking] = useState(false);
  // UI-5-T3-L3 — 입력 채널(45 chatChannelRef :955 동형): 음성 질문에만 응답 낭독(텍스트 = 읽는 중이니 낭독 0).
  const lingoChannelRef = useRef<"text" | "voice">("text");
  // L3 — 스피커 토글(낭독 전체 on/off · 사용자 설정 — resetForMode 무접촉). ref = 연출 done 타이머 라이브 참조.
  const [speakerOn, setSpeakerOn] = useState(true);
  const speakerOnRef = useRef(true);
  speakerOnRef.current = speakerOn;
  const listeningRef = useRef(false); // L3 — 낭독 종료 힌트가 청취 안내를 덮는 레이스 방지.
  listeningRef.current = listening;
  const [orbPressed, setOrbPressed] = useState(false); // S2b — pointerDown 즉시 피드백(100ms 이내 scale-95).
  const fabLongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabLongFiredRef = useRef(false);
  const [voiceGhost, setVoiceGhost] = useState<string | null>(null); // "듣고 있어요" 등 텍스트 안내(낭독 0).
  // UI-5-T3-L4(B5) — 막힘 감지 상태(45 DRIVE-2e 동형): 90s 상수·스텝당 1회 예산·제안 칩.
  const STUCK_MS = 90_000;
  const stuckShownRef = useRef<Set<string>>(new Set());
  const [stuckChip, setStuckChip] = useState<null | { key: string; label: string; msg: string }>(null);
  const voiceGhostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showVoiceGhost = (msg: string, ms = 5000) => {
    setVoiceGhost(msg);
    if (voiceGhostTimerRef.current) clearTimeout(voiceGhostTimerRef.current);
    voiceGhostTimerRef.current = setTimeout(() => setVoiceGhost(null), ms);
  };
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  // UI-5-T2-E4b — 인사 행동 칩(1스텝 하러 가기 / 알아서 할게요) 노출. 마운트·모드전환 시 재개, 상호작용 시 닫힘.
  const [greetingChipsOpen, setGreetingChipsOpen] = useState(true);
  const lingoSessionRef = useRef<string | null>(null); // UI-5-T2-E2 — lingo-chat 세션 id(meta 수신 시 보관).
  // UI-5-T1(T-D) — 조립순서 번호도(lingoSteps) 미이식.
  // 링고AI 조립 연출 — 카드 위에서 손가락으로 가리키며 단계별로 조립
  const [assembling, setAssembling] = useState(false);
  const [assembleStep, setAssembleStep] = useState(0);
  const [assembleSteps, setAssembleSteps] = useState<
    { label: string; note: string; anchor?: string; kind?: "watch" | "do" }[]
  >([]);
  // UI-5-T4-D1 — do 스텝 수행 대기 플래그 + 마이크로 피드백("잘하셨어요!").
  const awaitingDoRef = useRef(false);
  const [assembleFeedback, setAssembleFeedback] = useState<string | null>(null);
  // UI-5-T4-D3 — 온보딩 상태: 제안 고스트(1회) · 진행 중 플래그 · 격려 고스트(3s). 진행 추적 = 기존
  //   completedSteps/currentStep 재사용(신규 추적 0 · 강제 잠금 추가 0 — 중도 이탈 = 평시 흐름).
  const [onboardOffer, setOnboardOffer] = useState(false);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [onboardCheer, setOnboardCheer] = useState<string | null>(null);
  const onboardCheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showOnboardCheer = (msg: string, ms = 3000) => {
    setOnboardCheer(msg);
    if (onboardCheerTimer.current) clearTimeout(onboardCheerTimer.current);
    onboardCheerTimer.current = setTimeout(() => setOnboardCheer(null), ms);
  };
  // D3(1) — 발동: done 부재 + 첫 진입(마운트 1회 · 클라 전용).
  useEffect(() => {
    if (!readOnboardingDone()) setOnboardOffer(true);
  }, []);
  // D3(2b·2d) — 스텝 진입 격려 + 확인 스텝 도달 = 완료 처리. 기존 사슬(enterStep→도우미→E2b) 위에
  //   격려 1줄만 얹음 — 신규 연출 엔진 0.
  useEffect(() => {
    if (!onboardingActive) return;
    const s = stepPlanState[currentStep];
    if (!s) return;
    if (s.key === "review") {
      writeOnboardingDone(); // D3(2d) — 마지막 확인 스텝 도달 = 온보딩 완료.
      setOnboardingActive(false);
      showOnboardCheer("이제 혼자서도 만드실 수 있어요 — 발행은 준비되셨을 때 직접 눌러 주세요", 5000);
      return;
    }
    const denom = Math.max(1, stepPlanState.length - 1);
    const idx = Math.min(ONBOARD_CHEER.length - 1, Math.floor((currentStep / denom) * ONBOARD_CHEER.length));
    showOnboardCheer(ONBOARD_CHEER[idx]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingActive, currentStep]);
  // D3(2a) — [같이 만들기]: 기존 사슬 그대로 — enterStep(0)(E4f 인사 칩과 동일 호출) → onEditField →
  //   도우미(HELPER_COPY) → 완료 시 E2b 견인 칩. 사용자 탭 유래.
  function startOnboarding() {
    setOnboardOffer(false);
    setOnboardingActive(true);
    setGreetingChipsOpen(false);
    enterStep(0);
  }
  // D3(1) — [혼자 해볼게요]: done 기록 + 기존 인사 칩 흐름(E4f)으로.
  function declineOnboarding() {
    writeOnboardingDone();
    setOnboardOffer(false);
  }
  // UI-5-T4-D2 — 재관람("연출 다시 보기"): 마지막 연출 재료(watch 원본) + 카운트 면제 플래그.
  const lastAssemblyRef = useRef<null | { actions: any[]; steps: { label: string; note: string; anchor?: string }[] }>(null);
  const [hasAssemblyHistory, setHasAssemblyHistory] = useState(false);
  const replayingRef = useRef(false);
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
  // L2 — 구 패널 이동 상태(panelOffset/panelDragging/panelDrag) 폐기: 기록실 시트 = 하단 고정.

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
    setPendingVideo(null); // E5c — 확정 대기 선택도 새 카드로 초기화.
    setVideoSearching(false);
    setVideoSearched(false);
    setVideoError(null);
    setProductImageUrl(null); // E5a — 새 카드 = 실 사진 초기화.
    setProductImagePreview(null);
    setImageUploading(false);
    setImageUploadError(null);
    setCatStatus("idle");
    setAivStyle("dynamic");
    setAivLength("15s");
    setAivStatus("idle");
    // cfg 전 필드
    setCfgDate(DATE_OPTIONS[0]);
    setCfgTime(TIME_OPTIONS[1]);
    {
      // E5g — 판매기간 기본값 복원 + 유형·단일일 날짜 초기화(파괴 아님 = 새 카드 시작).
      const r = defaultSaleRange();
      setSaleStartIso(r.start);
      setSaleEndIso(r.end);
      setProductKind("fresh");
      // E5g2 — 기간(범위) 상태 초기화.
      setHarvestStartIso("");
      setHarvestEndIso("");
      setProduceStartIso("");
      setProduceEndIso("");
      setShipStartIso("");
      setShipEndIso("");
    }
    setCfgDates([DATE_OPTIONS[0]]);
    setCfgTimes([TIME_OPTIONS[1]]);
    setCfgSlotsByDate({ [DATE_OPTIONS[0]]: 4 });
    setDateRailIdx(0);
    // E5d — 실쿠폰 선택 리셋(목록 캐시는 DB 정본이라 유지 · 기본 선택 없음).
    setSelectedCouponId(null);
    setCouponsError(null);
    setCfgDock(DOCK_OPTIONS[0].id);
    setCfgProductName("");
    setCfgProductPrice("");
    setCfgProduct(EMPTY_PRODUCT);
    // E5b — 상품 실등록 참조·재사용 UI 리셋(목록 캐시는 DB 정본이라 유지).
    setRegisteredProduct(null);
    setProductSaving(false);
    setProductSaveError(null);
    setMyProductsOpen(false);
    setMyProductsError(null);
    setCfgPhone(true);
    setCfgMap(true);
    setCfgFacilities([newFacility("주차 가능"), newFacility("무료 와이파이")]);
    setCfgTitle("");
    setCfgSubtitle("");
    setPickedPoints([]); // E5e — 포인트 픽 리셋.
    // D3b — 후보·제안 캐시 리셋(새 카드 = 새 영상 요약).
    setAiKeyPoints([]);
    setAiSummaryLead(null);
    setCustomPointDraft("");
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
    // L4(B5) — 막힘 감지 리셋(새 카드 = 스텝 예산 재무장).
    setStuckChip(null);
    stuckShownRef.current = new Set();
    // D3 — 온보딩 진행 종료(새 카드 = 평시 흐름 · 제안은 1회 정책이라 미재노출).
    setOnboardingActive(false);
    setOnboardCheer(null);
    // E2b — 완료 칩·AI 레인 리셋(새 카드 = 수동 레인 기본 · 에지 ref 초기화).
    setStepChip(null);
    setAiLane(false);
    setNextPulseKey(0);
    prevStepDoneRef.current = null;
    prevPendingRef.current = 0;
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
    awaitingDoRef.current = false; // D1 — do 대기 해제.
    setAssembleFeedback(null);
    // D2 — 재관람 재료 폐기(이전 목적 연출 재생 차단 — 스냅샷 폐기 관례 동일) · 면제 플래그 해제.
    lastAssemblyRef.current = null;
    setHasAssemblyHistory(false);
    replayingRef.current = false;
    assembleSnapshot.current = null; // 되돌리기 스냅샷 폐기(이전 목적 작업물 유입 차단)
    appliedActionsRef.current = [];
    // ── 링고 패널: 대화 이력 유지 + 새 플랜 인사 ───────────────────
    // E4b — 전환 인사도 행동 지시형(1화면 1행동). 나열문 폐지.
    setMessages((m) => [
      ...m,
      { role: "assistant", text: `새 ${MODE_NAME[next]} 카드를 시작해요. ${introLead(next)}` }, // E4f — 중복 1회화 합성 공용.
    ]);
    setGreetingChipsOpen(true); // 새 인사 → 행동 칩 재개.
    // ── 안내 토스트 ─────────────────────────────────────────────────
    setStepToast(`새 ${MODE_NAME[next]} 카드를 시작했어요`);
  }

  // 작업물 존재 판정 — 하나라도 있으면 전환 시 확인 게이트.
  function hasWork(): boolean {
    return (
      !!selectedVideo ||
      !!productImageUrl ||
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
  // UI-5-T3-L1 — 오브 탭 계약(45 S2b :5895-5925 이식 + 49 드래그 병존): 짧게 = 즉시 청취(handleOrbTap) /
  //   길게(500ms, pointer 직접 구현) = 패널 열기(현행 유지 — L2에서 기록실 시트로 교체 예정) / 끌면 = 이동.
  function clearFabLongTimer() {
    if (fabLongTimerRef.current) {
      clearTimeout(fabLongTimerRef.current);
      fabLongTimerRef.current = null;
    }
  }
  function onFabPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = fabRef.current?.getBoundingClientRect();
    if (!rect) return;
    fabDrag.current = { active: true, moved: false, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setOrbPressed(true); // S2b — 누르는 순간 즉시 피드백(transition 100ms).
    fabLongFiredRef.current = false;
    clearFabLongTimer();
    fabLongTimerRef.current = setTimeout(() => {
      fabLongTimerRef.current = null;
      fabLongFiredRef.current = true; // 길게 = 기록실 시트(이때 짧은 탭 시퀀스 발화 금지 — 상호배타).
      setLingoOpen(true);
    }, 500);
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
        clearFabLongTimer(); // 끌기 시작 = 길게/탭 모두 취소.
        setOrbPressed(false);
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
    setOrbPressed(false);
    const hadTimer = !!fabLongTimerRef.current;
    clearFabLongTimer();
    if (wasDrag) {
      // 가까운 좌/우 가장자리에 붙이기
      setFabPos((prev) => {
        if (!prev) return prev;
        const mid = window.innerWidth / 2;
        const snapX = prev.x + FAB_SIZE / 2 < mid ? FAB_MARGIN : window.innerWidth - FAB_SIZE - FAB_MARGIN;
        return clampFab(snapX, prev.y);
      });
    } else if (hadTimer && !fabLongFiredRef.current) {
      handleOrbTap(); // L1 — 짧은 탭 = 즉시 청취(구 setLingoOpen(true) 계약 교체).
    }
  }

  // L2 — 구 패널 드래그 핸들러(onPanelPointer*) 폐기: 시트는 하단 고정(이동 기능 없음).

  // 텍스트로 링고에게 보내기 (입력창·칩 공용)
  function submitLingoText(text?: string) {
    const t = (text ?? lingoText).trim();
    if (!t || thinking) return;
    setLingoText("");
    lingoChannelRef.current = "text"; // L3 — 텍스트 채널(낭독 0 — 읽는 중, 45 :3445 동형).
    sendToLingo(t);
  }

  // 상단 AI 빌더 — 한 줄 설명으로 카드를 통째로 구성 (기록실 시트를 열고 링고에게 전달)
  function buildWithAI(text?: string) {
    const t = (text ?? heroPrompt).trim();
    if (!t || thinking) return;
    setHeroPrompt("");
    lingoChannelRef.current = "text"; // L3 — 텍스트 채널.
    setLingoOpen(true); // L2 — 시트 소환(구 panelOffset 리셋 폐기).
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
        lingoChannelRef.current = "voice"; // L3 — 음성 유래 채널 마킹(45 :3469 동형).
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

  // L3 — onDone 시그니처 확장(45 useLingoChat speak :530-555 관례: OFF·미지원·오류 전 분기 onDone 보장).
  //   스피커 OFF(speakerOnRef) = 낭독 0 + 즉시 onDone — 텍스트만.
  function speak(text: string, onDone?: () => void) {
    if (!text || typeof window === "undefined" || !window.speechSynthesis || !speakerOnRef.current) {
      onDone?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = 1.05;
      // L1 — 낭독 상태 추적(오브 배지 Volume2 전환). cancel 도 onend 발화 → false 복귀.
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        onDone?.();
      };
      u.onerror = () => {
        setSpeaking(false);
        onDone?.();
      };
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
      onDone?.();
    }
  }

  // UI-5-T3-L1 — 오브 짧은 탭 = 즉시 청취(45 S2b handleOrbTap :3487-3525 이식 · 낭독 대기 0).
  //   시퀀스: primeAudio(제스처 최상단·오디오 언락) → streaming 가드 → 청취 중 재탭=중지 →
  //   지원 게이트(불능 = 안내+패널 폴백) → stopSpeaking(낭독 끊기) → 띠딩 → 즉시 startListening.
  //   안내는 텍스트 고스트만("듣고 있어요 — 말씀하세요") — speakThenProceed 류 낭독 지연 0(S2b :3515-3516).
  //   인앱(inAppNoMic) 핸드오프: 49 기존 경로 부재 → 지원 게이트 폴백이 커버(기존 계약 무변).
  function handleOrbTap() {
    primeAudio(); // 오디오 언락은 제스처 컨텍스트 최상단(45 :3489).
    if (thinking) return; // streaming 가드(45 :3490 동형).
    if (listening) {
      // 청취 중 재탭 = 중지(낮은 톤 + 종료 — 45 :3501-3508 동형).
      playListenStop();
      try {
        recognitionRef.current?.stop();
      } catch {}
      setListening(false);
      setInterim("");
      setVoiceGhost(null);
      return;
    }
    // 탭 시점 재판정 — 불능이면 안내 + 패널 폴백(45 :3509-3514 동형).
    if (!canUseSpeechRecognition() || !recognitionRef.current) {
      showVoiceGhost(VOICE_UNSUPPORTED_NOTICE);
      setLingoOpen(true); // 시트 폴백(글 입력).
      return;
    }
    // 낭독 중 탭 = 끊고 즉시 청취(45 :3517 stopSpeaking 동형).
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    playListenStart(); // 띠딩(청취 시작음 — 45 :3520).
    setInterim("");
    try {
      recognitionRef.current.start();
      setListening(true);
      showVoiceGhost("듣고 있어요 — 말씀하세요"); // 텍스트 안내만(45 :3524 동형).
    } catch {
      // 중복 start 등 — 상태만 정합.
      setListening(true);
    }
  }

  // L2 — 구 toggleListening 폐기: 시트 내 마이크도 handleOrbTap(L1 시퀀스) 단일 경로.

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
        // F2③ — content 동반 장착은 content 가 현재 모드 덱에 있을 때만(커머스 유령 블록 장착 방지).
        const canEquipContent = DECK_IDS[modeRef.current].includes("content");
        switch (a.field) {
          case "title":
            setCfgTitle(v);
            if (canEquipContent && !applied["content"]) equip(blockById("content"));
            break;
          case "subtitle":
            setCfgSubtitle(v);
            if (canEquipContent && !applied["content"]) equip(blockById("content"));
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
          // E5d — "coupon" 케이스 제거: 실쿠폰 UUID 는 AI 대리 선택 금지(AI_BLOCKED_FIELDS 가 1차 차단,
          //   여기 도달 시 default 무적용·무기록이 2차 방어).
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
            setCfgPhone(v === "true" || v === "on");
            break;
          case "map":
            setCfgMap(v === "true" || v === "on");
            break;
          // L4(A2) — 커머스 카피: 상품 한마디(headline) → 폼·카드 부제 폴백 동시 반영.
          case "headline":
            setCfgProduct((p) => ({ ...p, headline: v }));
            break;
          // F2③ — Edge 방출 필드(FIX-48+50) 실배선: 원산지·수량 → 상품등록 폼 값(적용 사실화).
          case "origin":
            setCfgProduct((p) => ({ ...p, origin: v }));
            break;
          case "stockQty":
            setCfgProduct((p) => ({ ...p, quantity: v.replace(/[^0-9]/g, "") }));
            break;
          default:
            return; // F2③ — 미배선 필드(gbTarget* 등) = 무적용·무기록(요약 "채워진 척" 금지).
        }
        appliedActionsRef.current.push(a); // T1j — 적용 로그(요약).
        touch([a.field, ...(FIELD_TO_BLOCK[a.field] ? [FIELD_TO_BLOCK[a.field]] : [])]); // T1j — 필드+블록 손길 기록.
      }
    }
  }

  // 링고AI가 손가락으로 카드를 가리키며 단계별로 조립하는 연출을 재생
  // UI-5-T4-D2 — 졸업제: 1~2회차 = 풀 연출 / 3회차부터(또는 연속 스킵 2회) = 축약(딤·연출 생략,
  //   즉시 일괄 적용 + 요약만 — 마킹·배지·릴레이·재검증 동일 = 데이터 무손실, 극장만 졸업).
  //   opts.forceFull = 재관람("연출 다시 보기") — 회차 무관 풀 1회 · 카운트 미증가(replayingRef).
  function runAssembly(
    actions: any[],
    steps: { label: string; note: string; anchor?: string }[],
    opts?: { forceFull?: boolean },
  ) {
    // 이전 연출 타이머 정리
    assembleTimers.current.forEach(clearTimeout);
    assembleTimers.current = [];

    setLingoOpen(false); // 패널을 닫아 카드+연출이 온전히 보이게
    // T1m — 연출 시작 시 영상 관문 도우미(guide) 정리(장착 후 재요청으로 진입한 경우).
    setHelperTarget(null);
    setHelperCopyKey(null);
    // D2 — 졸업 판정(스킵 신호 포함) + do 졸업(1회 수행 성공 후 생략).
    const tut = readTutSeen();
    const forceFull = opts?.forceFull === true;
    replayingRef.current = forceFull;
    const abbreviated = !forceFull && (tut.assembleCount >= 2 || tut.skipStreak >= 2);
    const includeDo = forceFull || tut.doneCount < 1;
    // D2(3) — 재관람 재료 보관(watch 원본 — do 편입 전).
    lastAssemblyRef.current = { actions, steps };
    setHasAssemblyHistory(true);
    awaitingDoRef.current = false;
    setAssembleFeedback(null);
    if (!abbreviated) {
      // UI-5-T4-D1(4) — 마지막에 do 스텝 1개 시범 편입(관람 → 수행 튜토리얼 골격 · D3 온보딩 예정).
      //   대상 = 미리보기(거울 열기) 버튼 — 발행 버튼 아님(헌장 ⑨ — 발행 유도 연출 금지).
      //   D2 — do 졸업(doneCount ≥ 1) 시 watch 스텝만.
      setAssembleSteps(
        includeDo
          ? [
              ...steps,
              {
                label: "완성했어요! 이제 미리보기를 눌러 확인해 보세요",
                note: "이번엔 대표님 차례예요 — 화살표가 가리키는 버튼을 직접 눌러 보세요.",
                anchor: "mirror",
                kind: "do" as const,
              },
            ]
          : steps,
      );
      setAssembleStep(0);
      setAssembling(true);
    }
    // UI-5-T1j(2A) — 연출 시작 전 스냅샷 1회 저장(전체 되돌리기용) + 적용 액션 로그 초기화.
    assembleSnapshot.current = {
      applied: { ...applied },
      cfgTitle,
      cfgSubtitle,
      cfgClip,
      selectedCouponId, // E5d — 실쿠폰 UUID 스냅샷(구 cfgCoupon 폐기).
      cfgProductName,
      cfgProductPrice,
      cfgDock,
      cfgDate,
      cfgTime,
      cfgDates: [...cfgDates],
      cfgTimes: [...cfgTimes],
      cfgPhone,
      cfgMap,
      productKind, // E5g — 유형·ISO 날짜 스냅샷(구 인덱스 폐기).
      saleStartIso,
      saleEndIso,
      // E5g2 — 기간(범위) 스냅샷(구 단일 키 폐기).
      harvestStartIso,
      harvestEndIso,
      produceStartIso,
      produceEndIso,
      shipStartIso,
      shipEndIso,
      selectedVideo, // T1n — 영상 선택도 스냅샷(전체 되돌리기 정합).
      currentStep, // T2-E2a(5) — 스텝 진행도 스냅샷.
      completedSteps: new Set(completedSteps),
      aiLane, // E2b — 되돌리기 시 잠금 완화 상태도 원복(B1 자동 ✓와 정합).
      lingoTouched: new Set(lingoTouched),
      stepPlan: [...stepPlanState], // E3e — 추가 스텝 포함 플랜 스냅샷(되돌리기 정합).
    };
    appliedActionsRef.current = [];
    // D2(2) — 축약 모드: 딤·스포트라이트·타이머 생략, 동일 applyOneLingoAction 경로로 즉시 일괄 적용
    //   (touch ✦ 배지·appliedActionsRef 마킹 무손실) → finishAssembly(요약·릴레이·재검증 동일) 직행.
    if (abbreviated) {
      for (const a of actions) applyOneLingoAction(a);
      setBurstKey((k) => k + 1);
      finishAssembly();
      return;
    }
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

    // UI-5-T4-D1(4) — 마지막 = do 스텝 진입(관람 → 수행): 자동 마무리 타이머 대신 수행 감지 대기.
    //   do 대상 = "수신자 화면 미리보기" 버튼(anchor="mirror") — 발행 CTA·발행 실행 버튼 아님(헌장 ⑨).
    //   D2 — do 졸업(includeDo=false) 시 기존 마무리 직행.
    const enterDo = setTimeout(() => {
      if (!includeDo) {
        finishAssembly();
        return;
      }
      setAssembleStep(n); // allSteps[n] = do 스텝(runAssembly 진입부에서 편입).
      awaitingDoRef.current = true; // 감지 effect(mirrorOpen)가 마무리를 이어받음. 스킵은 상시 가능.
    }, n * STEP_MS + 800); // 마지막 watch 스텝 후 0.8s 여운.
    assembleTimers.current.push(enterDo);
  }

  // UI-5-T4-D1 — 연출 마무리(구 done 타이머 본문 추출 — do 수행/스킵 양 경로 공용).
  function finishAssembly() {
    awaitingDoRef.current = false;
    // D2(1) — 정상 완주 +1(스킵 제외 — skipAssembly 는 이 함수 미경유) · 연속 스킵 리셋. 재관람 = 미증가.
    if (!replayingRef.current) {
      writeTutSeen({ assembleCount: readTutSeen().assembleCount + 1, skipStreak: 0 });
    }
    replayingRef.current = false;
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
    const doneLine = `조립 완료 — ${filled.join("·") || "구성"} 채움${need.length ? `, ${need.join("·")} 확인 필요` : ""}.`;
    setMessages((m) => [...m, { role: "assistant", text: doneLine }]);
    // L3(예절 2) — 연출 스텝 문구 낭독 0(텍스트+효과음만) · 완료 요약 1줄만 음성 유래 세션이면 낭독.
    //   speakerOn 게이트는 speak 내부(speakerOnRef — 타이머 지연 대비 라이브). 후속 행동 없음 = 락 해당 없음.
    if (lingoChannelRef.current === "voice") speak(doneLine);
    setAiSyncPending((n2) => n2 + 1); // E2b(B1) — 조립 종료(액션 커밋 후) → 실충족 재검증 동기화(스텝 자동 ✓).
  }
  // UI-5-T4-D2(3) — 재관람: 회차 무관 풀 연출 1회 · 카운트 미증가(forceFull → replayingRef).
  function replayAssembly() {
    const last = lastAssemblyRef.current;
    if (!last || assembling) return;
    runAssembly(last.actions, last.steps, { forceFull: true }); // 진입부가 시트 자동 닫기(setLingoOpen(false)).
  }
  // D1(2) — 수행 감지: do 대상(미리보기 버튼)의 "실 onClick"이 낸 기존 완료 신호(mirrorOpen) 관찰 —
  //   가짜 시뮬레이션 0. 감지 → "잘하셨어요!" 0.8s → 마무리(요약). 스킵/리셋은 awaitingDoRef 해제.
  useEffect(() => {
    if (!assembling || !awaitingDoRef.current || !mirrorOpen) return;
    awaitingDoRef.current = false;
    // D2 — do 수행 성공 +1(재관람 제외) → 이후 연출에서 do 스텝 졸업.
    if (!replayingRef.current) writeTutSeen({ doneCount: readTutSeen().doneCount + 1 });
    setAssembleFeedback("잘하셨어요!");
    const t = setTimeout(() => {
      setAssembleFeedback(null);
      finishAssembly();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrorOpen, assembling]);

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
            // E5g — 판매기간 요약 라벨에 유형 캘린더 명칭 반영(제철·생산·판매).
            label: isClip ? "핵심구간" : isImage ? "매장 사진" : b.id === "seasonal" ? PRODUCT_KIND_META[productKind].calendar : b.label,
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
      if (s.selectedCouponId !== undefined) setSelectedCouponId(s.selectedCouponId); // E5d — 실쿠폰 복원.
      setCfgProductName(s.cfgProductName);
      setCfgProductPrice(s.cfgProductPrice);
      setCfgDock(s.cfgDock);
      setCfgDate(s.cfgDate);
      setCfgTime(s.cfgTime);
      setCfgDates(s.cfgDates);
      setCfgTimes(s.cfgTimes);
      setCfgPhone(s.cfgPhone);
      setCfgMap(s.cfgMap);
      if (s.productKind) setProductKind(s.productKind); // E5g — 유형·ISO 날짜 복원.
      if (typeof s.saleStartIso === "string") setSaleStartIso(s.saleStartIso);
      if (typeof s.saleEndIso === "string") setSaleEndIso(s.saleEndIso);
      // E5g2 — 기간(범위) 복원.
      if (typeof s.harvestStartIso === "string") setHarvestStartIso(s.harvestStartIso);
      if (typeof s.harvestEndIso === "string") setHarvestEndIso(s.harvestEndIso);
      if (typeof s.produceStartIso === "string") setProduceStartIso(s.produceStartIso);
      if (typeof s.produceEndIso === "string") setProduceEndIso(s.produceEndIso);
      if (typeof s.shipStartIso === "string") setShipStartIso(s.shipStartIso);
      if (typeof s.shipEndIso === "string") setShipEndIso(s.shipEndIso);
      setSelectedVideo(s.selectedVideo ?? null); // T1n — 영상 선택 복원.
      if (typeof s.currentStep === "number") setCurrentStep(s.currentStep); // T2-E2a — 스텝 진행 복원.
      if (s.completedSteps) setCompletedSteps(new Set(s.completedSteps));
      if (s.stepPlan) {
        setStepPlanState(s.stepPlan); // E3e — 추가 스텝 포함 플랜 복원.
        stepPlanRef.current = s.stepPlan;
      }
      setAiLane(!!s.aiLane); // E2b — 잠금 완화 상태 원복(B1 자동 ✓ 되돌림과 정합).
      setStepChip(null);
      setLingoTouched(s.lingoTouched);
    }
    setAssembleSummary(null);
  }
  function confirmAssembly() {
    setAssembleSummary(null);
    suggestNextUnsettled(); // E2b(B2) — [좋아요, 확인] 종료 → 첫 미확정 스텝 이동 "제안"(칩 — 강제 점프 아님).
  }

  // UI-5-T1k(B1)·T1m — 칩 탭/관문 → 딤 종료 → 해당 블록 이동 + 스포트라이트 1회 깜빡 + 도우미 말풍선(guide).
  //   copyKey = 안내 문구 오버라이드(예: 영상 관문 "video"). 미지정 시 블록 기본 안내.
  // UI-5-T2-E4c — 손 우선: 링고가 칸 조작을 유도하는 순간 패널을 비워 뒤 화면을 손에 넘긴다.
  //   도우미 말풍선(칸 부착형·helper)이 안내를 이어받음. 양보로 닫혔을 때만 재소환 말풍선 1회.
  function yieldToHand() {
    if (!lingoOpen) return;
    setLingoOpen(false);
    if (yieldBubbleShownRef.current) return;
    yieldBubbleShownRef.current = true;
    setYieldBubble(true);
    if (yieldBubbleTimer.current) clearTimeout(yieldBubbleTimer.current);
    yieldBubbleTimer.current = setTimeout(() => setYieldBubble(false), 3000);
  }
  function onEditField(blockId: string, copyKey?: string) {
    yieldToHand(); // E4c — 칸 이동(=화면 조작 요구) 진입 = 자동 양보. enterStep/insertStep/칩/관문 전부 포섭.
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
    setVideoShowCount(12); // E1b — 새 검색마다 노출 상한 초기화.
    setPendingVideo(null); // E5c(A) — 새 검색 = 이전 선택 대기 해제(stale 확정 방지).
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
      // E1b — provider 확장: youtube + naver_blog(Duke 요청). discover 반환 순서 존중(재정렬 없음).
      const cands = res.ok
        ? (json.candidates ?? []).filter((c) => c.provider === "youtube" || c.provider === "naver_blog")
        : [];
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
    // D3b — 영상 교체 = 포인트 픽·후보·제안 초기화(45 :2100 setPickedPoints([]) 동형).
    setPickedPoints([]);
    setAiKeyPoints([]);
    setAiSummaryLead(null);
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
      // UI-5-T4-D3b — 응답 소비 개시(F2③b "버려지던 응답"): ai_key_points = 후보 칩 · ai_summary = 한마디 제안.
      //   45 :2108-2126 동형(영상 교체 레이스 가드 = videoLeadRef). 자동 주입 0 — 전부 채택 탭 대기.
      const sumRes = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
      const sumJson = (await sumRes.json()) as { ai_summary?: unknown; ai_key_points?: unknown };
      if (!sumRes.ok || videoLeadRef.current !== slot.videoId) return;
      const points = Array.isArray(sumJson?.ai_key_points)
        ? (sumJson.ai_key_points as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [];
      setAiKeyPoints(points);
      if (typeof sumJson.ai_summary === "string" && sumJson.ai_summary.trim()) {
        setAiSummaryLead(sumJson.ai_summary.trim());
      }
    } catch {
      /* 요약 리드 실패는 조용히 — 섹션 미노출(빈 껍데기 금지) · 영상 선택 자체는 이미 반영됨. */
    }
  }
  // 링크 직접 붙여넣기 — URL 감지 시 oembed 후보 1건 → E5c(A3) 2단: 미리보기 행 + [확정](즉시 장착 폐지).
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
      setPendingVideo({
        provider: "youtube",
        source_url: vUrl,
        source_id: id,
        canonical_url: vUrl,
        title: meta.title ?? null,
        thumbnail_url: meta.thumbnail_url ?? null,
        author_name: meta.author_name ?? null,
        duration_sec: meta.duration_sec ?? null,
        raw_meta: {},
      }); // A3 — 검색 경로와 동일 2단 문법(확정 버튼 공용).
    } catch {
      setVideoError("지금 검색이 잘 안돼요 — 링크를 직접 붙여넣어 주세요.");
      focusVideoLink();
    }
  }
  // UI-5-T2-E5c(B2·B3) — 구간 확정(blur/Enter): 45 applyClip(:1613–1638) 검증 계승 — 끝>시작 ·
  //   영상 길이(durationLabel) 초과 차단. 통과 시 cfgClip = "시작~끝"(45 :1632 라벨 포맷 동일) →
  //   어댑터 model.clip 즉시 반영 + confirmHelper("content") = ✓·배지 소멸·릴레이/견인.
  //   반쪽 입력(한 칸 비움) = 조용히 대기(시작→끝 이동 blur 에 성급한 에러 금지).
  function commitClip() {
    const sRaw = clipStartDraft.trim();
    const eRaw = clipEndDraft.trim();
    if (!sRaw || !eRaw) return;
    const s = parseClock(sRaw);
    const e = parseClock(eRaw);
    if (s == null || e == null) {
      setClipError("시간은 0:12 형식(분:초)이나 초 숫자로 적어 주세요.");
      return;
    }
    if (e <= s) {
      setClipError("끝 시점은 시작보다 뒤여야 해요."); // 45 :1622 계승.
      return;
    }
    const durSec = selectedVideo?.durationLabel ? parseClock(selectedVideo.durationLabel) : null;
    if (durSec != null && (s > durSec || e > durSec)) {
      setClipError(`영상 길이(${selectedVideo!.durationLabel}) 안에서 골라 주세요.`); // 45 :1626 계승.
      return;
    }
    setClipError(null);
    setCfgClip(`${formatDuration(s)}~${formatDuration(e)}`); // 45 :1632 — model.clip 주입 경로 재사용.
    confirmHelper("content"); // B3 — 유효 구간 확정 = 도우미 ✓(needsConfirm 해소)·견인 연동.
  }

  function skipAssembly() {
    assembleTimers.current.forEach(clearTimeout);
    assembleTimers.current = [];
    awaitingDoRef.current = false; // D1 — do 대기도 스킵으로 해제(건너뛰기 상시).
    // D2(4) — 연속 스킵 신호 +1(2회 연속 = 다음부터 축약 — 원치 않는다는 신호 존중). 재관람 스킵 = 미기록.
    if (!replayingRef.current) writeTutSeen({ skipStreak: readTutSeen().skipStreak + 1 });
    replayingRef.current = false;
    setAssembleFeedback(null);
    setAssembling(false);
    const sum = buildAssembleSummary(); // 중단 = 적용된 데까지만 요약.
    setAssembleSummary(sum);
    setPendingConfirm(
      sum.items
        .filter((i) => i.needsConfirm)
        .map((i) => i.id)
        .sort((a, b) => planOrder(a) - planOrder(b)), // T2-E2a(8c) — 릴레이 큐 = STEP_PLAN 순서.
    );
    setAiSyncPending((n) => n + 1); // E2b(B1) — 중단도 적용된 데까지 재검증 동기화.
  }

  // UI-5-T2-E2a — 스텝 완료 조건(블록별 확정 신호). review = 항상 완료(훑어보기).
  function isStepDone(idx: number): boolean {
    const s = stepPlanState[idx]; // E3e — 런타임 플랜(추가 스텝 포함) 기준.
    if (!s) return false;
    switch (s.key) {
      case "video":
        return !!selectedVideo;
      case "photo":
        return !!productImageUrl; // E5a — 실 사진 URL 기준(가짜 불리언 폐기).
      case "title":
        return cfgTitle.trim().length > 0 || cfgProductName.trim().length > 0;
      case "clip":
        return cfgClip.trim().length > 0;
      case "price":
        return cfgProductPrice.trim().length > 0;
      case "coupon":
        return !!applied["coupon"] && !!selectedCouponId; // E5d — 실쿠폰 선택까지 완료(45 :1230 동형).
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
    setGreetingChipsOpen(false); // E4f — 스텝 진입 = 인사 칩 소멸(칩 탭·대화 시작과 함께 소멸 3조건).
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
    // E2b(B4) — AI 레인 한정 완화: AI 재검증(B1)으로 completedSteps에 오른 미래 스텝 = 완료 스텝 재방문(잠금 아님).
    //   수동 레인(aiLane=false) = 기존 순차 잠금 그대로(B5). review는 B1 제외 대상이라 이 완화로 못 간다.
    const aiUnlocked = aiLane && completedSteps.has(idx);
    if (idx > currentStep && !completedSteps.has(currentStep) && !isStepDone(currentStep) && !aiUnlocked) {
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
  // UI-5-T2-E2b — 칩 라벨: 다음이 확인(review)이면 [확인하러 가기](마지막 실스텝 완료·전 스텝 충족 B3 공용).
  function stepChipLabel(target: number): string {
    const s = stepPlanState[target];
    if (!s) return "다음";
    return s.key === "review" ? "확인하러 가기" : `다음: ${s.label}`;
  }
  // UI-5-T2-E2b(B2·B3) — 첫 미확정 스텝 탐색(needsConfirm 잔존=pendingConfirm 큐 또는 isStepDone false)
  //   → 이동 "제안" 칩만 세움(강제 점프 아님 — enterStep은 칩 탭에서만). 순서 = 런타임 플랜 순(planOrder와 동일 기준).
  //   전 스텝 충족 시 = 확인(review) 직행 제안.
  function suggestNextUnsettled() {
    const plan = stepPlanRef.current;
    let target = -1;
    for (let i = 0; i < plan.length; i++) {
      const s = plan[i];
      if (s.key === "review") continue;
      if ((s.block && pendingConfirm.includes(s.block)) || !isStepDone(i)) {
        target = i;
        break;
      }
    }
    if (target < 0) target = plan.findIndex((s) => s.key === "review");
    if (target >= 0) setStepChip({ kind: "ai", target });
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
  // UI-5-T2-E4f(3) — 라벨·가이드 첫 구 중복 1회화: 가이드가 1스텝 라벨로 시작하면
  //   "먼저 {라벨}부터 {가이드 잔여}"로 합성(조사 을/를 등 제거) — "상품 사진부터 — 상품 사진을 …" 겹침 해소.
  function introLead(m: StudioMode): string {
    const s0 = STEP_PLAN[m][0];
    const g = firstStepGuide(m);
    if (g.startsWith(s0.label)) {
      const rest = g.slice(s0.label.length).replace(/^[을를이가은는]\s*/, "").trimStart();
      return `먼저 ${s0.label}부터 ${rest}`;
    }
    return `먼저 ${s0.label}부터 — ${g}`;
  }
  // UI-5-T2-E4b — 행동 지시형 인사(1화면 1행동). 단계 나열·"더 넣고 싶으면" 폐지 —
  //   진행 지도(스텝 헤더)·확인 스텝 제안(E3e)이 각각 대체(정보 중복 금지). 총 2문장 이내.
  function stepPlanIntro(m: StudioMode): string {
    return `${MODE_NAME[m]} 카드를 만들어요. ${introLead(m)}`;
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
      saleStart: labelOfIso(saleStartIso),
      saleEnd: labelOfIso(saleEndIso),
      coupon: selectedCoupon?.title ?? "", // E5d — Edge 컨텍스트 = 실쿠폰 제목(빈 값 = 미선택).
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
  //   L3 — 반환 = 조립 연출 진입 여부(true = runAssembly 실행 → 응답 낭독 생략·완료 요약만 낭독 예절).
  function dispatchProposal(rawActions: any[], rawSteps: { label: string; note?: string }[]): boolean {
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
    // 관문은 클라 선처리(T1m·T1n). 미디어 = general/reserve 영상(selectedVideo) · commerce 상품 사진(productImageUrl).
    const mediaReady = m === "commerce" ? !!productImageUrl : !!selectedVideo;
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
      return false;
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
      return true; // L3 — 조립 진입(응답 낭독 생략 신호).
    } else {
      applyLingoActions(okActions); // 단순 편집 즉시 적용.
      if (okActions.length) setAiSyncPending((n) => n + 1); // E2b(B1) — 즉시 적용도 커밋 후 재검증 동기화.
    }
    return false;
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
          input_channel: lingoChannelRef.current, // L3 — 실채널(음성/텍스트) 전달(구 "text" 고정 교정).
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
      // ── 응답 처리 정합(T-1 방어벽 실전 가동): proposal 디스패치(가드 → 관문 → 연출/적용). ──
      const assembled = dispatchProposal(proposalActions, proposalSteps);
      // UI-5-T3-L3 — 채널 분기 낭독: 음성 질문 + 스피커 ON 에만(텍스트 질문 = 낭독 0 — 읽는 중).
      //   조립 연출 진입 시 응답 낭독 생략(예절 — 연출 템포 유지 · 완료 요약 1줄만 done 타이머에서 낭독).
      //   낭독 뒤 후속(재청취 힌트 고스트) = speakThenProceed 경유(Chrome onend 유실 3s 타임아웃 가드 — 45 락).
      //   conv 자동 재청취는 post-pilot 락 — 힌트 텍스트 1회(3s)만.
      if (!assembled && acc && lingoChannelRef.current === "voice" && speakerOn) {
        speakThenProceed({
          speak,
          stopSpeaking: () => window.speechSynthesis?.cancel(),
          text: acc,
          proceed: () => {
            if (!listeningRef.current) showVoiceGhost("이어서 말씀하려면 저를 탭하세요", 3000);
          },
        });
      }
    } catch {
      setBot("링고가 잠깐 딴생각했어요 — 다시 말씀해 주세요."); // 무언 실패 금지 · 재시도 가능.
    } finally {
      setThinking(false);
    }
  }

  // E3c — 매 렌더 최신 sendToLingo를 ref에 게시(음성 onresult가 이 최신본을 호출).
  sendToLingoRef.current = sendToLingo;

  // UI-5-T2-E5f — 내 파트너 id 1회 조회(45 loader store?.id 대응 — 비커머스 body partner_id 격차 해소).
  async function fetchMyPartnerId(): Promise<string | null> {
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return null;
      const { data } = await supabase.from("partners").select("id").eq("owner_user_id", uid).maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    } catch {
      return null;
    }
  }
  // UI-5-T2-E4·E5f — 발행 실행(2단 수동의 2단째). 45 handlePublish(:2251-2482) 3모드 완전 계승.
  //   호출처 = 거울 시트 [발행하기] 버튼뿐(자동/링고/연출/타이머 유래 0 — 헌장 ⑨). 이중 탭 = saving 가드.
  async function doPublish(): Promise<boolean> {
    // E5f — 커머스 게이트 해제: 필수 = 사진·상품명·가격·판매기간(45 :2256-2270 3종 + 기간). 미충족 사유 1줄.
    if (mode === "commerce") {
      const priceNum = Number(cfgProductPrice.replace(/[^0-9]/g, "")) || 0;
      if (!productImageUrl) {
        setSaveError("상품 사진을 올려 주세요.");
        return false;
      }
      if (!cfgProductName.trim()) {
        setSaveError("상품 이름을 입력해 주세요.");
        return false;
      }
      if (priceNum <= 0) {
        setSaveError("가격을 입력해 주세요.");
        return false;
      }
      if (!(applied["seasonal"] && saleStartIso && saleEndIso)) {
        setSaveError("판매 기간을 정해 주세요.");
        return false;
      }
    } else if (!selectedVideo) {
      // 검증(45 :2252 계승 — 비커머스는 영상 필수).
      setSaveError("영상을 먼저 담아 주세요");
      return false;
    }
    if (saving) return false; // 이중 탭 방지(45 :2271).
    setSaving(true);
    setSaveError(null);
    try {
      const isPublic = visibility === "public";
      const hasCoupon = !!applied["coupon"] && !!selectedCouponId; // E5d — 실쿠폰 UUID.
      // 제목 WYSIWYG(45 resolvedCardTitle FIX-57) — 어댑터 titleText 와 동일 산출(미리보기=발행 동일값).
      const resolvedCardTitle =
        cfgTitle.trim() || (applied["product"] && cfgProductName.trim() ? cfgProductName.trim() : "") || content.title;
      let dropId: string | null;
      let publishedShareUuid: string;
      let shareableUrl: string | null;
      let reusedCommerce = false;
      if (mode === "commerce") {
        // E5f — 45 :2350-2377 동형: E5b 등록/재사용 드롭이 있으면 재사용(이중 생성 방지 P6-6), 없으면 self_upload 신규.
        if (registeredProduct?.dropId) {
          reusedCommerce = true;
          dropId = registeredProduct.dropId;
          publishedShareUuid = registeredProduct.shareUuid;
          shareableUrl = null;
        } else {
          const priceNum = Number(cfgProductPrice.replace(/[^0-9]/g, "")) || 0;
          const points = cfgProduct.sellingPoints.map((s) => s.trim()).filter(Boolean).slice(0, 5);
          const body = {
            self_upload: true,
            image_url: productImageUrl, // E5a — 실 사진 단일 소스.
            name: cfgProductName.trim(),
            price_krw: priceNum,
            headline: cfgProduct.headline.trim(),
            selling_points: points,
            price_band_enabled: false, // §0 시세 영구 금지.
            is_public: isPublic,
            blocks: [
              { block_kind: "product", block_data: { name: cfgProductName.trim(), price_krw: priceNum }, position: 0 },
              // FIX-57 계승 — 제목 WYSIWYG 동봉(커머스 직발행 경로 · 45 :2333-2340 동형).
              ...(resolvedCardTitle
                ? [{ block_kind: "text", block_data: { custom_title: resolvedCardTitle }, position: 1 }]
                : []),
            ],
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
          dropId = json.drop.id ?? null;
          publishedShareUuid = json.drop.share_uuid;
          shareableUrl = json.shareable_url ?? null;
        }
      } else {
        // 비커머스(45 :2342-2349 동형) — E5f: clip 확정·custom_title 블록 + 실 partner_id 로 완전 동일 격상.
        const mediaUrl = `https://www.youtube.com/watch?v=${selectedVideo!.videoId}`;
        const hasReservation = !!applied["calendar"];
        const dropPurpose = hasReservation ? "예약" : hasCoupon ? "쿠폰" : "정보"; // 45 :2276-2278.
        // E5c 확정 구간("a~b") → 45 clipBlocks(:2296-2310) 동형 초 단위 산출(반쪽·무효 = 미동봉).
        const clipSecs = (() => {
          if (!cfgClip.includes("~")) return null;
          const [a, b] = cfgClip.split("~");
          const s = parseClock(a?.trim() ?? "");
          const e = parseClock(b?.trim() ?? "");
          return s != null && e != null && e > s ? { s, e } : null;
        })();
        const extraBlocks = [
          ...(clipSecs
            ? [
                {
                  block_kind: "video",
                  block_data: { video_id: selectedVideo!.videoId, title: selectedVideo!.title },
                  video_start_seconds: clipSecs.s,
                  video_end_seconds: clipSecs.e,
                },
              ]
            : []),
          // FIX-57 계승 — 제목 WYSIWYG(45 :2315-2319 동형 · 실값 있을 때만).
          ...(resolvedCardTitle ? [{ block_kind: "text", block_data: { custom_title: resolvedCardTitle } }] : []),
        ].map((b, i) => ({ ...b, position: i }));
        const body = {
          media_url: mediaUrl,
          purpose: dropPurpose,
          curator_message: cfgSubtitle.trim() || null,
          is_public: isPublic, // 신규 생성 경로 = body 로 실림(45 :2346).
          partner_id: await fetchMyPartnerId(), // E5f — 45 store?.id ?? null 동형(실 파트너 조회).
          ...(extraBlocks.length > 0 ? { blocks: extraBlocks } : {}),
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
        dropId = json.drop.id ?? null;
        publishedShareUuid = json.drop.share_uuid;
        shareableUrl = json.shareable_url ?? null;
      }
      const supabase = getSupabase();
      // E5f — BUG-1(S1-b) 최종 방어(45 :2380-2411 동형): 재사용 드롭은 is_public=false 로 생성됐고
      //   재사용 분기는 /api/drops 미호출 → 발행바 토글·발행시각을 best-effort 반영(실패해도 발행 유지).
      if (reusedCommerce && dropId) {
        try {
          const { error: pubErr } = await supabase.from("info_drops").update({ is_public: isPublic }).eq("id", dropId);
          if (pubErr) console.warn("[studio49] 공개 토글 반영 실패:", pubErr.message);
        } catch (e) {
          console.warn("[studio49] is_public update exception:", e);
        }
        try {
          const { error: pubAtErr } = await supabase
            .from("info_drops")
            .update({ published_at: new Date().toISOString() })
            .eq("id", dropId)
            .is("published_at", null); // 기존 값 보존(45 :2398-2406).
          if (pubAtErr) console.warn("[studio49] published_at 기록 실패:", pubAtErr.message);
        } catch (e) {
          console.warn("[studio49] published_at update exception:", e);
        }
      }
      // E5d — 쿠폰 귀속(45 :2412-2423 동형 · 모드 공통): best-effort.
      if (dropId && hasCoupon) {
        try {
          const { error: couponErr } = (await supabase.rpc(
            "set_drop_funnel_coupon" as never,
            { p_drop_id: dropId, p_coupon_id: selectedCouponId } as never,
          )) as { error: { message?: string } | null };
          if (couponErr) console.warn("[studio49] 쿠폰 연결 실패:", couponErr.message);
        } catch (e) {
          console.warn("[studio49] set_drop_funnel_coupon exception:", e);
        }
      }
      // E5e — 셀링포인트 영속화(45 :2425-2434 동형 · 비커머스만): best-effort.
      if (mode !== "commerce") {
        const points = cleanKeyPoints();
        if (dropId && points.length > 0) {
          try {
            const { error: kpErr } = (await supabase.rpc(
              "update_drop_key_points" as never,
              { p_drop_id: dropId, p_points: points } as never,
            )) as { error: { message?: string } | null };
            if (kpErr) console.warn("[studio49] 셀링포인트 저장 실패:", kpErr.message);
          } catch (e) {
            console.warn("[studio49] update_drop_key_points exception:", e);
          }
        }
      }
      // E5f — 판매기간 영속화(45 ST2b-3 :2440-2455 동형 · 커머스만): update_drop p_block_patch {sale_start, sale_end}.
      if (mode === "commerce" && applied["seasonal"] && saleStartIso && saleEndIso) {
        try {
          const { error: spanErr } = (await supabase.rpc(
            "update_drop" as never,
            {
              p_share_uuid: publishedShareUuid,
              p_curator_message: null,
              p_curator_note: null,
              p_block_patch: { sale_start: saleStartIso, sale_end: saleEndIso },
            } as never,
          )) as { error: { message?: string } | null };
          if (spanErr) console.warn("[studio49] 판매기간 저장 실패:", spanErr.message);
        } catch (e) {
          console.warn("[studio49] update_drop(p_block_patch) exception:", e);
        }
      }
      // (45 :2456-2468 카드색 = 49 E3d 색 기능 삭제 → 기본값 스킵 분기와 동형(호출 0) — 의도적 차이.)
      const origin = typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
      setSavedUrl(shareableUrl ?? `${origin}/d/${publishedShareUuid}`); // 45 :2470-2471 동형.
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

  // UI-5-T2-E4·E5f — 발행 게이트: 비커머스 = 영상+제목 / 커머스 = 사진·상품명·가격·판매기간(45 판정 계승).
  //   미충족 사유 1줄 — 게이트 해제(E5f): "준비 중" 문구 폐지.
  const hasTitleForPublish = cfgTitle.trim().length > 0 || cfgProductName.trim().length > 0;
  const commercePriceNum = Number(cfgProductPrice.replace(/[^0-9]/g, "")) || 0;
  const commerceSaleReady = !!applied["seasonal"] && !!saleStartIso && !!saleEndIso;
  const commerceReady =
    !!productImageUrl && cfgProductName.trim().length > 0 && commercePriceNum > 0 && commerceSaleReady;
  const canPublish = !dropped && (mode === "commerce" ? commerceReady : !!selectedVideo && hasTitleForPublish);
  const publishGateMsg =
    mode === "commerce"
      ? !productImageUrl
        ? "상품 사진을 올려 주세요"
        : !cfgProductName.trim()
          ? "상품 이름을 입력해 주세요"
          : commercePriceNum <= 0
            ? "가격을 입력해 주세요"
            : !commerceSaleReady
              ? "판매 기간을 정해 주세요"
              : null
      : !selectedVideo
        ? "영상을 먼저 담아 주세요"
        : !hasTitleForPublish
          ? "제목·한마디를 채워 주세요"
          : null;

  // UI-5-T3-L4(B5) — 막힘 감지(45 DRIVE-2e :1483-1515 동형 이식): 현재 스텝 90초 체류 + 무활동 =
  //   스텝(key)당 1회 제안 칩. 연출·청취·시트 열림·생각 중 = 발화 억제 · 활동 deps 변화 = 타이머 리셋.
  //   침묵 존중(45): 발화한 스텝은 재무장 없음 — [괜찮아요] 후 조용히 정상 흐름.
  //   B6 — gate 칩 통합: 확인(발행 직전) 스텝 막힘 = publishGateMsg(E5f 게이트 사유)를 그대로 사용
  //   (부족분 안내 단일 소스 — 중복 안내 금지).
  useEffect(() => {
    setStuckChip(null); // 스텝 전이·활동 재개 = 칩 소거(45 :1494 동형).
    const s = stepPlanState[currentStep];
    if (!s || dropped) return;
    if (stuckShownRef.current.has(s.key)) return;
    const t = setTimeout(() => {
      if (thinking || listening || assembling || assembleSummary || lingoOpen) return; // 정지 조건(45 :1498 확장).
      if (s.key !== "review" && isStepDone(currentStep)) return; // 완료 스텝 = 막힘 아님(확인 스텝은 게이트 기준).
      if (s.key === "review" && !publishGateMsg) return; // 발행 준비 완료 = 막힘 아님.
      stuckShownRef.current.add(s.key);
      setStuckChip({
        key: s.key,
        label: s.label,
        msg: s.key === "review" && publishGateMsg ? publishGateMsg : `${s.label}에서 막히셨어요?`,
      });
    }, STUCK_MS);
    return () => clearTimeout(t);
    // 활동 신호 = 리셋 deps(45 :1515 동형 + 49 신호: 입력값·사진·연출·시트).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, stepPlanState, messages.length, lingoText, deckIndex, mode, applied, dropped, thinking, listening, assembling, assembleSummary, lingoOpen, cfgTitle, cfgProductName, cfgProductPrice, productImageUrl, selectedVideo, cfgClip]);

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
    productImageUrl: productImagePreview ?? productImageUrl ?? undefined, // E5a — 실 사진 = 카드 얼굴(거울·미리보기 정본).
    // E5g2 — 신선 수확 기간 → 정본 수확·발송 칩(단일 날짜 전제)에 시작일 대표 매핑(장착+신선만 주입).
    harvestDate: applied["seasonal"] && productKind === "fresh" && harvestStartIso ? harvestStartIso : undefined,
    title: cfgTitle,
    subtitle: cfgSubtitle,
    clip: cfgClip,
    brand: cfgBrand,
    party: cfgParty,
    couponLabel: applied["coupon"] && selectedCoupon ? (selectedCoupon.title ?? null) : null, // E5d — 실쿠폰 제목(45 :62 동형).
    productName: cfgProductName,
    productPrice: cfgProductPrice,
    productHeadline: cfgProduct.headline,
    productPoints: cfgProduct.sellingPoints.map((p) => p.trim()).filter(Boolean),
    keyPoints: cleanKeyPoints(), // E5e — 비커머스 셀링포인트(정리분만 · 빈 배열 = 어댑터 미주입).
    productUnitLabel,
    facilities: cfgFacilities.map((f) => f.text.trim()).filter(Boolean),
    saleStart: labelOfIso(saleStartIso), // E5g — 정본 기간 표기(발행 라벨 포맷 불변 "M/D(요)").
    saleEnd: labelOfIso(saleEndIso),
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
        {/* E2b(A2) — 완료 에지마다 key 재마운트 → 펄스 1회(상주 애니메이션 금지). */}
        <style>{`@keyframes lingo-next-pulse{0%{box-shadow:0 0 0 0 rgba(29,78,216,0.6)}100%{box-shadow:0 0 0 10px rgba(29,78,216,0)}}`}</style>
        <button
          key={nextPulseKey}
          onClick={nextStep}
          disabled={!isStepDone(currentStep) || currentStep >= stepPlanState.length - 1}
          className="shrink-0 rounded-lg bg-[#16161D] px-2.5 py-1 text-[11px] font-bold text-white transition-transform active:scale-95 disabled:opacity-30"
          style={nextPulseKey > 0 ? { animation: "lingo-next-pulse 0.9s ease-out 1" } : undefined}
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
              feedback={assembleFeedback} /* D1 — 수행 마이크로 피드백(0.8s). */
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
              {/* UI-5-T1k(B2·3·4·5)·E4e — 미확정 칸 도우미 말풍선(값 자동입력 없음 · 안내만).
                  E4e — absolute 부착(-top-2 -translate-y-full z-20) 폐기 → 패널 안쪽 최상단 "흐름 배치".
                  오버레이는 주변 레이아웃을 모르므로 위 덱 카드와 겹침(간격 조정으론 재발 가능) — 흐름 참여가 근본 해결.
                  세로 스택: 말풍선 → (내부 done/relay/E2b 합류) 칩 → 폼 내용. 말꼬리 = 위 방향(칸 부착 느낌 유지). */}
              {helperTarget === activeBlock.id && (
                <div className="lingo-bubble-in mb-2">
                  <div className="relative rounded-2xl bg-white p-3 [box-shadow:0_16px_36px_-14px_rgba(15,23,42,0.4),0_0_0_1px_#E8E8EC]">
                    <span className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 bg-white [box-shadow:-2px_-2px_0_#E8E8EC]" aria-hidden="true" />
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                        ✦ 링고
                      </span>
                      <div className="min-w-0 flex-1">
                        {helperPhase === "guide" && (
                          <p className="text-[12px] font-semibold leading-relaxed text-[#16161D] [word-break:keep-all]">
                            {activeBlock.id === "seasonal"
                              ? SEASONAL_HELPER[productKind] /* E5g — 유형 분기(신선·가공·공산) */
                              : (HELPER_COPY[helperCopyKey ?? activeBlock.id] ?? HELPER_COPY[activeBlock.id] ?? "여기에서 값을 정해 주세요.")}
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
                            {/* E2b(A1) — 완료 칩 합류: 릴레이 큐가 없으면 스텝 [다음] 칩이 이어받음(중복 렌더 금지·자동 점프 없음). */}
                            {pendingConfirm.length === 0 && stepChip && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => {
                                    const t = stepChip;
                                    setStepChip(null);
                                    if (t.kind === "done") nextStep(); // A2 — 헤더 [다음]과 동일 경로.
                                    else enterStep(t.target); // B2 — 사용자 탭 = 이동 의사.
                                  }}
                                  className="inline-flex min-h-[36px] items-center rounded-full bg-[#16161D] px-3 text-[11px] font-bold text-white active:scale-95"
                                >
                                  {stepChipLabel(stepChip.target)}
                                </button>
                                <button
                                  onClick={() => setStepChip(null)}
                                  className="inline-flex min-h-[36px] items-center rounded-full border border-[#E8E8EC] bg-white px-3 text-[11px] font-bold text-[#525252] active:scale-95"
                                >
                                  여기 더 볼게요
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
                    // UI-5-T2-E5g — 상품 유형별 캘린더(제철·생산·판매). 전부 InlineDatePicker 단일 컴포넌트.
                    //   v0 날짜 칩 나열 폐기. 유형 전환 = 라벨·칸 구성만(날짜 상태 유지 — 파괴 리셋 금지).
                    <div className="space-y-3">
                      {/* 유형 칩 — [신선][가공][공산] */}
                      <div className="flex gap-1.5">
                        {(Object.keys(PRODUCT_KIND_META) as ProductKind[]).map((k) => {
                          const on = productKind === k;
                          return (
                            <button
                              key={k}
                              onClick={() => setProductKind(k)}
                              aria-pressed={on}
                              className="min-h-[44px] flex-1 rounded-xl text-[13px] font-bold transition-colors"
                              style={on ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: "#F4F4F5", color: "#525252" }}
                            >
                              {PRODUCT_KIND_META[k].chip}
                            </button>
                          );
                        })}
                      </div>

                      {/* 유형 캘린더 명칭 */}
                      <p className="text-[12px] font-bold text-[#0A0A0A] tracking-ko">
                        {PRODUCT_KIND_META[productKind].calendar}
                      </p>

                      {/* 판매기간(range) — 전 유형 공통 */}
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">판매기간</p>
                        <InlineDatePicker
                          mode="range"
                          startIso={saleStartIso || null}
                          endIso={saleEndIso || null}
                          onChange={(s, e) => {
                            setSaleStartIso(s);
                            setSaleEndIso(e ?? s);
                          }}
                          accent={accent}
                          summaryLabel="판매기간"
                        />
                      </div>

                      {/* E5g2 — 수확 기간(range) — 신선만. 45 판매기간(:4181–4191) 범위 문법 계승:
                          첫 탭=시작·둘째 탭=종료, 같은 날 재탭 = 시작=종료(하루 — 별도 모드 불필요). */}
                      {productKind === "fresh" && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">수확 기간</p>
                          <InlineDatePicker
                            mode="range"
                            startIso={harvestStartIso || null}
                            endIso={harvestEndIso || null}
                            onChange={(s, e) => {
                              setHarvestStartIso(s);
                              setHarvestEndIso(e ?? s);
                            }}
                            accent={accent}
                            summaryLabel="수확 기간"
                          />
                          {rangeLabel("수확", harvestStartIso, harvestEndIso) && (
                            <p className="mt-1 text-[11px] font-semibold tabular-nums text-[#525252]">
                              {rangeLabel("수확", harvestStartIso, harvestEndIso)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* E5g2 — 생산 기간(range) — 가공만. */}
                      {productKind === "processed" && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">생산 기간</p>
                          <InlineDatePicker
                            mode="range"
                            startIso={produceStartIso || null}
                            endIso={produceEndIso || null}
                            onChange={(s, e) => {
                              setProduceStartIso(s);
                              setProduceEndIso(e ?? s);
                            }}
                            accent={accent}
                            summaryLabel="생산 기간"
                          />
                          {rangeLabel("생산", produceStartIso, produceEndIso) && (
                            <p className="mt-1 text-[11px] font-semibold tabular-nums text-[#525252]">
                              {rangeLabel("생산", produceStartIso, produceEndIso)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* E5g2 — 발송 기간(range) — 전 유형 공통. */}
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">발송 기간</p>
                        <InlineDatePicker
                          mode="range"
                          startIso={shipStartIso || null}
                          endIso={shipEndIso || null}
                          onChange={(s, e) => {
                            setShipStartIso(s);
                            setShipEndIso(e ?? s);
                          }}
                          accent={accent}
                          summaryLabel="발송 기간"
                        />
                        {rangeLabel("발송", shipStartIso, shipEndIso) && (
                          <p className="mt-1 text-[11px] font-semibold tabular-nums text-[#525252]">
                            {rangeLabel("발송", shipStartIso, shipEndIso)}
                          </p>
                        )}
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
                  {/* UI-5-T2-E5d — 파트너 실쿠폰 목록(get_active_store_coupons · UUID 선택). 가짜 c1~c3 폐기.
                      선택 = 대표님 탭만(AI 대리 선택 차단). 로딩·실패·0건 전부 안내(무언 실패 금지). */}
                  {couponsLoading && (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-3 text-[12px] font-semibold text-[#8A8A8A]">
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                      쿠폰을 불러오는 중…
                    </div>
                  )}
                  {!couponsLoading && couponsError && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FEF2F2] px-3 py-2.5">
                      <span className="text-[12px] font-semibold text-[#DC2626] [word-break:keep-all]">{couponsError}</span>
                      <button
                        onClick={() => {
                          couponsLoadedRef.current = false;
                          void loadCoupons();
                        }}
                        className="shrink-0 text-[12px] font-bold"
                        style={{ color: accent }}
                      >
                        다시 시도
                      </button>
                    </div>
                  )}
                  {!couponsLoading && !couponsError && coupons.length === 0 && (
                    <div className="rounded-xl bg-[#F4F4F5] px-3 py-3 text-center">
                      <p className="text-[12px] font-medium text-[#8A8A8A] [word-break:keep-all]">
                        등록된 쿠폰이 없어요 — 파트너 페이지에서 만들 수 있어요
                      </p>
                      <a
                        href="/partner/coupons"
                        className="mt-1.5 inline-flex min-h-[36px] items-center rounded-full bg-white px-3 text-[11px] font-bold text-[#525252] [box-shadow:inset_0_0_0_1px_#E8E8EC]"
                      >
                        쿠폰 만들러 가기
                      </a>
                    </div>
                  )}
                  {!couponsLoading &&
                    coupons.map((c) => {
                      const on = selectedCouponId === c.id;
                      const sub =
                        c.coupon_type === "gift" && c.gift_item
                          ? `증정 · ${c.gift_item}`
                          : c.discount_value != null
                            ? `${c.discount_value.toLocaleString("ko-KR")}${c.discount_unit === "percent" ? "%" : "원"} 할인`
                            : null;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCouponId(c.id); // 실 UUID 보관 — 발행 시 set_drop_funnel_coupon 귀속.
                            confirmHelper("coupon"); // UI-5-T1k — 쿠폰 확정 = 도우미 완료.
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
                          style={
                            on
                              ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                              : { backgroundColor: "#F4F4F5" }
                          }
                        >
                          <Ticket className="h-4 w-4 shrink-0" style={{ color: on ? accent : "#A3A3A3" }} strokeWidth={2.25} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-[#0A0A0A]">
                              {c.title ?? "이름 없는 쿠폰"}
                            </span>
                            {sub && <span className="block text-[11px] font-medium text-[#8A8A8A]">{sub}</span>}
                          </span>
                          {on && <Check className="h-4 w-4" style={{ color: accent }} strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                </div>
              )}

              {activeBlock.id === "product" && (
                <div className="space-y-3">
                  {/* UI-5-T2-E5b — 재사용: 내 등록 상품 불러오기(자체업로드분 · 탭 = 폼 자동 채움 + 참조 연결). */}
                  <div>
                    <button
                      onClick={() => {
                        const next = !myProductsOpen;
                        setMyProductsOpen(next);
                        if (next && myProducts.length === 0) void loadMyProducts();
                      }}
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#F4F4F5] text-[12px] font-bold text-[#525252] transition-colors active:bg-[#ECECEC]"
                    >
                      <Search className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {myProductsOpen ? "닫기" : "등록한 상품 불러오기"}
                    </button>
                    {myProductsOpen && (
                      <div className="mt-1.5 space-y-1.5">
                        {myProductsLoading && (
                          <div className="flex items-center justify-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-3 text-[12px] font-semibold text-[#8A8A8A]">
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                            상품을 불러오는 중…
                          </div>
                        )}
                        {!myProductsLoading && myProductsError && (
                          <p className="rounded-xl bg-[#F4F4F5] px-3 py-3 text-center text-[12px] font-medium text-[#8A8A8A]">
                            {myProductsError}
                          </p>
                        )}
                        {!myProductsLoading &&
                          myProducts.map((row) => (
                            <button
                              key={row.dropId}
                              onClick={() => applyReusedProduct(row)}
                              className="flex min-h-[52px] w-full items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 text-left transition-transform active:scale-[0.99] [box-shadow:inset_0_0_0_1px_#E8E8EC]"
                            >
                              <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F4F4F5]">
                                {row.imageUrl ? (
                                  <img src={row.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-[#A3A3A3]" strokeWidth={2} />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-bold text-[#0A0A0A]">{row.name}</span>
                                {row.priceKrw != null && (
                                  <span className="block text-[11px] font-semibold tabular-nums text-[#8A8A8A]">
                                    {row.priceKrw.toLocaleString("ko-KR")}원
                                  </span>
                                )}
                              </span>
                              {registeredProduct?.dropId === row.dropId && (
                                <Check className="h-4 w-4 shrink-0 text-[#1D4ED8]" strokeWidth={2.5} />
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
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
                  onNotify={setStepToast} /* F2-C — 안내 = 페이지 토스트(1.8s 자동 소멸) 경유. */
                  photoUrl={productImagePreview ?? productImageUrl ?? undefined}
                  onEditPhoto={() => {
                    // E5a — 폼 사진 필드 = 표시 전용. 바꾸기 = 스텝 1(productimage) 재방문(단일 입구).
                    const i = stepPlanState.findIndex((s) => s.key === "photo");
                    if (i >= 0) enterStep(i);
                    else onEditField("productimage", "productimage");
                  }}
                  onRegister={() => void registerProduct()} /* E5b — 사용자 확정 탭 유래만(자동 트리거 0). */
                  registerSaving={productSaving}
                  registerError={productSaveError}
                  registeredName={registeredProduct?.name ?? null}
                />
                </div>
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
                      <div className="flex max-h-[364px] flex-col gap-1.5 overflow-y-auto">
                        {/* E1b — 상한 12(스크롤) · 소스 배지(유튜브/블로그) · 블로그=Case B(선택 시 안내, 가짜 반영 금지). */}
                        {videoResults.slice(0, videoShowCount).map((c) => {
                          const isYoutube = c.provider === "youtube";
                          const slot = isYoutube ? toVideoSlot(c) : null;
                          // E5c(A1) — 행 하이라이트 = 확정 대기(pending) 또는 이미 담긴 영상.
                          const on =
                            isYoutube &&
                            ((pendingVideo?.provider === c.provider && pendingVideo?.source_id === c.source_id) ||
                              selectedVideo?.videoId === slot!.videoId);
                          const badge = c.provider === "naver_blog" ? { label: "블로그", Icon: PenLine } : { label: "YouTube", Icon: Youtube };
                          const thumb = isYoutube ? slot!.thumbnailUrl : (c.thumbnail_url ?? "");
                          return (
                            <button
                              key={`${c.provider}|${c.source_id}`}
                              onClick={() =>
                                isYoutube
                                  ? setPendingVideo(c) /* E5c(A1) — 탭 = 선택 표시만(즉시 장착 폐지). 확정은 하단 버튼. */
                                  : setStepToast("블로그 카드는 준비 중이에요") /* Case B — 가짜 반영 금지 */
                              }
                              className="flex min-h-[56px] items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 text-left transition-transform active:scale-[0.99]"
                              style={{ boxShadow: `inset 0 0 0 1px ${on ? "#1D4ED8" : "#E8E8EC"}` }}
                            >
                              <span className="relative flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0F172A]">
                                {thumb ? (
                                  <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : null}
                                {isYoutube && <Play className="absolute h-4 w-4 text-white drop-shadow" strokeWidth={2.5} fill="currentColor" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-bold text-[#0A0A0A]">
                                  {c.title ?? (isYoutube ? "영상" : "블로그 글")}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#8A8A8A]">
                                  <badge.Icon className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                                  <span className="truncate">
                                    {badge.label}
                                    {c.author_name ? ` · ${c.author_name}` : ""}
                                    {isYoutube && slot!.durationLabel ? ` · ${slot!.durationLabel}` : ""}
                                  </span>
                                </span>
                              </span>
                              {on && <Check className="h-4 w-4 shrink-0 text-[#1D4ED8]" strokeWidth={2.5} />}
                            </button>
                          );
                        })}
                        {videoResults.length > videoShowCount && (
                          <button
                            onClick={() => setVideoShowCount((n) => n + 12)}
                            className="flex min-h-[44px] items-center justify-center rounded-xl bg-[#F4F4F5] text-[12px] font-bold text-[#525252] transition-transform active:scale-[0.99]"
                          >
                            더 보기 ({videoResults.length - videoShowCount}개)
                          </button>
                        )}
                      </div>
                    )}
                    {/* E5c(A3) — URL 붙여넣기 경로 미리보기 행(결과 목록에 없는 대기 후보만 — 경로 간 문법 통일). */}
                    {pendingVideo &&
                      !videoResults.some((r) => r.provider === pendingVideo.provider && r.source_id === pendingVideo.source_id) && (
                        <div className="flex min-h-[56px] items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 [box-shadow:inset_0_0_0_1px_#1D4ED8]">
                          <span className="relative flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0F172A]">
                            {pendingVideo.thumbnail_url ? (
                              <img src={pendingVideo.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : null}
                            <Play className="absolute h-4 w-4 text-white drop-shadow" strokeWidth={2.5} fill="currentColor" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-bold text-[#0A0A0A]">{pendingVideo.title ?? "영상"}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-medium text-[#8A8A8A]">
                              링크로 찾은 영상{pendingVideo.author_name ? ` · ${pendingVideo.author_name}` : ""}
                            </span>
                          </span>
                          <Check className="h-4 w-4 shrink-0 text-[#1D4ED8]" strokeWidth={2.5} />
                        </div>
                      )}
                    {/* E5c(A2) — 확정 버튼(2단의 2단째): 선택 시에만 활성 → 기존 selectVideo 사슬(장착·confirmHelper·
                        관문·요약 리드) 그대로 실행. isStepDone(video) 전이 = 이 시점(E2b 견인 발화 정합 A4). */}
                    {(pendingVideo || (!videoSearching && videoResults.length > 0)) && (
                      <button
                        onClick={() => {
                          if (!pendingVideo) return;
                          void selectVideo(pendingVideo);
                          setPendingVideo(null);
                        }}
                        disabled={!pendingVideo}
                        className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#16161D] text-[13px] font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-30"
                      >
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                        이 영상으로 확정
                      </button>
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
                  {/* UI-5-T4-D3b(b) — 한마디 제안(ai_summary): 자동 주입 금지 — 한마디가 비었을 때만 제안 칩,
                      탭 = 채택(사용자 유래). */}
                  {aiSummaryLead && !cfgSubtitle.trim() && (
                    <button
                      onClick={() => setCfgSubtitle(aiSummaryLead)}
                      className="flex w-full items-start gap-1.5 rounded-xl bg-[#EEF3FE] px-3 py-2 text-left transition-transform active:scale-[0.99] [box-shadow:inset_0_0_0_1px_#C7D7FB]"
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D4ED8]" strokeWidth={2.5} />
                      <span className="min-w-0 flex-1 text-[12px] font-medium leading-relaxed text-[#16161D] [word-break:keep-all]">
                        한마디 제안 — “{aiSummaryLead}” <b className="font-bold text-[#1D4ED8]">이 문구 쓰기</b>
                      </span>
                    </button>
                  )}
                  {/* UI-5-T4-D3b — 영상 포인트 픽(45 :4707-4732 계승 · 비커머스 정본 복원): 후보 = ai_key_points,
                      채택 = 탭 토글(pickedPoints — 자동 주입 0). 후보 없으면(도착 전·실패) 섹션 미노출(빈 껍데기 금지).
                      "셀링포인트" 용어 = 커머스 전용 → 여기 라벨 = "영상 포인트"(생활어). */}
                  {aiKeyPoints.length > 0 && (
                    <div className="rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#525252]">
                        <Sparkles className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                        영상 포인트
                        <span className="text-[10px] font-medium text-[#A3A3A3]">골라 담기 · 최대 5개</span>
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-[#8A8A8A] [word-break:keep-all]">
                        영상에서 뽑은 포인트예요 — 카드에 실을 것만 골라 주세요
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {aiKeyPoints.map((p) => {
                          const on = pickedPoints.includes(p);
                          return (
                            <button
                              key={p}
                              onClick={() => togglePickedPoint(p)}
                              aria-pressed={on}
                              className="rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors [word-break:keep-all]"
                              style={
                                on
                                  ? { backgroundColor: accent, color: "#fff" }
                                  : { backgroundColor: "#fff", color: "#404040", boxShadow: "inset 0 0 0 1px #E5E5E5" }
                              }
                            >
                              {p}
                            </button>
                          );
                        })}
                        {/* 직접 추가분(후보 밖 채택) — 탭 = 제거. */}
                        {pickedPoints
                          .filter((p) => !aiKeyPoints.includes(p))
                          .map((p) => (
                            <button
                              key={p}
                              onClick={() => setPickedPoints((prev) => prev.filter((x) => x !== p))}
                              className="rounded-full px-2.5 py-1.5 text-[11px] font-semibold [word-break:keep-all]"
                              style={{ backgroundColor: accent, color: "#fff" }}
                            >
                              {p} ×
                            </button>
                          ))}
                      </div>
                      {/* D3b(c) — 수동 입력은 보조 1개([직접 추가])로만. */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <input
                          value={customPointDraft}
                          onChange={(e) => setCustomPointDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              addCustomPoint();
                            }
                          }}
                          placeholder="직접 추가 — 예: 주차 편해요"
                          className="min-w-0 flex-1 rounded-lg bg-white px-2.5 py-2 text-[12px] font-medium text-[#0A0A0A] outline-none placeholder:text-[#B4B4B4]"
                          style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                        />
                        <button
                          onClick={addCustomPoint}
                          className="flex h-8 shrink-0 items-center justify-center rounded-lg bg-white px-2.5 text-[12px] font-semibold text-[#525252] transition-colors active:bg-[#ECECEC]"
                          style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  )}
                  {/* UI-5-T2-E5c(B1·B2) — 핵심구간 직접 입력(시작·끝 2칸, 45 파서 parseClock 재사용).
                      확정 = blur/Enter → commitClip 검증(끝>시작·영상 길이 초과 = 45 정책 계승) →
                      cfgClip "시작~끝" 커밋 = 어댑터 model.clip 즉시 반영. 값은 대표님만(AI clip 불가침 유지 B4). */}
                  <div className="rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#525252]">
                      <Video className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                      핵심 구간 (시작~끝)
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={clipStartDraft}
                        onChange={(e) => setClipStartDraft(e.target.value.replace(/[^0-9:]/g, ""))}
                        onBlur={commitClip}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            commitClip();
                          }
                        }}
                        placeholder="0:12"
                        inputMode="numeric"
                        aria-label="핵심 구간 시작"
                        className="min-w-0 flex-1 rounded-lg bg-white px-2 py-2 text-center text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#B4B4B4]"
                        style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                      />
                      <span className="shrink-0 text-[12px] font-semibold text-[#8A8A8A]">~</span>
                      <input
                        value={clipEndDraft}
                        onChange={(e) => setClipEndDraft(e.target.value.replace(/[^0-9:]/g, ""))}
                        onBlur={commitClip}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            commitClip();
                          }
                        }}
                        placeholder="0:30"
                        inputMode="numeric"
                        aria-label="핵심 구간 끝"
                        className="min-w-0 flex-1 rounded-lg bg-white px-2 py-2 text-center text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#B4B4B4]"
                        style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                      />
                    </div>
                    {clipError && (
                      <p className="mt-1.5 text-[11px] font-semibold text-[#DC2626] [word-break:keep-all]">{clipError}</p>
                    )}
                    {!clipError && cfgClip.includes("~") && (
                      <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-[#525252]">적용된 구간: {cfgClip}</p>
                    )}
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

              {/* UI-5-T2-E5a — reserve 매장 사진(image) = 기존 목업 무접촉(범위 밖). */}
              {activeBlock.id === "image" && (
                <div className="space-y-2">
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#F4F4F5]">
                    <span className="flex flex-col items-center gap-1.5 text-[#8A8A8A]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6E6E6] text-[#525252]">
                        <ImageIcon className="h-5 w-5" strokeWidth={2} />
                      </span>
                      <span className="text-[11px] font-semibold">대표 이미지 미리보기</span>
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => confirmHelper("image")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold text-white transition-transform active:translate-y-px"
                      style={{ backgroundColor: accent }}
                    >
                      <ImageIcon className="h-4 w-4" strokeWidth={2.25} />
                      갤러리에서 선택
                    </button>
                    <button
                      onClick={() => confirmHelper("image")}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[12px] font-semibold text-[#404040] transition-transform active:translate-y-px"
                    >
                      촬영
                    </button>
                  </div>
                </div>
              )}

              {/* UI-5-T2-E5a — 상품 사진(productimage) = 실 업로드 단일 입구(product-images 버킷). */}
              {activeBlock.id === "productimage" && (
                <div className="space-y-2">
                  {/* 갤러리 = 파일선택 · 촬영 = capture(데스크톱은 파일선택 폴백) */}
                  <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductImageChange} />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProductImageChange} />
                  {/* 썸네일 — 로컬 미리보기(업로드 중) → 실 URL */}
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#F4F4F5]">
                    {productImagePreview || productImageUrl ? (
                      <img src={productImagePreview || productImageUrl || ""} alt="상품 사진" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center gap-1.5 text-[#8A8A8A]">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6E6E6] text-[#525252]">
                          <ImageIcon className="h-5 w-5" strokeWidth={2} />
                        </span>
                        <span className="text-[11px] font-semibold">상품 사진 미리보기</span>
                      </span>
                    )}
                    {imageUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Loader2 className="h-6 w-6 animate-spin text-white" strokeWidth={2.5} />
                      </div>
                    )}
                    {!imageUploading && productImageUrl && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: accent }}>
                        <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={imageUploading}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold text-white transition-transform active:translate-y-px disabled:opacity-50"
                      style={{ backgroundColor: accent }}
                    >
                      <ImageIcon className="h-4 w-4" strokeWidth={2.25} />
                      갤러리에서 선택
                    </button>
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={imageUploading}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[12px] font-semibold text-[#404040] transition-transform active:translate-y-px disabled:opacity-50"
                    >
                      촬영
                    </button>
                  </div>
                  {imageUploadError && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FEF2F2] px-3 py-2">
                      <span className="text-[12px] font-medium text-[#DC2626] [word-break:keep-all]">{imageUploadError}</span>
                      <button
                        onClick={() => galleryInputRef.current?.click()}
                        className="shrink-0 text-[12px] font-bold"
                        style={{ color: accent }}
                      >
                        다시 시도
                      </button>
                    </div>
                  )}

                  {/* 이미지 등록 → AI 원페이지 상품 카탈로그 제작(별도 목업 · 게이트만 실 사진) */}
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
                              {productImageUrl ? "생성 버튼을 눌러 카탈로그를 만들어요" : "먼저 상품 이미지를 등록해 주세요"}
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
                        disabled={!productImageUrl || catStatus === "generating"}
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

          {/* UI-5-T2-E2b(A1·B2) — 완료/다음 코스 칩(설정 영역 하단 — 부유물 금지 원칙 준수).
              도우미 done 말풍선이 열려 있으면 그쪽에 합류(위)·여기선 숨김. 탭 = 사용자 의사(자동 점프·자동 발행 없음). */}
          {stepChip && !assembling && !assembleSummary && !(helperTarget === activeBlock.id && helperPhase !== "guide") && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F4F4F5] p-3">
              <span className="mr-1 text-[12px] font-bold text-[#16161D] [word-break:keep-all]">
                {stepChip.kind === "done"
                  ? `✓ ${stepPlanState[currentStep]?.label ?? "이번 스텝"} 완료`
                  : "✦ 링고가 채운 데까지 확인했어요"}
              </span>
              <button
                onClick={() => {
                  const t = stepChip;
                  setStepChip(null);
                  if (t.kind === "done") nextStep(); // A2 — 헤더 [다음]과 동일 경로(nextStep 경유).
                  else enterStep(t.target); // B2 — 사용자 탭 = 이동 의사(강제 점프 아님).
                }}
                className="inline-flex min-h-[36px] items-center rounded-full bg-[#16161D] px-3 text-[11px] font-bold text-white transition-transform active:scale-95"
              >
                {stepChipLabel(stepChip.target)}
              </button>
              <button
                onClick={() => setStepChip(null)}
                className="inline-flex min-h-[36px] items-center rounded-full border border-[#E8E8EC] bg-white px-3 text-[11px] font-bold text-[#525252] transition-transform active:scale-95"
              >
                여기 더 볼게요
              </button>
            </div>
          )}
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

        {/* 수신자 화면 미리보기 — 눈에 띄게 강조. UI-5-T4-D1 — do 스텝 지목 앵커(mirror). */}
        <button
          data-assemble-anchor="mirror"
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
          {/* UI-5-T3-L2 — 기록실 시트(구 플로팅 패널·백드롭·이동 핸들 폐지 · 비모달 — 판단 근거는
              LingoRecordSheet49 헤더 주석). 소환 = 오브 길게 탭(L1 타이머). 이관: 웰컴·제안 칩·로그·
              인사/행동 칩·interim·thinking·입력·마이크(L1 시퀀스)·전송 — 소실 0. */}
          <LingoRecordSheet49
            open={lingoOpen}
            onClose={() => setLingoOpen(false)}
            logRef={lingoLogRef}
            subHeader={
              /* UI-5-T4-D2(3) — 재관람 존중 + D3(1) — 처음 안내 재발동(같은 보조 줄 · 상시 화면 추가물 0). */
              <div className="flex gap-1.5">
                {hasAssemblyHistory && (
                  <button
                    onClick={replayAssembly}
                    disabled={assembling}
                    className="flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#F7F7F8] text-[12px] font-semibold text-[#525252] transition-colors active:bg-[#ECECEC] disabled:opacity-40"
                  >
                    <Play className="h-3.5 w-3.5" strokeWidth={2.25} fill="currentColor" />
                    연출 다시 보기
                  </button>
                )}
                <button
                  onClick={() => {
                    // D3(1) — 재발동: 명시 탭 유래로 같이 만들기 시나리오 재시작(시트는 startOnboarding 의
                    //   enterStep→onEditField→yieldToHand 경로가 아닌 직접 닫기 — 손 우선).
                    setLingoOpen(false);
                    startOnboarding();
                  }}
                  disabled={assembling || onboardingActive}
                  className="flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#F7F7F8] text-[12px] font-semibold text-[#525252] transition-colors active:bg-[#ECECEC] disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
                  처음 안내 다시 보기
                </button>
              </div>
            }
            headerAction={
              /* L3 — 스피커 토글: 낭독 전체 on/off(사용자 설정 — 리셋 무관). OFF 전환 시 진행 중 낭독 즉시 중단. */
              <button
                aria-label={speakerOn ? "낭독 끄기" : "낭독 켜기"}
                aria-pressed={speakerOn}
                onClick={() =>
                  setSpeakerOn((v) => {
                    if (v) {
                      window.speechSynthesis?.cancel();
                      setSpeaking(false);
                    }
                    return !v;
                  })
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
                style={speakerOn ? { backgroundColor: "#EEF3FE", color: "#1D4ED8" } : { backgroundColor: "#F4F4F5", color: "#9A9A9A" }}
              >
                {speakerOn ? <Volume2 className="h-4 w-4" strokeWidth={2.5} /> : <VolumeX className="h-4 w-4" strokeWidth={2.5} />}
              </button>
            }
            log={
              <>
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
                    {/* UI-5-T2-E4c(1d) — 행동 지시로 끝난 응답 + 현재 스텝 미완 시 상시 [하러 가기] 칩(→양보 경로). */}
                    {!greetingChipsOpen && messages.length > 0 && !thinking && !isStepDone(currentStep) && (
                      <div className="flex pl-1">
                        <button
                          onClick={() => enterStep(currentStep)}
                          className="min-h-[44px] rounded-xl bg-[#EEF2FF] px-3.5 text-[13px] font-bold text-[#1D4ED8] transition-transform active:scale-95"
                        >
                          {stepPlanState[currentStep]?.label} 하러 가기
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
              </>
            }
            footer={
              <div>
                {/* UI-5-T1(T-D) — 조립순서 번호도 · 추천 장착 버튼 · 대화 중 퀵명령 미이식. */}
                {/* 입력 컴포저 — 텍스트가 기본, 음성은 보조(시트 내 마이크 = L1 오브 동일 시퀀스). */}
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
                          onClick={handleOrbTap} /* L2 — 시트 내 마이크 = L1 오브 동일 시퀀스(primeAudio·띠딩·게이트). */
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
                {/* UI-5-T1(T-D) — 보조도구 3종(담기·편집·되돌리기) 미이식. */}
              </div>
            }
          />

          {/* UI-5-T2-E4f(2) — 인사 고스트 말풍선(패널 밖 승격). 원인(진단 b): 인사·행동 칩이 lingoOpen 패널
              내부 전용인데 패널 기본 닫힘(초기 false·E4c 양보) → 미노출. 패널 열림 여부와 무관하게 FAB 옆 노출.
              상태 = greetingChipsOpen 단일 공유(패널 내부 인사·칩 그대로 — 이중 관리 금지).
              소멸 = 칩 탭·대화 시작(sendToLingo)·스텝 진입(enterStep) 3조건 계승. 재소환 말풍선과 상호 배타. */}
          {/* UI-5-T4-D3(1) — 온보딩 제안이 인사 고스트를 1회 대체(done 부재 시). 기존 조건 전부 승계. */}
          {!lingoOpen && greetingChipsOpen && !yieldBubble && !assembling && !assembleSummary && !listening && !voiceGhost && !onboardCheer && (
            <div className="fixed bottom-[262px] right-5 z-40 w-[min(78vw,280px)] animate-fade-in rounded-2xl bg-white p-3 [box-shadow:0_16px_36px_-14px_rgba(15,23,42,0.4),0_0_0_1px_#E8E8EC]">
              <p className="flex items-start gap-1.5">
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                  ✦ 링고
                </span>
                <span className="text-[12px] font-semibold leading-relaxed text-[#16161D] [word-break:keep-all]">
                  {onboardOffer ? "처음이시죠? 제가 한 장 같이 만들어 드릴게요" : stepPlanIntro(mode)}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {onboardOffer ? (
                  <>
                    <button
                      onClick={startOnboarding}
                      className="inline-flex min-h-[36px] items-center rounded-full bg-[#16161D] px-3 text-[11px] font-bold text-white transition-transform active:scale-95"
                    >
                      같이 만들기
                    </button>
                    <button
                      onClick={declineOnboarding}
                      className="inline-flex min-h-[36px] items-center rounded-full border border-[#E8E8EC] bg-white px-3 text-[11px] font-bold text-[#525252] transition-transform active:scale-95"
                    >
                      혼자 해볼게요
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setGreetingChipsOpen(false);
                        enterStep(0); // E4b 계승 — 1스텝 칸 이동 + 포커스(탭 = 의사 · 자동 점프 아님).
                      }}
                      className="inline-flex min-h-[36px] items-center rounded-full bg-[#16161D] px-3 text-[11px] font-bold text-white transition-transform active:scale-95"
                    >
                      {stepPlanState[0]?.label} 하러 가기
                    </button>
                    <button
                      onClick={() => setGreetingChipsOpen(false)}
                      className="inline-flex min-h-[36px] items-center rounded-full border border-[#E8E8EC] bg-white px-3 text-[11px] font-bold text-[#525252] transition-transform active:scale-95"
                    >
                      내가 알아서 할게요
                    </button>
                  </>
                )}
              </div>
              <span className="absolute -bottom-1 right-7 h-3 w-3 rotate-45 bg-white [box-shadow:2px_2px_0_#E8E8EC]" aria-hidden="true" />
            </div>
          )}

          {/* UI-5-T4-D3(2b) — 온보딩 격려 고스트(3s 자동 소멸 · 도우미 밀도만 높인 일반 흐름). */}
          {!lingoOpen && onboardCheer && !listening && (
            <div className="fixed bottom-[262px] right-5 z-40 max-w-[240px] animate-fade-in rounded-2xl bg-[#16161D] px-3.5 py-2.5 [box-shadow:0_16px_36px_-14px_rgba(15,23,42,0.5)]">
              <p className="text-[12px] font-bold leading-snug text-white tracking-ko [word-break:keep-all]">{onboardCheer}</p>
              <span className="absolute -bottom-1 right-7 h-3 w-3 rotate-45 bg-[#16161D]" aria-hidden="true" />
            </div>
          )}

          {/* UI-5-T2-E4c(2) — 재소환 미니 말풍선(양보로 닫힘 직후 1회 · 3s 소멸). FAB는 항상 접근(z-40·백드롭 없음). */}
          {!lingoOpen && yieldBubble && (
            <div className="fixed bottom-[262px] right-5 z-40 max-w-[220px] animate-fade-in rounded-2xl bg-[#16161D] px-3.5 py-2.5 [box-shadow:0_16px_36px_-14px_rgba(15,23,42,0.5)]">
              <p className="text-[12px] font-bold leading-snug text-white tracking-ko [word-break:keep-all]">
                저는 여기 있어요 — 필요하면 불러 주세요
              </p>
              <span className="absolute -bottom-1 right-7 h-3 w-3 rotate-45 bg-[#16161D]" />
            </div>
          )}

          {/* UI-5-T3-L4(B5·B6) — 막힘 제안 칩: 현재 스텝 기준 도움 제안(확인 스텝 = 발행 게이트 사유 통합).
              [도와줘] = 시트 소환 + 스텝 맥락 질문(사용자 탭 유래) / [괜찮아요] = 소거(스텝당 1회 — 재발화 없음). */}
          {!lingoOpen && stuckChip && !listening && !voiceGhost && !yieldBubble && !assembling && !assembleSummary && (
            <div className="fixed bottom-[262px] right-5 z-40 w-[min(78vw,280px)] animate-fade-in rounded-2xl bg-white p-3 [box-shadow:0_16px_36px_-14px_rgba(15,23,42,0.4),0_0_0_1px_#E8E8EC]">
              <p className="flex items-start gap-1.5">
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                  ✦ 링고
                </span>
                <span className="text-[12px] font-semibold leading-relaxed text-[#16161D] [word-break:keep-all]">{stuckChip.msg}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    const label = stuckChip.label;
                    setStuckChip(null);
                    lingoChannelRef.current = "text";
                    setLingoOpen(true); // 기록실 시트 소환 + 스텝 맥락 도움 요청(A3 대본이 현재 스텝 인지).
                    sendToLingo(`${label} 단계가 어려워요 — 어떻게 하면 돼요?`);
                  }}
                  className="inline-flex min-h-[36px] items-center rounded-full bg-[#16161D] px-3 text-[11px] font-bold text-white transition-transform active:scale-95"
                >
                  도와줘
                </button>
                <button
                  onClick={() => setStuckChip(null)}
                  className="inline-flex min-h-[36px] items-center rounded-full border border-[#E8E8EC] bg-white px-3 text-[11px] font-bold text-[#525252] transition-transform active:scale-95"
                >
                  괜찮아요
                </button>
              </div>
              <span className="absolute -bottom-1 right-7 h-3 w-3 rotate-45 bg-white [box-shadow:2px_2px_0_#E8E8EC]" aria-hidden="true" />
            </div>
          )}

          {/* UI-5-T3-L1 — 음성 고스트: 청취 안내("듣고 있어요")·interim 실시간 표시(낭독 0 — 텍스트만). */}
          {!lingoOpen && (voiceGhost || (listening && interim)) && (
            <div className="fixed bottom-[262px] right-5 z-40 max-w-[240px] animate-fade-in rounded-2xl bg-[#16161D] px-3.5 py-2.5 [box-shadow:0_16px_36px_-14px_rgba(15,23,42,0.5)]">
              {voiceGhost && (
                <p className="text-[12px] font-bold leading-snug text-white tracking-ko [word-break:keep-all]">{voiceGhost}</p>
              )}
              {listening && interim && (
                <p className="mt-0.5 text-[12px] font-medium italic leading-snug text-white/70 [word-break:keep-all]">{interim}</p>
              )}
              <span className="absolute -bottom-1 right-7 h-3 w-3 rotate-45 bg-[#16161D]" aria-hidden="true" />
            </div>
          )}

          {/* UI-5-T1f(4) — 연출 중 개별 숨김 제거: 딤이 FAB를 덮어 무대화 대체(중복 로직 정리).
              UI-5-T3-L1 — 오브=마이크 상태 언어: 평시 마스코트+빨간 Mic 배지 / listening 흰 원+빨간 Mic+펄스
              (56px 동일 크기 — 점프 0) / speaking 배지 Volume2 / thinking 마스코트 궤도 회전(spin). */}
          {!lingoOpen && (
            <button
              ref={fabRef}
              aria-label="링고AI — 짧게 눌러 말하기, 길게 눌러 창 열기"
              onPointerDown={onFabPointerDown}
              onPointerMove={onFabPointerMove}
              onPointerUp={onFabPointerUp}
              onPointerCancel={onFabPointerUp}
              className={`fixed z-40 flex h-14 w-14 touch-none items-center justify-center rounded-full ${fabDragging ? "scale-110 cursor-grabbing" : "cursor-grab"}`}
              style={fabPos ? { left: fabPos.x, top: fabPos.y } : { right: 20, bottom: 196 }}
            >
              <span
                className={`relative flex h-14 w-14 items-center justify-center transition-transform duration-100 ${orbPressed && !fabDragging ? "scale-95" : ""}`}
              >
                {listening ? (
                  /* S2b — 청취 중 = 본체가 마이크(흰 원 + 빨강 Mic + 바깥 빨간 펄스 링 · 배지 숨김 · 점프 0). */
                  <span className="relative flex h-14 w-14 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-[#DC2626]/40 animate-ping" aria-hidden="true" />
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white ring-[3px] ring-white [box-shadow:0_8px_24px_-8px_rgba(15,23,42,0.35),inset_0_0_0_1px_#ECECEE]">
                      <Mic className="h-6 w-6 text-[#DC2626]" strokeWidth={2.25} />
                    </span>
                  </span>
                ) : (
                  <>
                    <LingoAvatar size={56} spin={thinking} className="ring-[3px] ring-white" />
                    {/* S2b — 상시 마이크 배지(어포던스): 평시 Mic(빨강) / 낭독 중 Volume2. */}
                    <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white [box-shadow:0_2px_6px_-1px_rgba(15,23,42,0.3),inset_0_0_0_1px_#E5E5E5]">
                      {speaking ? (
                        <Volume2 className="h-3 w-3 text-[#525252]" strokeWidth={2.5} />
                      ) : (
                        <Mic className="h-3 w-3 text-[#DC2626]" strokeWidth={2.5} />
                      )}
                    </span>
                  </>
                )}
                {lingo.action && !applied[lingo.action] && !listening && (
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
              </span>
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
