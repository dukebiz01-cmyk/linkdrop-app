import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Copy,
  Eye,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  Link as LinkIcon,
  Loader2,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  Minus,
  Palette,
  Pencil,
  Phone,
  Play,
  Plus,
  Rocket,
  Search,
  Send,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Ticket,
  Undo2,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  ProductRegisterForm45,
  type ProductRegisterPayload45,
  type ProductRegisterResult45,
} from "./ProductRegisterForm45";
import { CardDockingPicker, type DockedProduct } from "@/components/studio/CardDockingPicker";
import type { DiscoverCandidate } from "@/components/explore/DiscoverSection";
import type { AttachedProduct } from "@/components/create/types";
import { getSupabase } from "@/lib/supabase";
import { resizeToJpegBlob } from "@/lib/image-upload";
import { shareToKakao } from "@/lib/kakao";
import { CardModelBody } from "./CardModelBody";
import { CARD_MODEL_ACCENTS, fromStudioState } from "./card-model-adapters";
import { SHIP_STAGES, type CardModel } from "./card-model.types";

// =============================================================================
// CardStudioPage45 — ST2a: v0-45 "카드 스튜디오"(포지) 병행 구축.
// 정본: docs/ref/v0-45-card-studio-page.tsx (3,018줄). 기존 studio-build.tsx 0수정 —
// 실 데이터 소스는 공용 lib/컴포넌트는 import, studio-build 인라인 로직은 발췌 복제
// (각 지점 "// ST2b 스위치 시 원본 제거" 주석). 미리보기 = CardModelBody(studio) 거울.
//
// 정본 대비 변환 요약:
//   · mock 전면 제거 — COUPON_OPTIONS→loader 쿠폰 / DOCK_OPTIONS→CardDockingPicker /
//     MODE_CONTENT 데모 카피→실 매장·영상·상품 값(빈값 = 안내 placeholder, 가짜 카피 0) /
//     SHARE_JOURNEY·spreadCount 데모→미주입(=미렌더).
//   · 정직 게이트(백엔드 부재): 배송 안내(delivery)·고객 후기(review)·도달 강화
//     (top/boost/marketing)·AI 광고영상(aivideo)·AI 카탈로그 = UI 유지 + "준비 중" 비활성.
//   · 링고AI: FAB·패널·정적 코칭·액션 헬퍼(담기/편집/되돌리기·추천 장착)만 이식.
//     대화(LLM)·음성·AI 빌더 실행은 T5 트랙 예약석 — 입력 비활성(배선 0).
//   · 발행 = 기존 체인 재사용: POST /api/drops → set_drop_funnel_coupon /
//     update_drop_key_points / set_drop_card_color (best-effort 3종).
// =============================================================================

// ── 라우트(studio-lab)가 주입하는 실데이터 — studio-build loader 반환 미러 선언.
//    (studio-build.tsx:2638-2668 동형. import 대신 미러 — ST2b 스위치 시 원본 제거)
export type StudioLabStore = {
  id: string;
  display_name: string;
  verification_status: string;
  contact_phone: string | null;
  address: string | null;
  reservation_url: string | null;
  /** FIX-10 — partners.facilities jsonb(기본 '[]'). 시설 태그 저장·재로드. */
  facilities?: unknown;
};
export type StudioLabCoupon = {
  id: string;
  title: string | null;
  discount_value: number | null;
  discount_unit: string | null;
  coupon_type?: string | null;
  gift_item?: string | null;
  valid_until?: string | null;
  conditions?: { min_amount?: number; [k: string]: unknown } | null;
};

type BuildMode = "general" | "reserve" | "commerce";
type BlockCategory = "content" | "purpose" | "enhance";

interface StudioBlock {
  id: string;
  label: string;
  desc: string;
  /** 카드를 누르면 떠오르는 아크릴 패널 안내 문구 */
  detail: string;
  icon: LucideIcon;
  category: BlockCategory;
  /** 전환 레버 점수 = 완성도(전환력) 기여도. 강화 블록은 0(도달만 늘림). */
  power: number;
  isMain?: boolean;
  isPaid?: boolean;
}

// 정본 STUDIO_BLOCKS 18종 그대로(문구 불변).
const STUDIO_BLOCKS: StudioBlock[] = [
  { id: "calendar", label: "예약 캘린더", desc: "날짜 고르고 바로 예약", detail: "고객이 카드 안에서 날짜·시간을 골라 바로 예약해요. 전화나 DM 없이 전환되는 가장 강한 레버예요.", icon: Calendar, category: "purpose", power: 30, isMain: true },
  { id: "product", label: "상품 등록", desc: "이름 · 가격 한 번에", detail: "판매할 상품의 이름과 가격을 입력해 카드에 담아요. 보는 사람이 바로 가격을 확인하고 주문할 수 있어요.", icon: Tag, category: "purpose", power: 30, isMain: true },
  { id: "seasonal", label: "판매 캘린더", desc: "판매 기간·가능일을 한눈에", detail: "상품을 살 수 있는 기간과 판매 가능일을 캘린더로 보여줘요. 지금이 구매 적기라는 걸 알려 주문을 앞당겨요.", icon: Calendar, category: "purpose", power: 30, isMain: true },
  { id: "productimage", label: "이미지 등록", desc: "본체 이미지로 상품을 보여줘요", detail: "영상 대신 상품 사진이 카드의 본체가 돼요. 신선도와 품질이 잘 드러난 한 장이 주문을 부릅니다.", icon: ImageIcon, category: "content", power: 28, isMain: true },
  { id: "content", label: "영상 · 핵심구간", desc: "TimeLink로 0:42 명장면만 콕", detail: "긴 영상에서 가장 설득력 있는 구간만 골라 보여줘요. 첫 3초에 눈길을 잡아 이탈을 막아요.", icon: Video, category: "content", power: 28 },
  { id: "aivideo", label: "AI 광고영상 제작", desc: "상품 사진 → 광고영상 자동 생성", detail: "상품 사진과 정보만 넣으면 AI가 짧은 광고영상을 자동으로 만들어요. 촬영·편집 없이 첫 3초를 잡는 본체 영상을 얻어요.", icon: Clapperboard, category: "content", power: 26 },
  { id: "coupon", label: "쿠폰 연결", desc: "내 매장 쿠폰 중 선택", detail: "내 매장에 등록된 쿠폰을 카드에 붙여 방문 동기를 만들어요. 할인폭이 클수록 전환이 올라가요.", icon: Ticket, category: "purpose", power: 18 },
  { id: "dock", label: "카드 도킹", desc: "다른 카드 연결해 함께 보내기", detail: "이미 만든 다른 카드를 이 카드에 연결해 함께 보내요. 관련 카드를 묶어 한 번에 더 많은 전환을 만들어요.", icon: Copy, category: "purpose", power: 12 },
  { id: "image", label: "대표 이미지", desc: "썸네일 한 장으로 눈길", detail: "피드에서 가장 먼저 보이는 한 장이에요. 분위기가 잘 드러난 사진일수록 클릭률이 높아져요.", icon: ImageIcon, category: "content", power: 10 },
  { id: "link", label: "매장정보", desc: "전화 · 위치 · 문의 버튼", detail: "전화·위치·문의 버튼을 카드에 얹어요. 보는 사람이 바로 행동할 수 있게 길을 열어줘요.", icon: LinkIcon, category: "purpose", power: 8 },
  { id: "party", label: "인원 선택", desc: "예약 인원을 미리 받기", detail: "예약할 인원 수를 카드 안에서 바로 골라요. 방문 규모를 미리 알면 노쇼가 줄고 준비가 쉬워져요.", icon: Users, category: "purpose", power: 16 },
  { id: "review", label: "고객 후기", desc: "평점 · 리뷰로 신뢰 더하기", detail: "실제 방문·구매 고객의 평점과 한 줄 후기를 보여줘요. 사회적 증거가 처음 보는 사람의 확신을 만들어요.", icon: Star, category: "purpose", power: 20 },
  { id: "delivery", label: "배송 안내", desc: "택배사 · 배송 진행 추적", detail: "택배사를 고르고 배송이 어디까지 갔는지(준비·배송중·완료) 카드에 바로 보여줘요. 송장번호·배송비·도착 예정일까지 한눈에 확인돼요.", icon: Truck, category: "purpose", power: 14 },
  { id: "brand", label: "브랜드 소개", desc: "우리 가게 한 줄 스토리", detail: "우리 브랜드의 짧은 이야기를 카드에 담아요. 왜 특별한지 한 줄로 전해 기억에 남는 카드를 만들어요.", icon: Store, category: "content", power: 12 },
  { id: "bgcolor", label: "카드 배경색", desc: "내 카드 분위기 고르기", detail: "브랜드 톤에 맞는 배경색을 골라 카드 분위기를 완성해요. 작은 차이가 신뢰감을 만들어요.", icon: Palette, category: "content", power: 6 },
  { id: "top", label: "상위노출", desc: "피드 상단에 먼저 보이기", detail: "완성도 75점을 넘기면 열려요. 피드 상단에 먼저 노출돼 더 많은 사람이 카드를 봐요.", icon: TrendingUp, category: "enhance", power: 0, isPaid: true },
  { id: "boost", label: "부스트", desc: "더 많은 친구에게 도달", detail: "이미 잘 만든 카드를 더 많은 친구에게 실어줘요. 완성된 카드일 때만 효과가 커요.", icon: Rocket, category: "enhance", power: 0, isPaid: true },
  { id: "marketing", label: "마케팅 강화", desc: "광고 슬롯으로 확장", detail: "외부 광고 슬롯까지 확장해 도달을 넓혀요. 전환 설계가 끝난 뒤 마지막으로 더하는 단계예요.", icon: Megaphone, category: "enhance", power: 0, isPaid: true },
];

// 정본 CARD_COLORS 6색(:248-255) — 네이비 라벨은 정본 파일 모지바케라 정정.
const CARD_COLORS = [
  { id: "ink", value: "#0F172A", label: "잉크" },
  { id: "forest", value: "#14532D", label: "포레스트" },
  { id: "navy", value: "#1E3A8A", label: "네이비" },
  { id: "wine", value: "#7F1D1D", label: "와인" },
  { id: "sand", value: "#78350F", label: "샌드" },
  { id: "slate", value: "#334155", label: "슬레이트" },
];

const ENHANCE_UNLOCK = 75;
const INK = "#0A0A0A";
const PAGE_BG = "#FAFAFA";
const CARD_BASE = "#FFFFFF";

// ★ 정직 게이트 — 백엔드 부재 블록: 장착(=카드 표시) 차단 + "준비 중" 라벨(가짜 성공 금지).
//   delivery = 운송장/배송 테이블 부재 · review = 후기 데이터 부재 · top/boost/marketing =
//   도달 강화 상품 미출시. UI(덱 카드·설정 폼)는 정본 그대로 유지.
const GATED_BLOCK_IDS = new Set(["delivery", "review", "top", "boost", "marketing"]);
const GATE_NOTICE = "이 기능은 오픈 준비 중이에요. 곧 열려요.";

// 매장정보 시설 태그 — 빠른 추가용 추천 목록(정본 8종).
const FACILITY_PRESETS = ["주차 가능", "무료 와이파이", "반려동물 동반", "단체석", "예약 가능", "포장·배달", "유아 의자", "휠체어 접근"];
// AI 광고영상 제작 옵션 — 게이트 대상이지만 UI(선택지)는 정본 유지.
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
// 09:00 ~ 21:00, 1시간 단위 (정본).
const TIME_OPTIONS = Array.from({ length: 13 }, (_, i) => `${String(9 + i).padStart(2, "0")}:00`);
// 배송 택배사 선택지 — 게이트 대상(UI만 유지).
const COURIERS = ["CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배", "직접 전달"];
// 설정 UI가 필요한 블록 (정본).
const CONFIGURABLE = ["calendar", "seasonal", "coupon", "product", "dock", "link", "content", "aivideo", "image", "productimage", "party", "review", "delivery", "brand"];

function getStage(score: number) {
  if (score >= ENHANCE_UNLOCK) return { stars: 3, label: "완성", tone: "전환 준비 완료" };
  if (score >= 40) return { stars: 2, label: "괜찮음", tone: "조금만 더" };
  return { stars: 1, label: "기본", tone: "아직 약해요" };
}

// 모드별 덱 구성 (정본: 주 제작 → 일반 레버 → 강화).
const DECK_IDS: Record<BuildMode, string[]> = {
  general: ["content", "dock", "bgcolor", "top", "boost", "marketing"],
  reserve: ["calendar", "party", "content", "review", "coupon", "brand", "dock", "image", "link", "bgcolor", "top", "boost", "marketing"],
  commerce: ["product", "productimage", "aivideo", "seasonal", "review", "delivery", "coupon", "brand", "dock", "link", "bgcolor", "top", "boost", "marketing"],
};
const MODE_MAIN_IDS: Record<BuildMode, string[]> = {
  general: [],
  reserve: ["calendar", "coupon"],
  commerce: ["product", "productimage", "seasonal"],
};
const blockById = (id: string) => STUDIO_BLOCKS.find((b) => b.id === id)!;

// VideoSlot — CardBody.types.ts VideoSlot 동형(미러 — 거울 파일 import 회피).
type VideoSlot45 = {
  videoId: string;
  thumbnailUrl: string;
  title: string;
  isShorts: boolean;
  durationLabel?: string;
  sourceLabel?: string;
};

// ST2b 스위치 시 원본 제거 — studio-build.tsx:110-135 formatDuration/toVideoSlot 발췌 복제.
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function toVideoSlot(c: DiscoverCandidate): VideoSlot45 {
  return {
    videoId: c.source_id,
    thumbnailUrl: c.source_id ? `https://i.ytimg.com/vi/${c.source_id}/mqdefault.jpg` : (c.thumbnail_url ?? ""),
    title: c.title ?? "영상",
    isShorts: (c.duration_sec ?? 999) <= 60,
    durationLabel: c.duration_sec ? formatDuration(c.duration_sec) : undefined,
    sourceLabel: "YouTube",
  };
}

