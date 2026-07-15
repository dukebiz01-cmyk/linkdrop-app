import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { shareToKakao } from "@/lib/kakao";
import {
  ProductRegisterForm,
  type ProductRegisterPayload,
  type ProductRegisterResult,
} from "@/components/commerce/ProductRegisterForm";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { CouponManageView, type CouponRow } from "@/routes/_partner/partner.coupons";
// ST2b-1 — 정식 교체: 기본 렌더 = 신 스튜디오(CardStudioPage45). 구 컴포넌트(CardStudioPage)는
//   ?legacy=1 스위치백으로 보존(코드 삭제·이동 금지 — ST3 안정 후 정리).
import {
  CardStudioPage45,
  type StudioLabCoupon,
  type StudioLabStore,
} from "@/components/card-model/CardStudioPage45";
import { PartnerCalendarPage } from "@/components/partner/PartnerCalendarPage";
import type { AttachedProduct } from "@/components/create/types";
// P3 — 구매 미리보기 미러: 손님 /d purchase 와 동일 변환(buildProductWidget) 재사용(단일 소스).
import { buildProductWidget } from "@/lib/adapters";
import { resizeToJpegBlob } from "@/lib/image-upload";
import { KeyboardAwareBar } from "@/components/keyboard-aware-bar";
import type { InfoDropPageProps } from "@/components/info-drop-page";
// P6-7(형님 확정 A안) — CreatorCoachCard 는 홈(RoleHome 사업자 세그먼트)으로 이동. 스튜디오=빌더 복귀.
// Phase 2 — 미리보기 쿠폰 타이머(1-A 배지 재사용, 수신카드 1-C couponPanel 동형).
import { TimerBadge } from "@/components/home/ShareCardTile";
import { EMPTY_PRODUCT_COPY, type ProductCopyValue } from "@/components/create/ProductCopyEditor";
import type { DiscoverCandidate } from "@/components/explore/DiscoverSection";
import { DropCardShell } from "@/components/card/DropCardShell";
import { CardBody } from "@/components/card/CardBody";
import { ProductWidget } from "@/components/card/ProductWidget";
import { CouponPreview } from "@/components/receiver/CouponPreview";
import type { VideoSlot } from "@/components/card/CardBody.types";
import { MODE_ACCENT } from "@/lib/mode-accent";
import {
  Calendar,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Palette,
  Ticket,
  ShoppingBag,
  Rocket,
  TrendingUp,
  Megaphone,
  Lightbulb,
  Sparkles,
  Star,
  Check,
  Send,
  // STUDIO-fix2 G5 — Play(가짜 재생 placeholder) 제거, 실업로더 아이콘 추가.
  ImagePlus,
  Loader2,
  Lock,
  Store,
  Zap,
  Plus,
  ChevronDown,
  Sliders,
  Wrench,
  Circle,
  CircleCheck,
  Search,
  RefreshCw,
  Phone,
  MessageSquare,
  MapPin,
  ExternalLink,
  Copy,
  MessageCircle,
  Wand2,
  Flag,
  Tag,
  Globe,
  ShoppingCart,
  Layers,
} from "lucide-react";
// DOCK-3 — 카드 도킹 피커(신규 v1). 인라인 아코디언 전용(Radix 금지 락).
import { CardDockingPicker, type DockedProduct } from "@/components/studio/CardDockingPicker";

// =============================================================================
// /studio/build — 격리 프리뷰 라우트 (룩 확인 전용).
//   소스: v0 export card-studio-page.tsx. 내부 더미 상태·로직(STUDIO_BLOCKS·
//   useState·링고AI·덱·완성도·드롭)은 그대로 — 실데이터 배선은 다음 단계.
//   인증은 부모 _user.tsx 가 담당(여기 loader 없음 → throw 없음, graceful).
//   v0 globals 의 커스텀 keyframes(forge-float/holo-sweep/gauge-shine/animate-*)
//   는 이 repo 에 없어, 기존 파일 무수정 원칙을 지키려 아래 <style> 로 동봉한다.
// =============================================================================

// LinkDrop "카드 스튜디오" — 게임 카드 강화(포지) 경험.
// 하단 강화 카드 덱을 스와이프해서 고르고, 탭하면 메인 카드에 장착된다.
// 장착할수록 전환력(완성도) 게이지가 차오르고 카드 등급(별)이 올라간다.
// 블록은 데이터 배열 → 추가 시 UI/완성도/링고AI/덱이 자동 반영.

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

// 영상 슬롯 데이터 형태(VideoSlot) — YouTubeLiteEmbed 시그니처 = CardBody.types 단일 출처에서 import.
//   selectedVideo state 가 보유.