// 페이지 전용 keyframes — v0 globals(animate-fade-in 등) 부재라 sl- 접두로 자체 동봉.
const SL_KEYFRAMES = `
@keyframes sl-fade-in { from { opacity: 0; } to { opacity: 1; } }
.sl-fade-in { animation: sl-fade-in 0.25s ease-out both; }
@keyframes sl-slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.sl-slide-up { animation: sl-slide-up 0.3s ease-out both; }
@keyframes sl-pop { 0% { transform: scale(0.4); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
.sl-pop { animation: sl-pop 0.25s ease-out both; }
/* FIX-14 폴백 재구현 — @property/mask 불요, 전 브라우저 동작:
   프레임(inset -2px, overflow hidden) 안에서 conic-gradient 정사각 레이어를 transform
   rotate(2초/바퀴)로 돌리고, 안쪽을 흰 덮개로 가려 테두리 띠만 보이게. */
@keyframes sl-led-rotate { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
.sl-led-frame { position: absolute; inset: -2px; border-radius: inherit; overflow: hidden; pointer-events: none; }
.sl-led-spin { position: absolute; left: 50%; top: 50%; width: 1200px; height: 1200px;
  background: conic-gradient(transparent 0deg 295deg, rgba(255,233,196,0.20) 312deg, rgba(255,233,196,0.70) 340deg, rgba(255,255,255,0.95) 354deg, transparent 360deg);
  animation: sl-led-rotate 2s linear infinite; }
.sl-led-cover { position: absolute; inset: 2px; border-radius: inherit; background: #FFFFFF; }
`;

type ProductCopy45 = { headline: string; sellingPoints: string[] };

// FIX-4 — 적용 확정 후 접힘 행: "적용됨 · 요약" + [변경]으로 재펼침.
function AppliedRow({ accent, label, onEdit }: { accent: string; label: string; onEdit: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
      style={{ backgroundColor: `${accent}0A`, boxShadow: `inset 0 0 0 1px ${accent}33` }}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#0A0A0A]">
        <Check className="h-4 w-4 shrink-0" style={{ color: accent }} strokeWidth={2.75} />
        <span className="truncate">{label}</span>
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#525252] [box-shadow:inset_0_0_0_1px_#E5E5E5]"
      >
        변경
      </button>
    </div>
  );
}