// 초 → "M:SS" (또는 ≥1h 면 "H:MM:SS"). 영상 길이 라벨용.
function formatDuration(totalSec: number): string {
  const t = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// DiscoverCandidate → 영상 슬롯(YouTubeLiteEmbed props) 어댑터.
//   source_id = YouTube videoId. duration_sec ≤60 이면 쇼츠로 간주(9:16).
function toVideoSlot(c: DiscoverCandidate): VideoSlot {
  return {
    videoId: c.source_id,
    // youtube 16:9 썸네일(mqdefault) — 카드 슬롯도 리스트와 동일 비율. source_id 없으면 원본 폴백.
    thumbnailUrl: c.source_id
      ? `https://i.ytimg.com/vi/${c.source_id}/mqdefault.jpg`
      : (c.thumbnail_url ?? ""),
    title: c.title ?? "영상",
    isShorts: (c.duration_sec ?? 999) <= 60,
    durationLabel: c.duration_sec ? formatDuration(c.duration_sec) : undefined,
    sourceLabel: "YouTube",
  };
}

const STUDIO_BLOCKS: StudioBlock[] = [
  {
    id: "calendar",
    label: "예약 캘린더",
    desc: "날짜 고르고 바로 예약",
    detail:
      "고객이 카드 안에서 날짜·시간을 골라 바로 예약해요. 전화나 DM 없이 전환되는 가장 강한 레버예요.",
    icon: Calendar,
    category: "purpose",
    power: 30,
    isMain: true,
  },
  {
    id: "content",
    label: "영상 · 핵심구간",
    desc: "TimeLink로 0:42 명장면만 콕",
    detail:
      "긴 영상에서 가장 설득력 있는 구간만 골라 보여줘요. 첫 3초에 눈길을 잡아 이탈을 막아요.",
    icon: Video,
    category: "content",
    power: 28,
  },
  {
    id: "coupon",
    label: "쿠폰 연결",
    desc: "내 매장 쿠폰 중 선택",
    detail:
      "내 매장에 등록된 쿠폰을 카드에 붙여 방문 동기를 만들어요. 할인폭이 클수록 전환이 올라가요.",
    icon: Ticket,
    category: "purpose",
    power: 18,
  },
  {
    id: "product",
    label: "상품 등록",
    desc: "사진 · 이름 · 가격 한 번에",
    detail:
      "상품 사진과 이름·가격을 한 블록에서 등록해요. 사진이 카드 본체가 되고, 보는 사람이 바로 가격을 확인하고 주문할 수 있어요.",
    icon: Tag,
    category: "purpose",
    power: 45, // productimage(28) 흡수 — 사진이 상품 카드 필수라 완성 기여 상향.
    isMain: true,
  },
  {
    id: "seasonal",
    label: "판매 캘린더",
    desc: "판매 기간·가능일을 한눈에",
    detail:
      "상품을 살 수 있는 기간과 판매 가능일을 캘린더로 보여줘요. 지금이 구매 적기라는 걸 알려 주문을 앞당겨요.",
    icon: Calendar,
    category: "purpose",
    power: 30,
    isMain: true,
  },
  {
    id: "dock",
    label: "카드 도킹",
    desc: "다른 카드 연결해 함께 보내기",
    detail:
      "탐색에서 다른 메이커의 공개 카드를 찾아 내 카드에 연결해요. 받은 사람이 관련 카드로 바로 넘어가고, 주문·혜택은 원본 카드가 그대로 받아요.",
    icon: Layers,
    category: "purpose",
    power: 12,
  },
  {
    id: "image",
    label: "대표 이미지",
    desc: "썸네일 한 장으로 눈길",
    detail:
      "피드에서 가장 먼저 보이는 한 장이에요. 분위기가 잘 드러난 사진일수록 클릭률이 높아져요.",
    icon: ImageIcon,
    category: "content",
    power: 10,
  },
  {
    id: "link",
    label: "매장정보", // C14② 노출 라벨만 변경(id·저장키 0터치). 매장 전화·위치·예약링크 표시(store 파생, 읽기전용).
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
    desc: "추천 피드에 더 노출",
    detail: "이미 잘 만든 카드를 추천·탐색에 더 노출해요. 완성된 카드일 때만 효과가 커요.",
    icon: Rocket,
    category: "enhance",
    power: 0,
    isPaid: true,
  },
  {
    id: "marketing",
    label: "마케팅 강화",
    desc: "내 채널에 직접 발행",
    detail:
      "내 네이버 블로그·인스타·유튜브에 발행해 더 많은 사람을 카드로 데려와요. 전환 설계가 끝난 뒤 마지막으로 더하는 단계예요.",
    icon: Megaphone,
    category: "enhance",
    power: 0,
    isPaid: true,
  },
];

const CARD_COLORS = [
  { id: "ink", value: "#0F172A", label: "잉크" },
  { id: "forest", value: "#14532D", label: "포레스트" },
  { id: "navy", value: "#1E3A8A", label: "네이비" },
  { id: "wine", value: "#7F1D1D", label: "와인" },
  { id: "sand", value: "#78350F", label: "샌드" },
  { id: "slate", value: "#334155", label: "슬레이트" },
];

const ENABLE_COLOR_PICKER = false; // 색 선택 기능 임시 숨김. true로 켜면 팔레트 복원.

// 커머스 3모드 골격 — 모드별 덱 구성/카드색/강조색. STUDIO_BLOCKS(데이터)는 단일 출처, 모드는 id 선택만.
const blockById = (id: string) => STUDIO_BLOCKS.find((b) => b.id === id)!;
const DECK_IDS: Record<"general" | "reserve" | "commerce", string[]> = {
  // C14① — 퍼블릭 덱 정리: 대표이미지(image)·행동링크(link) 제거(영상+강화만). reserve/commerce 0터치.
  general: ["content", "bgcolor", "top", "boost", "marketing"],
  reserve: [
    "calendar",
    "content",
    "coupon",
    "image",
    "link",
    // DOCK-3 — 카드 도킹(reserve 전용 편입). commerce 는 attachedProducts 재사용 발행
    //   (:746 reusedProduct)과 시맨틱 충돌이라 미편입(Phase 2 검토).
    "dock",
    "bgcolor",
    "top",
    "boost",
    "marketing",
  ],
  commerce: ["product", "seasonal", "coupon", "link", "bgcolor", "top", "boost", "marketing"],
};
// v0 CARD_BASE — 세 모드 기본 카드색 흰색 통일. CARD_COLORS 팔레트는 유지(사용자가 다크색 선택 가능).
const MODE_CARD_COLOR: Record<"general" | "reserve" | "commerce", string> = {
  general: "#FFFFFF",
  reserve: "#FFFFFF",
  commerce: "#FFFFFF",
};
const ENHANCE_UNLOCK = 75;
const POINT = "#1D4ED8"; // 전환력 지표(게이지·별·파워)에만
const INK = "#0A0A0A";
const TAGLINE_MAX = 40; // 한마디(카드 부제) 글자수
const MAX_POINTS = 3; // 카드에 넣을 셀링포인트 최대 개수(카드 안 넘치게)

function getStage(score: number) {
  if (score >= ENHANCE_UNLOCK) return { stars: 3, label: "완성", tone: "전환 준비 완료" };
  if (score >= 40) return { stars: 2, label: "괜찮음", tone: "조금만 더" };
  return { stars: 1, label: "기본", tone: "아직 약해요" };
}

// 덱 구성은 컴포넌트 내부 useMemo(buildMode 의존)로 이동 — DECK_IDS[buildMode] 기반.

// 블록 설정 아코디언 대상 — 설정이 필요한 블록만. bgcolor(색=덱 팔레트)·강화 3종 제외.
const SETTING_BLOCK_IDS = ["calendar", "content", "coupon", "image", "link", "product", "dock"];

// STUDIO-fix3 H4⑵ 의 KeyboardAwareBar 는 NAV-fix1 에서 @/components/keyboard-aware-bar 로
//   공용 추출(하단 네비와 공유) — 동작·시맨틱 동일(중복 제거만).

// v0 globals 부재 keyframes 동봉 — 룩 보존용(기존 파일 무수정).
const STUDIO_BUILD_CSS = `
@keyframes sb-forge-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.forge-float { animation: sb-forge-float 4s ease-in-out infinite; }
@keyframes sb-forge-burst { 0% { transform: scale(0.2); opacity: 0; } 40% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.forge-burst { animation: sb-forge-burst 0.5s cubic-bezier(0.19,1,0.22,1) both; }
@keyframes sb-chip-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.18); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.chip-pop { animation: sb-chip-pop 0.32s cubic-bezier(0.19,1,0.22,1) both; }
@keyframes gauge-shine { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
@keyframes sb-fade-in { from { opacity: 0; } to { opacity: 1; } }
.animate-fade-in { animation: sb-fade-in 0.3s ease-out both; }
@keyframes sb-slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.animate-slide-up { animation: sb-slide-up 0.3s cubic-bezier(0.19,1,0.22,1) both; }
@keyframes sb-scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
.animate-scale-in { animation: sb-scale-in 0.25s ease-out both; }
`;

// 상품 이미지 업로드·KAMIS 시세 조회는 P2에서 ProductRegisterForm(공용 폼)이 내장 —
//   스튜디오 복제본(PRODUCT_IMAGE_BUCKET/resizeProductImageToJpeg/kamis state·effect)은 제거.

export function CardStudioPage() {
  // loader 데이터 수신만 — 이번 단계는 배선까지. 화면 하드코딩 치환은 다음 단계.
  const { isBusiness, store, coupons, manageCoupons, myRewards } = Route.useLoaderData();
  // P6-3(A안) — 사업자 모드 잠금 게이트: 비사업자(또는 매장 미보유)는 퍼블릭(general)만 활성.
  //   무세션은 _user 부모 가드 소관(여기 도달 전 /login). 사업자는 false → 현행 완전 동일.
  const bizLocked = !isBusiness || !store;
  const router = useRouter();
  // 링고 스타터 목적 프리셋 — ?purpose 를 초기 buildMode 로 매핑(쿠폰/예약→reserve · 구매→commerce ·
  //   정보/미지정→general). 비사업자(bizLocked)는 사업자 모드 진입 차단(§0 게이트) → general 고정.
  //   switchMode 미호출 = 콘텐츠 리셋 없음(fresh mount) · CardBody 거울은 buildMode 파생 props 를
  //   늘 받던 대로 수신(초기값만 다름) = 미러 무영향.
  const { purpose: purposeParam } = Route.useSearch();
  const initialMode: "general" | "reserve" | "commerce" = bizLocked
    ? "general"
    : purposeParam === "구매"
      ? "commerce"
      : purposeParam === "쿠폰" || purposeParam === "예약"
        ? "reserve"
        : "general";
  // 쿠폰 만들기 바텀시트(CouponManageView 임베드) 노출 상태.
  const [couponSheetOpen, setCouponSheetOpen] = useState(false);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  // 방금 켠 블록 id — 코칭이 "방금 켠 블록"에 반응하게(영상/쿠폰 내용검증 우선). 끄면 null.
  const [lastEquippedId, setLastEquippedId] = useState<string | null>(null);
  // 커머스 3모드 — 퍼블릭/예약·쿠폰/커머스. 덱 구성·카드색·강조색의 단일 스위치. (초기값 = 목적 프리셋)
  const [buildMode, setBuildMode] = useState<"general" | "reserve" | "commerce">(initialMode);
  const [cardColor, setCardColor] = useState(MODE_CARD_COLOR[initialMode]); // 모드 파생(switchMode 가 갱신). 색 기능 재개 시 팔레트로 환원
  // 라이트 카드(흰 셸) 여부 — 흰 셸이면 CardBody·stub 텍스트를 어두운 토큰으로. 다크색 선택 시 false=기존 동작.
  const isLightCard = cardColor === "#FFFFFF";
  // C4d — 현재 모드 목적색(v0 MODE_ACCENT). 뱃지·별·게이지·placeholder 틴트에 사용(동적 hex → style 속성).
  const accent = MODE_ACCENT[buildMode];
  const [showColorPicker, setShowColorPicker] = useState(false);
  // 쿠폰 피커 — 내 쿠폰 여러 개 중 선택(인라인, 색상 팔레트 showColorPicker 패턴 동일).
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  // 상품 블록 — 내 등록상품(get_my_products) 선택. 쿠폰 selectedCouponId 패턴. 미리보기·저장 배선은 다음 단계.
  const [attachedProducts, setAttachedProducts] = useState<AttachedProduct[]>([]);
  // DOCK-3 — 카드 도킹 자산(남의 공개 카드 참조 다건). ★ attachedProducts(내 상품, 커머스
  //   발행 재사용 :746·사진 가드 :665 판정 재료)와 별도 상태 — 남의 드롭이 그 판정에 섞이면
  //   발행이 남의 카드를 재사용하는 오동작이라 분리(§0). 모드 전환에도 덱 자산으로 보존.
  const [dockedProducts, setDockedProducts] = useState<DockedProduct[]>([]);
  // 커머스 상품 상태 — P2: 입력은 ProductRegisterForm(임베드)이 소유, 여기는 등록 결과 미러
  //   (카드 미리보기 productPreview·발행 payload·코치 isFilled 가 읽는다). §0: 시세 없음.
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  // P6-6(A안) — 폼 제출 응답의 공유 URL(단축 우선). 발행이 드롭 A 를 재사용할 때 savedUrl 로 승계.
  const [productShareUrl, setProductShareUrl] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState<number | null>(null);
  // 커머스 홍보 문구(나-1) — headline/sellingPoints. 등록폼 제출 결과 미러.
  const [productCopy, setProductCopy] = useState<ProductCopyValue>(EMPTY_PRODUCT_COPY);
  // STUDIO-fix2 G5 — 대표 이미지 블록 전용 상태(종전 미구현 placeholder → 실 업로더).
  //   heroImagePreview = 즉시 프리뷰(선택 직후 objectURL → 업로드 완료 시 실URL 교체).
  //   heroImageUrl = 업로드 완료된 실URL(코치 done 판정·표시 기준).
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState<string | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const [showCouponPicker, setShowCouponPicker] = useState(false);
  const [dropped, setDropped] = useState(false);
  // S2-a 저장 — POST /api/drops(영상+한마디만). 단축 URL 반환 확인까지.
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // P7b — 공개/비공개 토글(기본 공개 = P7 백필 시맨틱) + 카톡 전송 진행 상태.
  const [isPublic, setIsPublic] = useState(true);
  const [sending, setSending] = useState(false);
  const [deckIndex, setDeckIndex] = useState(0);
  const [pressedId, setPressedId] = useState<string | null>(null);
  // 블록 설정 아코디언 — 한 번에 하나만 펼침(null = 전부 접힘).
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  // 한마디(카드 부제) — 메이커 직접 입력. 카드 미리보기 부제로 표시(가짜 하드코딩 대체).
  const [tagline, setTagline] = useState("");
  // 영상 블록 — 선택된 영상(카드 슬롯이 읽어 WYSIWYG 반영) + 검색 state.
  const [selectedVideo, setSelectedVideo] = useState<VideoSlot | null>(null);
  const [videoQuery, setVideoQuery] = useState("");
  const [videoResults, setVideoResults] = useState<DiscoverCandidate[]>([]);
  const [videoSearching, setVideoSearching] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  // 검색 실행 여부 — 검색 전(안내) vs 결과 0개(없음) 구분용.
  const [videoSearched, setVideoSearched] = useState(false);
  // 카피 AI(B-2) — 영상 선택 시 백그라운드로 키포인트 리드(B-3에서 셀링포인트로 사용).
  const [aiKeyPoints, setAiKeyPoints] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  // B-3 — 메이커가 고른 셀링포인트(카드 미리보기 표시용). ★ 저장은 다음 단계(RPC 필요), 이번엔 state까지.
  const [pickedPoints, setPickedPoints] = useState<string[]>([]);
  // 경쟁조건 가드 — 영상 빨리 바꿀 때 stale 응답이 키포인트 덮어쓰지 않게(최신 선택 videoId).
  const aiVideoRef = useRef<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  // P — 히어로 미리보기가 화면(헤더 아래)에서 사라지면 상단 컴팩트 띠를 sticky 노출.
  //   덱 장착 중에도 카드 상태(썸네일·제목·전환력)가 계속 보이게 해 위아래 왕복 제거.
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), {
      rootMargin: "-60px 0px 0px 0px",
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const touchStart = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHold = useRef(false);

  // 선택된 쿠폰 — 미선택이면 첫 쿠폰 fallback(장착 시 자동 첫 쿠폰). coupons 비면 undefined.
  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId) ?? coupons[0];

  // 덱 = 현재 모드의 id 목록 → 블록 데이터 매핑(bgcolor 숨김 규칙 보존). 모듈 const DECK 대체.
  const DECK = useMemo(
    () =>
      DECK_IDS[buildMode].map(blockById).filter((b) => ENABLE_COLOR_PICKER || b.id !== "bgcolor"),
    [buildMode],
  );

  // 모드 전환 — 덱/카드색 교체 + 장착·덱위치 리셋(모드 간 잔상 방지).
  const switchMode = (next: "general" | "reserve" | "commerce") => {
    if (next === buildMode) return;
    // P6-3(§0 게이트) — 비사업자: 사업자 모드(예약·쿠폰/커머스) 전환 자체를 차단 → 등록 유도.
    //   전환이 발생하지 않으므로 저장·발행 경로에 비사업자 커머스 데이터가 흘러들 수 없다.
    //   (서버측 이중 방어 = create_drop_v2 v7.4 비사업자 purpose 게이트.)
    if (bizLocked && next !== "general") {
      void router.navigate({ to: "/partner/register" });
      return;
    }
    // S12 — 형님 확정 A: 목적 전환 = 전면 리셋(새 카드). S10 커머스 경계 조건은 S12로 대체(전면화). 이중 방어 게이트는 존치.
    setBuildMode(next);
    setApplied({});
    setDeckIndex(0);
    setCardColor(MODE_CARD_COLOR[next]);
    setDropped(false);
    setShowColorPicker(false);
    setProductImageUrl(null); // 커머스 잔재 방지
    setProductName("");
    setProductPrice(null);
    setProductCopy(EMPTY_PRODUCT_COPY);
    // STUDIO-fix2 G5 — S12 전면 리셋에 대표 이미지 상태 동참(잔재 방지).
    setHeroImageUrl(null);
    setHeroImagePreview(null);
    setHeroUploadError(null);
    // 카드 콘텐츠 전면 리셋(무조건) — 영상 트랙(영상·AI요약·셀링포인트) + 한마디 + 쿠폰 선택.
    //   검색도구(videoQuery/Results/Searched)·덱 자산(attachedProducts)은 보존(0터치).
    setSelectedVideo(null);
    setAiKeyPoints([]);
    setPickedPoints([]);
    setTagline("");
    setSelectedCouponId(null);
  };

  // S4-2 KAMIS 부류·품목·시세 조회 effect 3종 — P2에서 ProductRegisterForm 내장분으로 대체(제거).

  const score = useMemo(() => {
    // 도달가능(덱 노출) non-paid 블록 power 합을 분모로 정규화.
    // bgcolor 숨김 시 분모도 줄어 전부 장착=100%. 색 재개 시 bgcolor 복귀로 분모 자동 복원.
    const reachable = DECK.filter((b) => !b.isPaid);
    const maxPower = reachable.reduce((sum, b) => sum + b.power, 0);
    const gained = reachable.reduce((sum, b) => (applied[b.id] ? sum + b.power : sum), 0);
    return maxPower > 0 ? Math.round((gained / maxPower) * 100) : 0;
  }, [applied]);

  const stage = getStage(score);
  const appliedCount = STUDIO_BLOCKS.filter((b) => applied[b.id] && !b.isPaid).length;

  // 코치(lingo) — 모드-인지. 불변식: 현재 buildMode 의 DECK 에 있는 블록만 추천(action·텍스트 둘 다).
  //   DECK 에 없는 블록(예: 커머스인데 content/calendar)은 절대 가리키지 않는다.
  const lingo = useMemo<{
    text: string;
    short: string;
    action: string | null;
    done?: boolean;
  }>(() => {
    const deckBlocks = DECK; // 현재 모드 덱만

    // 거짓완성 차단 — 블록이 '실제로 채워졌는지'(탭 여부 아님). 데이터 state 있으면 그걸로, 없으면 applied 폴백.
    //   데이터검증: content(selectedVideo)·coupon(selectedCouponId)·product(사진+이름+결정가 통합).
    //   폴백(전용 데이터 state 없음): image·seasonal(데이터 UI 미구현, 후속) → applied.
    const isFilled = (id: string): boolean => {
      switch (id) {
        case "content":
          return !!selectedVideo; // 영상 실제 선택
        case "coupon":
          return !!selectedCouponId; // 쿠폰 실제 선택 id
        case "product":
          // 상품 = 사진 + 이름 + 결정가 통합(productimage 블록 흡수).
          return !!productImageUrl && !!productName.trim() && (productPrice ?? 0) > 0;
        case "image":
          // STUDIO-fix2 G5 — 전용 state 생김: 실제 업로드 완료 시에만 done(장착만으론 미완).
          return !!heroImageUrl;
        case "seasonal":
          return !!applied["seasonal"]; // 판매 캘린더 데이터 UI 미구현 → applied 폴백
        default:
          return !!applied[id]; // link/bgcolor/유료 등
      }
    };

    const nextLever = deckBlocks
      .filter((b) => !b.isPaid && !isFilled(b.id))
      .sort((a, b) => b.power - a.power)[0];

    // 핵심(isMain) 미충족부터 — 모드별 본체/목적 블록 우선(탭만 하고 값 빈 것도 미충족).
    const firstMissingMain = deckBlocks.find((b) => b.isMain && !isFilled(b.id));
    if (firstMissingMain) {
      const HINTS: Record<string, string> = {
        content:
          "친구가 0.5초 안에 멈추게 하려면 영상 핵심구간부터. 후크가 없으면 아무도 안 눌러요.",
        image: "본체 이미지 한 장이면 카드가 확 살아나요. 가장 잘 나온 컷부터 올려보세요.",
        calendar: "예약 카드인데 누를 곳이 없어요. 예약 캘린더를 장착해야 친구가 바로 행동해요.",
        product: "팔 상품의 이름과 가격부터 등록해요. 가격이 보여야 친구가 주문을 결심해요.",
        seasonal: "지금이 구매 적기라는 걸 판매 캘린더로 보여주면 주문이 앞당겨져요.",
      };
      return {
        text: HINTS[firstMissingMain.id] ?? `${firstMissingMain.label}부터 장착해보세요.`,
        short: `${firstMissingMain.label} 추가해요`,
        action: firstMissingMain.id,
      };
    }
    // 쿠폰 — 덱에 있을 때만(없는 모드에선 추천 금지). 실제 쿠폰 선택 여부로 판정.
    if (deckBlocks.some((b) => b.id === "coupon") && !isFilled("coupon")) {
      return {
        text: "왜 지금 행동해야 하죠? 쿠폰 한 장이면 '누를 이유'가 생겨요.",
        short: "쿠폰을 연결해요",
        action: "coupon",
      };
    }
    // terminal(done) 가드 — score 만으로 완성 신호 금지. 현재 덱의 핵심(isMain)이 전부 실충족 +
    //   score>=ENHANCE_UNLOCK 일 때만 done:true. 아니면 아래 레버 안내로 떨어진다(거짓완성 차단).
    const mainsAllFilled = deckBlocks.filter((b) => b.isMain).every((b) => isFilled(b.id));
    // 퍼블릭(정보)은 isMain이 없어 mains 게이트가 비므로, 본체인 영상(content)을 핵심 취급(방어적으로 isFilled만 사용).
    const coreFilled = mainsAllFilled && (buildMode !== "general" || isFilled("content"));
    if (score >= ENHANCE_UNLOCK && coreFilled) {
      return {
        text: "전환 레버가 충분해요. 이제 강화(부스트)를 켜면 도달이 늘어요. 지금이 쓸 타이밍.",
        short: "강화를 켜보세요",
        action: null,
        done: true,
      };
    }
    // 그 외 — 덱 안 다음 레버 추천(미충족 핵심이 없어도 부족분 채우기 유도).
    return {
      text: nextLever
        ? `${nextLever.label}까지 더하면 전환력이 확 올라가요.`
        : "핵심부터 채워요. 조금만 더 하면 완성!",
      short: nextLever ? `${nextLever.label} 추가해요` : "조금만 더 채워요",
      action: nextLever?.id ?? null,
    };
  }, [
    applied,
    score,
    buildMode,
    selectedVideo,
    selectedCouponId,
    productName,
    productPrice,
    productImageUrl,
    heroImageUrl, // STUDIO-fix2 G5 — image done 판정 dep
  ]);

  // 블록 설정 아코디언 토글 — 같은 걸 다시 누르면 접힘, 다른 걸 누르면 그것만 펼침.
  const toggleBlockSettings = (id: string) => setExpandedBlockId((cur) => (cur === id ? null : id));

  // 영상 검색 — /api/discover 직접 호출(인프라 이미 배포, DiscoverSection 컴포넌트 미사용).
  //   1차: URL/키워드 구분 없이 그대로 keyword 로 전달(엔드포인트가 검색 처리).
  //   TODO(후속): 유튜브 URL 직접입력 → oembed 로 단일 영상 즉시 해석하는 전용 분기.
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
      // v3: 영상 슬롯엔 youtube만(엔진은 naver도 주지만 표시 단계에서 거름 — 네이버는
      //   thumbnail_url null + source_id=URL 이라 영상 임베드가 깨짐). 엔진 불변.
      //   v4에서 이 필터를 풀고 naver를 하단 첨부로 분리 예정.
      setVideoResults((json.candidates ?? []).filter((c) => (c.provider as string) === "youtube"));
    } catch {
      setVideoError("네트워크 오류로 검색하지 못했어요.");
      setVideoResults([]);
    } finally {
      setVideoSearching(false);
      setVideoSearched(true);
    }
  };

  // 영상 선택 — 카드 즉시 반영(WYSIWYG) + 백그라운드 카피 AI 리드(B-2).
  //   oembed 로 source_id(content_sources UUID) 확보 → generate-summary 로 키포인트 수신.
  //   경쟁조건: 영상 빨리 바꾸면 aiVideoRef 로 stale 응답을 무시(최신 선택만 반영).
  //   best-effort — 실패해도 카피는 직접 입력 가능.
  const handleSelectVideo = async (c: DiscoverCandidate) => {
    const slot = toVideoSlot(c);
    setSelectedVideo(slot); // 즉시 카드 반영
    aiVideoRef.current = slot.videoId; // 이 호출이 최신 선택임을 기록
    setAiKeyPoints([]);
    setPickedPoints([]); // 새 영상이면 이전 선택 셀링포인트 무효
    setAiLoading(true);
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${slot.videoId}`;
      const oembedRes = await fetch("/api/oembed?url=" + encodeURIComponent(videoUrl));
      const oembedJson = (await oembedRes.json()) as { source_id?: string };
      const sourceId = oembedJson?.source_id;
      if (!oembedRes.ok || !sourceId) throw new Error("oembed failed");
      if (aiVideoRef.current !== slot.videoId) return; // stale — 그 사이 다른 영상 선택됨

      const sumRes = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }), // purpose 생략 → "정보" 기본
      });
      const sumJson = (await sumRes.json()) as { ai_key_points?: unknown };
      if (!sumRes.ok) throw new Error("summary failed");
      if (aiVideoRef.current !== slot.videoId) return; // stale 재확인

      setAiKeyPoints(
        Array.isArray(sumJson?.ai_key_points)
          ? (sumJson.ai_key_points as unknown[]).filter(
              (s): s is string => typeof s === "string" && s.trim().length > 0,
            )
          : [],
      );
    } catch (e) {
      console.warn("[studio-build] 카피 AI 리드 실패:", e);
      if (aiVideoRef.current === slot.videoId) setAiKeyPoints([]);
    } finally {
      if (aiVideoRef.current === slot.videoId) setAiLoading(false);
    }
  };

  // S2-a 저장 — 영상(media_url) + 한마디(curator_message)만 /api/drops 로. 쿠폰·예약은 다음 단계.
  //   media_url = selectedVideo.videoId 로 만든 YouTube watch URL(서버가 extract-meta 로 source 처리).
  //   purpose = "정보"(drop_purpose enum 값, 영상만 카드). is_public = false. blocks 미전송(영상은 media_url 본체).
  // P7b — 성공 시 URL·share_uuid 반환(폴리시로 전송은 게시후 활성 — 반환값은 후속 소비자용 유지).
  async function handleSaveDrop(): Promise<{ url: string | null; shareUuid: string } | null> {
    // 6a 영상 게이트 완화 — 비커머스만 영상 필수(커머스는 self_upload 라 영상 없이 저장).
    if (buildMode !== "commerce" && !selectedVideo) {
      setSaveError("영상을 먼저 선택해주세요.");
      return null;
    }
    // 6b 커머스 필수 가드 — 사진 + 이름 + 결정가(§0 단일값).
    //   P7b 폴리시(B2) — 사진 보유 판정에 덱 재사용 자산(attachedProducts[0].refDropId = 사진 보유
    //   드롭A)도 인정: switchMode 리셋이 productImageUrl 미러만 지우고 덱 자산은 보존하는
    //   비대칭으로, 재사용 분기 도달 전에 이 가드가 오차단하던 문제 해소.
    if (buildMode === "commerce") {
      // STUDIO-fix3 H1 — 사진 계보 통일: 폼 미러(productImageUrl)·대표 이미지(heroImageUrl)·
      //   덱 자산(attachedProducts) 어느 경로로 올려도 가드 충족(계보 불일치로 인한 오경고 해소).
      const hasProductImage =
        !!productImageUrl || !!heroImageUrl || !!attachedProducts?.[0]?.refDropId;
      if (!hasProductImage) {
        setSaveError("상품 사진을 올려주세요.");
        return null;
      }
      if (!productName.trim()) {
        setSaveError("상품 이름을 입력해주세요.");
        return null;
      }
      if (!((productPrice ?? 0) > 0)) {
        setSaveError("가격을 입력해주세요.");
        return null;
      }
    }
    if (saving) return null;
    setSaving(true);
    setSaveError(null);
    try {
      // 6c mediaUrl 은 비커머스에서만(커머스는 selectedVideo null 가능 → .videoId 접근 금지).
      const mediaUrl = selectedVideo
        ? `https://www.youtube.com/watch?v=${selectedVideo.videoId}`
        : null;
      // 쿠폰 붙음 단일 판정 — purpose 결정 + 쿠폰 RPC 둘 다 같은 조건(일관성).
      //   selectedCouponId(원본)로 판단(selectedCoupon fallback 거짓 양성 회피).
      const hasCoupon = applied["coupon"] && !!selectedCouponId;
      // 예약 장착 — 캘린더 블록 장착이면 예약 의도. 슬롯은 캘린더 인라인이 매장 단위로 이미 저장,
      //   손님 화면이 drop.partner_id 로 get_available_slots 조회(슬롯 0개여도 purpose="예약" 유효).
      const hasReservation = !!applied["calendar"];
      // purpose 우선순위(비커머스): 예약 > 쿠폰 > 정보. (커머스는 self_upload 서버가 "구매" 고정.)
      const dropPurpose = hasReservation ? "예약" : hasCoupon ? "쿠폰" : "정보";
      // DOCK-3 — 도킹 ref 블록(발행 payload 재료). create-wizard :179-191 block_data 계약
      //   동일 + producer_name(출처 생산자명 스냅샷, 피커가 public_profiles 로 조회한 값).
      //   dock 블록 장착 시에만 합류. 주문·전환은 원본 카드 몫(§0 — create_preorder 0터치).
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
      // HERO-2 대표 이미지 + DOCK-3 도킹 블록 병합 — position 연속 재부여(create-wizard 관례).
      const extraBlocks = [
        ...(applied["image"] && heroImageUrl
          ? [{ block_kind: "image", block_data: { image_url: heroImageUrl } }]
          : []),
        ...dockBlocks,
      ].map((b, i) => ({ ...b, position: i }));
      // 6d body 분기 — 커머스=self_upload(영상 0), 비커머스=기존 media_url 경로(1줄도 안 바꿈).
      const body =
        buildMode === "commerce"
          ? {
              self_upload: true,
              image_url: productImageUrl,
              name: productName.trim(),
              price_krw: productPrice,
              // 나-1 홍보 문구 — 서버가 메인 product 블록 block_data 에 머지(빈 값은 서버 생략).
              headline: productCopy.headline,
              selling_points: productCopy.sellingPoints,
              price_band_enabled: false, // §0 시세 영구 금지
              is_public: isPublic, // P7b — 발행 바 공개/비공개 토글값
              blocks: [
                {
                  block_kind: "product",
                  block_data: { name: productName.trim(), price_krw: productPrice },
                  position: 0,
                },
              ],
            }
          : {
              media_url: mediaUrl,
              purpose: dropPurpose,
              curator_message: tagline.trim() || null,
              is_public: isPublic, // P7b — 발행 바 공개/비공개 토글값
              // 예약 슬롯 조회(손님 get_available_slots)가 drop.partner_id 기준 — 매장 연결 필수.
              //   쿠폰·정보에도 매장 연결로 유용. studio-build 는 비즈니스 전제(store 있음).
              partner_id: store?.id ?? null,
              // HERO-2 — 대표 이미지 블록 동봉: 기존 blocks passthrough(/api/drops :381
              //   p_blocks) 계약 그대로(신규 payload 필드 0 · enum 'image' 값은 마이그레이션
              //   hero2_block_kind_image 로 수용). 수신카드 포스터·피드 타일 썸네일이 이 블록으로
              //   오버라이드되고 영상 재생 기능은 보존된다. 없으면 기존 동작 그대로.
              // DOCK-3 — 도킹 ref 블록도 같은 자리(extraBlocks 병합)로 합류.
              ...(extraBlocks.length > 0 ? { blocks: extraBlocks } : {}),
            };
      // P6-6(A안) — 커머스 발행 = 폼 제출로 이미 생성된 상품 드롭 A(완전체: 고지·신선·kamis·카피
      //   보유) 재사용. /api/drops 재호출 제거 → 이중 생성 + 발행본 데이터 열화(§0·고시 결함) 해소.
      //   refDropId 부재(폼 미제출 발행 시도) = 아래 else 폴백(현행 신규 생성) 유지 —
      //   P6-5ⓑ(임베드 상품명 필수)와 발행 가드(사진·이름·가격)로 이 폴백 도달은 자연 축소.
      //   is_public 은 A·구 B 모두 false(비공개 링크 열람)라 상태 전환 불요 — 공개 설계는 P7 소관.
      // P7b — 재사용 분기는 기존 드롭 공개상태 유지, P7 토글 미적용(신규 발행 없음).
      const reusedProduct =
        buildMode === "commerce" && attachedProducts[0]?.refDropId ? attachedProducts[0] : null;
      let dropId: string | null;
      let publishedShareUuid: string;
      let shareableUrl: string | null;
      if (reusedProduct) {
        dropId = reusedProduct.refDropId;
        publishedShareUuid = reusedProduct.refShareUuid;
        shareableUrl = productShareUrl; // 폼 제출 응답의 단축 URL(없으면 아래 long 폴백)
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
          return null;
        }
        dropId = json.drop.id ?? null;
        publishedShareUuid = json.drop.share_uuid;
        shareableUrl = json.shareable_url ?? null;
      }

      // S1-b로 이관됨 — 이 CardStudioPage(legacy)는 `?legacy=1` 전용(StudioBuildSwitch 기본은
      //   CardStudioPage45)이라 이 블록은 실경로 미도달 죽은 코드. 라이브 등가물은
      //   CardStudioPage45.handlePublish 의 S1-b 블록. 존치(제거는 별도 승인).
      // BUG-1 — 커머스 재사용 발행: 폼 제출로 만든 드롭 A 는 is_public=false(서버 기본)로
      //   생성됐고 이 분기는 /api/drops 를 재호출하지 않아 body.is_public(발행바 토글)이
      //   반영되지 않는다. 발행 성공 후 발행바 토글값(isPublic)을 드롭 A 에 best-effort 반영
      //   (쿠폰/카드색 패턴 동일 — 실패해도 발행 유지). RLS info_drops UPDATE(owner) 기존 정책 커버.
      //   else(신규 생성) 분기는 body 에 is_public 이 실려 나가므로 여기 대상 아님(reusedProduct 게이트).
      if (reusedProduct && dropId) {
        try {
          const { getSupabase } = await import("@/lib/supabase");
          const supabase = getSupabase();
          if (supabase) {
            const { error: pubErr } = await supabase
              .from("info_drops")
              .update({ is_public: isPublic })
              .eq("id", dropId);
            if (pubErr) console.warn("[studio-build] 공개 토글 반영 실패:", pubErr.message);
          }
        } catch (e) {
          console.warn("[studio-build] is_public update exception:", e);
        }
      }

      // S2-b 쿠폰 연결 — purpose 결정과 동일 조건(hasCoupon). create-wizard 패턴: 저장 후
      //   별도 RPC. best-effort(실패해도 저장/URL 진행).
      if (dropId && hasCoupon) {
        try {
          const { getSupabase } = await import("@/lib/supabase");
          const supabase = getSupabase();
          if (supabase) {
            const { error: couponErr } = await supabase.rpc("set_drop_funnel_coupon", {
              p_drop_id: dropId,
              p_coupon_id: selectedCouponId,
            });
            if (couponErr) console.warn("[studio-build] 쿠폰 연결 실패:", couponErr.message);
          }
        } catch (e) {
          console.warn("[studio-build] set_drop_funnel_coupon exception:", e);
        }
      }

      // B-3b 셀링포인트 영속화 — 메이커가 고른 키포인트로 ai_key_points 덮어쓰기.
      //   저장 응답 후 호출 = generate-summary 자동기록(AI 5개) 뒤라 메이커 선택분이 최종 승.
      //   create-wizard/쿠폰과 동일 패턴: 직접 supabase.rpc, best-effort(실패해도 저장/URL 진행).
      // S10 — 커머스 드롭에 영상 유래 셀링포인트 저장 차단(READ에서 확인된 저장 누수)
      if (dropId && buildMode !== "commerce" && pickedPoints.length > 0) {
        try {
          const { getSupabase } = await import("@/lib/supabase");
          const supabase = getSupabase();
          if (supabase) {
            const { error: kpErr } = await supabase.rpc("update_drop_key_points", {
              p_drop_id: dropId,
              p_points: pickedPoints,
            });
            if (kpErr) console.warn("[studio-build] 셀링포인트 저장 실패:", kpErr.message);
          }
        } catch (e) {
          console.warn("[studio-build] update_drop_key_points exception:", e);
        }
      }

      // B-b 카드색 영속화 — 메이커가 고른 카드 배경색 저장(cardColor 는 항상 값, 기본 forest).
      //   셀링포인트/쿠폰과 동일 패턴: 직접 supabase.rpc, best-effort(실패해도 저장/URL 진행).
      if (dropId && cardColor) {
        try {
          const { getSupabase } = await import("@/lib/supabase");
          const supabase = getSupabase();
          if (supabase) {
            const { error: colorErr } = await supabase.rpc("set_drop_card_color", {
              p_drop_id: dropId,
              p_color: cardColor,
            });
            if (colorErr) console.warn("[studio-build] 카드색 저장 실패:", colorErr.message);
          }
        } catch (e) {
          console.warn("[studio-build] set_drop_card_color exception:", e);
        }
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
      setSavedUrl(shareableUrl ?? `${origin}/d/${publishedShareUuid}`);
      setDropped(true);
      return { url: shareableUrl, shareUuid: publishedShareUuid };
    } catch (e) {
      console.error("[studio-build] handleSaveDrop", e);
      setSaveError("카드 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  // P7b 폴리시(B1) — 카톡 전송은 "게시 완료 후"에만: 발행 await 체인 뒤 sendDefault 호출이
  //   사용자 제스처 만료 → 브라우저 팝업 차단을 유발하던 것을 원천 차단(발행은 게시 버튼 소관).
  //   클릭 즉시 shareToKakao 만 수행. shareToKakao 는 throw 없음({ok,fallback} 반환,
  //   실패 시 클립보드 복사 폴백은 함수 내부 처리) — 반환값으로 실패 안내만 표시.
  async function handleSendKakao() {
    if (sending || saving) return;
    // 미게시 방어 — 버튼 disabled 로 도달하지 않지만 이중 가드.
    if (!dropped || !savedUrl) return;
    setSending(true);
    try {
      const linkUrl = savedUrl;
      // 스튜디오 실측 매핑 — 커머스: 상품명·상품사진, 비커머스: 영상 제목·썸네일.
      //   description 은 위저드 규칙([purpose, makerNote].join(" · ")) 그대로 — 한마디(tagline)가 makerNote.
      const purposeLabel =
        buildMode === "commerce"
          ? "구매"
          : applied["calendar"]
            ? "예약"
            : applied["coupon"] && selectedCouponId
              ? "쿠폰"
              : "정보";
      const title =
        (buildMode === "commerce" ? productName.trim() : selectedVideo?.title) || "LinkDrop";
      const imageUrl =
        (buildMode === "commerce" ? productImageUrl : selectedVideo?.thumbnailUrl) ?? "";
      const ctaTitle =
        purposeLabel === "구매"
          ? "상품 보러 가기"
          : purposeLabel === "예약" || purposeLabel === "쿠폰"
            ? "예약하고 혜택 받기"
            : "보러 가기";
      const res = await shareToKakao({
        title,
        description: [purposeLabel, tagline.trim()].filter(Boolean).join(" · "),
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

  function equip(block: StudioBlock) {
    if (block.isPaid && score < ENHANCE_UNLOCK) return;
    if (block.id === "bgcolor") {
      setShowColorPicker((v) => !v);
      setApplied((p) => ({ ...p, bgcolor: true }));
      setBurstKey((k) => k + 1);
      return;
    }
    setApplied((p) => ({ ...p, [block.id]: !p[block.id] }));
    // OFF→ON(켜짐)이면 방금 켠 블록으로 기록, ON→OFF(꺼짐)이면 해제. (applied = 토글 전 값.)
    if (!applied[block.id]) {
      setBurstKey((k) => k + 1);
      setLastEquippedId(block.id);
    } else {
      setLastEquippedId(null);
    }
  }

  // 히어로 카드 틸트는 DropCardShell 로 캡슐화 이동(interactive prop).

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

  // 3c 거울 — 미리보기 하단 블록 stub(손님 CardBody 블록 슬롯과 동형). preview=시각만(onClick 0).
  //   CardBody 가 reservation/contact 를 "예약 날짜 선택"/"정보 보기" ButtonBlock 으로 래핑(mode 무관).
  // 쿠폰 stub — 손님 benefitEventSection 쿠폰 부분 동형(heading+CouponPreview+note). 진행이벤트는 스튜디오에 없음.
  const couponBlockPreview =
    selectedCouponId && selectedCoupon ? (
      <section className="space-y-3">
        <div className="space-y-2">
          <h2
            className={`text-sm font-bold tracking-ko ${isLightCard ? "text-text-strong" : "text-white"}`}
          >
            예약하면 받는 혜택
          </h2>
          <div className="space-y-3">
            {/* Phase 2 — 마감 타이머(수신카드 1-C couponPanel 동형, relative 스트립).
                L6 예외: 미리보기 한정 클라 시계 폴백(31창 승인) — serverNow 미주입. */}
            {selectedCoupon.valid_until ? (
              <div className="relative h-7">
                <TimerBadge expiresAt={selectedCoupon.valid_until} />
              </div>
            ) : null}
            <CouponPreview coupon={{ ...selectedCoupon, title: selectedCoupon.title ?? "" }} />
            <p
              className={`text-xs font-medium tracking-ko ${isLightCard ? "text-text-muted" : "text-white/70"}`}
            >
              예약을 신청하면 쿠폰이 지갑에 담겨요.
            </p>
          </div>
        </div>
      </section>
    ) : null;
  // 연락 stub — 손님 contactRow 동형(전화/문자/길찾기). 단 div(onClick 0 = preview 시각만).
  const contactBlockPreview =
    applied["link"] && store && (store.contact_phone || store.address || store.reservation_url) ? (
      <section data-testid="secondary-contact-row" className="flex items-stretch gap-2">
        {store.contact_phone ? (
          <div className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-semibold tracking-ko text-[#0F172A]">
            <Phone className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            전화
          </div>
        ) : null}
        {store.contact_phone ? (
          <div className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-semibold tracking-ko text-[#0F172A]">
            <MessageSquare className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            문자
          </div>
        ) : null}
        {store.address ? (
          <div className="flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-semibold tracking-ko text-[#0F172A]">
            <MapPin className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            길찾기
          </div>
        ) : null}
      </section>
    ) : null;
  // 예약 stub — 정적 안내(실 캘린더 RPC X). CardBody 가 "예약 날짜 선택" ButtonBlock 으로 래핑.
  const reservationBlockPreview = applied["calendar"] ? (
    <div
      className={`rounded-xl px-3 py-4 text-center text-[13px] ${
        isLightCard
          ? "border border-[#E5E5E5] bg-[#FAFAFA] text-text-muted"
          : "border border-white/20 bg-white/5 text-white/70"
      }`}
    >
      손님이 여기서 예약 날짜를 골라요
    </div>
  ) : null;

  // STUDIO-fix2 G5 — 대표 이미지 업로드. 관례 = ProductRegisterForm 업로더 동일(리사이즈 →
  //   product-images 버킷 `${userId}/uuid.jpg`(RLS 첫 세그먼트) → publicUrl). 차이 1가지:
  //   선택 즉시 objectURL 로컬 프리뷰 → 업로드 완료 시 실URL 교체(넣은 즉시 썸네일).
  async function handleHeroImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
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
        console.error("[studio-build] hero upload failed:", upErr);
        setHeroUploadError("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setHeroImagePreview(null);
        return;
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setHeroImageUrl(pub.publicUrl);
      setHeroImagePreview(pub.publicUrl);
      // STUDIO-fix3 H2 — 링고 경유 업로드 시 블록 장착 자동 동기(업로드 성공 = 대표 이미지 채움).
      setApplied((p) => ({ ...p, image: true }));
    } catch (err) {
      console.error("[studio-build] hero unexpected:", err);
      setHeroUploadError(err instanceof Error ? err.message : "사진 처리 중 문제가 생겼어요.");
      setHeroImagePreview(null);
    } finally {
      setHeroUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  // P2 — 스튜디오 상품 등록 핸들러(ProductRegisterForm onSubmit 주입). 저장은 partner.products.new
  //   submitProduct 와 동일한 POST /api/drops(self_upload:true 등 payload 는 폼이 그대로 구성).
  //   성공 시 결과를 스튜디오 상태에 즉시 미러 → 카드 미리보기(productPreview)에 바로 붙고,
  //   생성된 상품 드롭 참조는 attachedProducts(덱 자산, 모드 전환에도 보존)에 적재.
  async function submitStudioProduct(
    payload: ProductRegisterPayload,
  ): Promise<ProductRegisterResult> {
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

    // WYSIWYG — 등록 결과를 미리보기·발행 상태로 미러(폼 입력값 = 서버 저장값).
    setProductImageUrl(payload.image_url);
    // P6-6 — 발행(드롭 A 재사용) 시 그대로 노출할 공유 URL 보관(단축 우선, long 폴백).
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
    return {
      shareUuid,
      shareUrl: json.shareable_url ?? `https://app.drop.how/d/${shareUuid}`,
    };
  }

  // 상품 본체 — P3(stash S3bc 흡수): 손님 /d purchase 경로와 동일 미러.
  //   데이터 = attachedProducts[0](덱 자산) 우선, 등록 결과 미러 상태 폴백(드롭 id 미확보 케이스).
  //   변환 = buildProductWidget(@/lib/adapters — 손님 info-drop-page :1479 와 같은 단일 소스,
  //   스튜디오 전용 복제 변환 금지) → 동일 ProductWidget. preview 라 콜백 없음(선주문 버튼 무동작).
  //   §0: 시세·비교가 금지 — 결정가 단일값만. 커머스 저장=self_upload 라 selfUpload 고정.
  //   게이트 = hasProductData: S12 목적 전환 리셋 시 placeholder 복귀(기존 노출 타이밍 보존).
  const hasProductData = !!productImageUrl || !!productName.trim() || (productPrice ?? 0) > 0;
  const firstProduct = attachedProducts[0] ?? null;
  const previewCommerce = !hasProductData
    ? null
    : firstProduct
      ? {
          name: firstProduct.name,
          priceKrw: firstProduct.priceKrw,
          imageUrl: firstProduct.imageUrl ?? "",
          buyUrl: "", // 미리보기 — 실이동 없음
          selfUpload: true,
          ...(firstProduct.headline ? { headline: firstProduct.headline } : {}),
          ...(firstProduct.sellingPoints?.length
            ? { sellingPoints: firstProduct.sellingPoints }
            : {}),
        }
      : {
          name: productName || "상품 이름",
          priceKrw: (productPrice ?? 0) > 0 ? productPrice : null,
          imageUrl: productImageUrl ?? "",
          buyUrl: "",
          selfUpload: true,
          ...(productCopy.headline ? { headline: productCopy.headline } : {}),
          ...(productCopy.sellingPoints.length ? { sellingPoints: productCopy.sellingPoints } : {}),
        };
  // 손님 local 중 어댑터가 읽는 필드(name/address)만 — store 기반. 나머지는 cast 로 생략(손님 :1480 패턴).
  const previewLocal = store?.display_name
    ? { name: store.display_name, address: store.address ?? undefined }
    : undefined;
  const productPreview = previewCommerce ? (
    <div aria-hidden="true" className="select-none">
      <ProductWidget
        {...buildProductWidget({
          commerce: previewCommerce,
          title: previewCommerce.name,
          local: previewLocal,
        } as InfoDropPageProps)}
        accent={MODE_ACCENT[buildMode]}
      />
    </div>
  ) : (
    // C6b — 커머스 상품 미장착 시 빈 카드 방지: 본체 자리(ProductWidget 교체 슬롯)에 상품 placeholder.
    //   시각 = 영상 placeholder 패턴 재사용(라이트 accent 틴트 / 다크 흰알파). aria-hidden 시각만.
    <div aria-hidden="true" className="select-none">
      <div
        className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-2xl ring-1 ${isLightCard ? "text-text-subtle" : "bg-white/10 ring-white/15 text-white/45"}`}
        // S6-2 — 카드 표면 순백: accent 배경 틴트(3%) 제거. ring 목적색 틴트만 유지(모드 구분 자산).
        style={
          isLightCard ? ({ "--tw-ring-color": `${accent}30` } as React.CSSProperties) : undefined
        }
      >
        <Tag className="h-7 w-7" strokeWidth={1.5} />
        <span className="text-[11px] font-medium">덱에서 상품 등록을 장착하세요</span>
      </div>
    </div>
  );

  return (
    <div
      // STUDIO-fix1 G1ⓐ — 발행바 가림 해소: 바 실높이(세그먼트44+멘트+버튼48+멘트+URL행 최대 ≈250px)
      //   + 하단 네비 오프셋(66px) + 여유 = 320px + 안전영역. 종전 pb-[150px]는 바 높이 미달로
      //   마지막 입력 필드가 가려졌음. 바 자체는 무변경(G1ⓒ).
      className="min-h-screen bg-[#FAFAFA] pb-[calc(320px+env(safe-area-inset-bottom))]"
      // G1ⓑ — 입력 포커스 시 발행바+모바일 키보드 이중 가림 완화: focusin 위임 1곳(React onFocus
      //   = focusin 버블). 입력류만 화면 중앙으로 보정(버튼 제외 · 개별 필드 무수정 · 애니 없음).
      // STUDIO-fix3 H4⑵ — isTyping 최상위 state 폐지(거대 트리 전체 리렌더 원인) → 발행바 숨김은
      //   KeyboardAwareBar(문서 focusin/focusout 자체 구독 · 바 wrapper 만 리렌더)로 격리.
      //   scrollIntoView 는 rAF 1회.
      onFocus={(e) => {
        const t = e.target as HTMLElement;
        if (t.matches?.("input, textarea, select")) {
          requestAnimationFrame(() => t.scrollIntoView({ block: "center" }));
        }
      }}
    >
      <style>{STUDIO_BUILD_CSS}</style>
      {/* STUDIO-fix3 H2 — 대표 이미지 파일 input 상시 렌더(아코디언 밖): 링고 코칭 줄·블록 설정
          버튼이 같은 ref 를 클릭 → 업로더 1계보(handleHeroImageChange 단일 핸들러). */}
      <input
        ref={heroFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleHeroImageChange}
        className="hidden"
      />
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#EDEDED] bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          {/* P6-9(S21) — 상단 X 제거: 주 탭 화면 표준(닫기=모달 문법). 이동은 하단 네비 상시가 담당.
              구 X 는 onClick 없는 죽은 버튼이었고, 전 진입점(탭 직결/나도 만들기 새 탭/redirect)이
              뒤로가기 불요 판정 — 교체 없이 제거. */}
          <div className="flex items-center gap-2.5">
            <div>
              <p className="text-[15px] font-bold leading-tight text-[#0A0A0A]">카드 스튜디오</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#737373]">
                  <Store className="h-3 w-3" strokeWidth={2} />
                  {store?.display_name ?? "내 매장"}
                </span>
                <span className="text-[#D4D4D4]">·</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {/* STUDIO-fix1 G3 — 노출 용어 통일: 커머스→상품판매(표시층만 · 식별자 불변). */}
                  {{ general: "퍼블릭", reserve: "예약·쿠폰", commerce: "상품판매" }[buildMode]}
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

      {/* P6-2 — 구 /studio 셸 이식: 내 캐쉬 칩(구 :196-202 마크업 재사용).
          P6-7 — AI 코치(CreatorCoachCard)는 홈으로 이동(진단=홈 소관) — 내 캐쉬만 잔류
          (캐시 사용처=스튜디오 도구, 이동 금지). 빌더 첫 화면 복귀. 빌더 본체 0터치. */}
      {myRewards != null ? (
        <div className="mx-auto max-w-md px-5 pt-4">
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F5] px-3 py-1.5">
              <span className="text-[11px] font-medium tracking-ko text-[#737373]">내 캐쉬</span>
              <span className="text-sm font-bold tracking-ko text-[#0A0A0A]">
                {Number(myRewards ?? 0).toLocaleString()}원
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {/* P — 컴팩트 미리보기 띠. 히어로 안 보일 때만. 헤더(top-0 z-40) 아래 고정(top-[56px] z-30).
          ★ fixed 오버레이 — 흐름에서 빼 레이아웃 시프트(히어로 밀림) 제거 → 깜빡임 소멸.
          바깥 pointer-events-none + 안쪽 auto = 띠 양옆 빈 영역이 아래 클릭 안 막음. 풀카드 복제 아님(썸네일 img만). */}
      {!heroVisible && (
        <div className="fixed left-0 right-0 top-[56px] z-30 flex justify-center px-5 pointer-events-none">
          <div className="w-full max-w-md pointer-events-auto">
            {/* 탭하면 히어로 풀카드로 부드럽게 스크롤. */}
            <div
              onClick={() =>
                heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-[#EDEDED] bg-white/95 p-2.5 backdrop-blur"
            >
              {/* 썸네일 — 영상 선택 시 썸네일, 아니면 메이커 cardColor 빈 박스(까만 고정 폐기). */}
              <div
                className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl"
                style={selectedVideo?.thumbnailUrl ? undefined : { backgroundColor: cardColor }}
              >
                {/* S10 — commerce 게이트(이중 방어): 커머스에선 영상 미니 썸네일 미표시 */}
                {selectedVideo?.thumbnailUrl && buildMode !== "commerce" ? (
                  <img
                    src={selectedVideo.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/70">
                    <Video className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                )}
              </div>
              {/* 코칭(lingo) + 제목 + 전환력 게이지 */}
              <div className="min-w-0 flex-1">
                {/* 링고AI 코칭 줄 — 본문 코칭 이관(lingo.text). 완성 시 체크(POINT).
                    STUDIO-fix3 H2 — 코칭이 대표 이미지(action==="image")면 줄 탭 = 같은 파일
                    input 클릭(업로더 1계보 합류) + heroImagePreview 미니 썸네일 병기. */}
                <button
                  type="button"
                  onClick={() => {
                    if (lingo.action === "image") heroFileInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-1.5 text-left"
                >
                  {lingo.done ? (
                    <CircleCheck
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: POINT }}
                      strokeWidth={2.5}
                    />
                  ) : (
                    <Lightbulb
                      className="ai-breathe h-3.5 w-3.5 shrink-0"
                      style={{ color: "#D97706" }}
                      strokeWidth={2}
                    />
                  )}
                  <span className="truncate text-[11px] text-[#525252]">
                    {lingo.short ?? lingo.text}
                  </span>
                  {heroImagePreview ? (
                    <img
                      src={heroImagePreview}
                      alt="대표 이미지"
                      className="ml-auto h-6 w-6 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                </button>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-[#0A0A0A]">
                    {store?.display_name ?? "내 매장"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-md px-5">
        {/* ───────── 커머스 3모드 토글 (퍼블릭 / 예약·쿠폰 / 커머스) ───────── */}
        <div className="mt-5 flex rounded-2xl bg-white p-1 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          {[
            { key: "general", label: "퍼블릭", Icon: Globe },
            { key: "reserve", label: "예약·쿠폰", Icon: Calendar },
            // STUDIO-fix1 G3 — 노출 용어 통일: 커머스→상품판매(표시층만 · key 불변).
            { key: "commerce", label: "상품판매", Icon: Store },
          ].map(({ key, label, Icon }) => {
            const isOn = buildMode === key;
            // P6-3(A안) — 비사업자: 사업자 모드 탭 잠금 표시(구 셸 :133-153 계열 재사용 —
            //   dimmed + Lock + "사업자 전용"). 클릭은 switchMode 가드가 등록 유도로 처리(전환 0).
            const locked = bizLocked && key !== "general";
            return (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key as "general" | "reserve" | "commerce")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all duration-200 ${isOn ? "text-white" : locked ? "text-[#A3A3A3] opacity-70" : "text-[#737373]"}`}
                style={
                  isOn
                    ? { backgroundColor: MODE_ACCENT[key as "general" | "reserve" | "commerce"] }
                    : undefined
                }
                aria-pressed={isOn}
                aria-disabled={locked || undefined}
                aria-label={locked ? `${label} — 사업자 전용` : undefined}
              >
                {locked ? (
                  <Lock className="h-4 w-4" strokeWidth={2.25} />
                ) : (
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                )}
                {label}
              </button>
            );
          })}
        </div>

        {/* ───────── 히어로: 홀로그래픽 메인 카드 (3D 틸트) ───────── */}
        <section ref={heroRef} className="pt-7" style={{ perspective: "1100px" }}>
          {/* forge-float 플로팅은 스튜디오 전용 → 셸 밖 유지. 등급 그림자·홀로 강도(stage 의존)·
              버스트(게임화)는 셸에 prop/slot 으로 주입(셸 자체는 색·게임 중립). */}
          <div className="forge-float">
            <DropCardShell
              cardColor={cardColor}
              interactive
              boxShadow={`0 22px 60px -12px rgba(15,23,42,${0.28 + stage.stars * 0.07}), 0 0 0 1px rgba(255,255,255,0.08) inset`}
              holoOpacity={0.1 + stage.stars * 0.07}
              overlay={
                <div
                  key={burstKey}
                  className="pointer-events-none absolute right-5 top-5 z-10"
                  style={{ transform: "translateZ(40px)" }}
                >
                  {burstKey > 0 && (
                    <div className="forge-burst flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
                      <Zap
                        className="h-4 w-4"
                        style={{ color: POINT }}
                        strokeWidth={2.5}
                        fill={POINT}
                      />
                    </div>
                  )}
                </div>
              }
            >
              {/* 카드 본체 = 단일 CardBody(실콘텐츠만). 손님 /d 도 4단계에서 같은 CardBody 채택. */}
              {/* 라이트 셸 — 상속 텍스트(제목 h3·ButtonBlock 라벨)를 어두운 색으로. 다크 셸이면 undefined=기존 흰 상속. */}
              <div className={isLightCard ? "text-[#0F172A]" : undefined}>
                <CardBody
                  mode="preview"
                  cardColor={cardColor}
                  light={isLightCard}
                  video={selectedVideo}
                  title={buildMode === "commerce" ? "" : (store?.display_name ?? "")}
                  tagline={tagline}
                  taglinePlaceholder="한마디를 입력하면 여기 표시돼요"
                  // C9 — 영상 유래 셀링포인트는 커머스 카드에 누수 금지(상품은 productBlock 자체 셀링).
                  sellingPoints={buildMode === "commerce" ? [] : pickedPoints}
                  coupon={null}
                  productBlock={buildMode === "commerce" ? productPreview : null}
                  // C13 S1 — 커머스 카드는 상품 전용. 쿠폰/예약/연락 블록 누수 차단
                  //   (couponBlockPreview 내부게이트가 selectedCouponId 라 예약서 선택 후 커머스 전환 시 샘).
                  couponBlock={buildMode === "commerce" ? null : couponBlockPreview}
                  reservationBlock={buildMode === "commerce" ? null : reservationBlockPreview}
                  // S13 — 형님 확정: 정보 카드에 전화·길찾기·예약 칩 없음(양면 거울). 연락 블록은 reserve 에서만.
                  contactBlock={buildMode === "reserve" ? contactBlockPreview : null}
                  purpose={
                    applied["calendar"]
                      ? "예약"
                      : applied["coupon"] && selectedCouponId
                        ? "쿠폰"
                        : "정보"
                  }
                />
              </div>

              {/* ── preview placeholder (CardBody 밖, 스튜디오 authoring 안내 — 문구·게이트 그대로) ── */}
              {/* 영상 슬롯 — 미선택 시. selectedVideo 있으면 CardBody 가 임베드.
                    커머스는 본체=ProductWidget 상품사진이라 영상 placeholder 무의미 → 게이트. */}
              {!selectedVideo && buildMode !== "commerce" && (
                <div
                  className={`mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-2xl ring-1 ${isLightCard ? "" : "bg-white/10 ring-white/15"}`}
                  // S6-2 — 카드 표면 순백: accent 배경 틴트(3%) 제거. ring 목적색 틴트만 유지.
                  style={
                    isLightCard
                      ? ({ "--tw-ring-color": `${accent}30` } as React.CSSProperties)
                      : undefined
                  }
                >
                  {applied["content"] ? (
                    // 영상 블록 장착했지만 미선택 — 아래 설정에서 검색·선택 유도(가짜 영상 표시 안 함).
                    <div
                      className={`flex flex-col items-center gap-1.5 ${isLightCard ? "text-text-subtle" : "text-white/45"}`}
                    >
                      <Video className="h-7 w-7" strokeWidth={1.5} />
                      <span className="text-[11px] font-medium">
                        아래에서 영상을 검색해 선택하세요
                      </span>
                    </div>
                  ) : applied["image"] ? (
                    // STUDIO-fix2 G5 — 대표 이미지 실렌더(종전 Play 아이콘 placeholder → 실썸네일).
                    //   업로드 전엔 업로드 유도 안내(가짜 이미지 표시 안 함).
                    heroImagePreview ? (
                      <img
                        src={heroImagePreview}
                        alt="대표 이미지 미리보기"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex flex-col items-center gap-1.5 ${isLightCard ? "text-text-subtle" : "text-white/45"}`}
                      >
                        <ImageIcon className="h-7 w-7" strokeWidth={1.5} />
                        <span className="text-[11px] font-medium">
                          아래 블록 설정에서 사진을 올려주세요
                        </span>
                      </div>
                    )
                  ) : (
                    <div
                      className={`flex flex-col items-center gap-1.5 ${isLightCard ? "text-text-subtle" : "text-white/45"}`}
                    >
                      <ImageIcon className="h-7 w-7" strokeWidth={1.5} />
                      <span className="text-[11px] font-medium">덱에서 콘텐츠를 장착하세요</span>
                    </div>
                  )}
                </div>
              )}

              {/* 한마디 placeholder — CardBody tagline 슬롯으로 이관(taglinePlaceholder).
                    제목 바로 밑(채워진 tagline 과 같은 위치)에 표시 → 거울 위치 정합. */}

              {/* 행동영역 placeholder — 쿠폰/연락/목적 미장착 안내. 커머스는 행동=ProductWidget 선주문하기 → 게이트. */}
              {buildMode !== "commerce" && (
                <div className="mt-4 space-y-2">
                  {/* 거울 1c — 예약 "예약 날짜 선택" ButtonBlock 은 CardBody reservationBlock 로 이관(3c). 여기선 미렌더. */}
                  {applied["coupon"] && !(selectedCouponId && selectedCoupon) && (
                    <div className="animate-slide-up space-y-2">
                      {coupons.length > 0 ? (
                        // 쿠폰은 있으나 미선택 — 아래 설정에서 고르도록 안내.
                        <div
                          className={`rounded-xl py-3 text-center text-[12px] ${isLightCard ? "border border-dashed text-text-muted" : "border border-dashed border-white/25 text-white/55"}`}
                          style={isLightCard ? { borderColor: `${accent}30` } : undefined}
                        >
                          아래에서 쿠폰을 선택하세요
                        </div>
                      ) : (
                        // 매장에 활성 쿠폰 없음.
                        <div
                          className={`rounded-xl py-3 text-center text-[12px] ${isLightCard ? "border border-dashed text-text-muted" : "border border-dashed border-white/25 text-white/55"}`}
                          style={isLightCard ? { borderColor: `${accent}30` } : undefined}
                        >
                          매장에 활성 쿠폰이 없어요
                        </div>
                      )}
                    </div>
                  )}
                  {applied["link"] &&
                    !(store?.contact_phone || store?.address || store?.reservation_url) && (
                      <div
                        className={`rounded-xl py-3 text-center text-[12px] animate-slide-up ${isLightCard ? "border border-dashed text-text-muted" : "border border-dashed border-white/25 text-white/55"}`}
                        style={isLightCard ? { borderColor: `${accent}30` } : undefined}
                      >
                        매장 정보를 등록하면 표시돼요
                      </div>
                    )}
                  {!applied["calendar"] && !applied["coupon"] && !applied["link"] && (
                    <div
                      className={`rounded-xl py-3 text-center text-[12px] ${isLightCard ? "border border-dashed text-text-muted" : "border border-dashed border-white/25 text-white/55"}`}
                      style={isLightCard ? { borderColor: `${accent}30` } : undefined}
                    >
                      목적 카드를 장착하면 여기에 행동 버튼이 생겨요
                    </div>
                  )}
                </div>
              )}

              {/* DOCK-Fix1 — 관련 상품(도킹) 미리보기: 수신카드 info-drop-page :1773-1833 관련
                    상품 섹션과 동형(썸네일·제목·생산자명·가격 + 목적칩은 스튜디오 참고용).
                    게이트 = 발행 payload(dockBlocks) 와 동일 조건(applied["dock"] && 다건) → L5
                    (미리보기=전송분 동일). dockedProducts 표시 전용 — attachedProducts 가드
                    (:665·:746)·발행 로직 0터치. */}
              {applied["dock"] && dockedProducts.length > 0 && (
                <div className="mt-4">
                  <h2
                    className={`text-sm font-bold tracking-ko ${isLightCard ? "text-[#0F172A]" : "text-white"}`}
                  >
                    관련 상품
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {dockedProducts.map((p) => (
                      <li
                        key={p.refDropId}
                        className="flex items-center gap-3 rounded-2xl border border-[#E8EDF3] bg-white p-3"
                      >
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="size-14 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="size-14 shrink-0 rounded-lg bg-[#F1F5F9]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold tracking-ko text-[#0F172A]">
                            {p.name}
                          </p>
                          {p.producerName ? (
                            <p className="truncate text-xs font-medium tracking-ko text-[#94A3B8]">
                              {p.producerName} 님의 카드
                            </p>
                          ) : null}
                          <p className="text-xs font-medium tracking-ko text-[#64748B]">
                            {p.priceKrw != null
                              ? `${p.priceKrw.toLocaleString("ko-KR")}원`
                              : "가격 미정"}
                          </p>
                        </div>
                        {p.purpose ? (
                          <span className="shrink-0 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#64748B]">
                            {p.purpose}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* C13 S2 — 손님 정본 순서 정합: 손님은 shareFooter 가 카드 내부(쿠폰받기 sticky 보다 위)라
                    스튜디오도 shareFooter stub 을 쿠폰받기 stub 위로 이동(내용·조건·클래스 불변, 순서만). */}
              {/* 거울 5a — 공유 푸터 stub. CardBody.shareFooter prop 에서 형제로 이동 — 시각 stub(onClick·href 없음). 클래스는 손님 푸터와 1:1. */}
              <div className="mt-6" data-testid="share-footer">
                <div data-testid="share-block" className="mt-4 flex items-center gap-2">
                  {/* S5 — 형님 확정: 푸터는 3목적+손님 4면 동일. Wand2는 스튜디오 발행 도구(크롬)이므로 손님 기능조건 미러 대상 아님 (C6c 역전). */}
                  <div
                    aria-hidden="true"
                    className="flex h-12 flex-1 items-center justify-center rounded-2xl text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
                    style={{ backgroundColor: MODE_ACCENT[buildMode] }}
                  >
                    <Wand2 className="h-[22px] w-[22px]" strokeWidth={2.25} />
                  </div>
                  <div
                    aria-hidden="true"
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset ${isLightCard ? "bg-[#F5F5F5] text-text-strong ring-[#E5E5E5]" : "bg-white/15 text-white ring-white/25"}`}
                  >
                    <Copy className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <div
                    aria-hidden="true"
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset ${isLightCard ? "bg-[#F5F5F5] text-text-strong ring-[#E5E5E5]" : "bg-white/15 text-white ring-white/25"}`}
                  >
                    <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                </div>
                <p
                  className={`mt-3 text-center text-[10px] leading-relaxed ${isLightCard ? "text-text-subtle" : "text-white/45"}`}
                >
                  본 콘텐츠는 LinkDrop 광고·제휴 안내가 적용됩니다. (FTC 권고)
                </p>
                <div
                  className={`mt-2 text-center text-[11px] underline underline-offset-2 ${isLightCard ? "text-text-subtle" : "text-white/50"}`}
                >
                  문제 신고
                </div>
              </div>

              {/* 거울 5b — 손님 sticky "쿠폰 받기"(fixed bottom-0)를 인라인 시각 stub 으로 미러.
                    div(onClick 없음 = 시각만). 게이트 = 쿠폰 단독(쿠폰 선택 + 캘린더 미장착) = 손님 !isCombined && isCoupon. */}
              {applied["coupon"] && selectedCouponId && !applied["calendar"] ? (
                <div className="mx-auto w-full max-w-[480px] px-6 pt-3">
                  <div
                    className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold text-white"
                    style={{ backgroundColor: MODE_ACCENT[buildMode] }}
                  >
                    <span className="truncate">쿠폰 받기</span>
                  </div>
                </div>
              ) : null}

              {/* 거울 5b' — 손님 인라인 "쿠폰 받기"(L1367, isCombined=예약+쿠폰 통합, 흰배경 보조버튼 cta-coupon-only)를
                    시각 stub 으로 미러. div(onClick 없음 = 시각만). 게이트 = 통합(쿠폰 선택 + 캘린더 장착) = 손님 isCombined.
                    위 sticky-미러 stub(쿠폰 단독, !applied["calendar"])과 applied["calendar"] 유무로 배타. */}
              {applied["coupon"] && selectedCouponId && applied["calendar"] ? (
                <div className="mx-auto w-full max-w-[480px] px-6 pt-3">
                  <div className="flex w-full min-h-[44px] items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold tracking-ko text-[#0A0A0A]">
                    쿠폰 받기
                  </div>
                </div>
              ) : null}
            </DropCardShell>
          </div>
        </section>

        {/* 한마디(카드 부제) — 블록 아님, 카드에 항상 딸린 텍스트. 카드 아래·아코디언 위에 항상 노출. */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] text-[#A3A3A3]">한마디</span>
            <span className="text-[11px] tabular-nums text-[#A3A3A3]">
              {tagline.length} / {TAGLINE_MAX}
            </span>
          </div>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, TAGLINE_MAX))}
            placeholder={
              buildMode === "commerce"
                ? "이 상품을 한마디로 소개해보세요"
                : buildMode === "reserve"
                  ? "예약하고 싶게 한마디 남겨보세요"
                  : "이 영상을 왜 공유하는지 한마디 남겨보세요"
            }
            className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2.5 text-[14px] outline-none focus:border-[#0A0A0A]"
          />
          {/* 셀링포인트(보조 설명) — AI가 영상에서 뽑은 키포인트. 탭해서 카드에 추가(최대 3).
              ★ 한마디(카피)는 위 직접입력 유지 — AI는 셀링포인트만. 저장은 다음 단계(미리보기까지). */}
          <div className="mt-3">
            {/* C9 — 영상 유래 요약 UI는 비커머스(general/reserve)에서만. 커머스는 하단 상품 카피 안내로 낙하(따라다님 차단). */}
            {aiLoading && buildMode !== "commerce" ? (
              <div className="flex items-center gap-1.5 text-[12px] text-[#A3A3A3]">
                <Sparkles className="h-3 w-3" strokeWidth={1.75} />
                링고AI가 영상에서 추천 문구 찾는 중…
              </div>
            ) : aiKeyPoints.length > 0 && buildMode !== "commerce" ? (
              <>
                <div className="mb-1.5 text-[11px] text-[#A3A3A3]">
                  셀링포인트 — 탭해서 카드에 추가 (최대 {MAX_POINTS})
                </div>
                <div className="flex flex-col gap-1.5">
                  {aiKeyPoints.map((kp, i) => {
                    const picked = pickedPoints.includes(kp);
                    const atMax = pickedPoints.length >= MAX_POINTS && !picked;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={atMax}
                        onClick={() =>
                          setPickedPoints((p) => (picked ? p.filter((x) => x !== kp) : [...p, kp]))
                        }
                        className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-left text-[13px] transition-shadow disabled:opacity-40"
                        style={{
                          boxShadow: picked ? "0 0 0 1.5px #0A0A0A" : "0 0 0 0.5px #E5E5E5",
                        }}
                      >
                        {picked ? (
                          <CircleCheck
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#0A0A0A]"
                            strokeWidth={2}
                          />
                        ) : (
                          <Circle
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#C4C4C4]"
                            strokeWidth={2}
                          />
                        )}
                        <span className={picked ? "font-medium text-[#0A0A0A]" : "text-[#525252]"}>
                          {kp}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : selectedVideo && buildMode !== "commerce" ? (
              // 영상은 있으나 키포인트 없음(AI 실패 등) — 한마디 직접입력 안내.
              <div className="flex items-center gap-1.5 text-[11px] text-[#A3A3A3]">
                <Sparkles className="h-3 w-3" strokeWidth={1.75} />
                막히면 링고AI가 도와드려요
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-[#A3A3A3]">
                <Sparkles className="h-3 w-3" strokeWidth={1.75} />
                {buildMode === "commerce"
                  ? "상품 사진을 등록하면 카피를 만들어요"
                  : "영상을 선택하면 추천 문구가 나와요"}
              </div>
            )}
          </div>
        </div>

        {/* 블록 설정 영역 — 장착한 블록을 인라인으로 다듬기 (S2 골격, S3에서 내부 채움) */}
        {STUDIO_BLOCKS.filter((b) => SETTING_BLOCK_IDS.includes(b.id) && applied[b.id]).length >
          0 && (
          <section className="mt-5">
            <div className="mb-2 flex items-center gap-1.5 px-0.5 text-[12px] font-medium text-[#737373]">
              <Sliders className="h-3.5 w-3.5" strokeWidth={2} />
              블록 설정 · 장착한 블록을 여기서 다듬어요
            </div>
            <div className="flex flex-col gap-2">
              {STUDIO_BLOCKS.filter((b) => SETTING_BLOCK_IDS.includes(b.id) && applied[b.id]).map(
                (block) => {
                  const Icon = block.icon;
                  const isExpanded = expandedBlockId === block.id;
                  return (
                    <div
                      key={block.id}
                      className="overflow-hidden rounded-2xl bg-white"
                      style={{
                        boxShadow: isExpanded ? "0 0 0 1.5px #0A0A0A" : "0 0 0 1px #EDEDED",
                      }}
                    >
                      {/* 헤더 — 덱 카드 아이콘박스/label/desc/power 토큰 복제 */}
                      <button
                        type="button"
                        onClick={() => toggleBlockSettings(block.id)}
                        className="flex w-full items-center gap-3 p-3.5 text-left"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0A0A0A]/[0.05] text-[#0A0A0A]">
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-bold leading-tight text-[#0A0A0A]">
                            {block.label}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-[1.4] text-[#5C5C5C]">
                            {block.desc}
                          </span>
                        </span>
                        {block.power > 0 ? (
                          <span
                            className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold tabular-nums"
                            style={{ color: POINT }}
                          >
                            <Zap className="h-3.5 w-3.5" strokeWidth={2.5} fill={POINT} />+
                            {block.power}
                          </span>
                        ) : null}
                        <ChevronDown
                          className="h-4.5 w-4.5 shrink-0 text-[#9A9A9A] transition-transform duration-200"
                          strokeWidth={2}
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                        />
                      </button>
                      {/* 펼침 영역 — coupon/calendar 실제 UI, 나머지는 placeholder(S3 예정) */}
                      {/* calendar는 embedded 래퍼 px-1 + body px-5 가 이미 좌우 여백 → 펼침 px-0(3중 패딩 해소) */}
                      {isExpanded && (
                        <div
                          className={`animate-slide-up pb-3.5 ${block.id === "calendar" ? "px-0" : "px-3.5"}`}
                        >
                          {block.id === "coupon" ? (
                            // 쿠폰 선택(인라인 라디오, 카드 CouponPreview 즉시 갱신) + 새 쿠폰 만들기(시트).
                            <div className="space-y-3">
                              {coupons.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-[11px] text-[#A3A3A3]">내 쿠폰에서 선택</p>
                                  <div className="flex flex-col gap-1.5">
                                    {coupons.map((c) => {
                                      // 체크 표시 = selectedCouponId(원본). selectedCoupon(?? coupons[0] fallback)
                                      //   을 쓰면 미선택에도 첫 쿠폰이 체크돼 보여 저장(가드=selectedCouponId)과 불일치.
                                      const isSel = selectedCouponId === c.id;
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => setSelectedCouponId(c.id)}
                                          className="flex items-center gap-2 rounded-lg bg-white p-2.5 text-left transition-shadow"
                                          style={{
                                            boxShadow: isSel
                                              ? "0 0 0 1.5px #0A0A0A"
                                              : "0 0 0 0.5px #E5E5E5",
                                          }}
                                        >
                                          {isSel ? (
                                            <CircleCheck
                                              className="h-4 w-4 shrink-0 text-[#0A0A0A]"
                                              strokeWidth={2}
                                            />
                                          ) : (
                                            <Circle
                                              className="h-4 w-4 shrink-0 text-[#C4C4C4]"
                                              strokeWidth={2}
                                            />
                                          )}
                                          <span
                                            className={`min-w-0 flex-1 truncate text-[13px] ${
                                              isSel ? "font-bold text-[#0A0A0A]" : "text-[#525252]"
                                            }`}
                                          >
                                            {c.title ?? "쿠폰"}
                                          </span>
                                          {c.discount_value != null ? (
                                            <span className="shrink-0 text-[11px] text-[#A3A3A3]">
                                              {c.discount_value}
                                              {c.discount_unit ?? ""}
                                            </span>
                                          ) : null}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-center text-[12px] text-[#A3A3A3]">
                                  아직 등록한 쿠폰이 없어요
                                </p>
                              )}
                              <div
                                className={
                                  coupons.length > 0
                                    ? "border-t border-dashed border-[#D4D4D4] pt-3"
                                    : ""
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => setCouponSheetOpen(true)}
                                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D4D4D4] py-2.5 text-[13px] font-medium text-[#525252] transition-colors hover:bg-[#FAFAFA]"
                                >
                                  <Plus className="h-4 w-4" strokeWidth={2} />새 쿠폰 만들기
                                </button>
                              </div>
                              {/* 확인 = 선택 매듭 + 아코디언 닫기(영상 패턴). selectedCouponId 있을 때만 활성. */}
                              {coupons.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedBlockId(null)}
                                  disabled={!selectedCouponId}
                                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0A0A0A] py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#171717] disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
                                >
                                  <Check className="h-4 w-4" strokeWidth={2.5} />
                                  확인
                                </button>
                              ) : null}
                            </div>
                          ) : block.id === "calendar" ? (
                            // 캘린더 인라인 — embedded(헤더 없는 body만). ClientOnly 없이 자체 mounted 가드로 #418 차단(1차).
                            <PartnerCalendarPage
                              embedded
                              partnerId={store?.id ?? ""}
                              partnerName={store?.display_name ?? null}
                            />
                          ) : block.id === "content" ? (
                            // 영상 — 미선택이면 검색 모드, 선택되면 완료 모드("정했어요"+다시 고르기).
                            //   탭하면 setSelectedVideo → 카드 슬롯 즉시 반영(WYSIWYG).
                            selectedVideo ? (
                              // 완료 모드 — 검색 리스트 접고 선택한 영상 + 다시 고르기.
                              <div className="space-y-3">
                                <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#0A0A0A]">
                                  <Check className="h-4 w-4" strokeWidth={2.5} />이 영상으로
                                  정했어요
                                </div>
                                <div className="flex items-center gap-2.5 rounded-lg bg-white p-2 [box-shadow:0_0_0_1px_#E5E5E5]">
                                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-[#F5F5F5]">
                                    {selectedVideo.thumbnailUrl ? (
                                      <img
                                        src={selectedVideo.thumbnailUrl}
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-[#A3A3A3]">
                                        <Video className="h-5 w-5" strokeWidth={1.75} />
                                      </div>
                                    )}
                                  </div>
                                  <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-tight text-[#0A0A0A]">
                                    {selectedVideo.title}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  {/* 다시 고르기 = 취소(영상 비우고 검색 복귀). AI 키포인트도 리셋. */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedVideo(null);
                                      aiVideoRef.current = null;
                                      setAiKeyPoints([]);
                                      setPickedPoints([]);
                                      setAiLoading(false);
                                    }}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white py-2.5 text-[13px] font-medium text-[#525252] [box-shadow:0_0_0_1px_#E5E5E5] transition-colors hover:bg-[#FAFAFA]"
                                  >
                                    <RefreshCw className="h-4 w-4" strokeWidth={2} />
                                    다시 고르기
                                  </button>
                                  {/* 확인 = 매듭(selectedVideo 유지, 아코디언만 닫기). 카드 반영은 이미 됨(WYSIWYG). */}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedBlockId(null)}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0A0A0A] py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#171717]"
                                  >
                                    <Check className="h-4 w-4" strokeWidth={2.5} />
                                    확인
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // 검색 모드 — 검색창 + 결과 리스트.
                              <div className="space-y-3">
                                <div className="flex gap-2">
                                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3">
                                    <Search
                                      className="h-4 w-4 shrink-0 text-[#A3A3A3]"
                                      strokeWidth={2}
                                    />
                                    <input
                                      type="search"
                                      value={videoQuery}
                                      onChange={(e) => setVideoQuery(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") void handleVideoSearch();
                                      }}
                                      placeholder="영상 검색 또는 유튜브 링크"
                                      className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:outline-none"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void handleVideoSearch()}
                                    disabled={!videoQuery.trim() || videoSearching}
                                    className="shrink-0 rounded-lg bg-[#0A0A0A] px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#171717] disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
                                  >
                                    {videoSearching ? "찾는 중…" : "확인"}
                                  </button>
                                </div>

                                {videoError ? (
                                  <p className="text-center text-[12px] text-[#B91C1C]">
                                    {videoError}
                                  </p>
                                ) : videoSearching ? (
                                  <p className="text-center text-[12px] text-[#A3A3A3]">찾는 중…</p>
                                ) : videoResults.length > 0 ? (
                                  <ul className="max-h-[280px] space-y-2 overflow-y-auto px-0.5 py-0.5">
                                    {videoResults.map((c) => (
                                      <li key={`${c.provider}|${c.source_id}`}>
                                        <button
                                          type="button"
                                          onClick={() => void handleSelectVideo(c)}
                                          className="flex w-full items-center gap-2.5 rounded-lg bg-white p-2 text-left transition-shadow [box-shadow:0_0_0_0.5px_#E5E5E5] hover:[box-shadow:0_0_0_1px_#0A0A0A]"
                                        >
                                          <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-[#F5F5F5]">
                                            {/* youtube 16:9 썸네일(mqdefault 320×180) — high(4:3) 상하 크롭 방지. */}
                                            {c.source_id ? (
                                              <img
                                                src={`https://i.ytimg.com/vi/${c.source_id}/mqdefault.jpg`}
                                                alt=""
                                                className="absolute inset-0 h-full w-full object-cover"
                                              />
                                            ) : c.thumbnail_url ? (
                                              <img
                                                src={c.thumbnail_url}
                                                alt=""
                                                className="absolute inset-0 h-full w-full object-cover"
                                              />
                                            ) : (
                                              <div className="absolute inset-0 flex items-center justify-center text-[#A3A3A3]">
                                                <Video className="h-5 w-5" strokeWidth={1.75} />
                                              </div>
                                            )}
                                          </div>
                                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="line-clamp-2 text-[13px] font-medium leading-tight text-[#0A0A0A]">
                                              {c.title ?? "영상"}
                                            </span>
                                            {c.author_name ? (
                                              <span className="truncate text-[11px] text-[#A3A3A3]">
                                                {c.author_name}
                                              </span>
                                            ) : null}
                                            {c.duration_sec ? (
                                              <span className="text-[11px] text-[#A3A3A3]">
                                                {formatDuration(c.duration_sec)}
                                              </span>
                                            ) : null}
                                          </span>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : videoSearched ? (
                                  <p className="text-center text-[12px] text-[#A3A3A3]">
                                    검색 결과가 없어요
                                  </p>
                                ) : (
                                  <p className="text-center text-[12px] text-[#A3A3A3]">
                                    영상을 검색하거나 링크를 붙여넣으세요
                                  </p>
                                )}
                              </div>
                            )
                          ) : block.id === "link" ? (
                            // 매장 연락처 표시(편집 아님 — 매장 설정 소관). 등록된 것만 리스트.
                            store?.contact_phone || store?.address || store?.reservation_url ? (
                              <ul className="space-y-2">
                                {store?.contact_phone ? (
                                  <li className="flex items-center gap-2.5 rounded-lg bg-white p-2.5 [box-shadow:0_0_0_0.5px_#E5E5E5]">
                                    <Phone
                                      className="h-4 w-4 shrink-0 text-[#0A0A0A]"
                                      strokeWidth={2}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0A0A0A]">
                                      {store.contact_phone}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-[#A3A3A3]">
                                      카드에 표시됨
                                    </span>
                                  </li>
                                ) : null}
                                {store?.address ? (
                                  <li className="flex items-center gap-2.5 rounded-lg bg-white p-2.5 [box-shadow:0_0_0_0.5px_#E5E5E5]">
                                    <MapPin
                                      className="h-4 w-4 shrink-0 text-[#0A0A0A]"
                                      strokeWidth={2}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0A0A0A]">
                                      {store.address}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-[#A3A3A3]">
                                      길찾기
                                    </span>
                                  </li>
                                ) : null}
                                {store?.reservation_url ? (
                                  <li className="flex items-center gap-2.5 rounded-lg bg-white p-2.5 [box-shadow:0_0_0_0.5px_#E5E5E5]">
                                    <ExternalLink
                                      className="h-4 w-4 shrink-0 text-[#0A0A0A]"
                                      strokeWidth={2}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0A0A0A]">
                                      {store.reservation_url}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-[#A3A3A3]">
                                      예약 링크
                                    </span>
                                  </li>
                                ) : null}
                              </ul>
                            ) : (
                              <div className="rounded-xl border border-dashed border-[#D4D4D4] bg-[#FAFAFA] px-3 py-5 text-center">
                                <p className="text-[13px] font-medium text-[#525252]">
                                  매장 등록에서 전화·주소를 입력하면 카드에 나타나요
                                </p>
                              </div>
                            )
                          ) : block.id === "dock" ? (
                            // DOCK-3 — 카드 도킹 피커 임베드(ProductRegisterForm 임베드 문법 동일).
                            //   인라인 펼침 + 자체 mounted 게이트(#418) — Radix 미사용.
                            <CardDockingPicker
                              value={dockedProducts}
                              onChange={setDockedProducts}
                              // Fix3 — 완료(확정) = 아코디언 접기(쿠폰 확인 버튼 동작 동일).
                              onDone={() => setExpandedBlockId(null)}
                            />
                          ) : block.id === "product" ? (
                            // P2(결정ⓐ) — 등록폼 공용화: ProductRegisterForm 임베드(B-2 인라인 입력 대체).
                            //   사진 업로드·KAMIS 품목/시세(§0 제작화면 전용)·홍보 문구는 폼이 내장.
                            //   제출 → submitStudioProduct 가 /api/drops 저장 + 미리보기·attachedProducts 즉시 반영.
                            //   embedded = 폼 카드 크롬·"새 상품" 헤더·완료 화면 '카드 보기'(외부 이동) 숨김.
                            <ProductRegisterForm
                              embedded
                              onSubmit={submitStudioProduct}
                              // STUDIO-fix4 T2/T3 — 사진 업로드 즉시 미러: 제출 전에도 카드
                              //   미리보기(previewCommerce)·발행 가드(hasProductImage) 충족.
                              onImageChange={(url) => setProductImageUrl(url)}
                            />
                          ) : block.id === "image" ? (
                            // STUDIO-fix2 G5 — 대표 이미지 업로더(종전 "다음 단계에서 제작" placeholder).
                            //   ProductRegisterForm 사진 업로더 문법 복제 + 즉시 프리뷰.
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => heroFileInputRef.current?.click()}
                                disabled={heroUploading}
                                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFAFA] px-4 py-8 text-sm font-semibold text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-60"
                              >
                                {heroUploading ? (
                                  <>
                                    <Loader2 className="size-5 animate-spin" strokeWidth={2} />
                                    올리는 중…
                                  </>
                                ) : (
                                  <>
                                    <ImagePlus className="size-5" strokeWidth={2} />
                                    {heroImagePreview ? "다른 사진으로 바꾸기" : "사진 선택"}
                                  </>
                                )}
                              </button>
                              {/* STUDIO-fix3 H2 — 파일 input 은 루트 상시 렌더로 이동(링고 경로와
                                  동일 ref 공유 — 업로더 1계보). 여기 버튼은 같은 ref 클릭만. */}
                              {heroImagePreview ? (
                                <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                                  <img
                                    src={heroImagePreview}
                                    alt="대표 이미지 미리보기"
                                    className="aspect-video w-full object-cover"
                                  />
                                </div>
                              ) : null}
                              {heroUploadError ? (
                                <p className="text-[11px] text-[#EF4444]">{heroUploadError}</p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-[#D4D4D4] bg-[#FAFAFA] px-3 py-5 text-center">
                              <Wrench
                                className="mx-auto h-5 w-5 text-[#A3A3A3]"
                                strokeWidth={1.75}
                              />
                              <p className="mt-1.5 text-[13px] font-medium text-[#525252]">
                                여기에 {block.label} 설정이 들어갑니다
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#A3A3A3]">
                                다음 단계에서 제작
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </section>
        )}

        {/* ───────── 전환력 게이지 ───────── */}
        <section className="mt-5 rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-[#0A0A0A]">{stage.label}</span>
              <span className="text-[11px] text-[#A3A3A3]">전환력 · {stage.tone}</span>
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
                backgroundImage: `linear-gradient(90deg, ${accent}, ${accent}CC, ${accent})`,
                backgroundSize: "200% 100%",
                animation: score > 0 ? "gauge-shine 2.4s linear infinite" : undefined,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-[#A3A3A3]">
            레버 {appliedCount}개 장착 · 강화는 {ENHANCE_UNLOCK}점부터 열려요
          </p>
        </section>
        {/* 링고AI 코칭은 상단 컴팩트 띠로 이관(중복 제거). lingo useMemo 는 띠에서 재사용. */}
      </div>

      {/* ───────── 강화 카드 덱 (스와이프 → 탭 장착) ───────── */}
      <section className="mt-6">
        <div className="mx-auto flex max-w-md items-center justify-between px-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#737373]">
            강화 카드 덱
          </p>
          <span className="text-[11px] font-medium text-[#9A9A9A]">
            밀어서 고르고 · 탭해서 장착
          </span>
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
                        ? `0 22px 48px -12px rgba(15,23,42,0.3), 0 0 0 2px ${accent}`
                        : "0 22px 48px -12px rgba(15,23,42,0.22), 0 0 0 1px #EDEDED"
                      : "0 10px 24px -10px rgba(15,23,42,0.18), 0 0 0 1px #EDEDED",
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
                      style={
                        block.isMain && !block.isPaid ? { backgroundColor: accent } : undefined
                      }
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
                      className={`flex h-[76px] w-[76px] items-center justify-center rounded-2xl transition-colors ${
                        locked
                          ? "bg-[#F5F5F5] text-[#C4C4C4]"
                          : "bg-[#0A0A0A]/[0.05] text-[#0A0A0A]"
                      }`}
                    >
                      <Icon className="h-9 w-9" strokeWidth={1.75} />
                    </div>
                  </div>

                  {/* 라벨/설명 */}
                  <div>
                    <p className="text-[16px] font-bold leading-tight text-[#0A0A0A]">
                      {block.label}
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
                      className="chip-pop absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-white"
                      style={{
                        backgroundColor: accent,
                        boxShadow: "0 4px 10px rgba(15,23,42,0.25)",
                      }}
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
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 0 1px rgba(255,255,255,0.55)",
                      transform: pressedId === block.id ? "translateY(0)" : "translateY(6px)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles
                        className="h-3.5 w-3.5"
                        style={{ color: accent }}
                        strokeWidth={2.5}
                      />
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
          {ENABLE_COLOR_PICKER && activeBlock.id === "bgcolor" && showColorPicker && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2 animate-fade-in">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCardColor(c.value)}
                  className="h-8 w-8 rounded-full ring-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    // @ts-expect-error css var
                    "--tw-ring-color": cardColor === c.value ? INK : "transparent",
                  }}
                  aria-label={c.label}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => equip(activeBlock)}
            disabled={activeLocked}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold transition-all duration-200 active:scale-[0.98] ${
              activeLocked
                ? "cursor-not-allowed bg-white text-[#C4C4C4] [box-shadow:0_0_0_1px_#EDEDED]"
                : activeApplied
                  ? "bg-white text-[#0A0A0A] [box-shadow:0_0_0_1.5px_#0A0A0A]"
                  : "text-white"
            }`}
            style={!activeLocked && !activeApplied ? { backgroundColor: INK } : undefined}
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

      {/* ───────── 카드 드롭하기 ─────────
          P6-9(S21) — 하단 네비(66px+safe, z-30) 상시 노출: 발행 바를 bottom-0 덮개에서
          네비 위 안착으로 이동(z-40 유지 — 네비와 영역 분리라 충돌 없음). safe-area 는 네비가 소화. */}
      {/* STUDIO-fix2 G4/H4⑵ — 입력 중 표시만 숨김: KeyboardAwareBar 가 자체 구독(트리 리렌더 0),
          마크업·공개토글·게시상태 완전 보존.
          STUDIO-fix4 T1 — 지터 교정(판정 ⓐ): bottom-[calc(66px+safe)] 는 모바일 주소창
          수축(비주얼 뷰포트 변동) 때 네비(bottom-0)와 다른 시점에 재배치돼 떨림. 바도 bottom-0
          앵커로 통일하고 네비 높이만큼 투명 스페이서(터치 통과)로 오프셋 — 차동 지터 소멸. */}
      <KeyboardAwareBar>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="pointer-events-auto">
            <div className="pointer-events-none h-6 bg-gradient-to-t from-[#FAFAFA] to-transparent" />
            <div className="bg-[#FAFAFA]/95 backdrop-blur-md">
              <div className="mx-auto max-w-md px-5 pb-4">
                {/* P7b (2-1) 공개/비공개 세그먼트 토글 — 자체 구현(Radix 금지), 정적 상태 전환(L7). */}
                <div className="flex gap-2" role="group" aria-label="공개 범위 선택">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    disabled={saving}
                    aria-pressed={isPublic}
                    aria-label="공개로 게시"
                    className={`h-11 flex-1 rounded-lg text-[13px] font-semibold ${
                      isPublic
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E5E5E5] bg-white text-[#525252]"
                    }`}
                  >
                    공개
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    disabled={saving}
                    aria-pressed={!isPublic}
                    aria-label="비공개로 저장"
                    className={`h-11 flex-1 rounded-lg text-[13px] font-semibold ${
                      !isPublic
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E5E5E5] bg-white text-[#525252]"
                    }`}
                  >
                    비공개
                  </button>
                </div>
                {/* P7b (2-2) 상태 안내 멘트 */}
                <p className="mt-1 text-xs text-neutral-500">
                  {isPublic
                    ? "홈·탐색·내 페이지에 게시됩니다"
                    : "내 페이지에만 저장돼요 · 링크로만 공유"}
                </p>
                {/* P7b (2-3) 게시/저장(보조) + 카톡 전송(주) — 전송 강조 flex 1:1.4 */}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void handleSaveDrop()}
                    disabled={score < 40 || saving}
                    aria-label={isPublic ? "카드 게시하기" : "카드 저장하기"}
                    className={`h-12 flex-[1] rounded-2xl text-[14px] font-bold ${
                      score >= 40
                        ? "border border-[#D4D4D4] bg-white text-[#0A0A0A]"
                        : "border border-[#EDEDED] bg-white text-[#A3A3A3]"
                    }`}
                  >
                    {saving
                      ? "저장 중…"
                      : dropped
                        ? isPublic
                          ? "게시했어요! ✓"
                          : "저장했어요! ✓"
                        : score >= 40
                          ? isPublic
                            ? "게시하기"
                            : "저장하기"
                          : "레버를 더 채워주세요"}
                  </button>
                  {/* P7b 폴리시(B1) — 게시 완료 후에만 활성(클릭 즉시 공유 = 제스처 유효, 팝업 차단 해소).
                  색 위계: 파랑=토글상태 / 검정=주액션(전송) / 아웃라인=보조(게시). */}
                  <button
                    onClick={() => void handleSendKakao()}
                    disabled={!dropped || !savedUrl || saving || sending}
                    aria-label="카카오톡으로 카드 전송"
                    className={`flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl text-[14px] font-bold ${
                      dropped && savedUrl && !saving && !sending
                        ? "bg-[#0A0A0A] text-white"
                        : "bg-[#E5E5E5] text-[#A3A3A3]"
                    }`}
                  >
                    <Send className="h-4 w-4" strokeWidth={2} />
                    {sending ? "전송 중…" : "전송"}
                  </button>
                </div>
                <p className="mt-1 text-center text-xs text-neutral-500">
                  {dropped ? "받는 사람에게 카드를 전송합니다" : "게시 후 전송할 수 있어요"}
                </p>
                {/* S2-a 저장 결과 — 단축 URL + 복사(유지) + P7b 성공 멘트. */}
                {saveError ? (
                  <p className="mt-2 text-center text-[12px] text-[#B91C1C]">{saveError}</p>
                ) : savedUrl ? (
                  <>
                    <div className="mt-2 flex items-center justify-center gap-2 text-[12px] text-[#525252]">
                      <span className="truncate font-medium text-[#0A0A0A]">{savedUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== "undefined" && navigator.clipboard) {
                            void navigator.clipboard.writeText(savedUrl);
                          }
                        }}
                        className="shrink-0 rounded-lg bg-white px-2 py-1 font-semibold text-[#525252] [box-shadow:0_0_0_1px_#E5E5E5] hover:bg-[#FAFAFA]"
                      >
                        복사
                      </button>
                    </div>
                    <p className="mt-1 text-center text-xs text-neutral-500">
                      {isPublic
                        ? "홈·탐색·내 페이지에서 볼 수 있어요"
                        : "내 페이지에서 볼 수 있어요"}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          {/* T1 — 네비(66px+safe) 오프셋 스페이서: 투명 + 터치 통과(pointer-events-none 상속). */}
          <div className="h-[calc(66px+env(safe-area-inset-bottom))]" />
        </div>
      </KeyboardAwareBar>

      {/* ───────── 새 쿠폰 만들기 바텀시트 (CouponManageView 무수정 임베드) ───────── */}
      {/* S3에서 아래 설정 영역(아코디언)으로 이전 예정 — 임시 보존 */}
      <Sheet open={couponSheetOpen} onOpenChange={setCouponSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl tracking-ko"
        >
          <SheetTitle className="mb-4 text-lg font-bold tracking-ko text-[#0A0A0A]">
            새 쿠폰 만들기
          </SheetTitle>
          <CouponManageView
            partnerId={store?.id ?? null}
            coupons={manageCoupons}
            onChanged={async () => {
              await router.invalidate();
            }}
          />
        </SheetContent>
      </Sheet>

      <Toaster richColors position="top-center" />
    </div>
  );
}

type StudioBuildStore = {
  id: string;
  display_name: string;
  verification_status: string;
  // 4-A 매장 연락처 — link 블록(전화/길찾기/네이버예약) 표시용. DB 기존 컬럼.
  contact_phone: string | null;
  address: string | null;
  reservation_url: string | null;
};
type StudioBuildCoupon = {
  id: string;
  title: string | null;
  discount_value: number | null;
  discount_unit: string | null;
  // CouponPreview 표시용 — get_active_store_coupons(v5.11)가 이미 반환(loader 직접 캐스팅으로 통과).
  //   conditions(min_amount)는 그 RPC에 없어 옵셔널(CouponPreview가 옵셔널 처리).
  coupon_type?: string | null;
  gift_item?: string | null;
  valid_until?: string | null;
  conditions?: { min_amount?: number; [k: string]: unknown } | null;
};
type StudioBuildLoaderData = {
  isBusiness: boolean;
  store: StudioBuildStore | null;
  coupons: StudioBuildCoupon[];
  // 쿠폰 만들기 시트(CouponManageView) 임베드용 — partner.coupons 와 동일 쿼리(coupons 테이블 직접).
  //   피커용 coupons(get_active_store_coupons)와 별개로 둘 다 반환.
  manageCoupons: CouponRow[];
  // P6-2 — 내 캐쉬(reward_ledger 누적, 구 /studio 셸 이식). 실패·미조회 = null(graceful).
  myRewards: number | null;
  /** ST2b-1 — 신 스튜디오(FIX-9) 도킹 가용 카드 실카운트. 구 컴포넌트는 미소비(무영향). */
  dockCount: number;
};

// ST2b-1 — 구 스튜디오 스위치백 파라미터(?legacy=1 → 구 CardStudioPage 렌더).
//   1줄 복귀 경로 — 제거 시점: ST3 안정 후(이 상수·validateSearch 분기·StudioBuildSwitch 정리).
const STUDIO_LEGACY_PARAM = "legacy";

export const Route = createFileRoute("/_user/studio-build")({
  head: () => ({ meta: [{ title: "카드 스튜디오 — LinkDrop" }] }),
  // 링고 스타터 목적 프리셋 — ?purpose=정보|쿠폰|예약|구매. 그 외/미지정 = undefined(무영향, 하위호환).
  //   초기 buildMode 만 프리셋(switchMode 미호출·CardBody 거울 무영향). 비사업자 가드는 렌더가 담당.
  validateSearch: (
    search: Record<string, unknown>,
  ): { purpose?: "정보" | "쿠폰" | "예약" | "구매"; legacy?: 1 } => {
    const p = search.purpose;
    const out: { purpose?: "정보" | "쿠폰" | "예약" | "구매"; legacy?: 1 } =
      p === "정보" || p === "쿠폰" || p === "예약" || p === "구매" ? { purpose: p } : {};
    // ST2b-1 — ?legacy=1 스위치백(구 스튜디오). 제거 시점: ST3 안정 후.
    const legacyRaw = search[STUDIO_LEGACY_PARAM];
    if (legacyRaw === "1" || legacyRaw === 1) out.legacy = 1;
    return out;
  },
  // S1 — 실데이터 로딩 길 + 비즈니스 게이트. 화면 하드코딩 치환은 다음 단계.
  //   인증은 부모 _user.tsx beforeLoad 담당 → 세션 throw 금지(graceful). 매장 없으면 등록 유도.
  loader: async (): Promise<StudioBuildLoaderData> => {
    const empty: StudioBuildLoaderData = {
      isBusiness: false,
      store: null,
      coupons: [],
      manageCoupons: [],
      myRewards: null,
      dockCount: 0,
    };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty; // 인증은 _user.tsx 담당 — 여기선 throw 안 함(graceful).

    // ST2b-1 — 도킹 가용 카드 실카운트(신 스튜디오 FIX-9 소비 — studio-lab loader 동일 쿼리).
    //   가짜 숫자 금지 — 실패 시 0. 구 컴포넌트는 미소비(무영향).
    let dockCount = 0;
    try {
      const { count } = await supabase
        .from("info_drops")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .eq("is_public", true);
      dockCount = count ?? 0;
    } catch {
      // graceful — 0 유지.
    }

    // 비즈니스 여부 (create-wizard.tsx:77 패턴).
    const { data: isBusinessRaw } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });
    const isBusiness = Boolean(isBusinessRaw);

    // 내 매장 (partner.register.tsx:57-61 패턴) — display_name 은 다음 단계 표시용.
    // ST2b-1 — facilities 동봉(신 스튜디오 FIX-10 시설 태그 재로드 — studio-lab select 동일).
    //   types.ts 미반영 컬럼이라 select 는 as never + 결과 캐스트(studio-lab 정본 패턴).
    //   구 컴포넌트는 초과 필드 무해.
    const { data: storeRaw } = await supabase
      .from("partners")
      .select(
        "id, display_name, verification_status, contact_phone, address, reservation_url, facilities" as never,
      )
      .eq("owner_user_id", userId)
      .maybeSingle();
    const store = (storeRaw as unknown as StudioBuildStore | null) ?? null;

    // P6-3(형님 확정 A안) — 전면 redirect 차단 → "잠금 열람"으로 완화: 비사업자(또는 매장
    //   미보유)도 진입 허용. 사업자 모드 잠금은 컴포넌트 게이트(switchMode·탭 Lock)가,
    //   저장측은 create_drop_v2 비사업자 purpose 게이트(v7.4)가 이중 방어. 매장 데이터
    //   (쿠폰·manageCoupons)는 사업자+매장 보유일 때만 조회(아래 기존 경로 그대로).
    if (!isBusiness || !store) {
      // 내 캐쉬만 조회(P6-2 본체 블록은 사업자 경로에 0터치 보존 — 이 분기 전용 사본).
      let lockedRewards: number | null = null;
      try {
        const rpc = supabase.rpc as unknown as (
          fn: string,
        ) => Promise<{ data: unknown; error: unknown }>;
        const { data: rewardsRaw, error: rewardsErr } = await rpc("get_my_rewards");
        if (!rewardsErr) lockedRewards = Number(rewardsRaw) || 0;
      } catch {
        // graceful — null 유지
      }
      return { ...empty, isBusiness, myRewards: lockedRewards, dockCount };
    }

    // 활성 쿠폰 (create-drop-wizard.tsx:401 패턴). get_active_store_coupons 는 types.ts 미반영.
    //   ⚠️ supabase.rpc 를 변수로 떼면 this 분실('rest' 에러) → 메서드 직접 호출하고 캐스트는
    //   인자(as never)·결과에만 적용 (PreorderSheet.tsx:80-81 정본 패턴). 실패 시 빈 배열.
    let coupons: StudioBuildCoupon[] = [];
    try {
      const { data: rowsRaw, error: rowsErr } = (await supabase.rpc(
        "get_active_store_coupons" as never,
        { p_partner_id: store.id } as never,
      )) as { data: unknown; error: unknown };
      if (!rowsErr && Array.isArray(rowsRaw)) {
        coupons = rowsRaw as StudioBuildCoupon[];
      }
    } catch (e) {
      // 무증상 실패 재발 방지 — 콘솔에 단서 남김(이전엔 빈 catch라 'rest' 에러가 묻혔음).
      console.error("[studio-build] coupon load failed", e);
    }

    // 쿠폰 만들기 시트용 — partner.coupons CouponsPage 와 동일 쿼리(coupons 테이블 직접, partner_id 필터, created_at desc).
    //   CouponManageView 는 이 목록(전체 쿠폰: 활성/비활성 포함)을 그대로 받아 렌더한다.
    let manageCoupons: CouponRow[] = [];
    try {
      const { data: rows, error: rowsErr } = await supabase
        .from("coupons")
        .select(
          "id, title, coupon_type, discount_value, discount_unit, conditions, valid_until, total_count, is_active, created_at, gift_item",
        )
        .eq("partner_id", store.id)
        .order("created_at", { ascending: false });
      if (!rowsErr && Array.isArray(rows)) {
        manageCoupons = rows as CouponRow[];
      }
    } catch (e) {
      console.error("[studio-build] manage coupons load failed", e);
    }

    // P6-2 — 내 캐쉬(구 /studio loader :44-54 이식). get_my_rewards 는 types.ts 미반영이라
    //   untyped rpc 우회(TEMP — 타입 재생성 후 제거). 실패 시 null(throw 금지, graceful 유지).
    let myRewards: number | null = null;
    try {
      const rpc = supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: unknown; error: unknown }>;
      const { data: rewardsRaw, error: rewardsErr } = await rpc("get_my_rewards");
      if (!rewardsErr) myRewards = Number(rewardsRaw) || 0;
    } catch {
      // 조회 실패 — 헤더는 표기 생략 대신 0원 렌더 방지 위해 null 유지.
    }

    return { isBusiness, store, coupons, manageCoupons, myRewards, dockCount };
  },
  component: StudioBuildSwitch,
});

// ST2b-1 — 정식 교체 스위치: 기본 = 신 스튜디오(CardStudioPage45) / ?legacy=1 = 구(보존).
//   진입 계약 무변경: ?purpose 딥링크·/studio 리다이렉트·비사업자 잠금 열람(loader 게이트)
//   전부 신이 동일 수용(타입 호환: StudioBuildStore ⊂ StudioLabStore[facilities 옵셔널] ·
//   StudioBuildCoupon ≡ StudioLabCoupon). 제거 시점: ST3 안정 후(구 렌더 경로 정리).
function StudioBuildSwitch() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  if (search.legacy === 1) return <CardStudioPage />;
  return (
    <CardStudioPage45
      isBusiness={data.isBusiness}
      store={data.store as StudioLabStore | null}
      coupons={data.coupons as StudioLabCoupon[]}
      manageCoupons={data.manageCoupons}
      dockCount={data.dockCount}
      initialPurpose={search.purpose}
    />
  );
}