export function CardStudioPage45({
  isBusiness,
  store,
  coupons,
  dockCount = 0,
  initialPurpose,
}: {
  isBusiness: boolean;
  store: StudioLabStore | null;
  coupons: StudioLabCoupon[];
  /** FIX-9 — 도킹 가능(공개 발행) 카드 실카운트(loader head count). 가짜 숫자 금지. */
  dockCount?: number;
  /** ?purpose 진입 프리셋 — studio-build validateSearch 와 동등(정보|쿠폰|예약|구매). */
  initialPurpose?: "정보" | "쿠폰" | "예약" | "구매";
}) {
  const router = useRouter();
  // 목적 진입 쿼리 → 초기 모드 (studio-build 프리셋 시맨틱 동등: 초기값만, switchMode 미호출).
  const initialMode: BuildMode =
    initialPurpose === "구매" ? "commerce" : initialPurpose === "예약" || initialPurpose === "쿠폰" ? "reserve" : "general";

  const [mode, setMode] = useState<BuildMode>(initialMode);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [cardColor, setCardColor] = useState(CARD_BASE);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [mirrorOpen, setMirrorOpen] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  // 공개/비공개 — 손가락으로 좌우로 밀어서 전환 (정본).
  const visTrackRef = useRef<HTMLDivElement>(null);
  const [visDragPct, setVisDragPct] = useState<number | null>(null);
  const visDrag = useRef({ active: false, startX: 0, base: 0 });
  const [deckIndex, setDeckIndex] = useState(0);

  // 예약 캘린더 — 날짜/시간/좌석 (정본 45일 레일). SSR 안전: 날짜 리스트는 클라 마운트 후 생성
  // (new Date() 하이드레이션 불일치 방지 — 기존 mounted 게이트 패턴).
  const [dateList, setDateList] = useState<ReturnType<typeof buildDateList>>([]);
  useEffect(() => setDateList(buildDateList(45)), []);
  const DATE_OPTIONS = useMemo(() => dateList.map((d) => d.label), [dateList]);
  const [cfgDates, setCfgDates] = useState<string[]>([]);
  const [cfgTimes, setCfgTimes] = useState<string[]>([]);
  const [cfgSlotsByDate, setCfgSlotsByDate] = useState<Record<string, number>>({});
  const setSlotForDate = (date: string, next: number) =>
    setCfgSlotsByDate((prev) => ({ ...prev, [date]: Math.max(0, Math.min(20, next)) }));
  const dateRailRef = useRef<HTMLDivElement>(null);
  const [dateRailIdx, setDateRailIdx] = useState(0);
  // 판매 캘린더 — 판매 기간(시작~종료 인덱스).
  const [saleStartIdx, setSaleStartIdx] = useState(0);
  const [saleEndIdx, setSaleEndIdx] = useState(6);

  // 쿠폰 — 실 loader 쿠폰 목록에서 선택. ST2b 스위치 시 원본 제거(studio-build selectedCouponId 동형).
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId) ?? null;

  // 도킹 — 실 CardDockingPicker (studio-build DOCK-3 동형).
  const [dockedProducts, setDockedProducts] = useState<DockedProduct[]>([]);

  // 커머스 — ProductRegisterForm 임베드 결과 미러. ST2b 스위치 시 원본 제거(studio-build :380-396 동형).
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [productShareUrl, setProductShareUrl] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState<number | null>(null);
  const [productCopy, setProductCopy] = useState<ProductCopy45>({ headline: "", sellingPoints: [] });
  const [attachedProducts, setAttachedProducts] = useState<AttachedProduct[]>([]);

  // 대표 이미지 — 실 업로더(product-images 버킷). ST2b 스위치 시 원본 제거(studio-build :389-396).
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState<string | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  // 영상 — 실 검색(/api/discover)·선택·카피AI 리드. ST2b 스위치 시 원본 제거(studio-build :412-426).
  const [selectedVideo, setSelectedVideo] = useState<VideoSlot45 | null>(null);
  const [videoQuery, setVideoQuery] = useState("");
  const [videoResults, setVideoResults] = useState<DiscoverCandidate[]>([]);
  const [videoSearching, setVideoSearching] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoSearched, setVideoSearched] = useState(false);
  const [aiKeyPoints, setAiKeyPoints] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [pickedPoints, setPickedPoints] = useState<string[]>([]);
  const aiVideoRef = useRef<string | null>(null);

  // 콘텐츠 편집값 (정본).
  const [cfgTitle, setCfgTitle] = useState("");
  const [cfgSubtitle, setCfgSubtitle] = useState(""); // = 한마디(curator_message)
  const [cfgClip, setCfgClip] = useState("");
  // 추가 카드 편집값 (정본 — party/brand 는 프리뷰 반영, review/delivery 는 게이트).
  const [cfgParty, setCfgParty] = useState(2);
  const [cfgRating, setCfgRating] = useState(5);
  const [cfgReview, setCfgReview] = useState("");
  const [cfgShipFee, setCfgShipFee] = useState("무료");
  const [cfgShipEta, setCfgShipEta] = useState("2~3일");
  const [cfgCourier, setCfgCourier] = useState(COURIERS[0]);
  const [cfgShipStage, setCfgShipStage] = useState(0);
  const [cfgTrackingNo, setCfgTrackingNo] = useState("");
  const [cfgBrand, setCfgBrand] = useState("");
  const [cfgPhone, setCfgPhone] = useState(true);
  const [cfgMap, setCfgMap] = useState(true);
  // FIX-10 — 매장정보 실체화: partners 실값 프리필(주소·시설). 저장 = partners UPDATE
  //   (store-hub 명함 편집과 동일 RLS partners_owner_all 경로).
  const [cfgAddress, setCfgAddress] = useState(store?.address ?? "");
  const [storeSaving, setStoreSaving] = useState(false);
  const [cfgFacilities, setCfgFacilities] = useState<FacilityItem[]>(() =>
    Array.isArray(store?.facilities)
      ? (store!.facilities as unknown[])
          .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
          .map((f) => newFacility(f))
      : [],
  );
  const addFacility = (text = "") => setCfgFacilities((prev) => [...prev, newFacility(text)]);
  const editFacility = (id: string, text: string) =>
    setCfgFacilities((prev) => prev.map((f) => (f.id === id ? { ...f, text } : f)));
  const removeFacility = (id: string) => setCfgFacilities((prev) => prev.filter((f) => f.id !== id));

  // AI 광고영상/카탈로그 — 게이트(생성 배선 0). 선택 UI state 만 정본 유지.
  const [aivStyle, setAivStyle] = useState("dynamic");
  const [aivLength, setAivLength] = useState("15s");

  const [pressedId, setPressedId] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  // FIX-1/4 — 선택=미확정(candidate) → [확정/적용]=확정 패턴. 모든 선택형 패널 일관.
  const [videoCandidate, setVideoCandidate] = useState<DiscoverCandidate | null>(null);
  const [couponCandidate, setCouponCandidate] = useState<string | null>(null);
  const [colorCandidate, setColorCandidate] = useState<string | null>(null);
  // 적용 후 접힘(적용됨 · 변경) 패널 — coupon/calendar/seasonal/dock.
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});
  // FIX-16 — 링고 표면 통합(하단 스트립 폐지 · 단일 플로팅 캡슐): 상태 리터럴은 승계하되 의미 재정의
  //   "strip" = 캡슐(드래그 플로팅, 기본) / "panel" = 캡슐 자리 기준 확장 패널 / "closed" = 최소 아바타 점.
  //   완전 소멸 없음 — X 는 점까지만, 점 탭 = 캡슐 복귀. FIX-3 계약(자동 사라짐 없음·실상태 결합) 유지.
  const [lingoView, setLingoView] = useState<"strip" | "panel" | "closed">("strip");
  // 패널 확장 기준점 — 캡슐 위치(fabPos)에서 확장, 화면 경계 클램프.
  const [panelBottom, setPanelBottom] = useState(188);
  const [stripFlash, setStripFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX-6 — 발행 후 카톡 전송 진행 상태(studio-build sending 동형).
  const [sending, setSending] = useState(false);
  // FIX-14 — 상품 폼(45) 내부 비동기(등록/사진/AI카피)를 스트립 busy 에 결합(원인① 수정).
  const [formBusy, setFormBusy] = useState<string | null>(null);
  // FIX-15 — 상품 구성 메타(unit_label) → 미리보기 칩(미주입=미렌더).
  const [productUnitLabel, setProductUnitLabel] = useState<string | null>(null);
  const [lastEquipped, setLastEquipped] = useState<string | null>(null);
  const deckRef = useRef<HTMLElement>(null);
  const FAB_SIZE = 56;
  const FAB_MARGIN = 12;
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const [fabDragging, setFabDragging] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const fabDrag = useRef({ active: false, moved: false, dx: 0, dy: 0 });
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const [panelDragging, setPanelDragging] = useState(false);
  const panelDrag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  // 발행 — 기존 체인 재사용. ST2b 스위치 시 원본 제거(studio-build :398-405 동형).
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 히어로 카드가 화면에서 벗어나면 상단 조립 미니 미리보기 (정본 — IntersectionObserver, 클라 전용).
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), {
      rootMargin: "-58px 0px -68% 0px",
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const touchStart = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHold = useRef(false);

  const DECK = useMemo(() => DECK_IDS[mode].map(blockById), [mode]);
  const isMainBlock = (id: string) => MODE_MAIN_IDS[mode].includes(id);
  const accent = CARD_MODEL_ACCENTS[mode];
  const pageBg = PAGE_BG;

  // 모드 전환 — 정본: 장착·진행 초기화. 비사업자 잠금 = studio-build P6-3 완화 동등
  // (진입 허용 · 사업자 모드만 잠금).
  const switchMode = (next: BuildMode) => {
    if (next === mode) return;
    if (!isBusiness && next !== "general") {
      toast.info("예약·상품판매 카드는 사업자 인증 후 열려요.");
      return;
    }
    setMode(next);
    setApplied({});
    setDeckIndex(0);
    setDropped(false);
    setSavedUrl(null);
    setSaveError(null);
    setShowColorPicker(false);
    setCardColor(CARD_BASE);
  };

  // 공개/비공개 스와이프 (정본).
  function onVisPointerDown(e: React.PointerEvent) {
    visDrag.current = { active: true, startX: e.clientX, base: visibility === "public" ? 0 : 1 };
    setVisDragPct(visDrag.current.base);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onVisPointerMove(e: React.PointerEvent) {
    if (!visDrag.current.active) return;
    const track = visTrackRef.current;
    if (!track) return;
    const travel = track.clientWidth / 2;
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
    () => Math.min(100, STUDIO_BLOCKS.reduce((sum, b) => (applied[b.id] ? sum + b.power : sum), 0)),
    [applied],
  );
  const stage = getStage(score);
  const appliedCount = STUDIO_BLOCKS.filter((b) => applied[b.id] && !b.isPaid).length;

  // FIX-3 — 스트립 플래시: 확정 액션·비동기 완료 시에만 호출(실상태 결합, 가짜 진행 금지).
  //   burstKey +1 = 미리보기 카드 1회 하이라이트(기존 장착 버스트 연출 재사용).
  function flashStrip(msg: string) {
    setStripFlash(msg);
    setBurstKey((k) => k + 1);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setStripFlash(null), 2600);
  }
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  // FIX-3 — 모드별 진행 단계(실상태 파생 — 가짜 진행 없음).
  const steps = useMemo(() => {
    const productDone =
      !!attachedProducts[0] || (!!productImageUrl && !!productName.trim() && (productPrice ?? 0) > 0);
    const styleDone = !!applied["bgcolor"] || !!cfgSubtitle.trim() || score >= 40;
    if (mode === "commerce") {
      return [
        { label: "상품", block: "product", done: productDone },
        { label: "혜택", block: "coupon", done: !!(applied["coupon"] && selectedCouponId) || !!applied["seasonal"] },
        { label: "꾸미기", block: "bgcolor", done: styleDone },
        { label: "전송", block: null, done: dropped },
      ];
    }
    if (mode === "reserve") {
      return [
        { label: "영상", block: "content", done: !!selectedVideo },
        { label: "예약·혜택", block: "calendar", done: !!applied["calendar"] || !!(applied["coupon"] && selectedCouponId) },
        { label: "꾸미기", block: "bgcolor", done: styleDone },
        { label: "전송", block: null, done: dropped },
      ];
    }
    return [
      { label: "영상", block: "content", done: !!selectedVideo },
      { label: "꾸미기", block: "bgcolor", done: styleDone },
      { label: "전송", block: null, done: dropped },
    ];
  }, [mode, applied, selectedCouponId, selectedVideo, attachedProducts, productImageUrl, productName, productPrice, cfgSubtitle, score, dropped]);
  const currentStepIdx = steps.findIndex((s) => !s.done);
  const nextStepLabel = currentStepIdx >= 0 ? steps[currentStepIdx].label : null;

  // FIX-3 — 비동기 작업 진행 표시(실제 상태와 결합 — 스피너는 진행 중일 때만).
  const stripBusy = saving
    ? "카드를 발행하는 중…"
    : sending
      ? "카톡으로 전송하는 중…"
      : formBusy // FIX-14 — 상품 폼 내부 비동기(등록·사진·AI카피) 결합.
        ? formBusy
        : heroUploading
          ? "사진을 올리는 중…"
          : aiLoading
            ? "AI가 영상 요약을 읽는 중…"
            : videoSearching
              ? "영상을 찾는 중…"
              : null;

  // FIX-11 — LED 러닝 라이트: 실작업 중에만 점등, 완료 시 한 바퀴(2초) 마무리 후 정지.
  const [ledFinish, setLedFinish] = useState(false);
  const prevBusyRef = useRef(false);
  useEffect(() => {
    const busy = !!stripBusy;
    const wasBusy = prevBusyRef.current;
    prevBusyRef.current = busy;
    if (wasBusy && !busy) {
      setLedFinish(true);
      const t = setTimeout(() => setLedFinish(false), 2000);
      return () => clearTimeout(t);
    }
  }, [stripBusy]);
  const ledOn = !!stripBusy || ledFinish;

  // FIX-9 — 링고 능동 제안(규칙 기반, LLM 아님): 미장착·비게이트·비유료 중 전환력 기여
  //   최대 1개. 거절 시 세션 쿨다운(재노출 금지). 전송 준비 완료 시 제안 대신 수렴 문구.
  const [dismissedSuggests, setDismissedSuggests] = useState<string[]>([]);
  const [suggestVisible, setSuggestVisible] = useState(false);
  const readyToSend = !dropped && currentStepIdx >= 0 && steps[currentStepIdx].block === null;
  const suggestion = useMemo(() => {
    if (dropped || readyToSend) return null;
    return (
      DECK.filter(
        (b) => !b.isPaid && !GATED_BLOCK_IDS.has(b.id) && !applied[b.id] && !dismissedSuggests.includes(b.id),
      ).sort((a, b) => b.power - a.power)[0] ?? null
    );
  }, [DECK, applied, dismissedSuggests, dropped, readyToSend]);
  // 트리거 ① 단계 완료 — done 개수 증가 시.
  const doneCount = steps.filter((s) => s.done).length;
  const prevDoneRef = useRef(doneCount);
  useEffect(() => {
    if (doneCount > prevDoneRef.current) setSuggestVisible(true);
    prevDoneRef.current = doneCount;
  }, [doneCount]);
  // 트리거 ② 설정 패널 닫힘(적용 접힘) 시.
  const collapsedCount = Object.values(collapsedPanels).filter(Boolean).length;
  const prevCollapsedRef = useRef(collapsedCount);
  useEffect(() => {
    if (collapsedCount > prevCollapsedRef.current) setSuggestVisible(true);
    prevCollapsedRef.current = collapsedCount;
  }, [collapsedCount]);
  // 트리거 ③ 약 20초 무행동(주요 상호작용 시 리셋).
  useEffect(() => {
    const t = setTimeout(() => setSuggestVisible(true), 20000);
    return () => clearTimeout(t);
  }, [applied, deckIndex, mode, lingoView, cfgSubtitle, selectedVideo, collapsedPanels]);
  const showSuggest = !stripBusy && !stripFlash && suggestVisible && !!suggestion;

  // FIX-10 — 매장정보 저장(주소 + 시설 → partners UPDATE, RLS partners_owner_all).
  //   facilities 컬럼은 types.ts 미반영(마스터 신설)이라 as never 캐스트(기존 rpc 관례).
  async function handleStoreInfoSave() {
    if (!store || storeSaving) return;
    setStoreSaving(true);
    try {
      const facilities = cfgFacilities.map((f) => f.text.trim()).filter(Boolean);
      const { error } = await getSupabase()
        .from("partners")
        .update({ address: cfgAddress.trim() || null, facilities } as never)
        .eq("id", store.id);
      if (error) {
        console.error("[studio-lab] store info save failed:", error);
        toast.error("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("매장 정보를 저장했어요.");
      flashStrip("매장정보가 저장됐어요");
    } catch (err) {
      console.error("[studio-lab] store info save unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setStoreSaving(false);
    }
  }

  // 링고 코칭 — 정적 규칙 기반(정본 그대로 · LLM 아님). 게이트 블록은 추천에서 제외.
  const lingo = useMemo(() => {
    const deckBlocks = DECK_IDS[mode].map(blockById).filter((b) => !GATED_BLOCK_IDS.has(b.id));
    const nextLever = deckBlocks.filter((b) => !b.isPaid && !applied[b.id]).sort((a, b) => b.power - a.power)[0];
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
        text: nextLever ? `${nextLever.label}까지 더하면 전환력이 확 올라가요.` : "거의 다 됐어요. 마무리만 하면 완성!",
        action: nextLever?.id ?? null,
      };
    }
    return { text: "전환 레버가 충분해요. 강화(부스트)는 오픈 준비 중 — 지금은 전송으로 마무리해요.", action: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, score, mode]);

  function equip(block: StudioBlock) {
    // ★ 정직 게이트 — 백엔드 부재 블록은 장착 자체를 막는다(카드에 가짜 데이터 표시 금지).
    if (GATED_BLOCK_IDS.has(block.id)) {
      toast.info(GATE_NOTICE);
      return;
    }
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

  // 길게 누르면 아크릴 안내 패널, 짧게 탭하면 장착 (정본).
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

  // ── 링고AI 실행 헬퍼 (정본 — 규칙 기반, LLM 아님) ──
  const scrollToDeck = () => deckRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  function jumpToBlock(id: string) {
    const idx = DECK.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    setDeckIndex(idx);
    setTimeout(scrollToDeck, 60);
    return true;
  }
  // FIX-3 — 액션 수행 후 닫힘 금지: 패널 → 스트립으로 축소(다음 안내로 갱신), 완전 닫기는 X 만.
  function lingoEquipSuggestion() {
    if (!lingo.action) {
      scrollToDeck();
      setLingoView("strip");
      return;
    }
    const idx = DECK.findIndex((b) => b.id === lingo.action);
    if (idx < 0) {
      scrollToDeck();
      setLingoView("strip");
      return;
    }
    setDeckIndex(idx);
    const block = DECK[idx];
    if (!applied[block.id] && !(block.isPaid && score < ENHANCE_UNLOCK)) equip(block);
    setTimeout(scrollToDeck, 60);
    setLingoView("strip");
  }
  function lingoUndo() {
    if (!lastEquipped) return;
    setApplied((p) => ({ ...p, [lastEquipped]: false }));
    jumpToBlock(lastEquipped);
    setLastEquipped(null);
    setLingoView("strip");
  }
  function lingoEdit() {
    const priority = ["content", "product", "productimage", "image", "calendar", "seasonal", "coupon", "dock", "link"];
    const target =
      priority.find((id) => DECK.some((b) => b.id === id) && applied[id]) ??
      DECK.find((b) => CONFIGURABLE.includes(b.id) && !GATED_BLOCK_IDS.has(b.id))?.id;
    if (target) {
      if (!applied[target] && !(blockById(target).isPaid && score < ENHANCE_UNLOCK)) equip(blockById(target));
      jumpToBlock(target);
    } else {
      scrollToDeck();
    }
    setLingoView("strip");
  }

  // FIX-3 — [계속하기]: 현재 단계의 블록으로 흐름 복귀(전송 단계면 거울 시트).
  function continueFlow() {
    const step = steps[currentStepIdx >= 0 ? currentStepIdx : steps.length - 1];
    if (!step.block) {
      setMirrorOpen(true);
      return;
    }
    if (!jumpToBlock(step.block)) scrollToDeck();
  }
  const canEdit = DECK.some((b) => CONFIGURABLE.includes(b.id) && !GATED_BLOCK_IDS.has(b.id));

  // FIX-16 — 캡슐/점 공용 드래그(정본 FAB 로직 승격): 실측 폭 기준 클램프 + 엣지 스냅.
  //   위치(fabPos)는 세션 state 로 기억 — 리렌더·액션·상태 전환(점↔캡슐↔패널) 후에도 그 자리.
  function clampPos(x: number, y: number, w: number, h: number) {
    const maxX = window.innerWidth - w - FAB_MARGIN;
    const maxY = window.innerHeight - h - FAB_MARGIN;
    return { x: Math.min(Math.max(FAB_MARGIN, x), maxX), y: Math.min(Math.max(FAB_MARGIN, y), maxY) };
  }
  function onFabPointerDown(e: React.PointerEvent<HTMLElement>) {
    const rect = fabRef.current?.getBoundingClientRect();
    if (!rect) return;
    fabDrag.current = { active: true, moved: false, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onFabPointerMove(e: React.PointerEvent<HTMLElement>) {
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
    if (fabDrag.current.moved && rect) setFabPos(clampPos(nx, ny, rect.width, rect.height));
  }
  // 탭(무이동) 동작은 표면별로 다름 — onTap 콜백 주입(점 → 캡슐 / 캡슐 → 패널).
  function onFabPointerUp(onTap: () => void) {
    if (!fabDrag.current.active) return;
    const wasDrag = fabDrag.current.moved;
    fabDrag.current.active = false;
    fabDrag.current.moved = false;
    setFabDragging(false);
    if (wasDrag) {
      const rect = fabRef.current?.getBoundingClientRect();
      const w = rect?.width ?? FAB_SIZE;
      const h = rect?.height ?? FAB_SIZE;
      setFabPos((prev) => {
        if (!prev) return prev;
        const mid = window.innerWidth / 2;
        const snapX = prev.x + w / 2 < mid ? FAB_MARGIN : window.innerWidth - w - FAB_MARGIN;
        return clampPos(snapX, prev.y, w, h);
      });
    } else {
      onTap();
    }
  }
  // 캡슐 탭 = 그 자리 기준 패널 확장(화면 경계 클램프 — 캡슐 아래변 높이를 패널 bottom 으로).
  function openPanelAt() {
    const rect = fabRef.current?.getBoundingClientRect();
    if (rect && typeof window !== "undefined") {
      const fromCapsule = window.innerHeight - rect.bottom;
      setPanelBottom(Math.max(16, Math.min(window.innerHeight - 420, fromCapsule)));
    } else {
      setPanelBottom(188);
    }
    setPanelOffset({ x: 0, y: 0 });
    setLingoView("panel");
  }
  // 링고AI 패널 드래그 (정본).
  function onPanelPointerDown(e: React.PointerEvent) {
    panelDrag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: panelOffset.x, oy: panelOffset.y };
    setPanelDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPanelPointerMove(e: React.PointerEvent) {
    if (!panelDrag.current.active) return;
    const dx = panelDrag.current.ox + (e.clientX - panelDrag.current.sx);
    const dy = panelDrag.current.oy + (e.clientY - panelDrag.current.sy);
    const maxX = window.innerWidth * 0.4;
    const maxY = window.innerHeight * 0.5;
    setPanelOffset({ x: Math.min(Math.max(-maxX, dx), maxX), y: Math.min(Math.max(-maxY, dy), maxY) });
  }
  function onPanelPointerUp() {
    panelDrag.current.active = false;
    setPanelDragging(false);
  }

  // ── 영상 검색 — 실배선 /api/discover. ST2b 스위치 시 원본 제거(studio-build :606-634 발췌). ──
  const handleVideoSearch = async () => {
    const k = videoQuery.trim();
    if (!k || videoSearching) return;
    setVideoSearching(true);
    setVideoError(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: k }),
      });
      const json = (await res.json()) as { candidates?: DiscoverCandidate[]; message?: string };
      if (!res.ok) {
        setVideoError(json.message ?? "검색에 실패했어요.");
        setVideoResults([]);
        return;
      }
      setVideoResults((json.candidates ?? []).filter((c) => (c.provider as string) === "youtube"));
    } catch {
      setVideoError("네트워크 오류로 검색하지 못했어요.");
      setVideoResults([]);
    } finally {
      setVideoSearching(false);
      setVideoSearched(true);
    }
  };

  // 영상 선택 — 즉시 카드 반영 + 백그라운드 카피AI(oembed→generate-summary).
  // ST2b 스위치 시 원본 제거(studio-build :640-677 발췌).
  const handleSelectVideo = async (c: DiscoverCandidate) => {
    const slot = toVideoSlot(c);
    setSelectedVideo(slot);
    if (slot.durationLabel && !cfgClip) setCfgClip(slot.durationLabel);
    aiVideoRef.current = slot.videoId;
    setAiKeyPoints([]);
    setPickedPoints([]);
    setAiLoading(true);
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${slot.videoId}`;
      const oembedRes = await fetch("/api/oembed?url=" + encodeURIComponent(videoUrl));
      const oembedJson = (await oembedRes.json()) as { source_id?: string };
      const sourceId = oembedJson?.source_id;
      if (!oembedRes.ok || !sourceId) throw new Error("oembed failed");
      if (aiVideoRef.current !== slot.videoId) return;
      const sumRes = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
      const sumJson = (await sumRes.json()) as { ai_key_points?: unknown };
      if (!sumRes.ok) throw new Error("summary failed");
      if (aiVideoRef.current !== slot.videoId) return;
      const points = Array.isArray(sumJson?.ai_key_points)
        ? (sumJson.ai_key_points as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [];
      setAiKeyPoints(points);
      // FIX-3 — 비동기 완료 전환(실제 완료 시에만): 스트립 안내 + 미리보기 하이라이트.
      if (points.length > 0) flashStrip("AI 요약 완료! 셀링포인트를 골라보세요");
    } catch (e) {
      console.warn("[studio-lab] 카피 AI 리드 실패:", e);
      if (aiVideoRef.current === slot.videoId) setAiKeyPoints([]);
    } finally {
      if (aiVideoRef.current === slot.videoId) setAiLoading(false);
    }
  };

  // ── 대표 이미지 업로드 — 실배선(product-images 버킷). ST2b 스위치 시 원본 제거(studio-build :1057-1098 발췌). ──
  async function handleHeroImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setHeroUploadError(null);
    const localUrl = URL.createObjectURL(file);
    setHeroImagePreview(localUrl);
    setHeroUploading(true);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        setHeroUploadError("로그인이 필요해요.");
        setHeroImagePreview(null);
        return;
      }
      const blob = await resizeToJpegBlob(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) {
        console.error("[studio-lab] hero upload failed:", upErr);
        setHeroUploadError("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setHeroImagePreview(null);
        return;
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setHeroImageUrl(pub.publicUrl);
      setHeroImagePreview(pub.publicUrl);
      setApplied((p) => ({ ...p, image: true }));
      flashStrip("완료! 사진이 카드에 반영됐어요"); // FIX-3 — 실업로드 완료 시에만.
    } catch (err) {
      console.error("[studio-lab] hero unexpected:", err);
      setHeroUploadError(err instanceof Error ? err.message : "사진 처리 중 문제가 생겼어요.");
      setHeroImagePreview(null);
    } finally {
      setHeroUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  // ── 상품 등록 제출 — 실배선(/api/drops self_upload). ST2b 스위치 시 원본 제거(studio-build :1104-1148 발췌). ──
  async function submitStudioProduct(payload: ProductRegisterPayload45): Promise<ProductRegisterResult45> {
    const res = await fetch("/api/drops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as {
      drop?: { id?: string; share_uuid?: string };
      shareable_url?: string;
      message?: string;
    };
    if (!res.ok || !json.drop?.share_uuid) {
      throw new Error(json.message ?? "DROP_CREATE_FAILED");
    }
    const dropId = json.drop.id ?? null;
    const shareUuid = json.drop.share_uuid;
    setProductImageUrl(payload.image_url);
    setProductShareUrl(json.shareable_url ?? `https://app.drop.how/d/${shareUuid}`);
    setProductName(payload.name ?? "");
    setProductPrice(payload.price_krw);
    setProductCopy({ headline: payload.headline, sellingPoints: payload.selling_points });
    if (dropId) {
      setAttachedProducts((prev) => [
        ...prev,
        {
          refDropId: dropId,
          refShareUuid: shareUuid,
          name: payload.name ?? "",
          priceKrw: payload.price_krw,
          imageUrl: payload.image_url,
          ...(payload.headline ? { headline: payload.headline } : {}),
          ...(payload.selling_points.length ? { sellingPoints: payload.selling_points } : {}),
        },
      ]);
    }
    setApplied((p) => ({ ...p, product: true }));
    // FIX-15 — 구성 메타(unit_label) 미러 → 미리보기 상품 메타 칩("구성: 1박스 · 20개입").
    const unitLabel = (payload.blocks?.[0]?.block_data as { unit_label?: unknown } | undefined)?.unit_label;
    setProductUnitLabel(typeof unitLabel === "string" && unitLabel ? `구성: ${unitLabel}` : null);
    flashStrip("완료! 상품이 카드에 반영됐어요"); // FIX-3 — 실등록 완료 시에만.
    return { shareUuid, shareUrl: json.shareable_url ?? `https://app.drop.how/d/${shareUuid}` };
  }

  // ── 발행 — 기존 체인 동일 재사용. ST2b 스위치 시 원본 제거(studio-build handleSaveDrop :683-890 발췌). ──
  async function handlePublish(): Promise<boolean> {
    if (mode !== "commerce" && !selectedVideo) {
      setSaveError("영상을 먼저 선택해주세요.");
      return false;
    }
    if (mode === "commerce") {
      const hasProductImage = !!productImageUrl || !!heroImageUrl || !!attachedProducts?.[0]?.refDropId;
      if (!hasProductImage) {
        setSaveError("상품 사진을 올려주세요.");
        return false;
      }
      if (!productName.trim()) {
        setSaveError("상품 이름을 입력해주세요.");
        return false;
      }
      if (!((productPrice ?? 0) > 0)) {
        setSaveError("가격을 입력해주세요.");
        return false;
      }
    }
    if (saving) return false;
    setSaving(true);
    setSaveError(null);
    try {
      const mediaUrl = selectedVideo ? `https://www.youtube.com/watch?v=${selectedVideo.videoId}` : null;
      const hasCoupon = !!applied["coupon"] && !!selectedCouponId;
      const hasReservation = !!applied["calendar"];
      const dropPurpose = hasReservation ? "예약" : hasCoupon ? "쿠폰" : "정보";
      const dockBlocks =
        applied["dock"] && dockedProducts.length > 0
          ? dockedProducts.map((p) => ({
              block_kind: "product",
              block_data: {
                ref_drop_id: p.refDropId,
                ref_share_uuid: p.refShareUuid,
                name: p.name,
                price_krw: p.priceKrw,
                image_url: p.imageUrl,
                ...(p.producerName ? { producer_name: p.producerName } : {}),
              },
            }))
          : [];
      const extraBlocks = [
        ...(applied["image"] && heroImageUrl ? [{ block_kind: "image", block_data: { image_url: heroImageUrl } }] : []),
        ...dockBlocks,
      ].map((b, i) => ({ ...b, position: i }));
      const isPublic = visibility === "public";
      const body =
        mode === "commerce"
          ? {
              self_upload: true,
              image_url: productImageUrl,
              name: productName.trim(),
              price_krw: productPrice,
              headline: productCopy.headline,
              selling_points: productCopy.sellingPoints,
              price_band_enabled: false, // §0 시세 영구 금지
              is_public: isPublic,
              blocks: [
                { block_kind: "product", block_data: { name: productName.trim(), price_krw: productPrice }, position: 0 },
              ],
            }
          : {
              media_url: mediaUrl,
              purpose: dropPurpose,
              curator_message: cfgSubtitle.trim() || null,
              is_public: isPublic,
              partner_id: store?.id ?? null,
              ...(extraBlocks.length > 0 ? { blocks: extraBlocks } : {}),
            };
      // 커머스 = 폼 제출로 이미 생성된 상품 드롭 A 재사용(이중 생성 방지 — P6-6 동일).
      const reusedProduct = mode === "commerce" && attachedProducts[0]?.refDropId ? attachedProducts[0] : null;
      let dropId: string | null;
      let publishedShareUuid: string;
      let shareableUrl: string | null;
      if (reusedProduct) {
        dropId = reusedProduct.refDropId;
        publishedShareUuid = reusedProduct.refShareUuid;
        shareableUrl = productShareUrl;
      } else {
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
          setSaveError(json.message ?? "카드 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
          return false;
        }
        dropId = json.drop.id ?? null;
        publishedShareUuid = json.drop.share_uuid;
        shareableUrl = json.shareable_url ?? null;
      }

      const supabase = getSupabase();
      // ① 쿠폰 연결 — best-effort.
      if (dropId && hasCoupon && supabase) {
        try {
          const { error: couponErr } = await supabase.rpc("set_drop_funnel_coupon", {
            p_drop_id: dropId,
            p_coupon_id: selectedCouponId,
          });
          if (couponErr) console.warn("[studio-lab] 쿠폰 연결 실패:", couponErr.message);
        } catch (e) {
          console.warn("[studio-lab] set_drop_funnel_coupon exception:", e);
        }
      }
      // ② 셀링포인트 영속화 — 비커머스만(S10 저장 누수 차단 동일). best-effort.
      if (dropId && mode !== "commerce" && pickedPoints.length > 0 && supabase) {
        try {
          const { error: kpErr } = await supabase.rpc("update_drop_key_points", {
            p_drop_id: dropId,
            p_points: pickedPoints,
          });
          if (kpErr) console.warn("[studio-lab] 셀링포인트 저장 실패:", kpErr.message);
        } catch (e) {
          console.warn("[studio-lab] update_drop_key_points exception:", e);
        }
      }
      // ③ 카드색 영속화 — 6색 팔레트 값(또는 기본 화이트) 저장. best-effort.
      if (dropId && cardColor && supabase) {
        try {
          const { error: colorErr } = await supabase.rpc("set_drop_card_color", {
            p_drop_id: dropId,
            p_color: cardColor,
          });
          if (colorErr) console.warn("[studio-lab] 카드색 저장 실패:", colorErr.message);
        } catch (e) {
          console.warn("[studio-lab] set_drop_card_color exception:", e);
        }
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
      setSavedUrl(shareableUrl ?? `${origin}/d/${publishedShareUuid}`);
      setDropped(true);
      flashStrip("발행 완료! 카톡으로 바로 전송해 보세요"); // FIX-3/6 — 실발행 성공 시에만.
      return true;
    } catch (e) {
      console.error("[studio-lab] handlePublish", e);
      setSaveError("카드 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // FIX-6 — 발행 후 카톡 전송: 기존 플로우 미러(버튼식 · 게시 완료 후에만 · 클릭 즉시 shareToKakao
  //   = 제스처 유효로 팝업차단 회피). ST2b 스위치 시 원본 제거(studio-build :896-936 발췌).
  async function handleSendKakao() {
    if (sending || saving) return;
    if (!dropped || !savedUrl) return;
    setSending(true);
    try {
      const linkUrl = savedUrl;
      const purposeLabel =
        mode === "commerce"
          ? "구매"
          : applied["calendar"]
            ? "예약"
            : applied["coupon"] && selectedCouponId
              ? "쿠폰"
              : "정보";
      const title = (mode === "commerce" ? productName.trim() : selectedVideo?.title) || "LinkDrop";
      const imageUrl = (mode === "commerce" ? productImageUrl : selectedVideo?.thumbnailUrl) ?? "";
      const ctaTitle =
        purposeLabel === "구매"
          ? "상품 보러 가기"
          : purposeLabel === "예약" || purposeLabel === "쿠폰"
            ? "예약하고 혜택 받기"
            : "보러 가기";
      const res = await shareToKakao({
        title,
        description: [purposeLabel, cfgSubtitle.trim()].filter(Boolean).join(" · "),
        imageUrl,
        linkUrl,
        buttons: [{ title: ctaTitle, link: linkUrl }],
      });
      if (!res?.ok) {
        setSaveError("전송에 실패했어요. 링크가 복사됐으니 붙여넣어 보내주세요.");
      }
    } finally {
      setSending(false);
    }
  }

  const activeBlock = DECK[deckIndex];
  const activeApplied = !!applied[activeBlock.id];
  const activeGated = GATED_BLOCK_IDS.has(activeBlock.id);
  const activeLocked = (!!activeBlock.isPaid && score < ENHANCE_UNLOCK) || activeGated;

  // 모드별 카드 표시 기본값 — 정본 MODE_CONTENT 의 데모 카피 제거(실값 + 안내 placeholder).
  const storeName = store?.display_name ?? "";
  const content = useMemo(() => {
    if (mode === "commerce") {
      return {
        category: "상품판매 카드",
        categoryIcon: Store,
        store: storeName || "내 매장",
        source: storeName ? `${storeName} · 산지·매장 직접 판매` : "내 상품 · 직접 판매",
        titleFallback: productName || "상품 이름을 등록해 보세요",
        subtitleFallback: productCopy.headline || "상품 등록에서 홍보 문구를 채워보세요",
      };
    }
    if (mode === "reserve") {
      return {
        category: "예약 · 쿠폰 카드",
        categoryIcon: Calendar,
        store: storeName || "내 매장",
        source: selectedVideo ? `YouTube · ${selectedVideo.title}` : "YouTube",
        titleFallback: storeName || "매장 이름이 카드 제목이 돼요",
        subtitleFallback: "한마디를 입력해 보세요",
      };
    }
    return {
      category: "퍼블릭 카드",
      categoryIcon: Globe,
      store: storeName || "내 채널",
      source: selectedVideo ? "YouTube · 공유 콘텐츠" : "YouTube",
      titleFallback: selectedVideo?.title || "영상을 고르면 제목이 채워져요",
      subtitleFallback: "한마디를 입력해 보세요",
    };
  }, [mode, storeName, productName, productCopy.headline, selectedVideo]);

  // 제작=공유=수신 거울 — fromStudioState(어댑터) + 스튜디오 로컬 프리뷰 필드 병합.
  const couponTitle =
    selectedCoupon?.title ??
    (selectedCoupon ? `${selectedCoupon.discount_value ?? ""}${selectedCoupon.discount_unit ?? ""} 할인` : undefined);
  const cardModel: CardModel = fromStudioState(
    {
      buildMode: mode,
      cardColor,
      applied,
      tagline: cfgSubtitle,
      selectedVideo,
      pickedPoints,
      selectedCoupon: applied["coupon"] && couponTitle ? { title: couponTitle } : null,
      storeName: content.store,
      storePhone: cfgPhone ? (store?.contact_phone ?? null) : null,
      storeAddress: cfgMap ? (cfgAddress.trim() || store?.address || null) : null,
      productName,
      productPrice,
      productImageUrl: productImageUrl ?? undefined,
      productCopy,
      dockedProduct: applied["dock"] ? (dockedProducts[0] ?? null) : null,
    },
    {
      // 프리뷰 전용 필드(미영속) — 45 설정 UI 값이 거울에 그대로 흐른다.
      pageBg,
      category: content.category,
      categoryIcon: content.categoryIcon,
      source: content.source,
      titleText: cfgTitle.trim() || (mode === "commerce" ? productName || content.titleFallback : content.titleFallback),
      subtitleText: cfgSubtitle.trim() || content.subtitleFallback,
      ...(cfgClip ? { clip: cfgClip } : {}),
      ...(applied["image"] && heroImagePreview && mode !== "commerce" ? { heroImageUrl: heroImagePreview } : {}),
      ...(applied["brand"] && cfgBrand.trim() ? { brandText: cfgBrand.trim() } : {}),
      ...(applied["party"] ? { party: cfgParty } : {}),
      ...(applied["calendar"] && cfgDates.length > 0
        ? { dates: cfgDates, times: cfgTimes, slotsByDate: cfgSlotsByDate }
        : {}),
      ...(applied["seasonal"] && DATE_OPTIONS.length > 0
        ? { saleStart: DATE_OPTIONS[saleStartIdx], saleEnd: DATE_OPTIONS[saleEndIdx] }
        : {}),
      ...(applied["link"] ? { facilities: cfgFacilities.map((f) => f.text.trim()).filter(Boolean) } : {}),
      // FIX-15 — 상품 구성 메타 칩(등록 폼 unit_label 미러, 미주입=미렌더).
      ...(mode === "commerce" && productUnitLabel ? { productUnitLabel } : {}),
      // 여정·확산 — 정본 데모(SHARE_JOURNEY·12명) 제거: 실 여정은 수신 후 생기는 것. 미주입=미렌더.
    },
  );

  return (
    // FIX-16 — 하단 스트립 폐지: 본문 패딩은 전송 CTA 기준 원복(pb-[120px]).
    <div className="min-h-screen pb-[120px] transition-colors duration-300" style={{ backgroundColor: pageBg }}>
      <style>{SL_KEYFRAMES}</style>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#EDEDED] bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
              else window.location.assign("/home");
            }}
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
                  style={{ fill: i < stage.stars ? accent : "transparent", color: i < stage.stars ? accent : "#D4D4D4" }}
                  strokeWidth={2.25}
                />
              ))}
            </span>
            <span className="text-[11px] font-bold text-[#0A0A0A]">{stage.label}</span>
          </span>
        </div>
      </header>

      {/* 스티키 조립 미니 미리보기 (히어로 카드가 화면 밖일 때 등장)
          FIX-2 — 모드 토글이 스티키 스택(헤더 아래)에 통합돼 미니 미리보기는 그 아래(top-[134px])
          에서 시작 — 스크롤 전 구간에서 두 요소 비겹침. */}
      <div
        aria-hidden={heroVisible}
        className={`pointer-events-none fixed inset-x-0 top-[134px] z-[31] transition-all duration-300 ease-out ${
          heroVisible ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="mx-auto max-w-md px-5 pt-2">
          <div className="flex items-center gap-3 rounded-2xl bg-white/95 p-2.5 pr-3 backdrop-blur-lg [box-shadow:0_10px_28px_-10px_rgba(15,23,42,0.22),0_0_0_1px_#EAEAEA]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F5] text-[#525252]">
              <content.categoryIcon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-[#0A0A0A]">{cardModel.titleText}</p>
              <div className="mt-1 flex items-center gap-1">
                {DECK.filter((b) => applied[b.id]).length ? (
                  <>
                    {DECK.filter((b) => applied[b.id])
                      .slice(0, 4)
                      .map((b) => {
                        const BIcon = b.icon;
                        return (
                          <span key={b.id} className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F0F0F0] text-[#525252]" title={b.label}>
                            <BIcon className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                        );
                      })}
                    {DECK.filter((b) => applied[b.id]).length > 4 && (
                      <span className="text-[10px] font-bold text-[#A3A3A3]">+{DECK.filter((b) => applied[b.id]).length - 4}</span>
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
        {/* 모드 전환 (퍼블릭 / 예약·쿠폰 / 상품판매) — 비사업자는 사업자 모드 잠금(studio-build P6-3 동등)
            FIX-2 — 스티키 스택 상단 통합: 헤더(57px) 바로 아래 고정 + 페이지 배경으로 아래 콘텐츠 가림. */}
        {/* FIX-8 z-스택: 모드탭(z-30) < 미니 미리보기(z-31) < 스트립(z-38) < 패널(z-40) < 거울 시트(z-60) */}
        <div className="sticky top-[57px] z-30 -mx-5 px-5 pb-2 pt-4" style={{ backgroundColor: pageBg }}>
        <div className="flex rounded-2xl bg-white p-1 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          {(
            [
              { key: "general", label: "퍼블릭", Icon: Globe },
              { key: "reserve", label: "예약·쿠폰", Icon: Calendar },
              { key: "commerce", label: "상품판매", Icon: Store },
            ] as const
          ).map(({ key, label, Icon }) => {
            const isOn = mode === key;
            const modeLocked = !isBusiness && key !== "general";
            return (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all duration-200 ${
                  isOn ? "text-white" : modeLocked ? "text-[#B4B4B4]" : "text-[#737373]"
                }`}
                style={isOn ? { backgroundColor: accent, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(15,23,42,0.14)" } : undefined}
                aria-pressed={isOn}
              >
                {modeLocked ? <Lock className="h-4 w-4" strokeWidth={2.25} /> : <Icon className="h-4 w-4" strokeWidth={2.25} />}
                {label}
              </button>
            );
          })}
        </div>
        </div>

        {/* AI 빌더 — 정본 UI 유지 + T5 게이트(LLM 배선 금지): 입력·예시 비활성 + 준비 중 칩.
            T5 트랙 예약석 — 오픈 시 sendToLingo(한 줄 → 카드 통구성) 재배선. */}
        <section className="mt-4 rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
              <MessageCircle className="h-[17px] w-[17px]" strokeWidth={2.25} />
              <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3" strokeWidth={2.5} fill="currentColor" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[14px] font-bold leading-tight text-[#0A0A0A]">
                AI로 카드 만들기
                <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#64748B]">오픈 준비 중</span>
              </p>
              <p className="text-[11px] font-medium text-[#8A8A8A]">한 줄로 설명하면 카드를 통째로 구성해드려요</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 rounded-full bg-[#F4F4F5] py-1.5 pl-4 pr-1.5 opacity-60">
            <input
              disabled
              placeholder="곧 열려요 — 지금은 아래 덱에서 직접 만들 수 있어요"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#9A9A9A]"
            />
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </span>
          </div>
        </section>

        {/* 라이브 프리뷰 라벨 (WYSIWYG 캔버스 안내) */}
        <div className="mt-5 flex items-center justify-between px-0.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#525252]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: accent }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            </span>
            실시간 미리보기
          </span>
          <span className="text-[11px] font-medium text-[#8A8A8A]">보이는 그대로 공유돼요</span>
        </div>

        {/* 히어로: 라이브 캔버스 카드 — ST1 CardModelBody(studio) 거울 */}
        <section ref={heroRef} className="pt-2.5">
          <div>
            <CardModelBody model={cardModel} variant="studio" burstKey={burstKey} />
          </div>
        </section>

        {/* 전환력 게이지 */}
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
            <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${score}%`, backgroundColor: accent }} />
          </div>
          <p className="mt-2 text-[11px] text-[#8A8A8A]">
            레버 {appliedCount}개 장착 · 강화는 {ENHANCE_UNLOCK}점부터 열려요
          </p>
        </section>

        {/* 링고AI 코칭 (탭하면 어시스턴트 열림) — 정적 규칙 기반 */}
        <button
          type="button"
          onClick={() => setLingoView("panel")}
          className="sl-fade-in mt-3 flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left transition-transform duration-150 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)] active:scale-[0.99]"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
            <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
            <Sparkles className="absolute -right-0.5 -top-0.5 h-[11px] w-[11px]" strokeWidth={2.5} fill="currentColor" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-[#0A0A0A]">링고AI</span>
              <span className="rounded-full border border-[#E5E5E5] px-1.5 py-0.5 text-[9px] font-bold text-[#737373]">전환 코칭</span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-[#525252]">{lingo.text}</p>
          </div>
          <span className="mt-0.5 flex shrink-0 items-center gap-0.5 rounded-full bg-[#F4F4F5] px-2 py-1 text-[11px] font-bold text-[#525252]">
            도움받기
            <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </button>
      </div>

      {/* 강화 카드 덱 (스와이프 → 탭 장착) */}
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
            const gated = GATED_BLOCK_IDS.has(block.id);
            const locked = (!!block.isPaid && score < ENHANCE_UNLOCK) || gated;
            const isCenter = offset === 0;
            return (
              <button
                key={block.id}
                type="button"
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
                  transform: `translate(-50%, -50%) translateX(${offset * 56}%) rotateY(${offset * -24}deg) scale(${isCenter ? 1 : 0.8})`,
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
                        block.isPaid ? "bg-[#F5F5F5] text-[#737373]" : isMainBlock(block.id) ? "text-white" : "bg-[#F5F5F5] text-[#525252]"
                      }`}
                      style={isMainBlock(block.id) && !block.isPaid ? { backgroundColor: accent } : undefined}
                    >
                      {block.isPaid ? "강화" : isMainBlock(block.id) ? "핵심" : "레버"}
                    </span>
                    {block.power > 0 ? (
                      <span className="flex items-center gap-0.5 text-[15px] font-bold tabular-nums" style={{ color: accent }}>
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
                    <p className="flex items-center gap-1.5 text-[16px] font-bold leading-tight text-[#0A0A0A]">
                      {block.label}
                      {gated && (
                        <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-bold text-[#64748B]">준비 중</span>
                      )}
                      {/* FIX-9 — 도킹 가용 수 배지(실카운트, 0장이면 미표기 — 가짜 숫자 금지). */}
                      {block.id === "dock" && dockCount > 0 && (
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums" style={{ backgroundColor: `${accent}14`, color: accent }}>
                          {dockCount}장 가능
                        </span>
                      )}
                    </p>
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
                      className="sl-pop absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: accent, boxShadow: "0 1px 3px rgba(15,23,42,0.2), 0 0 0 2px #fff" }}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </div>
                  )}

                  {/* 아크릴 안내 패널 — 카드를 누르고 있는 동안 떠오름 */}
                  <div
                    className={`absolute inset-0 flex flex-col justify-end rounded-3xl p-5 transition-all duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] ${
                      pressedId === block.id ? "pointer-events-none opacity-100" : "pointer-events-none opacity-0"
                    }`}
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.62) 55%, rgba(255,255,255,0.86) 100%)",
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
                    <p className="mt-1.5 text-[12px] font-medium leading-[1.5] text-[#1F2937]">{block.detail}</p>
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
              type="button"
              onClick={() => jumpTo(i)}
              aria-label={`${b.label}로 이동`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === deckIndex ? 20 : 6, backgroundColor: i === deckIndex ? accent : "#D4D4D4" }}
            />
          ))}
        </div>

        {/* 장착 액션 (가운데 카드 대상) */}
        <div className="mx-auto mt-4 max-w-md px-5">
          {/* 배경색 팔레트 — 정본 6색. FIX-4 일관 패턴: 스와치 탭=후보 → [적용]=확정(카드 반영). */}
          {activeBlock.id === "bgcolor" && showColorPicker && (
            <div className="sl-fade-in mb-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[...CARD_COLORS, { id: "base", value: CARD_BASE, label: "기본" }].map((c) => {
                  const pick = colorCandidate ?? cardColor;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColorCandidate(c.value)}
                      className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c.value,
                        boxShadow:
                          pick === c.value
                            ? `0 0 0 2px #fff, 0 0 0 4px ${accent}`
                            : cardColor === c.value
                              ? `0 0 0 2px #fff, 0 0 0 3px ${accent}66`
                              : "0 0 0 1px #E5E5E5",
                      }}
                      aria-label={c.label}
                    />
                  );
                })}
              </div>
              {colorCandidate && colorCandidate !== cardColor && (
                <button
                  type="button"
                  onClick={() => {
                    setCardColor(colorCandidate);
                    setColorCandidate(null);
                    setShowColorPicker(false);
                    flashStrip(`배경색이 적용됐어요${nextStepLabel ? ` — 다음은 ${nextStepLabel}` : ""}`);
                  }}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-transform active:translate-y-px"
                  style={{ backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }}
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  이 색으로 적용
                </button>
              )}
            </div>
          )}

          {/* 블록 설정 패널 — 장착과 동시에 값을 채우면 카드에 바로 반영. 게이트 블록은 미리보기+준비 중. */}
          {(activeApplied || activeGated) && CONFIGURABLE.includes(activeBlock.id) && (
            <div className="sl-fade-in mb-3 rounded-2xl bg-white p-3.5" style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}>
              <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-bold text-[#0A0A0A]">
                <activeBlock.icon className="h-3.5 w-3.5 text-[#525252]" strokeWidth={2.5} />
                {activeBlock.label} 설정
                <span className="ml-auto text-[10px] font-semibold text-[#8A8A8A]">
                  {activeGated ? "오픈 준비 중 — 미리보기예요" : "카드에 바로 반영돼요"}
                </span>
              </p>

              <div className={activeGated ? "pointer-events-none opacity-55" : undefined}>
                {/* 예약 캘린더 / 판매 캘린더 — FIX-4: 하단 [적용] 확정 → 접힘(적용됨 · 변경). */}
                {(activeBlock.id === "calendar" || activeBlock.id === "seasonal") &&
                collapsedPanels[activeBlock.id] ? (
                  <AppliedRow
                    accent={accent}
                    label={
                      activeBlock.id === "calendar"
                        ? `적용됨 · ${cfgDates.length}일 · ${cfgTimes.length === 0 ? "시간 미지정" : `${cfgTimes.length}개 시간대`}`
                        : `적용됨 · ${DATE_OPTIONS[saleStartIdx] ?? ""}${saleEndIdx !== saleStartIdx ? ` ~ ${DATE_OPTIONS[saleEndIdx] ?? ""}` : ""}`
                    }
                    onEdit={() => setCollapsedPanels((p) => ({ ...p, [activeBlock.id]: false }))}
                  />
                ) : null}
                {(activeBlock.id === "calendar" || activeBlock.id === "seasonal") &&
                !collapsedPanels[activeBlock.id] && (
                  <div className="space-y-2.5">
                    {activeBlock.id === "seasonal" ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                          <Calendar className="h-4 w-4 shrink-0 text-[#525252]" strokeWidth={2.25} />
                          <span className="text-[12px] font-semibold text-[#525252]">판매 기간</span>
                          <span className="ml-auto text-[12px] font-bold tabular-nums text-[#0A0A0A]">
                            {DATE_OPTIONS[saleStartIdx] ?? ""}
                            {saleEndIdx !== saleStartIdx ? ` ~ ${DATE_OPTIONS[saleEndIdx] ?? ""}` : ""}
                            <span className="ml-1.5 text-[11px] font-semibold text-[#8A8A8A]">({saleEndIdx - saleStartIdx + 1}일간)</span>
                          </span>
                        </div>
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">시작일</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DATE_OPTIONS.slice(0, 10).map((d, i) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  setSaleStartIdx(i);
                                  if (i > saleEndIdx) setSaleEndIdx(i);
                                }}
                                className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                                style={saleStartIdx === i ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: "#F4F4F5", color: "#525252" }}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">종료일</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DATE_OPTIONS.slice(0, 10).map((d, i) => {
                              const disabled = i < saleStartIdx;
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => setSaleEndIdx(i)}
                                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-35"
                                  style={saleEndIdx === i ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: "#F4F4F5", color: "#525252" }}
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <p className="rounded-xl bg-[#F7F7F8] px-3 py-2 text-[11px] font-medium leading-relaxed text-[#8A8A8A]">
                          판매 기간은 카드 미리보기에 표시돼요. 기간 자동 마감은 오픈 준비 중이에요.
                        </p>
                      </div>
                    ) : (
                      // 예약 캘린더 — 정본 3단계(날짜→시간→자리수). 프리뷰 반영, 실 슬롯 저장은 매장 캘린더 소관.
                      <div className="space-y-3">
                        <section className="rounded-xl border border-[#EDEDED] p-2.5">
                          <div className="mb-2 flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A] text-[9px] font-extrabold text-white">1</span>
                            <p className="text-[11px] font-bold text-[#0A0A0A]">예약 가능일</p>
                            {dateList.length > 0 && (
                              <span className="rounded-md bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#525252]">
                                {dateList[Math.min(dateRailIdx, dateList.length - 1)].year}.
                                {String(dateList[Math.min(dateRailIdx, dateList.length - 1)].month).padStart(2, "0")}
                              </span>
                            )}
                            <span className="ml-auto text-[10px] font-semibold text-[#8A8A8A]">{cfgDates.length}일 선택</span>
                          </div>
                          <div className="relative">
                            <div
                              ref={dateRailRef}
                              onScroll={(e) =>
                                setDateRailIdx(Math.min(dateList.length - 1, Math.max(0, Math.round(e.currentTarget.scrollLeft / 46))))
                              }
                              className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            >
                              {dateList.map((d) => {
                                const on = cfgDates.includes(d.label);
                                const seats = cfgSlotsByDate[d.label] ?? 0;
                                return (
                                  <button
                                    key={d.label}
                                    type="button"
                                    onClick={() =>
                                      setCfgDates((prev) => {
                                        const isOn = prev.includes(d.label);
                                        const next = isOn ? prev.filter((x) => x !== d.label) : [...prev, d.label];
                                        const ordered = DATE_OPTIONS.filter((o) => next.includes(o));
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
                                    style={{ backgroundColor: on ? "#0A0A0A" : "#F7F7F8", borderColor: on ? "#0A0A0A" : "transparent" }}
                                  >
                                    <span className="text-[9px] font-bold leading-none" style={{ color: on ? "rgba(255,255,255,0.75)" : "#8A8A8A" }}>
                                      {WEEKDAY_KR[d.dow]}
                                    </span>
                                    <span className="text-[15px] font-extrabold leading-none tabular-nums" style={{ color: on ? "#fff" : "#0A0A0A" }}>
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
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
                          </div>
                        </section>

                        <section className="rounded-xl border border-[#EDEDED] p-2.5">
                          <div className="mb-2 flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A] text-[9px] font-extrabold text-white">2</span>
                            <p className="text-[11px] font-bold text-[#0A0A0A]">예약 가능 시간</p>
                            <span className="ml-auto text-[10px] font-semibold text-[#8A8A8A]">
                              {cfgTimes.length === 0 ? "시간 미지정" : `${cfgTimes.length}개 시간대`}
                            </span>
                          </div>
                          <div className="relative">
                            <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              <button
                                type="button"
                                onClick={() => setCfgTimes([])}
                                className="flex h-10 flex-none snap-start items-center justify-center rounded-xl border px-4 text-[12px] font-bold transition-colors"
                                style={
                                  cfgTimes.length === 0
                                    ? { backgroundColor: "#0A0A0A", borderColor: "#0A0A0A", color: "#fff" }
                                    : { backgroundColor: "#fff", borderColor: "#E5E5E5", color: "#8A8A8A" }
                                }
                              >
                                해당없음
                              </button>
                              {TIME_OPTIONS.map((t) => {
                                const on = cfgTimes.includes(t);
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() =>
                                      setCfgTimes((prev) => {
                                        const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t];
                                        return TIME_OPTIONS.filter((o) => next.includes(o));
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

                        <section className="rounded-xl border border-[#EDEDED] p-2.5">
                          <div className="mb-2 flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A] text-[9px] font-extrabold text-white">3</span>
                            <p className="text-[11px] font-bold text-[#0A0A0A]">날짜별 잔여 자리</p>
                            <span className="ml-auto text-[10px] text-[#8A8A8A]">날짜마다 다르게</span>
                          </div>
                          <div className="space-y-1.5">
                            {DATE_OPTIONS.filter((d) => cfgDates.includes(d)).map((d) => {
                              const seats = cfgSlotsByDate[d] ?? 4;
                              return (
                                <div key={d} className="flex items-center justify-between rounded-lg bg-[#F7F7F8] py-1.5 pl-2.5 pr-2.5">
                                  <span className="text-[12px] font-bold tabular-nums text-[#0A0A0A]">{d}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSlotForDate(d, seats - 1)}
                                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#0A0A0A] shadow-sm disabled:opacity-40"
                                      disabled={seats <= 0}
                                      aria-label={`${d} 좌석 감소`}
                                    >
                                      <Minus className="h-3 w-3" strokeWidth={2.5} />
                                    </button>
                                    <span className="w-11 text-center text-[13px] font-extrabold tabular-nums" style={{ color: seats === 0 ? "#A3A3A3" : accent }}>
                                      {seats === 0 ? "마감" : `${seats}석`}
                                    </span>
                                    <button
                                      type="button"
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
                              <p className="py-2 text-center text-[11px] text-[#A3A3A3]">위에서 예약 가능일을 먼저 선택하세요</p>
                            )}
                          </div>
                        </section>

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
                    {/* FIX-4 — 적용 확정: 패널 접힘 + 스트립 안내 + 미리보기 하이라이트. */}
                    <button
                      type="button"
                      onClick={() => {
                        setCollapsedPanels((p) => ({ ...p, [activeBlock.id]: true }));
                        flashStrip(
                          `${activeBlock.id === "calendar" ? "예약 가능일" : "판매 기간"}이 적용됐어요${
                            nextStepLabel ? ` — 다음은 ${nextStepLabel}` : ""
                          }`,
                        );
                      }}
                      disabled={activeBlock.id === "calendar" && cfgDates.length === 0}
                      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-transform active:translate-y-px disabled:opacity-40"
                      style={{ backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }}
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                      적용
                    </button>
                  </div>
                )}

                {/* 쿠폰 — 실 loader 쿠폰 목록. FIX-4: 선택(후보) → [적용] 확정 → 접힘. */}
                {activeBlock.id === "coupon" &&
                  (collapsedPanels["coupon"] && selectedCoupon ? (
                    <AppliedRow
                      accent={accent}
                      label={`적용됨 · ${selectedCoupon.title ?? "쿠폰"}`}
                      onEdit={() => setCollapsedPanels((p) => ({ ...p, coupon: false }))}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      {/* FIX-9 — 가용 수량 실카운트(loader). 0장 = 숫자 대신 먼저 만들기 안내. */}
                      {coupons.length > 0 && (
                        <p className="px-0.5 text-[11px] font-semibold text-[#8A8A8A]">
                          보유 쿠폰 <b className="tabular-nums" style={{ color: accent }}>{coupons.length}장</b>
                        </p>
                      )}
                      {coupons.length === 0 && (
                        <p className="rounded-xl bg-[#F4F4F5] px-3 py-3 text-center text-[12px] font-medium text-[#8A8A8A]">
                          활성 쿠폰이 없어요. 파트너 센터에서 쿠폰을 먼저 만들어 주세요.
                        </p>
                      )}
                      {coupons.map((c) => {
                        const isCandidate = (couponCandidate ?? selectedCouponId) === c.id;
                        const isConfirmed = selectedCouponId === c.id;
                        const label = c.title ?? `${c.discount_value ?? ""}${c.discount_unit ?? ""} 할인`;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setCouponCandidate(c.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
                            style={isCandidate ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` } : { backgroundColor: "#F4F4F5" }}
                          >
                            <Ticket className="h-4 w-4 shrink-0" style={{ color: isCandidate ? accent : "#A3A3A3" }} strokeWidth={2.25} />
                            <span className="flex-1 text-[13px] font-semibold text-[#0A0A0A]">{label}</span>
                            {isConfirmed ? (
                              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: accent }}>
                                적용됨
                              </span>
                            ) : isCandidate ? (
                              <Check className="h-4 w-4" style={{ color: accent }} strokeWidth={2.5} />
                            ) : null}
                          </button>
                        );
                      })}
                      {couponCandidate && couponCandidate !== selectedCouponId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCouponId(couponCandidate);
                            setCouponCandidate(null);
                            setCollapsedPanels((p) => ({ ...p, coupon: true }));
                            flashStrip(`쿠폰이 적용됐어요${nextStepLabel ? ` — 다음은 ${nextStepLabel}` : ""}`);
                          }}
                          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-transform active:translate-y-px"
                          style={{ backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }}
                        >
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                          이 쿠폰 적용
                        </button>
                      )}
                    </div>
                  ))}

                {/* 상품 등록 — FIX-13: v0-45 정본 3유형 폼(신규 이식)으로 교체.
                    기존 commerce/ProductRegisterForm 무수정(구 스튜디오 사용 중). */}
                {activeBlock.id === "product" && (
                  <ProductRegisterForm45
                    accent={accent}
                    onSubmit={submitStudioProduct}
                    onImageChange={(url) => setProductImageUrl(url)}
                    onBusyChange={setFormBusy}
                  />
                )}

                {/* 카드 도킹 — 실 CardDockingPicker */}
                {/* FIX-9 — 도킹 가용 수량(공개 발행 카드 실카운트). 0장 = 먼저 만들기 안내. */}
                {activeBlock.id === "dock" && !collapsedPanels["dock"] && (
                  dockCount > 0 ? (
                    <p className="mb-2 px-0.5 text-[11px] font-semibold text-[#8A8A8A]">
                      함께 보낼 수 있는 카드 <b className="tabular-nums" style={{ color: accent }}>{dockCount}장</b>
                    </p>
                  ) : (
                    <p className="mb-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-center text-[12px] font-medium text-[#8A8A8A]">
                      아직 도킹할 공개 카드가 없어요 — 먼저 카드를 만들어 보세요.
                    </p>
                  )
                )}
                {activeBlock.id === "dock" &&
                  (collapsedPanels["dock"] && dockedProducts.length > 0 ? (
                    <AppliedRow
                      accent={accent}
                      label={`적용됨 · 카드 ${dockedProducts.length}장 연결`}
                      onEdit={() => setCollapsedPanels((p) => ({ ...p, dock: false }))}
                    />
                  ) : (
                    <CardDockingPicker
                      value={dockedProducts}
                      onChange={setDockedProducts}
                      // FIX-4 — 완료(확정) = 접힘 + 스트립 안내(선택형 패널 일관 패턴).
                      onDone={() => {
                        if (dockedProducts.length > 0) {
                          setCollapsedPanels((p) => ({ ...p, dock: true }));
                          flashStrip(`도킹 카드가 연결됐어요${nextStepLabel ? ` — 다음은 ${nextStepLabel}` : ""}`);
                        }
                      }}
                    />
                  ))}

                {/* 콘텐츠 — 실 영상 검색 + 제목/부제/핵심구간 */}
                {activeBlock.id === "content" && (
                  <div className="space-y-2">
                    {/* FIX-1 — 확정된 영상: 패널 상단 '선택됨' 행 고정 표시 */}
                    {selectedVideo && (
                      <div
                        className="flex items-center gap-2.5 rounded-xl p-2"
                        style={{ backgroundColor: `${accent}0A`, boxShadow: `inset 0 0 0 1px ${accent}33` }}
                      >
                        <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-[#E5E5E5]">
                          <img src={selectedVideo.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-bold text-[#0A0A0A]">{selectedVideo.title}</span>
                          <span className="block text-[10px] text-[#8A8A8A]">
                            {selectedVideo.sourceLabel ?? "YouTube"}
                            {selectedVideo.durationLabel ? ` · ${selectedVideo.durationLabel}` : ""}
                          </span>
                        </span>
                        <span
                          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: accent }}
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                          선택됨
                        </span>
                      </div>
                    )}
                    {/* 영상 검색 (실배선 /api/discover) */}
                    <div className="flex items-center gap-1.5 rounded-xl bg-[#F4F4F5] py-1.5 pl-3 pr-1.5">
                      <Search className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                      <input
                        value={videoQuery}
                        onChange={(e) => setVideoQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            void handleVideoSearch();
                          }
                        }}
                        placeholder="영상 키워드 검색 (YouTube)"
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:text-[#9A9A9A]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleVideoSearch()}
                        disabled={videoSearching || !videoQuery.trim()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40"
                        style={{ backgroundColor: accent }}
                        aria-label="영상 검색"
                      >
                        {videoSearching ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : <Search className="h-4 w-4" strokeWidth={2.5} />}
                      </button>
                    </div>
                    {videoError && <p className="text-[11px] font-medium text-[#DC2626]">{videoError}</p>}
                    {/* FIX-1 — 결과 탭 = '후보 선택'(미확정), 아래 [이 영상으로 확정]에서 확정. */}
                    {videoResults.length > 0 && (
                      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                        {videoResults.map((c) => {
                          const isCandidate = videoCandidate?.source_id === c.source_id;
                          const isConfirmed = selectedVideo?.videoId === c.source_id;
                          return (
                            <button
                              key={`${c.provider}-${c.source_id}`}
                              type="button"
                              onClick={() => setVideoCandidate(c)}
                              className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors"
                              style={
                                isCandidate
                                  ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                                  : { backgroundColor: "#F4F4F5" }
                              }
                            >
                              <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-[#E5E5E5]">
                                {c.source_id && (
                                  <img src={`https://i.ytimg.com/vi/${c.source_id}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-bold text-[#0A0A0A]">{c.title ?? "영상"}</span>
                                <span className="block text-[10px] text-[#8A8A8A]">
                                  {c.author_name ?? "YouTube"}
                                  {c.duration_sec ? ` · ${formatDuration(c.duration_sec)}` : ""}
                                </span>
                              </span>
                              {isConfirmed ? (
                                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: accent }}>
                                  선택됨
                                </span>
                              ) : isCandidate ? (
                                <Check className="h-4 w-4 shrink-0" style={{ color: accent }} strokeWidth={2.5} />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {videoCandidate && videoCandidate.source_id !== selectedVideo?.videoId && (
                      <button
                        type="button"
                        onClick={() => {
                          const c = videoCandidate;
                          setVideoCandidate(null);
                          void handleSelectVideo(c); // 확정 — 카드 반영 + oembed→요약 리드 시작.
                          flashStrip("영상이 카드에 반영됐어요");
                        }}
                        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-transform active:translate-y-px"
                        style={{ backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }}
                      >
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                        이 영상으로 확정
                      </button>
                    )}
                    {videoSearched && !videoSearching && videoResults.length === 0 && !videoError && (
                      <p className="rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-center text-[12px] font-medium text-[#8A8A8A]">검색 결과가 없어요.</p>
                    )}

                    <input
                      value={cfgTitle}
                      onChange={(e) => setCfgTitle(e.target.value)}
                      placeholder={content.titleFallback}
                      className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
                      onFocus={(e) => (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`)}
                      onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    />
                    <textarea
                      value={cfgSubtitle}
                      onChange={(e) => setCfgSubtitle(e.target.value)}
                      placeholder={content.subtitleFallback}
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
                        placeholder="0:42"
                        className="ml-auto w-16 rounded-lg bg-white px-2 py-1 text-center text-[12px] font-bold tabular-nums text-[#0A0A0A] outline-none"
                        style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                      />
                    </div>

                    {/* 카피 AI 키포인트 → 셀링포인트 픽 (실배선 generate-summary 리드) */}
                    {(aiLoading || aiKeyPoints.length > 0) && (
                      <div className="rounded-xl bg-[#F4F4F5] p-3">
                        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#0A0A0A]">
                          <Sparkles className="h-3.5 w-3.5 text-[#737373]" strokeWidth={2.5} />
                          AI 추천 셀링포인트
                          {aiLoading && <Loader2 className="h-3 w-3 animate-spin text-[#8A8A8A]" strokeWidth={2.5} />}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiKeyPoints.map((p) => {
                            const on = pickedPoints.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setPickedPoints((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
                                className="rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors [word-break:keep-all]"
                                style={on ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: "#fff", color: "#404040", boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI 광고영상 — 게이트(생성 Edge 부재). 선택 UI 는 정본 유지, 생성 비활성. */}
                {activeBlock.id === "aivideo" && (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[12px] font-bold text-[#404040]">영상 스타일</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {AIV_STYLES.map((s) => {
                          const on = aivStyle === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setAivStyle(s.id)}
                              className="rounded-xl px-2 py-2 text-left transition-colors"
                              style={on ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` } : { backgroundColor: "#F4F4F5" }}
                            >
                              <span className="block text-[12px] font-bold" style={{ color: on ? accent : "#0A0A0A" }}>{s.label}</span>
                              <span className="mt-0.5 block text-[10px] font-medium leading-tight text-[#8A8A8A]">{s.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[12px] font-bold text-[#404040]">영상 길이</p>
                      <div className="flex gap-1.5">
                        {AIV_LENGTHS.map((l) => {
                          const on = aivLength === l.id;
                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => setAivLength(l.id)}
                              className="flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors"
                              style={on ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: "#F4F4F5", color: "#525252" }}
                            >
                              {l.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[#F4F4F5]" style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}>
                      <span className="flex flex-col items-center gap-1.5 text-[#8A8A8A]">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6E6E6] text-[#525252]">
                          <Clapperboard className="h-5 w-5" strokeWidth={2} />
                        </span>
                        <span className="text-[11px] font-semibold">상품 정보로 광고영상을 만들어요</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-[#F4F4F5] py-2.5 text-[13px] font-bold text-[#94A3B8]"
                    >
                      <Lock className="h-4 w-4" strokeWidth={2.5} />
                      AI 광고영상 — 오픈 준비 중
                    </button>
                  </div>
                )}

                {/* 대표 이미지 / 상품 이미지 — 실 업로더 */}
                {(activeBlock.id === "image" || activeBlock.id === "productimage") && (
                  <div className="space-y-2">
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#F4F4F5]">
                      {heroImagePreview ? (
                        <img src={heroImagePreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex flex-col items-center gap-1.5 text-[#8A8A8A]">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6E6E6] text-[#525252]">
                            <ImageIcon className="h-5 w-5" strokeWidth={2} />
                          </span>
                          <span className="text-[11px] font-semibold">
                            {activeBlock.id === "productimage" ? "상품 사진" : "대표 이미지"} 미리보기
                          </span>
                        </span>
                      )}
                    </div>
                    {heroUploadError && <p className="text-[11px] font-medium text-[#DC2626]">{heroUploadError}</p>}
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => heroFileInputRef.current?.click()}
                        disabled={heroUploading}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold text-white transition-transform active:translate-y-px disabled:opacity-60"
                        style={{ backgroundColor: accent }}
                      >
                        {heroUploading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} /> : <ImageIcon className="h-4 w-4" strokeWidth={2.25} />}
                        {heroUploading ? "올리는 중…" : heroImagePreview ? "다른 사진으로 바꾸기" : "갤러리에서 선택"}
                      </button>
                      <input ref={heroFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeroImageChange} />
                    </div>
                    {/* AI 원페이지 카탈로그 — 게이트(생성 Edge 부재). */}
                    {activeBlock.id === "productimage" && (
                      <div className="mt-1 rounded-xl bg-[#F4F4F5] p-3">
                        <div className="mb-1 flex items-center gap-1.5">
                          <LayoutTemplate className="h-4 w-4 shrink-0 text-[#525252]" strokeWidth={2.25} />
                          <span className="flex-1 text-[13px] font-bold text-[#0A0A0A]">AI 원페이지 카탈로그</span>
                          <span className="rounded-full bg-[#E6E6E6] px-2 py-0.5 text-[10px] font-bold text-[#525252]">준비 중</span>
                        </div>
                        <p className="mb-2.5 text-[11px] font-medium leading-relaxed text-[#8A8A8A]">
                          등록한 이미지를 분석해 제목·설명·특징까지 갖춘 한 장짜리 상품 카탈로그를 자동으로 만들어요.
                        </p>
                        <button
                          type="button"
                          disabled
                          className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[13px] font-bold text-[#94A3B8]"
                          style={{ boxShadow: "inset 0 0 0 1px #ECECEC" }}
                        >
                          <Lock className="h-4 w-4" strokeWidth={2.5} />
                          AI 카탈로그 — 오픈 준비 중
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 매장정보 — FIX-10 실체화: 주소 실필드(partners 프리필·UPDATE 저장) + 시설 저장.
                    전화 편집 필드는 생략 — READ 판정: 명함 편집(partner.index)이 전화를 다루지 않음
                    (display_name/business_type/address/metadata 만 UPDATE). 표시 토글만 유지. */}
                {activeBlock.id === "link" && (
                  <div className="space-y-3.5">
                    {store && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-[#8A8A8A]">매장 주소</p>
                        <input
                          value={cfgAddress}
                          onChange={(e) => setCfgAddress(e.target.value)}
                          placeholder="예: 충북 괴산군 …"
                          className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
                          onFocus={(e) => (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`)}
                          onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {[
                        { on: cfgPhone, set: setCfgPhone, icon: Phone, label: "전화 걸기", has: !!store?.contact_phone },
                        { on: cfgMap, set: setCfgMap, icon: MapPin, label: "위치 보기", has: !!(cfgAddress.trim() || store?.address) },
                      ].map((row) => (
                        <button
                          key={row.label}
                          type="button"
                          onClick={() => row.set((v) => !v)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
                          style={row.on ? { backgroundColor: `${accent}12`, boxShadow: `inset 0 0 0 1.5px ${accent}` } : { backgroundColor: "#F4F4F5" }}
                        >
                          <row.icon className="h-4 w-4 shrink-0" style={{ color: row.on ? accent : "#A3A3A3" }} strokeWidth={2.25} />
                          <span className="flex-1 text-[13px] font-semibold text-[#0A0A0A]">
                            {row.label}
                            {!row.has && <span className="ml-1.5 text-[10px] font-semibold text-[#A3A3A3]">매장 정보 미등록</span>}
                          </span>
                          <span className="flex h-5 w-9 items-center rounded-full px-0.5 transition-colors" style={{ backgroundColor: row.on ? accent : "#D4D4D4" }}>
                            <span className="h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: row.on ? "translateX(16px)" : "translateX(0)" }} />
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* 시설 정보 — 프리셋 8종 + 추가·수정·삭제(프리뷰 반영 · 저장은 백엔드 부재로 미영속) */}
                    <div className="rounded-xl bg-[#F4F4F5] p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <Store className="h-4 w-4 shrink-0 text-[#525252]" strokeWidth={2.25} />
                        <span className="flex-1 text-[13px] font-bold text-[#0A0A0A]">시설 정보</span>
                        <span className="text-[11px] font-medium text-[#A3A3A3]">{cfgFacilities.length}개</span>
                      </div>
                      <div className="space-y-1.5">
                        {cfgFacilities.length === 0 && (
                          <p className="rounded-lg bg-white px-3 py-2.5 text-center text-[12px] font-medium text-[#A3A3A3]">시설 정보를 추가해 보세요</p>
                        )}
                        {cfgFacilities.map((f) => (
                          <div key={f.id} className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5" style={{ boxShadow: "inset 0 0 0 1px #ECECEC" }}>
                            <Check className="h-3.5 w-3.5 shrink-0 text-[#737373]" strokeWidth={2.75} />
                            <input
                              value={f.text}
                              onChange={(e) => editFacility(f.id, e.target.value)}
                              placeholder="예: 주차 가능"
                              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#C4C4C4]"
                            />
                            <button
                              type="button"
                              onClick={() => removeFacility(f.id)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#A3A3A3] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626] active:scale-90"
                              aria-label="시설 삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => addFacility()}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#E6E6E6] py-2 text-[12px] font-bold text-[#404040] transition-transform active:translate-y-px"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        시설 추가
                      </button>
                      {FACILITY_PRESETS.filter((p) => !cfgFacilities.some((f) => f.text.trim() === p)).length > 0 && (
                        <div className="mt-2.5">
                          <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">빠른 추가</p>
                          <div className="flex flex-wrap gap-1.5">
                            {FACILITY_PRESETS.filter((p) => !cfgFacilities.some((f) => f.text.trim() === p)).map((p) => (
                              <button
                                key={p}
                                type="button"
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

                    {/* FIX-10 — 저장: partners UPDATE(주소 + facilities jsonb). 성공/실패 toast + 스트립 갱신. */}
                    {store ? (
                      <button
                        type="button"
                        onClick={() => void handleStoreInfoSave()}
                        disabled={storeSaving}
                        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-transform active:translate-y-px disabled:opacity-60"
                        style={{ backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }}
                      >
                        {storeSaving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
                        {storeSaving ? "저장 중…" : "매장정보 저장"}
                      </button>
                    ) : (
                      <p className="rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-center text-[12px] font-medium text-[#8A8A8A]">
                        매장 등록 후 저장할 수 있어요. 지금은 미리보기에만 반영돼요.
                      </p>
                    )}
                  </div>
                )}

                {/* 인원 선택 */}
                {activeBlock.id === "party" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                      <span className="text-[12px] font-semibold text-[#525252]">예약 인원</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setCfgParty((n) => Math.max(1, n - 1))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[16px] font-bold text-[#404040]"
                          style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                          aria-label="인원 줄이기"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                        <span className="w-10 text-center text-[15px] font-bold tabular-nums text-[#0A0A0A]">{cfgParty}명</span>
                        <button
                          type="button"
                          onClick={() => setCfgParty((n) => Math.min(20, n + 1))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: accent }}
                          aria-label="인원 늘리기"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 고객 후기 — 게이트(백엔드 부재). UI 유지 + 비활성. */}
                {activeBlock.id === "review" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 rounded-xl bg-[#F4F4F5] px-3 py-2.5">
                      <span className="text-[12px] font-semibold text-[#525252]">평점</span>
                      <div className="ml-auto flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" onClick={() => setCfgRating(n)} aria-label={`${n}점`}>
                            <Star
                              className="h-5 w-5"
                              strokeWidth={2}
                              style={{ color: n <= cfgRating ? accent : "#D4D4D4", fill: n <= cfgRating ? accent : "transparent" }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      value={cfgReview}
                      onChange={(e) => setCfgReview(e.target.value)}
                      placeholder="한 줄 후기를 입력하세요"
                      className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-medium text-[#404040] outline-none placeholder:text-[#A3A3A3]"
                    />
                  </div>
                )}

                {/* 배송 안내 — 게이트(운송장·배송 테이블 부재). UI(택배사 6종 등) 유지 + 비활성. */}
                {activeBlock.id === "delivery" && (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">택배사</p>
                      <div className="flex flex-wrap gap-1.5">
                        {COURIERS.map((c) => {
                          const on = cfgCourier === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCfgCourier(c)}
                              className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                              style={on ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: "#F4F4F5", color: "#525252" }}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-[#8A8A8A]">배송 진행 상태</p>
                      <div className="flex gap-1.5">
                        {SHIP_STAGES.map((label, i) => {
                          const on = cfgShipStage === i;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setCfgShipStage(i)}
                              className="flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors"
                              style={on ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: "#F4F4F5", color: "#525252" }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
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

                {/* 브랜드 소개 */}
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
            type="button"
            onClick={() => equip(activeBlock)}
            disabled={activeLocked}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold tracking-[-0.01em] transition-all duration-200 active:scale-[0.98] ${
              activeLocked ? "cursor-not-allowed bg-white text-[#C4C4C4] [box-shadow:0_0_0_1px_#EDEDED]" : activeApplied ? "bg-white" : "text-white"
            }`}
            style={
              !activeLocked && !activeApplied
                ? { backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }
                : activeApplied
                  ? { color: accent, boxShadow: `inset 0 0 0 1.5px ${accent}`, backgroundColor: `${accent}0A` }
                  : undefined
            }
          >
            {activeGated ? (
              <>
                <Lock className="h-4 w-4" strokeWidth={2.25} />
                오픈 준비 중이에요
              </>
            ) : activeLocked ? (
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

      {/* 공개 범위 · 미리보기 */}
      <div className="mx-auto mt-3 flex max-w-md flex-col gap-3 px-5">
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
                type="button"
                onClick={() => setVisibility("public")}
                className="relative z-10 flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold transition-colors duration-200"
                style={{ color: pct < 0.5 ? accent : "#8A8A8A" }}
                aria-pressed={visibility === "public"}
              >
                <Globe className="h-4 w-4" strokeWidth={2.25} />
                공개
              </button>
              <button
                type="button"
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

        {/* 수신자 화면 미리보기 */}
        <button
          type="button"
          onClick={() => setMirrorOpen(true)}
          className="group flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left transition-transform [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)] active:translate-y-px"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#F4F4F5] text-[#525252]">
            <Eye className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-[#0A0A0A]">수신자 화면 미리보기</span>
            <span className="block text-[11px] font-medium text-[#8A8A8A]">받는 사람에게 보이는 그대로 확인하기</span>
          </span>
          <ChevronRight className="h-4 w-4 flex-none text-[#C4C4C4] transition-transform group-active:translate-x-0.5" strokeWidth={2.5} />
        </button>

        {saveError && <p className="px-1 text-center text-[12px] font-medium text-[#DC2626]">{saveError}</p>}
        {dropped && savedUrl && (
          <p className="break-all px-1 text-center text-[11px] font-medium text-[#525252]">
            발행 완료 — <span className="font-bold text-[#0A0A0A]">{savedUrl}</span>
          </p>
        )}
      </div>

      {/* 카드 드롭하기 (고정 CTA) */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EDEDED] pb-[env(safe-area-inset-bottom)]" style={{ backgroundColor: pageBg }}>
        <div style={{ backgroundColor: pageBg }}>
          <div className="mx-auto flex max-w-md flex-col gap-2 px-5 pb-5 pt-4">
            {/* FIX-6 — 발행 성공 후: 기존 studio-build 미러(버튼식) — 카톡 전송(주) + 링크 복사(보조). */}
            {dropped && savedUrl ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      void navigator.clipboard.writeText(savedUrl);
                      flashStrip("링크를 복사했어요");
                    }
                  }}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D4D4D4] bg-white text-[14px] font-bold text-[#0A0A0A] transition-transform active:scale-[0.98]"
                >
                  <Copy className="h-4 w-4" strokeWidth={2.25} />
                  링크 복사
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendKakao()}
                  disabled={sending || saving}
                  className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                  style={{ backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }}
                >
                  <Send className="h-4 w-4" strokeWidth={2.25} />
                  {sending ? "전송 중…" : "카톡으로 전송"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMirrorOpen(true)}
                className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[14px] font-bold tracking-[-0.01em] text-white transition-all duration-300 active:scale-[0.98]"
                style={{ backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <Send className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.25} />
                전송
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 수신자 거울 시트 (보이는 그대로 = 받는 그대로) — 커스텀 fixed 오버레이(Radix 아님) */}
      {mirrorOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="sl-fade-in absolute inset-0 bg-black/45" onClick={() => setMirrorOpen(false)} />
          <div className="sl-slide-up absolute inset-x-0 bottom-0 mx-auto max-h-[92vh] max-w-md overflow-hidden rounded-t-3xl bg-[#F5F5F5] [box-shadow:0_-20px_60px_-20px_rgba(15,23,42,0.5)]">
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
                type="button"
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
              {/* FIX-5 — READ c) 판정: share variant = 시각 stub(콜백 미주입) → 정직 안내 1줄. */}
              <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-[#EFF6FF] px-3 py-2 text-[11px] font-medium text-[#1D4ED8]">
                <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
                미리보기예요 — 쿠폰 받기 등 버튼은 실제 카드에서 작동해요
              </div>
              <CardModelBody model={cardModel} variant="share" />
            </div>

            <div className="border-t border-[#EAEAEA] bg-white px-5 py-3.5">
              {saveError && <p className="mb-2 text-center text-[12px] font-medium text-[#DC2626]">{saveError}</p>}
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void handlePublish().then((ok) => {
                    if (ok) setMirrorOpen(false);
                  });
                }}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: accent, boxShadow: `0 10px 30px -8px ${accent}80` }}
              >
                {saving ? <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.25} /> : <Send className="h-[18px] w-[18px]" strokeWidth={2.25} />}
                {saving ? "발행 중…" : "전송하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 링고AI 상주 어시스턴트 — FIX-3: strip(기본) ↔ panel ↔ closed(FAB). 자동으로 사라지지
          않는다 — 액션 후 strip 으로 축소·내용 갱신. 대화(LLM)·음성 = T5 트랙 예약석(배선 0). */}
      {(
        <>
          {lingoView === "panel" && (
            <>
              <div className="sl-fade-in fixed inset-0 z-40 bg-black/25" onClick={() => setLingoView("strip")} />
              {/* FIX-16 — 캡슐 자리 기준 확장(panelBottom, 화면 경계 클램프). 접기 = 같은 자리 캡슐로. */}
              <div className="sl-slide-up fixed inset-x-0 z-40 px-5" style={{ bottom: panelBottom }}>
                <div
                  className={`relative mx-auto max-w-md rounded-3xl border border-[#E5E5E5] bg-white p-4 [box-shadow:0_24px_60px_-16px_rgba(15,23,42,0.45)] ${
                    panelDragging ? "" : "transition-transform duration-200 ease-out"
                  }`}
                  style={{ transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)` }}
                >
                  {/* FIX-11/14 — LED 러닝 라이트(패널에도 동일, 실작업 중에만 — 폴백 구현).
                      콘텐츠는 아래 relative 레이어 — 흰 덮개 위에 그려지도록(페인트 순서). */}
                  {ledOn && (
                    <span className="sl-led-frame" aria-hidden="true">
                      <span className="sl-led-spin" />
                      <span className="sl-led-cover" />
                    </span>
                  )}
                  <div className="relative">
                  {/* 드래그 핸들 */}
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
                        전환 코칭 — 대화는 오픈 준비 중이에요
                      </p>
                    </div>
                    {/* FIX-3 — 접기(→스트립) / X(완전 닫기, FAB 은 남음) 분리. */}
                    <button
                      type="button"
                      aria-label="스트립으로 접기"
                      onClick={() => setLingoView("strip")}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] transition-transform active:scale-90"
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      aria-label="닫기"
                      onClick={() => setLingoView("closed")}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] transition-transform active:scale-90"
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* 정적 가이드 문구(규칙 기반 코칭) — FIX-16: 비동기/플래시도 여기서 갱신. */}
                  <div className="mt-3 rounded-2xl bg-[#F7F7F8] p-3.5">
                    <p className="flex items-start gap-1.5 text-pretty text-[13px] font-medium leading-relaxed text-[#404040] [word-break:keep-all]">
                      {stripBusy ? (
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={2.5} style={{ color: accent }} />
                      ) : (
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A3A3A3]" strokeWidth={2.5} fill="currentColor" />
                      )}
                      <span>{stripBusy ?? stripFlash ?? lingo.text}</span>
                    </p>
                    {/* FIX-16 — 스트립에서 이관: 단계 점 + [계속하기](정보 소실 0). */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#ECECEE] pt-2.5">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {steps.map((s, i) => (
                          <span key={s.label} className="flex items-center gap-1">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={
                                s.done
                                  ? { backgroundColor: accent }
                                  : i === currentStepIdx
                                    ? { backgroundColor: "#fff", boxShadow: `0 0 0 1.5px ${accent}` }
                                    : { backgroundColor: "#D4D4D4" }
                              }
                            />
                            <span className="text-[10px] font-bold" style={{ color: s.done ? accent : i === currentStepIdx ? "#0A0A0A" : "#A3A3A3" }}>
                              {s.label}
                            </span>
                          </span>
                        ))}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLingoView("strip");
                          continueFlow();
                        }}
                        className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-white active:scale-95"
                        style={{ backgroundColor: accent }}
                      >
                        계속하기
                        <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* 추천 장착 — 한 줄 제안(블록 고유 아이콘) */}
                  {lingo.action && !applied[lingo.action] && (() => {
                    const SuggestIcon = blockById(lingo.action).icon;
                    return (
                      <button
                        type="button"
                        onClick={lingoEquipSuggestion}
                        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#F4F4F5] text-[13px] font-bold text-[#0A0A0A] transition-transform [box-shadow:inset_0_0_0_1px_#E5E5E5] active:scale-[0.98]"
                      >
                        <SuggestIcon className="h-4 w-4 text-[#525252]" strokeWidth={2.25} />
                        {blockById(lingo.action).label} 바로 장착
                      </button>
                    );
                  })()}

                  {/* 입력 컴포저 — T5 예약석(대화 LLM 배선 금지): 비활성 표시만. 오픈 시 lingo-chat 재배선. */}
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 rounded-full bg-[#F4F4F5] py-1.5 pl-4 pr-1.5 opacity-60">
                      <input
                        disabled
                        placeholder="링고 대화는 오픈 준비 중이에요"
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#9A9A9A]"
                      />
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
                        <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                      </span>
                    </div>
                  </div>

                  {/* 보조 도구 — 담기·편집·되돌리기 (규칙 기반 액션 헬퍼) */}
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {[
                      { key: "add", icon: Plus, label: "블록 담기", onClick: () => { scrollToDeck(); setLingoView("strip"); }, disabled: false },
                      { key: "edit", icon: Pencil, label: "내용 편집", onClick: lingoEdit, disabled: !canEdit },
                      { key: "undo", icon: Undo2, label: "되돌리기", onClick: lingoUndo, disabled: !lastEquipped },
                    ].map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.key}
                          type="button"
                          onClick={tool.onClick}
                          disabled={tool.disabled}
                          className="group flex flex-col items-center gap-1.5 rounded-2xl bg-[#F7F7F8] py-2.5 transition-all [box-shadow:inset_0_0_0_1px_#EDEDED] active:scale-[0.97] disabled:opacity-40"
                        >
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                            style={{ backgroundColor: tool.disabled ? "#ECECEC" : "#EAEAEA", color: tool.disabled ? "#B4B4B4" : "#525252" }}
                          >
                            <Icon className="h-[17px] w-[17px]" strokeWidth={2.25} />
                          </span>
                          <span className="text-[11px] font-semibold text-[#404040] [word-break:keep-all]">{tool.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* FIX-16 — 단일 플로팅 캡슐(하단 스트립 대체): 아바타 + 한줄 안내(truncate, 두 줄 금지)
              + 단계 점 축약 + [계속] 미니 버튼. 드래그 이동(엣지 스냅)·위치 기억(fabPos state).
              탭 = 그 자리 기준 패널 확장. LED 는 캡슐 테두리(rounded-full inherit). */}
          {lingoView === "strip" && !mirrorOpen && (
            <div
              ref={fabRef}
              role="button"
              aria-label="링고AI — 탭하면 패널이 열려요 · 끌면 옮겨요"
              onPointerDown={onFabPointerDown}
              onPointerMove={onFabPointerMove}
              onPointerUp={() => onFabPointerUp(openPanelAt)}
              onPointerCancel={() => onFabPointerUp(openPanelAt)}
              className={`fixed z-40 flex h-12 w-[240px] max-w-[70vw] touch-none select-none items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white pl-1.5 pr-1.5 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.35)] ${
                fabDragging ? "scale-[1.03] cursor-grabbing" : "cursor-grab transition-transform duration-200"
              }`}
              style={fabPos ? { left: fabPos.x, top: fabPos.y } : { right: 20, bottom: 196 }}
            >
              {ledOn && (
                <span className="sl-led-frame" aria-hidden="true">
                  <span className="sl-led-spin" />
                  <span className="sl-led-cover" />
                </span>
              )}
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
                {stripBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} style={{ color: accent }} />
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
                    <Sparkles className="absolute -right-0.5 -top-0.5 h-[9px] w-[9px]" strokeWidth={2.5} fill="currentColor" />
                  </>
                )}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold leading-tight text-[#0A0A0A]">
                  {stripBusy ??
                    stripFlash ??
                    (showSuggest && suggestion
                      ? `${suggestion.label} +${suggestion.power}점`
                      : dropped
                        ? "전송 완료!"
                        : readyToSend
                          ? "보낼 준비 됐어요"
                          : lingo.text)}
                </span>
                {/* 단계 점 축약 — 점만(라벨 없음). done=accent · current=링 · 대기=회색 */}
                <span className="mt-1 flex items-center gap-1">
                  {steps.map((s, i) => (
                    <span
                      key={s.label}
                      className="h-1.5 w-1.5 rounded-full"
                      style={
                        s.done
                          ? { backgroundColor: accent }
                          : i === currentStepIdx
                            ? { backgroundColor: "#fff", boxShadow: `0 0 0 1.5px ${accent}` }
                            : { backgroundColor: "#D4D4D4" }
                      }
                    />
                  ))}
                </span>
              </span>
              {/* FIX-9 — 제안 중엔 [장착]+거절(쿨다운), 아니면 [계속]. 드래그와 충돌 방지(전파 차단). */}
              {showSuggest && suggestion ? (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      const idx = DECK.findIndex((b) => b.id === suggestion.id);
                      if (idx >= 0) setDeckIndex(idx);
                      equip(suggestion);
                      setSuggestVisible(false);
                      flashStrip(`+${suggestion.power}점! ${suggestion.label} 장착됐어요`);
                    }}
                    className="relative flex h-8 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold text-white active:scale-95"
                    style={{ backgroundColor: accent }}
                  >
                    장착
                  </button>
                  <button
                    type="button"
                    aria-label="제안 닫기"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setDismissedSuggests((d) => [...d, suggestion.id]);
                      setSuggestVisible(false);
                    }}
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] active:scale-95"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={continueFlow}
                  className="relative flex h-8 shrink-0 items-center gap-0.5 rounded-full px-2.5 text-[11px] font-bold text-white active:scale-95"
                  style={{ backgroundColor: accent }}
                >
                  계속
                  <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
                </button>
              )}
            </div>
          )}

          {/* FIX-16 — 최소화(아바타 점): X 로 도달하는 최소 상태. 완전 소멸 없음 — 탭 = 캡슐 복귀.
              같은 fabPos 공유(드래그·스냅 동일). */}
          {lingoView === "closed" && !mirrorOpen && (
            <div
              ref={fabRef}
              role="button"
              aria-label="링고AI 캡슐 열기 · 끌면 옮기기"
              onPointerDown={onFabPointerDown}
              onPointerMove={onFabPointerMove}
              onPointerUp={() => onFabPointerUp(() => setLingoView("strip"))}
              onPointerCancel={() => onFabPointerUp(() => setLingoView("strip"))}
              className={`fixed z-40 flex h-10 w-10 touch-none select-none items-center justify-center rounded-full text-white ring-2 ring-white ${
                fabDragging ? "scale-110 cursor-grabbing" : "cursor-grab transition-all duration-300 ease-out active:scale-90"
              }`}
              style={
                fabPos
                  ? { left: fabPos.x, top: fabPos.y, backgroundColor: accent, boxShadow: `0 10px 24px -8px ${accent}, 0 4px 12px rgba(15,23,42,0.18)` }
                  : { right: 20, bottom: 196, backgroundColor: accent, boxShadow: `0 10px 24px -8px ${accent}, 0 4px 12px rgba(15,23,42,0.18)` }
              }
            >
              <MessageCircle className="h-5 w-5" strokeWidth={2} />
              {lingo.action && !applied[lingo.action] && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                  <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold" style={{ color: accent }}>
                    !
                  </span>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
