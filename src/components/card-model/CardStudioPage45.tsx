import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  GripVertical,
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
  Mic,
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
  Square,
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
  COURIERS45,
  type ProductFormProgress45,
  type ProductRegisterPayload45,
  type ProductRegisterResult45,
} from "./ProductRegisterForm45";
import { CardDockingPicker, type DockedProduct } from "@/components/studio/CardDockingPicker";
// ST2b-0 — 쿠폰 만들기 이식(구 studio-build 임베드 방식 그대로 · View 내부 무수정).
//   구는 Radix Sheet 래핑 → 여기선 인라인 펼침으로 래핑만 교체(Radix 금지 락).
import { CouponManageView, type CouponRow } from "@/routes/_partner/partner.coupons";
import type { DiscoverCandidate } from "@/components/explore/DiscoverSection";
import type { AttachedProduct } from "@/components/create/types";
import { getSupabase } from "@/lib/supabase";
import { resizeToJpegBlob } from "@/lib/image-upload";
import { shareToKakao } from "@/lib/kakao";
import { CardModelBody } from "./CardModelBody";
import {
  useLingoChat,
  useLingoVoice,
  type LingoContext,
  type LingoStudioAction,
} from "./useLingoChat";
import { CARD_MODEL_ACCENTS, fromStudioState, buildShippingView } from "./card-model-adapters";
// FIX-42 — 발행 게이트 발화 정본 + 결정 로직(순수 — stage·1상태1발화 dedupe 실측 가능).
import { decideGateUtterance } from "./gate-notes45";
// FIX-48+50 — 번호 인터뷰 좌표계 단일 정본(순서·번호·라벨·앵커 · done 매핑만).
import {
  getInterviewJourney,
  computeInterviewStates,
  blockBadge,
  resolveInterviewDone,
  interviewSetFieldKey,
  interviewSlotAnchor,
  type InterviewMode,
  type SalesMethod,
  type InterviewSignals,
} from "./interview-steps45";
// FIX-43/48+50 P1.5 — 링고 음성 마이크(56px 파형 orb 표준). 캡슐·패널 마이크 A안 재사용.
// B-lite(작업9) — 공용 소리 스위치 부품 장착(마이크 슬라이드 레일 + 스피커 헤더 토글). 홈과 동일.
import { SlideToMic } from "@/components/lingo/SlideToMic";
import { SpeakerToggle } from "@/components/lingo/SpeakerToggle";
// FIX-47 — 인앱 WebView 음성 정직 게이트(pwa-install 공용 판정 재사용 — 중복 정의 0).
import { getInAppBrowser, type InAppBrowser } from "@/lib/pwa-install";
import { VoiceWavePanel45 } from "@/components/lingo/VoiceWavePanel45";
// FIX-39/40 — 판매 부스터·공동구매(전부 실값·0=미렌더). 순수 모듈(ST2b /d 공용).
import { buildBoosterChips, buildGroupBuyView, stockUnitLabelFrom } from "./booster45";
// FIX-44 — 영상 서치 도우미 순수 모듈(URL 파싱·후보 번역·41창 확정 문구 원문).
import {
  FINDER_EMPTY_MSG,
  FINDER_FAIL_MSG,
  mapYoutubeSearchCandidates,
  parseYouTubeId,
  type YoutubeSearchItem,
} from "./video-finder45";
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
// LINGO-V2 — 확인어 정본 상수(정확 일치·클라 판정 — LLM 재해석 금지). trim 후 일치만 적용.
const LINGO_CONFIRM_WORDS = new Set(["확인", "응", "좋아", "해줘", "네", "그래"]);
// FIX-48(41창 ② 회신) — 판정 = trim + 끝 구두점 strip 후 정확 일치(LLM 재해석 금지 유지).
const normalizeConfirmWord = (t: string) => t.trim().replace(/[.,!?~…。、！？]+$/u, "").trim();
// LINGO-V2 — 모드 라벨(액션 요약 표기용 — 탭 라벨과 동일 어휘).
const LINGO_MODE_LABELS: Record<string, string> = {
  general: "퍼블릭",
  reserve: "예약·쿠폰",
  commerce: "상품판매",
};
// P3 커밋2 — 0단계 목적 3종 정본 라벨(발화·칩 표기). 631af55 유지: 공동구매는 4번째 목적이 아니라
//   commerce(상품 판매) 안의 판매방식 — 여기 매핑도 commerce 로 흡수(모드 전환 오해 차단).
const PURPOSE_SPEAK_LABEL: Record<BuildMode, string> = {
  general: "정보 알리기",
  reserve: "예약·쿠폰",
  commerce: "상품 판매",
};
// 발화 답 → 목적 매핑(정본만, LLM 재해석 0). 키워드 우선 → 번호 지목 폴백 → 애매('몰라' 등).
const PURPOSE_NUM: Record<"1" | "2" | "3", BuildMode> = { "1": "general", "2": "reserve", "3": "commerce" };
const PURPOSE_NUM_WORDS: Record<string, BuildMode> = {
  "1": "general", "1번": "general", 일: "general", 일번: "general", 하나: "general", 첫번째: "general", 첫째: "general",
  "2": "reserve", "2번": "reserve", 이: "reserve", 이번: "reserve", 둘: "reserve", 두번째: "reserve", 둘째: "reserve",
  "3": "commerce", "3번": "commerce", 삼: "commerce", 삼번: "commerce", 셋: "commerce", 세번째: "commerce", 셋째: "commerce",
};
function mapSpokenPurpose(raw: string): BuildMode | "ambiguous" {
  const t = raw.replace(/\s+/g, "").replace(/[.,!?~…。、！？]+$/u, "");
  // 631af55 — 공동구매/공구 = commerce 판매방식(모드 아님). 판매 계열 최우선.
  if (/(판매|팔|상품|커머스|쇼핑|주문|공동구매|공구|마켓|장사)/.test(t)) return "commerce";
  if (/(예약|쿠폰|할인|방문|부킹|손님)/.test(t)) return "reserve";
  if (/(정보|알리|소개|홍보|일반|링크|영상|공유|그냥)/.test(t)) return "general";
  if (PURPOSE_NUM_WORDS[t]) return PURPOSE_NUM_WORDS[t];
  const digit = t.match(/^([123])번?$/);
  if (digit) return PURPOSE_NUM[digit[1] as "1" | "2" | "3"];
  return "ambiguous";
}
// LINGO-V2b C2 — setField 값 상한. READ 판정: title(cfgTitle)·한마디(cfgSubtitle) 입력칸과
//   저장측(curator_message) 모두 명시 상한 부재 → 스펙 지시 100자 채택(둘 동일 준용).
const LINGO_FIELD_MAX = 100;
// LINGO-V2 — setField 표기 라벨(클라 실행 가능 필드 = title/subtitle 만 — 그 외는 정직 안내).
const LINGO_FIELD_LABELS: Record<string, string> = {
  title: "제목",
  subtitle: "한마디",
  clip: "핵심구간",
  date: "날짜",
  time: "시간",
  coupon: "쿠폰",
  productName: "상품명",
  productPrice: "가격",
  // FIX-48+50 P2 — 인터뷰 setField 확장(승인 6종).
  origin: "원산지",
  stockQty: "수량",
  gbTargetCount: "공동구매 목표인원",
  gbTargetPrice: "공동구매 달성가",
  dock: "도킹",
  phone: "전화",
  map: "지도",
};
// FIX-48+50 P2 — 상품 폼(ProductRegisterForm45) 내부 필드로 부착되는 setField 키(스튜디오 직접
//   소유가 아님 → fieldPatch 브리지로 폼에 전달·폼이 최종 검증·부착). title/subtitle 은 스튜디오 직접.
const LINGO_PRODUCT_FIELDS = new Set([
  "productName",
  "productPrice",
  "origin",
  "stockQty",
  "gbTargetCount",
  "gbTargetPrice",
]);
// FIX-28 — 카드 배경색 UI 스위치(재도입 스위치 1개). false = 덱 카드·팔레트 숨김 +
//   cardColor 기본값 고정 + 게시 시 색 저장 스킵. set_drop_card_color RPC·cardColor
//   상태·팔레트 코드는 삭제 금지(보존) — true 로 되돌리면 그대로 재활성.
const ENABLE_CARD_COLORS = false;

// FIX-29 — 전략 코칭 사전(정본 카피 — Duke 승인, 임의 창작·과장 금지). 진실 경계:
//   성과 수치("전환율 N%" 류) 금지 — {N} 치환은 실제 보유 숫자만(coupon = 게이지 상승폭
//   블록 power / dock = 도킹 실카운트). 톤 = 60대 친화 존댓말.
const COACH_NOTES: Record<string, { why: string; effect: string }> = {
  tagline: {
    why: "사장님 목소리 한 줄이 있으면 광고가 아니라 지인의 추천이 돼요",
    effect: "받은 분이 끝까지 읽을 이유가 생겨요",
  },
  coupon: {
    why: "혜택이 보이면 '나중에'가 '지금'이 돼요",
    effect: "+{N}점 · 받은 분 지갑에 저장돼 다시 찾아올 고리가 생겨요",
  },
  calendar: {
    why: "빈자리가 보여야 예약이 시작돼요 — 전화로 묻기 전에 결정하게 돼요",
    effect: "문의 단계를 건너뛰어요",
  },
  store: {
    why: "손님은 시설을 보고 비교해요 — 화장실·주차가 결정 요소예요",
    effect: "비교에서 빠지지 않게 돼요",
  },
  product: {
    why: "사진과 가격은 신뢰의 최소 단위예요",
    effect: "안 보이면 그냥 지나쳐요",
  },
  shipBasis: {
    why: "언제 받는지 알려주면 기다림이 이해가 돼요",
    effect: "문의와 오해가 줄어요",
  },
  // S4-5 — 배송 스텝(비필수 · 입력은 상품 등록 폼에서 직접).
  ship: {
    why: "어떻게 받는지 보이면 주문 전 망설임이 줄어요 — 배송비는 특히 결제 직전 이탈 사유예요",
    effect: "배송 문의가 줄고 주문 결심이 빨라져요",
  },
  dock: {
    why: "카드를 함께 보내면 받는 분은 볼거리가 늘어요",
    effect: "드로피를 더 받을 수 있어요 · 지금 {N}장 연결 가능",
  },
  content: {
    why: "영상에서 출발한 카드가 더 오래 읽혀요",
    effect: "구매 결심에 필요한 시간이 생겨요",
  },
  keymoment: {
    why: "바쁜 분은 핵심만 봐요",
    effect: "긴 영상도 20초 안에 전달돼요",
  },
};

// FIX-42 — 발행 게이트 발화 정본·결정 로직은 gate-notes45.ts(순수 모듈 — 실측 가능)로 분리.

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
// 배송 택배사 선택지 — S4-5: 단일 소스를 ProductRegisterForm45(COURIERS45)로 이동, 여기선 별칭만.
const COURIERS = COURIERS45;
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
  // S4-5c — 커머스 덱 죽은 토글 제거: "link"(매장정보 — S4-4a 로 미리보기 억제 = 죽은 스위치) ·
  //   "delivery"(배송추적 카드 — 백엔드 부재, S4b 전 죽은 카드). 카드 정의는 보존(부활 대비).
  commerce: ["product", "productimage", "aivideo", "seasonal", "review", "coupon", "brand", "dock", "bgcolor", "top", "boost", "marketing"],
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
// FIX-27 — "42" / "m:ss" / "h:mm:ss" 시각 문자열 → 초. 형식 오류 = null.
function parseClock(v: string): number | null {
  const t = v.trim();
  if (!t || !/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
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
/* 작업12 — 링고 busy LED 러닝라이트(.sl-led-ring* · sl-led-rotate keyframe) 완전 제거
   (Duke 지시: AI 카드 주변 도는 램프 삭제). busy 표시는 캡슐 스피너·헤더 텍스트가 대체. */
/* FIX-20 — 카드 방향등 래퍼 패딩 방식(FIX-19 음수 z 폐기 — 카드 불투명 배경·풀사이즈
   자식(아크릴 패널 inset-0)에 가려질 수 있어 실기기 신뢰 불가):
   wrapper(-m 2px + p 2px, rounded 26px, overflow hidden)의 패딩 2px 가 곧 링 띠.
   회전 레이어(span)는 카드보다 앞 형제 — 카드 본체(positioned·불투명 bg)가 중앙을 덮어
   패딩 띠만 노출. 덮개·마스크·음수 z 불요, 카드 콘텐츠 무접촉.
   래퍼는 상시 유지 + 레이어만 조건 렌더 — 점등/소등 간 카드 크기 불변(레이아웃 점프 0).
   FIX-22 — 래퍼 overflow:hidden 폐지(카드 모서리 밖 체크 배지가 잘림): 클리핑은 링 전용
   레이어(.sl-led-clip, inset 0 + rounded 26px + overflow hidden)가 담당 — conic 은 그 안에서만
   회전하고 카드 본체·배지는 클리핑 밖(뒤 형제, 위 페인트)이라 무접촉. */
.sl-led-wrap { position: relative; isolation: isolate; margin: -2px; padding: 2px; border-radius: 26px; }
/* FIX-48+50 조정A — 덱 카드 노란 회전 글로우(.sl-led-clip / .sl-led-wrap-spin) 제거.
   .sl-led-wrap 래퍼(margin -2px/padding 2px)는 레이아웃 자리만 — 회전 레이어 없어 램프 없음. */
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

// FIX-32 — ±스텝 버튼(길게 누르면 반복 — 60대 친화 미세조정). onStep 은 함수형 setState 를
//   쓰는 핸들러만 연결할 것(setInterval 의 stale closure 안전).
function HoldButton({ label, onStep }: { label: string; onStep: () => void }) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };
  return (
    <button
      type="button"
      onPointerDown={() => {
        onStep();
        stop();
        timer.current = setInterval(onStep, 220);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="flex h-11 min-w-11 shrink-0 touch-none select-none items-center justify-center rounded-lg bg-white px-2 text-[12px] font-bold text-[#0A0A0A] [box-shadow:inset_0_0_0_1px_#E5E5E5] active:translate-y-px"
    >
      {label}
    </button>
  );
}

// FIX-32 — 핵심구간 범위 슬라이더(외부 라이브러리 금지 — 포인터 핸들러 직접 구현).
//   탭/드래그 시 가까운 핸들이 잡히고, 드래그는 부드럽게(1초 단위) · 놓을 때 5초 스냅.
//   트랙 높이 44px(터치영역), 최소 간격 5초 클램프(끝≤시작 불가), 선택 구간 accent 하이라이트.
function ClipRangeSlider({
  durSec,
  startSec,
  endSec,
  accent,
  onChange,
}: {
  durSec: number;
  startSec: number;
  endSec: number;
  accent: string;
  onChange: (start: number, end: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"start" | "end" | null>(null);
  const pctOf = (sec: number) => (durSec > 0 ? (Math.min(sec, durSec) / durSec) * 100 : 0);
  const secAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * durSec;
  };
  const move = (rawSec: number, snap: boolean) => {
    const sec = snap ? Math.round(rawSec / 5) * 5 : Math.round(rawSec);
    if (dragRef.current === "start") {
      onChange(Math.min(Math.max(0, sec), Math.max(0, endSec - 5)), endSec);
    } else {
      onChange(startSec, Math.max(Math.min(durSec, sec), Math.min(durSec, startSec + 5)));
    }
  };
  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        const sec = secAt(e.clientX);
        dragRef.current = Math.abs(sec - startSec) <= Math.abs(sec - endSec) ? "start" : "end";
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        move(sec, false);
      }}
      onPointerMove={(e) => {
        if (dragRef.current) move(secAt(e.clientX), false);
      }}
      onPointerUp={(e) => {
        if (!dragRef.current) return;
        move(secAt(e.clientX), true); // 놓을 때 5초 스냅.
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      className="relative h-11 touch-none cursor-pointer select-none"
      aria-hidden="true"
    >
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#E0E0E0]" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{
          left: `${pctOf(startSec)}%`,
          width: `${Math.max(0, pctOf(endSec) - pctOf(startSec))}%`,
          backgroundColor: accent,
        }}
      />
      {[startSec, endSec].map((sec, i) => (
        <span
          key={i}
          className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: `${pctOf(sec)}%` }}
        >
          <span
            className="h-5 w-5 rounded-full bg-white"
            style={{ boxShadow: `0 1px 4px rgba(15,23,42,0.25), 0 0 0 2px ${accent}` }}
          />
        </span>
      ))}
    </div>
  );
}

export function CardStudioPage45({
  isBusiness,
  store,
  coupons,
  manageCoupons = [],
  dockCount = 0,
  initialPurpose,
}: {
  isBusiness: boolean;
  store: StudioLabStore | null;
  coupons: StudioLabCoupon[];
  /** ST2b-0 — 쿠폰 만들기 시트용 전체 쿠폰(활성/비활성 · partner.coupons 동일 쿼리).
   *  미주입 = 만들기 폼만(목록 빈 배열) — CouponManageView 계약 그대로. */
  manageCoupons?: CouponRow[];
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
  // P3 커밋2 — 목적 확정 여부(연속 대화 0단계 게이트). ?purpose 진입 = 확정. 탭 전환(doSwitchMode)·
  //   0단계 음성/칩 선택 시 확정. 미확정으로 마이크 ON = AI 가 먼저 '무엇을 만들지' 묻는다.
  const purposeConfirmedRef = useRef(initialPurpose != null);
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

  // ST2b-0 — 쿠폰 만들기 인라인 펼침(구 Radix Sheet 대체 — 래핑만 교체, View 내부 무수정).
  //   생성 완료(onChanged) = router.invalidate → loader 재실행 → coupons/manageCoupons 갱신
  //   → 새 쿠폰 즉시 연결 가능(예약 모드 쿠폰 필수 게이트 데드락 해소).
  const [couponMakeOpen, setCouponMakeOpen] = useState(false);
  // 쿠폰 — 실 loader 쿠폰 목록에서 선택. ST2b 스위치 시 원본 제거(studio-build selectedCouponId 동형).
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId) ?? null;

  // 도킹 — 실 CardDockingPicker (studio-build DOCK-3 동형).
  const [dockedProducts, setDockedProducts] = useState<DockedProduct[]>([]);
  // FIX-33 — 도킹 정식 단계(비필수)의 [건너뛰기] 확정. 건너뛴 뒤 수동 연결해도 done 유지.
  const [dockSkipped, setDockSkipped] = useState(false);

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
  // FIX-27 — 핵심구간 표준 선택확정(FIX-1/4 동형): 초안 → [적용] → 확정 스냅샷.
  //   cfgClip 은 확정 라벨 미러(미리보기 model.clip 기존 경로 재사용)로만 세팅.
  // FIX-32 — 초안 입력을 초 단위 숫자(슬라이더/±버튼)로 교체 — 타이핑 0. 시작·끝을 한
  //   객체로 묶은 이유: HoldButton 반복(setInterval)에서 함수형 갱신으로 상호 클램프
  //   (끝-5초 ≤ 시작 불가)를 stale 없이 보장.
  const [clipSel, setClipSel] = useState({ start: 0, end: 30 });
  const [clipDraftNote, setClipDraftNote] = useState("");
  const [clipError, setClipError] = useState<string | null>(null);
  const [confirmedClip, setConfirmedClip] = useState<{
    startSec: number;
    endSec: number | null;
    note: string;
    label: string;
  } | null>(null);
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
  // FIX-28 — 매장·시설 실확정 스냅샷(저장 성공 값 기준 — 편집 중 값과 분리).
  //   초기값 = loader partners 실값(이미 저장돼 있으면 필수 충족으로 인정).
  const [savedStoreInfo, setSavedStoreInfo] = useState(() => ({
    hasAddress: !!store?.address?.trim(),
    facilities: Array.isArray(store?.facilities)
      ? (store!.facilities as unknown[]).filter((f) => typeof f === "string" && f.trim().length > 0).length
      : 0,
  }));
  // FIX-28 — 상품 발송기준 실확정: 등록 폼에서 수확·발송일(harvest_date/ship_date)이 담겨
  //   저장됐는지(FIX-24 기간 포함). 판매 캘린더(seasonal)와 둘 중 1 = 발송기준 충족.
  const [productShipDateSet, setProductShipDateSet] = useState(false);
  // FIX-38 B — 영상 출처 [AI로 만들기] 정직 게이트 인라인 펼침(가격·캐시 숫자 미표기).
  const [aiVideoGateOpen, setAiVideoGateOpen] = useState(false);
  // FIX-43 — 듣는 중 파형 패널(스트립 뷰에서 캡슐이 펼쳐짐) + 실시간 인식 텍스트(interim).
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState("");
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
  // FIX-44 — 영상 서치 도우미(B안): 검색·선택만. 결과는 기존 videoResults 후보 체인에 주입 —
  //   [이 영상으로 확정] 전까지 덱·카드 무변경(자동 장착 절대 금지). YouTube 한정 락.
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderQuery, setFinderQuery] = useState("");
  const [finderLoading, setFinderLoading] = useState(false);
  const [finderNotice, setFinderNotice] = useState<string | null>(null);
  const [couponCandidate, setCouponCandidate] = useState<string | null>(null);
  const [colorCandidate, setColorCandidate] = useState<string | null>(null);
  // 적용 후 접힘(적용됨 · 변경) 패널 — coupon/calendar/seasonal/dock.
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});
  // FIX-48+50 P1.5 커밋3 — 집중모드 2층: 비필수 강화 지표(전환력 점수·레버 스트립)를 "✨ 카드 더
  //   강하게" 접힘 섹션 1개로. 기본 접힘, 인라인 펼침(Radix 금지). 점수·레버 로직 무변경 — 표시만.
  const [focusMoreOpen, setFocusMoreOpen] = useState(false);
  // FIX-48+50 P1.5 커밋1d — 코치 부가설명(왜 좋냐면/효과)은 "왜요?" 탭 시 인라인 펼침(기본 접힘).
  const [coachWhyOpen, setCoachWhyOpen] = useState(false);
  // FIX-16 — 링고 표면 통합(하단 스트립 폐지 · 단일 플로팅 캡슐): 상태 리터럴은 승계하되 의미 재정의
  //   "strip" = 캡슐(드래그 플로팅, 기본) / "panel" = 캡슐 자리 기준 확장 패널 / "closed" = 최소 아바타 점.
  //   완전 소멸 없음 — X 는 점까지만, 점 탭 = 캡슐 복귀. FIX-3 계약(자동 사라짐 없음·실상태 결합) 유지.
  // FIX-48+50 P1.5 — 링고 단일 박스 2상태: strip(접힘 캡슐) ↔ panel(펼침). closed(점) 폐지.
  const [lingoView, setLingoView] = useState<"strip" | "panel">("strip");
  // T5 — 링고 대화 실배선(41창 백엔드 계약): SSE 채팅 + 음성 반이중 v1.
  const chat = useLingoChat();
  const voice = useLingoVoice();
  // FIX-47 — 인앱 WebView(카톡 등) 음성 정직 게이트: 마이크 진입점 미렌더(가짜 버튼·권한
  //   루프 원천 차단) + 안내 1줄. 마운트 후 판정(SSR=null — hydration 안전). 텍스트 대화
  //   무접촉. 일반 브라우저 권한 거부는 기존 폴백(useLingoVoice notice)과 별개 게이트.
  const [inAppNoMic, setInAppNoMic] = useState<InAppBrowser | null>(null);
  useEffect(() => {
    setInAppNoMic(getInAppBrowser());
  }, []);
  const [chatInput, setChatInput] = useState("");
  // 입력 채널 — 마이크 결과로 채워지면 "voice", 손으로 고치기 시작하면 "text"로 복귀.
  const chatChannelRef = useRef<"text" | "voice">("text");
  const chatListRef = useRef<HTMLDivElement>(null);
  const [stripFlash, setStripFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX-6 — 발행 후 카톡 전송 진행 상태(studio-build sending 동형).
  const [sending, setSending] = useState(false);
  // FIX-14 — 상품 폼(45) 내부 비동기(등록/사진/AI카피)를 스트립 busy 에 결합(원인① 수정).
  const [formBusy, setFormBusy] = useState<string | null>(null);
  // FIX-34 — 폼 진행 신호(이름 확정·가격·사진) → 링고 마이크로 안내. 동일 값이면 참조
  //   유지(무한 리렌더 방지 — 폼이 onChange 마다 방출).
  const [formProgress, setFormProgress] = useState<ProductFormProgress45>({
    nameSet: false,
    priceSet: false,
    photoSet: false,
    name: "",
  });
  const handleFormProgress = (p: ProductFormProgress45) =>
    setFormProgress((prev) =>
      prev.nameSet === p.nameSet &&
      prev.priceSet === p.priceSet &&
      prev.photoSet === p.photoSet &&
      prev.name === p.name &&
      // FIX-48+50 — 번호 인터뷰 신호도 등가 비교(누락 시 원산지·공동구매 변경이 스텝퍼에 안 옴).
      prev.salesMethod === p.salesMethod &&
      prev.originSet === p.originSet &&
      prev.gbTargetSet === p.gbTargetSet &&
      prev.gbPriceSet === p.gbPriceSet &&
      prev.gbDeadlineSet === p.gbDeadlineSet &&
      // S4-5·S4-6 — 배송 신호도 등가 비교(누락 시 배송 입력이 스텝퍼·미리보기 셀에 안 옴).
      prev.shipMethodSet === p.shipMethodSet &&
      prev.shipMethod === p.shipMethod &&
      prev.freeShip === p.freeShip &&
      prev.shipFeeKrw === p.shipFeeKrw &&
      prev.shipNote === p.shipNote &&
      prev.harvestDate === p.harvestDate
        ? prev
        : p,
    );
  // FIX-15 — 상품 구성 메타(unit_label) → 미리보기 칩(미주입=미렌더).
  // FIX-39 — 부스터 실값 미러: 한정 수량(payload.stock_limit)·무료배송(block_data.free_ship).
  const [productStockLimit, setProductStockLimit] = useState<number | null>(null);
  // FIX-45c — 남은수량 단위 미러(기존 저장 키 sale_unit/pack_type 파생만 — 신규 저장 키 0). 기본 '개'.
  const [productStockUnit, setProductStockUnit] = useState<string>("개");
  const [productFreeShip, setProductFreeShip] = useState(false);
  // FIX-40 — 공동구매 미러(block_data.group_buy_target_n/price_krw — 유효 저장분만).
  const [productGroupBuy, setProductGroupBuy] = useState<{
    targetN: number;
    priceKrw: number;
  } | null>(null);
  const [productUnitLabel, setProductUnitLabel] = useState<string | null>(null);
  // FIX-24 — 수확·발송 기간 스냅샷(date_range_label) 미러 — 동일 패턴.
  const [productDateRangeLabel, setProductDateRangeLabel] = useState<string | null>(null);
  const [lastEquipped, setLastEquipped] = useState<string | null>(null);
  const deckRef = useRef<HTMLElement>(null);
  // B전환 커밋1 — 스튜디오 링고 드래그 폐기: fabPos·⠿·패널 이동 상태 전량 제거(홈 LingoHomeBox 는
  //   무접촉 — 자체 fabPos 유지). 하단 고정 독/캡슐만. 링고는 고정 발행바 위에 스택하므로 발행바
  //   실측 높이(publishBarH)만큼 bottom 오프셋(가변 높이·safe-area·게이트 문구 대응).
  const publishBarRef = useRef<HTMLDivElement>(null);
  const [publishBarH, setPublishBarH] = useState(96);
  useEffect(() => {
    const el = publishBarRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setPublishBarH(el.offsetHeight));
    ro.observe(el);
    setPublishBarH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

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

  // FIX-28 — 배경색 카드 숨김(ENABLE_CARD_COLORS 스위치 — 로직 보존).
  // S3-4c — 인원 블록 렌더 제거(코드 보존·가역): 인원 확정은 예약 시트 몫(기본 성인 2 자동).
  const DECK = useMemo(
    () =>
      DECK_IDS[mode]
        .map(blockById)
        .filter((b) => ENABLE_CARD_COLORS || b.id !== "bgcolor")
        .filter((b) => b.id !== "party"),
    [mode],
  );
  const isMainBlock = (id: string) => MODE_MAIN_IDS[mode].includes(id);
  const accent = CARD_MODEL_ACCENTS[mode];
  const pageBg = PAGE_BG;

  // 모드 전환 — 정본: 장착·진행 초기화. 비사업자 잠금 = studio-build P6-3 완화 동등
  // (진입 허용 · 사업자 모드만 잠금).
  // FIX-35 READ 판정 — mode 를 바꾸는 경로는 이 함수(모드 탭 onClick) 단 1곳(①):
  //   ② ?purpose 프리셋은 useState 초기값으로만 1회 소비(setMode 재호출 경로 없음 —
  //      remount 외 재적용 불가. 이 계약을 깨는 setMode(initialMode) 재실행 금지),
  //   ③ continueFlow/방향등 점프는 setDeckIndex 만, ④ 등록 성공 리셋 경로에 setMode 없음,
  //   ⑤ 링고 switchMode 액션은 클라 미배선(useLingoChat 이 actions 이벤트 미소비).
  //   → 제작 중 스티키 탭 오터치가 즉시 전체 초기화로 이어지던 것이 원인 — 확인 1회 게이트.
  const [pendingMode, setPendingMode] = useState<BuildMode | null>(null);
  const doSwitchMode = (next: BuildMode) => {
    purposeConfirmedRef.current = true; // P3 커밋2 — 명시 모드 선택 = 목적 확정(0단계 재발동 금지).
    setMode(next);
    setApplied({});
    setDeckIndex(0);
    setDropped(false);
    setSavedUrl(null);
    setSaveError(null);
    setShowColorPicker(false);
    setCardColor(CARD_BASE);
    setFormProgress({ nameSet: false, priceSet: false, photoSet: false, name: "" }); // FIX-34 신호 리셋.
    setDockSkipped(false); // FIX-33 — 도킹 건너뛰기도 진행 상태 — 함께 초기화.
  };
  const switchMode = (next: BuildMode) => {
    if (next === mode) return;
    if (!isBusiness && next !== "general") {
      toast.info("예약·상품판매 카드는 사업자 인증 후 열려요.");
      return;
    }
    // FIX-35 — 제작 진행 중(장착·입력·등록 어느 하나라도)이면 확인 1회 후 전환.
    const hasProgress =
      Object.values(applied).some(Boolean) ||
      !!selectedVideo ||
      !!heroImageUrl ||
      !!attachedProducts[0] ||
      !!productName.trim() ||
      formProgress.nameSet ||
      formProgress.priceSet ||
      formProgress.photoSet ||
      dockedProducts.length > 0 ||
      !!cfgSubtitle.trim() ||
      !!confirmedClip ||
      cfgDates.length > 0 ||
      !!selectedCouponId;
    if (hasProgress) {
      setPendingMode(next);
      return;
    }
    doSwitchMode(next);
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

  // FIX-28 — 목적별 필수패키지(Duke 확정본 — 이 표가 정본). 게시 게이트·방향등·단계 점이
  //   전부 이 steps 하나를 읽는다(단일 기준). done = 실확정 state 결합(FIX-25 원칙).
  //   candidates = 방향등·점프 대상 덱 블록 / gate = 게시 비활성 사유 1줄 / teach = 링고 티칭.
  // FIX-33 — required 플래그 도입: 발행 게이트는 required=true 만 본다(무변경).
  //   도킹 = 정식 단계(비필수, 필수 뒤·발행 앞): done = 1장 이상 연결 or [건너뛰기].
  //   가용(dockCount) 0장이면 단계 자체를 목록에서 제외(자동 스킵 — 단계 점 미표시).
  const steps = useMemo(() => {
    const productDone =
      !!attachedProducts[0] || (!!productImageUrl && !!productName.trim() && (productPrice ?? 0) > 0);
    // FIX-42 — 누락 사유 1줄(missing): 실제 미충족 필드명 기준(창작 금지). 이 표가 배지·발화의
    //   단일 소스 — 배지용 목록 복제 금지. 첫 번째 미충족 필드 하나만 말한다(방향등 순서 동일).
    const productMissing = productDone
      ? null
      : !productImageUrl
        ? "상품 사진 미등록"
        : !productName.trim()
          ? "상품 이름 미입력"
          : "상품 가격 미입력";
    const dockStep =
      dockCount > 0
        ? [
            {
              label: "도킹", coach: "dock", block: "dock", candidates: ["dock"], required: false,
              done: dockedProducts.length > 0 || dockSkipped,
              gate: "",
              teach: "",
              missing: null as string | null,
            },
          ]
        : [];
    if (mode === "commerce") {
      return [
        {
          label: "상품", coach: "product", block: "product", candidates: ["product", "productimage"], required: true, done: productDone,
          gate: "상품(사진·이름·가격)을 먼저 등록해 주세요",
          teach: "팔 상품의 이름과 가격부터 등록해요. 가격이 보여야 친구가 주문을 결심해요.",
          missing: productMissing,
        },
        {
          // 판매기간(seasonal) 또는 수확·발송일(등록 폼 날짜) 중 1 확정.
          label: "발송기준", coach: "shipBasis", block: "seasonal", candidates: ["seasonal"], required: true, done: !!applied["seasonal"] || productShipDateSet,
          gate: "판매기간 또는 수확·발송일을 먼저 확정해 주세요",
          teach: "언제 받을 수 있는지 알려줘요 — 판매 캘린더나 수확·발송일 중 하나면 돼요.",
          missing: "판매기간·발송일 미확정",
        },
        {
          // S4-5 — 배송(비필수 · 발행 게이트 아님): 배송방법 선택 = done(폼 진행 신호).
          //   입력은 상품 등록 폼 ⑥배송 섹션에서 직접(can_set:false — 링고는 안내만).
          label: "배송", coach: "ship", block: "product", candidates: ["product"], required: false,
          done: !!formProgress.shipMethodSet,
          gate: "",
          teach: "어떻게 보낼지 알려줘요 — 상품 등록의 배송 칸에서 배송방법·배송비·안내문구를 입력해 주세요.",
          missing: "배송방법 미선택",
        },
        ...dockStep,
        { label: "발행", coach: "", block: null, candidates: [] as string[], required: false, done: dropped, gate: "", teach: "", missing: null as string | null },
      ];
    }
    if (mode === "reserve") {
      return [
        {
          // FIX-30(b) — READ 실측: 서버 /api/drops 가 비커머스에 media_url(영상 source)을
          //   구조적으로 요구(400 "영상 링크와 목적은 필수예요" + extract-meta 필수)라
          //   이미지 단독 예약 발행은 현재 불가. 필수표(영상 or 이미지)와의 모순을 임시
          //   정직 표기로 해소 — done 도 영상 기준으로 회귀(이미지 단독으로 게이트가 열리면
          //   발행에서 막혀 거짓 게이트가 됨). 서버 지원(별도 트랙) 후 `|| !!heroImageUrl`
          //   + 원래 문구 복원.
          label: "콘텐츠", coach: "content", block: "content", candidates: ["content", "image"], required: true, done: !!selectedVideo,
          gate: "예약 카드는 아직 영상이 필요해요 — 곧 이미지만으로도 가능해져요",
          teach: "지금은 영상이 카드의 시작이에요. 대표 이미지는 함께 담을 수 있고, 이미지 단독 발행도 곧 열려요.",
          missing: "영상 미선택",
        },
        {
          // Duke: 쿠폰이 우선순위 필수 — 콘텐츠 다음 최우선 배치.
          label: "쿠폰", coach: "coupon", block: "coupon", candidates: ["coupon"], required: true, done: !!(applied["coupon"] && selectedCouponId),
          gate: "쿠폰을 먼저 연결해 주세요",
          teach: "왜 지금 예약해야 하나요? 쿠폰 한 장이면 '누를 이유'가 생겨요.",
          missing: !applied["coupon"] ? "쿠폰 미설정" : "쿠폰 미선택",
        },
        {
          label: "캘린더", coach: "calendar", block: "calendar", candidates: ["calendar"], required: true, done: !!applied["calendar"] && cfgDates.length > 0,
          gate: "예약 캘린더를 먼저 설정해 주세요",
          teach: "예약 카드의 심장이에요. 받을 수 있는 날짜를 골라 캘린더를 확정해요.",
          missing: !applied["calendar"] ? "캘린더 미설정" : "예약 날짜 미선택",
        },
        {
          // store+facilities — 동일 설정 패널(매장정보)에서 함께 충족: 1묶음 표기.
          label: "매장·시설", coach: "store", block: "link", candidates: ["link"], required: true, done: savedStoreInfo.hasAddress && savedStoreInfo.facilities > 0,
          gate: "매장 정보(주소·시설)를 먼저 저장해 주세요",
          teach: "주소와 시설 태그를 저장하면 손님이 안심하고 예약해요. 매장정보에서 한 번에 저장돼요.",
          missing: !savedStoreInfo.hasAddress ? "매장 주소 미저장" : "시설 정보 미저장",
        },
        ...dockStep,
        { label: "발행", coach: "", block: null, candidates: [] as string[], required: false, done: dropped, gate: "", teach: "", missing: null as string | null },
      ];
    }
    return [
      {
        label: "영상", coach: "content", block: "content", candidates: ["content"], required: true, done: !!selectedVideo,
        gate: "영상을 먼저 담아 주세요",
        teach: "친구가 0.5초 안에 멈추게 하려면 영상 핵심구간부터. 후크가 없으면 아무도 안 눌러요.",
        missing: "영상 미선택",
      },
      {
        // 한마디(tagline) — 정보 모드 필수 승격(꾸미기 단계·색은 제거, FIX-28).
        label: "한마디", coach: "tagline", block: "content", candidates: ["content"], required: true, done: !!cfgSubtitle.trim(),
        gate: "내 한마디를 먼저 적어 주세요",
        teach: "왜 이 영상을 보내는지 한 줄만 적어요. 그 한마디가 카드의 목소리예요.",
        missing: "한마디 미입력",
      },
      ...dockStep,
      { label: "발행", coach: "", block: null, candidates: [] as string[], required: false, done: dropped, gate: "", teach: "", missing: null as string | null },
    ];
  }, [mode, applied, selectedCouponId, selectedVideo, heroImageUrl, attachedProducts, productImageUrl, productName, productPrice, productShipDateSet, cfgSubtitle, cfgDates, savedStoreInfo, dockCount, dockedProducts, dockSkipped, dropped, formProgress.shipMethodSet]);
  const currentStepIdx = steps.findIndex((s) => !s.done);
  const nextStepLabel = currentStepIdx >= 0 ? steps[currentStepIdx].label : null;

  // T5 — 빈 채팅박스 금지: 패널 첫 진입 시 현재 모드·단계 기반 시작 제안 1개를 링고 말풍선으로
  //   선노출(이미 대화가 있으면 seed 는 no-op).
  useEffect(() => {
    if (lingoView !== "panel") return;
    const intro =
      mode === "commerce"
        ? "상품 카드를 같이 완성해 볼까요? 소개 문구나 가격 고민, 뭐든 물어보세요."
        : mode === "reserve"
          ? "예약·쿠폰 카드를 같이 만들어 볼까요? 어떤 매장·혜택인지 알려주시면 문구부터 도와드릴게요."
          : "카드를 같이 완성해 볼까요? 영상 고르기부터 한마디 문구까지 뭐든 물어보세요.";
    chat.seed(nextStepLabel ? `${intro} 지금은 ${nextStepLabel} 단계예요.` : intro);
  }, [lingoView, mode, nextStepLabel, chat.seed]);

  // T5 — 새 말풍선/타자 진행 시 대화 리스트 하단 고정.
  useEffect(() => {
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

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
              : voice.listening // T5 — 음성 인식 중 busy("듣는 중").
                ? "듣고 있어요…"
                : chat.streaming // T5 — 대화 스트리밍 중 busy.
                  ? "링고가 생각 중…"
                  : null;

  // 작업12 — LED 러닝 라이트 제거(ledFinish/prevBusyRef/ledOn 폐지). busy 표시는 캡슐
  //   스피너(Loader2)·헤더 텍스트("생각 중…"/"말하는 중…")가 담당(회전 링 없음).
  // 배선 점검 — 개발 전용: 등록·업로드·AI·발행 때 busy 가 실제 true 가 되는지 확인.
  useEffect(() => {
    if (import.meta.env.DEV) console.debug("[studio-lab] stripBusy →", stripBusy ?? "(idle)");
  }, [stripBusy]);

  // FIX-9 — 능동 제안 노출 리듬(트리거·거절 쿨다운)은 유지. FIX-23 — 대상 선택은 아래
  //   단일 타깃(currentTarget)으로 통합: 말(티칭)·버튼(계속/장착)·불(방향등)이 전부
  //   같은 블록에서 파생 — 구조적으로 어긋날 수 없다.
  const [dismissedSuggests, setDismissedSuggests] = useState<string[]>([]);
  const [suggestVisible, setSuggestVisible] = useState(false);
  const readyToSend = !dropped && currentStepIdx >= 0 && steps[currentStepIdx].block === null;

  // FIX-28/33 — 첫 미완료 "필수" 단계(발행 게이트가 읽는 유일 기준 — 도킹 등 비필수 미포함).
  const firstRequiredStep = useMemo(
    () => steps.find((s) => s.required && !s.done && s.candidates.length > 0) ?? null,
    [steps],
  );
  // 게시 게이트 — 필수 전부 충족 시에만 활성. 사유 1줄 = 첫 미완 항목의 gate 문구.
  const canPublish = !firstRequiredStep;
  const gateMsg = firstRequiredStep?.gate ?? null;

  // FIX-48+50 — 번호 인터뷰 좌표계(interview-steps45 단일 정본). 판매방식 = 폼 신호(quick/full/groupBuy).
  //   signals = 기존 steps done·formProgress 재사용(신규 판정 0). 스텝퍼·덱 번호 배지·(P2)폼 마커 공용.
  const interviewMethod: SalesMethod = formProgress.salesMethod ?? "full";
  const interviewJourney = useMemo(
    () => getInterviewJourney(mode as InterviewMode, interviewMethod),
    [mode, interviewMethod],
  );
  const interviewSignals: InterviewSignals = useMemo(
    () => ({
      photoSet: formProgress.photoSet,
      nameSet: formProgress.nameSet,
      priceSet: formProgress.priceSet,
      originSet: formProgress.originSet,
      gbTargetSet: formProgress.gbTargetSet,
      gbPriceSet: formProgress.gbPriceSet,
      gbDeadlineSet: formProgress.gbDeadlineSet,
      // S4-5 — 배송 스텝 신호(폼 배송방법 선택 = done).
      shipMethodSet: formProgress.shipMethodSet,
      shipBasisDone: !!applied["seasonal"] || productShipDateSet,
      dockDone: dockedProducts.length > 0 || dockSkipped,
      videoDone: !!selectedVideo,
      taglineDone: !!cfgSubtitle.trim(),
      couponDone: !!(applied["coupon"] && selectedCouponId),
      calendarDone: !!(applied["calendar"] && cfgDates.length > 0),
      storeAddrDone: savedStoreInfo.hasAddress,
      facilitiesDone: savedStoreInfo.facilities > 0,
      publishDone: dropped,
    }),
    [
      formProgress,
      applied,
      productShipDateSet,
      dockedProducts.length,
      dockSkipped,
      selectedVideo,
      cfgSubtitle,
      selectedCouponId,
      cfgDates.length,
      savedStoreInfo,
      dropped,
    ],
  );
  const interviewStates = useMemo(
    () => computeInterviewStates(interviewJourney, interviewSignals),
    [interviewJourney, interviewSignals],
  );
  // FIX-48+50 P2 — 미리보기 점선 번호 슬롯(거울 성역 · studio 전용 별도 prop). 현재 단계 → 앵커.
  const previewCurrentSlot = useMemo(() => {
    const cur = interviewStates.find((x) => x.state === "current");
    if (!cur) return undefined;
    const anchor = interviewSlotAnchor(cur.step.key);
    return anchor ? { no: cur.step.no, label: cur.step.label, anchor } : undefined;
  }, [interviewStates]);

  // FIX-48+50 P1.5 커밋2 — 첫 진입 자동 인사: 모드 확정 후 링고 박스를 1회 펼쳐 현재 번호 질문을 시드.
  //   문구 창작 금지 — interview-steps45 정본 번호·라벨 인용. TTS 자동재생 절대 금지(텍스트 seed만 —
  //   voice.speak 미호출). 세션 1회 가드(sessionStorage + ref): 재접힘·재진입 후 자동 재펼침 금지.
  const autoGreetedRef = useRef(false);
  useEffect(() => {
    if (autoGreetedRef.current) return;
    autoGreetedRef.current = true;
    const key = "sl-lingo-greeted";
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(key) === "1") return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage 접근 불가(프라이빗 모드 등) — ref 가드만으로 1회 보장.
    }
    const cur = interviewStates.find((x) => x.state === "current");
    chat.seed(cur ? `${cur.step.no}번 ${cur.step.label}부터 시작해 볼까요?` : "카드를 같이 완성해 볼까요? 뭐든 물어보세요.");
    setLingoView("panel");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX-48+50 P1.5 커밋1g — 링고 박스 헤더/캡슐의 현재 번호 = 원형 배지(26px, 목적색, 스텝퍼와 동일
  //   sl-num-pulse 리듬 공유). 부착 순간 마이크로 연출: 번호 전진 시 배지 ✓ 잠깐 표시 → 다음 번호.
  //   번호·라벨 = interview-steps45 정본(창작 0).
  const interviewCurrent = interviewStates.find((x) => x.state === "current");
  const interviewCurNo = interviewCurrent?.step.no ?? null;
  const prevInterviewNoRef = useRef<number | null>(interviewCurNo);
  const [interviewAdvanceFlash, setInterviewAdvanceFlash] = useState(false);
  useEffect(() => {
    if (prevInterviewNoRef.current != null && interviewCurNo != null && interviewCurNo > prevInterviewNoRef.current) {
      setInterviewAdvanceFlash(true);
      const t = setTimeout(() => setInterviewAdvanceFlash(false), 700);
      prevInterviewNoRef.current = interviewCurNo;
      return () => clearTimeout(t);
    }
    prevInterviewNoRef.current = interviewCurNo;
  }, [interviewCurNo]);
  const renderNumBadge = (no: number) => (
    <span
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold tabular-nums text-white transition-all duration-300"
      style={{ backgroundColor: accent, animation: "sl-num-pulse 1.6s ease-out infinite" }}
    >
      {interviewAdvanceFlash ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : no}
    </span>
  );

  // FIX-48+50 — [필수] 배지 파생(requiredBadges) 폐지: 덱 번호 배지는 interview-steps45
  //   blockBadge(interviewJourney, ...) 단일 정본으로 대체(위 render). steps 는 발행 게이트
  //   (firstRequiredStep/canPublish/gateMsg)·방향등·링고 발화 정본으로 계속 사용.

  // FIX-23/25/28/33 — 단일 타깃: 단계 순회(필수 → 도킹(비필수 정식 단계) → 발행)로 통일.
  //   필수는 거절 쿨다운 제외(계속 안내), 비필수(도킹)는 쿨다운/[건너뛰기] 허용.
  //   발행 단계 도달 후 권장 쿠폰(비예약 모드 잔여 제안 — 기존 리듬) → 전부 소진 = 수렴.
  const currentTarget = useMemo(() => {
    if (dropped) return null;
    for (const s of steps) {
      if (s.done) continue;
      if (s.candidates.length === 0) break; // 발행 단계 — 아래 잔여 권장으로.
      for (const id of s.candidates) {
        const b = DECK.find((x) => x.id === id);
        if (!b || GATED_BLOCK_IDS.has(b.id)) continue;
        if (!s.required && dismissedSuggests.includes(b.id)) continue; // 비필수만 쿨다운.
        if (applied[b.id]) return b; // 진행 중 — 마무리 안내(등록·선택·저장 완료까지 유지).
        if (!b.isPaid) return b; // 미장착 — 장착 안내.
      }
      if (!s.required) continue; // 비필수 후보 전멸(쿨다운) — 다음 단계로.
      return null; // 이론상 도달 없음(필수 후보는 비게이트).
    }
    // 잔여 권장 — 쿠폰(예약 모드는 필수라 여기 도달 시 이미 적용됨 — 자연 제외).
    if (!applied["coupon"] && !dismissedSuggests.includes("coupon")) {
      const c = DECK.find((b) => b.id === "coupon" && !GATED_BLOCK_IDS.has(b.id));
      if (c) return c;
    }
    return null;
  }, [dropped, steps, DECK, applied, dismissedSuggests]);

  // 제안 칩([장착]+X) 대상 = 단일 타깃이 "장착 가능"일 때만(마무리 안내 대상엔 칩 없음).
  const suggestion = useMemo(() => {
    if (dropped || readyToSend || !currentTarget || applied[currentTarget.id]) return null;
    return currentTarget;
  }, [currentTarget, applied, dropped, readyToSend]);
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
  // FIX-19→23 — 방향등 = 단일 타깃 그 자체(캡슐 기본 문구=해당 단계 티칭과 상시 동행).
  //   단계 완료 시 타깃이 다음 단계 블록으로 넘어가며 불도 즉시 이동(순서대로 켜짐).
  //   busy/flash 중엔 기존처럼 잠시 소등, 수렴·발행 후 = 타깃 null → 전체 소등(기존 계약).
  // FIX-48+50 조정A — 덱 카드 방향등(노란 회전 글로우) 폐지: "지금 차례"는 번호 배지 3상태로만
  //   (글로우·회전·네온 0). suggestLitId/debugLitId·lit 판정 제거. 링고 busy LED(ledOn)는 작업12에서 제거.

  // FIX-32 — 영상 길이(초). 파싱 가능 + 10초 이상이면 범위 슬라이더, 아니면 스텝퍼 폴백.
  const clipDurSec = selectedVideo?.durationLabel ? parseClock(selectedVideo.durationLabel) : null;
  // FIX-32 — ±버튼 스텝(함수형 갱신 — HoldButton 반복의 stale closure 안전). 상호 클램프:
  //   시작 ≤ 끝-5초 / 끝 ≥ 시작+5초 / 0 ~ 영상길이(불명 시 상한 없음).
  const stepClip = (which: "start" | "end", delta: number) =>
    setClipSel((p) => {
      if (which === "start") {
        return { ...p, start: Math.min(Math.max(0, p.start + delta), Math.max(0, p.end - 5)) };
      }
      const cap = clipDurSec ?? Number.MAX_SAFE_INTEGER;
      return { ...p, end: Math.max(Math.min(cap, p.end + delta), p.start + 5) };
    });

  // FIX-27 — 핵심구간 [적용] 확정: 검증(끝>시작·영상 길이 초과 차단) 통과 시에만
  //   confirmedClip 확정 + 미리보기 라벨(cfgClip) + 패널 접힘 + 링고 안내 갱신.
  //   (FIX-32 — 슬라이더/스텝퍼 클램프가 1차 방어, 여기는 확정 직전 재검증 — 계약 유지.)
  function applyClip() {
    const startSec = clipSel.start;
    const endSec = clipSel.end;
    if (endSec <= startSec) {
      setClipError("끝 시점은 시작보다 뒤여야 해요.");
      return;
    }
    if (clipDurSec != null && (startSec > clipDurSec || endSec > clipDurSec)) {
      setClipError(`영상 길이(${selectedVideo!.durationLabel}) 안에서 골라 주세요.`);
      return;
    }
    setClipError(null);
    const label = `${formatDuration(startSec)}~${formatDuration(endSec)}`;
    setConfirmedClip({ startSec, endSec, note: clipDraftNote.trim(), label });
    setCfgClip(label); // 미리보기(model.clip) 기존 주입 경로 재사용.
    setCollapsedPanels((p) => ({ ...p, clip: true }));
    flashStrip(`핵심구간이 적용됐어요${nextStepLabel ? ` — 다음은 ${nextStepLabel}` : ""}`);
  }

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
      // FIX-28 — 실확정 스냅샷 갱신(필수패키지 '매장·시설' done 판정 소스).
      setSavedStoreInfo({ hasAddress: !!cfgAddress.trim(), facilities: facilities.length });
      flashStrip("매장정보가 저장됐어요");
    } catch (err) {
      console.error("[studio-lab] store info save unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setStoreSaving(false);
    }
  }

  // FIX-29 — 현재 타깃의 코칭 키: 필수 구간 = 단계의 coach(정본 표), 권장 구간 = 블록 id 매핑.
  // S4-5 — 배송 단계(비필수)는 타깃 블록이 product 라 블록 id 매핑이 어긋남 → 단계 정본으로 지목.
  const pendingShipStep = steps.find((s) => s.coach === "ship" && !s.done);
  const currentCoachKey = firstRequiredStep
    ? firstRequiredStep.coach || null
    : pendingShipStep && currentTarget?.id === "product"
      ? "ship"
      : currentTarget && (currentTarget.id === "dock" || currentTarget.id === "coupon")
        ? currentTarget.id
        : null;
  // FIX-29 — effect 의 {N} 치환(진실 경계 — 실제 보유 숫자만): coupon = 게이지 상승폭(블록
  //   power), dock = 도킹 실카운트(0이면 숫자 구간 미노출 — 가짜 유도 금지).
  const coachEffect = (key: string): string | null => {
    const note = COACH_NOTES[key];
    if (!note) return null;
    if (key === "coupon") return note.effect.replace("{N}", String(blockById("coupon").power));
    if (key === "dock") {
      return dockCount > 0 ? note.effect.replace("{N}", String(dockCount)) : "드로피를 더 받을 수 있어요";
    }
    return note.effect;
  };
  // FIX-29 — 게시 마무리 코칭: 실제 충족(장착·확정)된 항목만(사실 기반 — 미장착 언급 금지),
  //   우선순위(목적 블록 → 콘텐츠) 상위 3개의 effect 요약.
  const finishCoach = useMemo(() => {
    if (!dropped) return [] as { key: string; label: string }[];
    const done: { key: string; label: string }[] = [];
    if (applied["coupon"] && selectedCouponId) done.push({ key: "coupon", label: "쿠폰" });
    if (applied["calendar"] && cfgDates.length > 0) done.push({ key: "calendar", label: "예약 캘린더" });
    if (attachedProducts[0] || (productImageUrl && productName.trim())) done.push({ key: "product", label: "상품" });
    if (applied["seasonal"] || productShipDateSet) done.push({ key: "shipBasis", label: "발송기준" });
    if (savedStoreInfo.hasAddress && savedStoreInfo.facilities > 0) done.push({ key: "store", label: "매장·시설" });
    if (dockedProducts.length > 0) done.push({ key: "dock", label: "카드 도킹" });
    if (selectedVideo) done.push({ key: "content", label: "영상" });
    if (selectedVideo && confirmedClip) done.push({ key: "keymoment", label: "핵심구간" }); // FIX-27 — 실확정 기준.
    if (cfgSubtitle.trim()) done.push({ key: "tagline", label: "한마디" });
    return done.slice(0, 3);
  }, [dropped, applied, selectedCouponId, cfgDates, attachedProducts, productImageUrl, productName, productShipDateSet, savedStoreInfo, dockedProducts, selectedVideo, confirmedClip, cfgSubtitle]);

  // 링고 코칭 — FIX-28: 필수 구간은 step.teach(필수패키지 정본의 티칭 — 문구·버튼·불 단일
  //   기준), 권장 구간은 항목별 권장 문구. 타깃 없음 = 수렴("이제 게시할 수 있어요").
  const lingo = useMemo(() => {
    if (firstRequiredStep && currentTarget) {
      // FIX-34 — 상품 단계 마이크로 안내: 폼 진행 신호를 따라 문구가 전진(같은 문구 무한
      //   반복 금지). 이름은 입력된 실값만 사용(진실 경계 — 창작 금지). 등록 완료 시엔
      //   단계 done 으로 이 분기 자체가 넘어간다(기존 전이).
      if (firstRequiredStep.label === "상품") {
        const fp = formProgress;
        if (fp.nameSet && fp.priceSet && fp.photoSet) {
          return { text: `'${fp.name}' 준비 끝 — [상품 등록]을 눌러 확정해요.`, action: currentTarget.id };
        }
        if (fp.nameSet && fp.priceSet) {
          return { text: "사진 한 장이면 끝나요", action: currentTarget.id };
        }
        if (fp.nameSet && fp.name) {
          return { text: `좋아요, '${fp.name}' — 이제 가격을 넣어주세요`, action: currentTarget.id };
        }
      }
      return { text: firstRequiredStep.teach, action: currentTarget.id };
    }
    if (currentTarget) {
      // 권장 모드 — 도킹은 실카운트 동봉(가짜 숫자 금지: dockCount>0 일 때만 타깃이 됨).
      // S4-5 — 배송 단계(비필수·타깃=product 블록): 단계 정본 teach 로 안내(블록 라벨 발화 오배선 방지).
      const text =
        currentTarget.id === "dock"
          ? `다른 카드를 함께 보내면 드로피를 더 받을 수 있어요 — ${dockCount}장 연결 가능`
          : currentTarget.id === "coupon"
            ? "왜 지금 행동해야 하나요? 쿠폰 한 장이면 '누를 이유'가 생겨요."
            : pendingShipStep && currentTarget.id === "product"
              ? pendingShipStep.teach
              : `${currentTarget.label}를 더해보세요.`;
      return { text, action: currentTarget.id };
    }
    return { text: "필수는 다 챙겼어요 — 이제 발행할 수 있어요.", action: null };
  }, [firstRequiredStep, currentTarget, dockCount, formProgress, pendingShipStep]);

  // FIX-42 — 링고 능동 안내(§13) 트리거 ①: 잠금 발행 버튼 클릭 시도.
  //   · 발화 = GATE_NOTES 정본(서버 호출 0) → 스트립/캡슐 플래시 채널(기존 stripFlash 재사용,
  //     프리뷰 버스트는 발화가 아니므로 미발동 — flashStrip 대신 전용 타이머).
  //   · 1상태 1발화: coach 키 기준 세션 내 dedupe. 무시(재클릭)하면 침묵 — 배지가 이어받는다.
  //   · stage 게이트: guide=상태별 각 1회 / assist=게이트 도달 후 통산 1회 / standby=발화 0.
  //     stage 미수신(대화 전) = "guide"(서버 lingo_user_state 신규 기본값과 동일).
  //   · 방향등: currentTarget 이 이미 같은 블록을 가리킴(단일 소스) — 여기선 덱 점프만 재사용.
  //   트리거 ②(장시간 무입력)는 전용 막힘 감지 신호 부재로 보류(기존 20초 타이머는 제안 노출
  //   리듬 공용이라 비막힘 상황에도 발화하게 됨 — §13 위반 위험). 보고 후 별도 슬라이스.
  const spokenGateKeysRef = useRef<string[]>([]);
  function handleGateBlockedClick() {
    const step = firstRequiredStep;
    if (!step) return;
    if (currentTarget && !jumpToBlock(currentTarget.id)) scrollToDeck();
    const key = step.coach || step.label;
    const text = decideGateUtterance({
      stage: chat.stage ?? "guide", // 미수신 = guide(서버 lingo_user_state 신규 기본값 동일).
      coachKey: key,
      spokenKeys: spokenGateKeysRef.current,
      unmetRequiredCount: steps.filter((s) => s.required && !s.done).length,
    });
    if (!text) return; // 침묵 — 배지·방향등이 이어받는다.
    spokenGateKeysRef.current = [...spokenGateKeysRef.current, key];
    setStripFlash(text);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setStripFlash(null), 5000);
  }

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

  // FIX-3→23 — [계속하기]: 단일 타깃 블록으로 흐름 복귀(타깃 없음 = 수렴 → 거울 시트).
  //   안내 문구·방향등과 같은 소스라 항상 같은 카드로 점프한다.
  function continueFlow() {
    if (!currentTarget) {
      setMirrorOpen(true);
      return;
    }
    if (!jumpToBlock(currentTarget.id)) scrollToDeck();
  }
  const canEdit = DECK.some((b) => CONFIGURABLE.includes(b.id) && !GATED_BLOCK_IDS.has(b.id));

  // B전환 커밋1 — 스튜디오 링고 드래그 폐기(fabPos·⠿·패널 이동 로직 전량 제거). 펼침 = 하단
  //   고정 독으로 상태 전환만(위치 계산 없음). 호출부(캡슐 탭·마이크·[말 끝났어요])는 이 함수 유지.
  function openPanelAt() {
    setLingoView("panel");
  }

  // ── 영상 검색 — 실배선 /api/discover. ST2b 스위치 시 원본 제거(studio-build :606-634 발췌). ──
  const handleVideoSearch = async () => {
    const k = videoQuery.trim();
    if (!k || videoSearching) return;
    // FIX-44 — 외부영상 URL 직접 붙여넣기(READ 판정: 전용 URL 칸 부재 → 이 검색 입력이 URL 수용).
    //   YouTube 한정 락. oembed 실값(제목·채널)으로 후보 1건 구성 → 아래 같은 선택·확정 체인
    //   (자동 장착 0 — [이 영상으로 확정]을 눌러야 카드 반영).
    const pastedId = parseYouTubeId(k);
    if (pastedId) {
      setVideoSearching(true);
      setVideoError(null);
      setFinderNotice(null);
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
        setVideoError("네트워크 오류로 영상 정보를 불러오지 못했어요.");
        setVideoResults([]);
      } finally {
        setVideoSearching(false);
        setVideoSearched(true);
      }
      return;
    }
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

  // FIX-44 — 영상 서치 도우미 검색(Edge youtube-search 직invoke — 유저 세션 JWT 자동 첨부).
  //   검색어 기본 채움 = DB 검증 매장명(partners.display_name)만 — 키워드 창작 금지.
  //   성공 후보만 기존 videoResults 체인에 주입(선택 전까지 덱 무변경). 0건/실패 =
  //   41창 확정 문구 원문(가짜 후보·재시도 루프 0). Instagram·타 플랫폼 시도 금지.
  const handleFinderSearch = async () => {
    const q = finderQuery.trim();
    if (!q || finderLoading) return;
    setFinderLoading(true);
    setFinderNotice(null);
    try {
      const { data, error } = await getSupabase().functions.invoke("youtube-search", {
        body: { q },
      });
      if (error || !data) {
        setFinderNotice(FINDER_FAIL_MSG);
        return;
      }
      const items = (data as { candidates?: YoutubeSearchItem[] }).candidates ?? [];
      const mapped = mapYoutubeSearchCandidates(items);
      if (mapped.length === 0) {
        // 0건 — 확정 문구 원문 + URL 입력칸(검색 입력 — URL 수용) 포커스.
        setFinderNotice(FINDER_EMPTY_MSG);
        document.getElementById("st45-video-query")?.focus?.();
        return;
      }
      setVideoResults(mapped);
      setVideoSearched(true);
      setVideoError(null);
    } catch {
      setFinderNotice(FINDER_FAIL_MSG);
    } finally {
      setFinderLoading(false);
    }
  };

  // 영상 선택 — 즉시 카드 반영 + 백그라운드 카피AI(oembed→generate-summary).
  // ST2b 스위치 시 원본 제거(studio-build :640-677 발췌).
  const handleSelectVideo = async (c: DiscoverCandidate) => {
    const slot = toVideoSlot(c);
    setSelectedVideo(slot);
    // FIX-27 — 기존 durationLabel 자동 주입 제거(영상 "전체 길이"가 핵심구간 기본값으로
    //   박히던 오류 — 실확정 아님). 영상이 바뀌면 구간 확정도 리셋(구영상 구간 잔존 방지).
    // FIX-32 — 초안은 0 ~ min(30초, 영상길이) 기본 범위로 초기화(타이핑 없는 시작점).
    const slotDurSec = slot.durationLabel ? parseClock(slot.durationLabel) : null;
    setConfirmedClip(null);
    setClipSel({ start: 0, end: slotDurSec != null ? Math.max(5, Math.min(30, slotDurSec)) : 30 });
    setClipDraftNote("");
    setClipError(null);
    setCfgClip("");
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
    // FIX-24 — 수확·발송 기간 스냅샷(date_range_label) 미러 → 미리보기 칩(단일일 = null = 미렌더).
    const rangeLabel = (payload.blocks?.[0]?.block_data as { date_range_label?: unknown } | undefined)?.date_range_label;
    setProductDateRangeLabel(typeof rangeLabel === "string" && rangeLabel ? rangeLabel : null);
    // FIX-28 — 발송기준 실확정: 수확·발송일이 등록에 포함됐는지(fresh=harvest_date/goods=ship_date).
    const bd = payload.blocks?.[0]?.block_data as
      | { harvest_date?: unknown; ship_date?: unknown; free_ship?: unknown }
      | undefined;
    setProductShipDateSet(!!(bd?.harvest_date || bd?.ship_date));
    // FIX-39 — 부스터 실값 미러(등록 payload 기존 키 재사용 — 신규 저장 키 0).
    setProductStockLimit(payload.stock_limit ?? null);
    // FIX-45c — 남은수량 단위 = 판매 구성 동기화(기존 저장 키 sale_unit/pack_type 파생만).
    const su = payload.blocks?.[0]?.block_data as
      | { sale_unit?: unknown; pack_type?: unknown }
      | undefined;
    setProductStockUnit(
      stockUnitLabelFrom(
        typeof su?.sale_unit === "string" ? su.sale_unit : null,
        typeof su?.pack_type === "string" ? su.pack_type : null,
      ),
    );
    setProductFreeShip(bd?.free_ship === true);
    // FIX-40 — 공동구매 미러(폼이 유효 통과분만 저장 — 여기선 존재 확인만).
    const gb = payload.blocks?.[0]?.block_data as
      | { group_buy_target_n?: unknown; group_buy_price_krw?: unknown }
      | undefined;
    setProductGroupBuy(
      typeof gb?.group_buy_target_n === "number" && typeof gb?.group_buy_price_krw === "number"
        ? { targetN: gb.group_buy_target_n, priceKrw: gb.group_buy_price_krw }
        : null,
    );
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
      // FIX-27 — 핵심구간 확정값을 발행 payload 에 결합: create_drop_v2 계약(v5.1)대로
      //   blocks[] 최상위 video_start_seconds/video_end_seconds → component_blocks 컬럼.
      //   문구는 기존 키 부재 → block_data 신규 키 clip_note(미주입=미렌더).
      const clipBlocks =
        selectedVideo && confirmedClip
          ? [
              {
                block_kind: "video",
                block_data: {
                  video_id: selectedVideo.videoId,
                  title: selectedVideo.title,
                  ...(confirmedClip.note ? { clip_note: confirmedClip.note } : {}),
                },
                video_start_seconds: confirmedClip.startSec,
                ...(confirmedClip.endSec != null ? { video_end_seconds: confirmedClip.endSec } : {}),
              },
            ]
          : [];
      const extraBlocks = [
        ...clipBlocks,
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
      // S1-b — 커머스 재사용 발행: 폼 등록으로 만든 상품 드롭은 is_public=false(서버 기본 —
      //   /api/drops self_upload `p_is_public ?? false`)로 생성됐고, 이 재사용 분기는 /api/drops
      //   를 재호출하지 않아 발행바 토글(isPublic)이 드롭에 반영되지 않는다. 발행 성공 후
      //   best-effort 반영(쿠폰 연결 패턴 동일 — 실패해도 발행 유지). RLS drops_owner_modify
      //   (auth.uid()=owner_user_id) 커버. else(신규 생성)는 body.is_public 로 실려나가 대상 아님.
      if (reusedProduct && dropId && supabase) {
        try {
          const { error: pubErr } = await supabase
            .from("info_drops")
            .update({ is_public: isPublic })
            .eq("id", dropId);
          if (pubErr) console.warn("[studio-lab] 공개 토글 반영 실패:", pubErr.message);
        } catch (e) {
          console.warn("[studio-lab] is_public update exception:", e);
        }
      }
      // S1-b(2) — 발행 시각 기록: 등록 시 생성된 드롭은 published_at NULL(status=published
      //   인데 발행시각 미기록)이라 D-day·정렬 등 발행시각 의존 로직이 빈다. 발행 성공 후
      //   NULL 인 경우만 now() 기록(.is('published_at', null) 게이트 — 기존 값 보존).
      //   best-effort(실패해도 발행 유지). RLS drops_owner_modify 커버.
      if (reusedProduct && dropId && supabase) {
        try {
          const { error: pubAtErr } = await supabase
            .from("info_drops")
            .update({ published_at: new Date().toISOString() })
            .eq("id", dropId)
            .is("published_at", null);
          if (pubAtErr) console.warn("[studio-lab] published_at 기록 실패:", pubAtErr.message);
        } catch (e) {
          console.warn("[studio-lab] published_at update exception:", e);
        }
      }
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
      // ④ ST2b-3(v8.8) — 판매기간 영속화: seasonal 확정값을 update_drop p_block_patch
      //    (서버 2키 화이트리스트 {sale_start, sale_end})로 메인 product 블록에 병합.
      //    best-effort — 실패해도 발행 진행. /d D-day 는 ST2b-2a 선배선(adapters sale_end
      //    소비)이 자동 점등. 기존 RPC 3종·POST 무접촉(이 호출 1개 추가만).
      if (mode === "commerce" && applied["seasonal"] && supabase) {
        try {
          const pad2 = (n: number) => String(n).padStart(2, "0");
          const sd = dateList[saleStartIdx];
          const ed = dateList[saleEndIdx];
          const isoOf = (d: { year: number; month: number; day: number }) =>
            `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
          if (sd && ed) {
            const { error: spanErr } = await supabase.rpc("update_drop" as never, {
              p_share_uuid: publishedShareUuid,
              p_curator_message: null,
              p_curator_note: null,
              p_block_patch: { sale_start: isoOf(sd), sale_end: isoOf(ed) },
            } as never);
            if (spanErr) console.warn("[studio-lab] 판매기간 저장 실패:", (spanErr as { message?: string }).message);
          }
        } catch (e) {
          console.warn("[studio-lab] update_drop(p_block_patch) exception:", e);
        }
      }
      // ③ 카드색 영속화 — 6색 팔레트 값 저장. best-effort.
      //    FIX-28 — 기본값(CARD_BASE)이면 스킵(색 UI 숨김 중 불필요 호출 0 — RPC 는 보존).
      if (dropId && supabase && cardColor && cardColor !== CARD_BASE) {
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

  // FIX-39 — 판매 부스터 칩 산출(전부 실값 · 0=미렌더). 미발행 스튜디오엔 주문 실집계 경로가
  //   없어 orderCount=null(가짜 집계 금지 — /d 실집계 주입은 ST2b, 같은 순수 모듈 소비).
  //   D-day 는 조회 시점(todayIso) 계산 — 스냅샷 박제 금지. FIX-42 steps 판정과 무관(선택 요소).
  const boosterChips = useMemo(() => {
    if (mode !== "commerce") return [];
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const end = applied["seasonal"] ? dateList[saleEndIdx] : undefined;
    const couponOn = !!applied["coupon"] && !!selectedCoupon;
    return buildBoosterChips({
      stockLimit: productStockLimit,
      // FIX-45c — 남은수량 단위 = 판매 구성 라벨("N박스 남음") — 기본 '개' 하위호환.
      stockUnitLabel: productStockUnit,
      saleEndIso: end
        ? `${end.year}-${String(end.month).padStart(2, "0")}-${String(end.day).padStart(2, "0")}`
        : null,
      todayIso,
      orderCount: null,
      // FIX-40 — 공동구매 활성 시 주문 칩은 진행률이 대체(이중 표기 방지 — READ ② 판정).
      groupBuyActive: !!productGroupBuy,
      benefits: {
        coupon: couponOn,
        discountLabel:
          couponOn && selectedCoupon!.discount_value != null
            ? `${selectedCoupon!.discount_value}${selectedCoupon!.discount_unit ?? ""} 할인`
            : null,
        freeShipping: productFreeShip,
      },
    });
  }, [mode, applied, dateList, saleEndIdx, selectedCoupon, productStockLimit, productStockUnit, productFreeShip, productGroupBuy]);

  // FIX-40 — 공동구매 표시(순수 모듈): 참여 M = preorders 실집계 입력 없음(미발행 스튜디오)
  //   → null = 진행률 미렌더(조건·고지만). /d 실집계 주입은 ST2b — 같은 모듈 소비.
  const groupBuyView = useMemo(
    () =>
      mode === "commerce" && productGroupBuy
        ? buildGroupBuyView({
            targetN: productGroupBuy.targetN,
            achievedPriceKrw: productGroupBuy.priceKrw,
            joinedCount: null,
          })
        : null,
    [mode, productGroupBuy],
  );

  // S4-6 — 배송정보 셀 거울: 폼 라이브 신호(formProgress) → 공용 buildShippingView(수신
  //   fromDropDetail 과 단일 소스 — 문구·행 순서·무료배송 규칙 동일). 실값 0 = null = 셀 미렌더.
  const studioShippingView =
    mode === "commerce"
      ? buildShippingView({
          shipMethod: formProgress.shipMethod,
          freeShip: formProgress.freeShip,
          shipFeeKrw: formProgress.shipFeeKrw,
          shipNote: formProgress.shipNote,
          harvestDate: formProgress.harvestDate,
        })
      : null;

  // 제작=공유=수신 거울 — fromStudioState(어댑터) + 스튜디오 로컬 프리뷰 필드 병합.
  const couponTitle =
    selectedCoupon?.title ??
    (selectedCoupon ? `${selectedCoupon.discount_value ?? ""}${selectedCoupon.discount_unit ?? ""} 할인` : undefined);
  const cardModel: CardModel = fromStudioState(
    {
      buildMode: mode,
      cardColor,
      // S4-4a — 커머스 그리드 다이어트: 상품판매 모드는 매장정보 셀 미장착(link 강제 false —
      //   fromDropDetail 수신 억제와 동형 거울). 덱 장착 토글이 있어도 미리보기 미렌더.
      // S4-6 — 배송정보 셀 장착 신호(실값 행 존재 시만 — 수신 applied.shipping 과 동형).
      applied:
        mode === "commerce"
          ? { ...applied, link: false, shipping: !!studioShippingView }
          : applied,
      tagline: cfgSubtitle,
      selectedVideo,
      pickedPoints,
      // ST2b-0 — valid_until 동봉(실값만): 미리보기 마감 타이머(수신 1-C 동형) 재료.
      selectedCoupon:
        applied["coupon"] && couponTitle
          ? { title: couponTitle, valid_until: selectedCoupon?.valid_until ?? null }
          : null,
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
      // S4-4a — 커머스는 시설 셀 미주입(그리드 다이어트 · fromDropDetail 동형).
      ...(applied["link"] && mode !== "commerce"
        ? { facilities: cfgFacilities.map((f) => f.text.trim()).filter(Boolean) }
        : {}),
      // FIX-15 — 상품 구성 메타 칩(등록 폼 unit_label 미러, 미주입=미렌더).
      ...(mode === "commerce" && productUnitLabel ? { productUnitLabel } : {}),
      // FIX-24 — 수확·발송 기간 칩(date_range_label 미러, 단일일=미주입=미렌더).
      ...(mode === "commerce" && productDateRangeLabel ? { productDateRangeLabel } : {}),
      // S4-6 — 배송정보 셀 표 행(공용 헬퍼 산출 — 수신과 동일 코드 렌더).
      ...(studioShippingView ? { shipping: studioShippingView } : {}),
      // S4-3 — CTA 라벨 거울: 45 스튜디오 상품판매 발행은 항상 자체등록(self_upload:true, :1902)
      //   → selfUpload 상태 = commerce 모드 자체 = "주문예약". 그 외 = 미주입 = 렌더러 "구매" 폴백.
      // ★거울 락: fromDropDetail의 ctaLabel 분기(selfUpload→"주문예약"/buyUrl→"구매하기")와 동일해야 함.
      //   스튜디오가 외부 buyUrl 상품을 지원하게 되면 이 하드코딩도 분기로 확장할 것 (S4-3)
      ...(mode === "commerce" ? { ctaLabel: "주문예약" } : {}),
      // FIX-39 — 판매 부스터 칩(실값 한정 · 빈 배열 = 미주입 = 미렌더).
      ...(boosterChips.length > 0 ? { boosterChips } : {}),
      // FIX-40 — 공동구매(설정 실존 시만 · 미주입 = 미렌더).
      ...(groupBuyView ? { groupBuy: groupBuyView } : {}),
      // 여정·확산 — 정본 데모(SHARE_JOURNEY·12명) 제거: 실 여정은 수신 후 생기는 것. 미주입=미렌더.
    },
  );

  // T5 STEP 2 — 먼저 아는 링고: 매 전송 시 스튜디오 요약 context 동봉.
  //   민감정보(결제·전화번호 등) 미포함 — 제작 상태 요약만.
  function buildLingoContext(): LingoContext {
    const effectiveProductName = productName.trim() || attachedProducts[0]?.name || "";
    const effectiveProductPrice = productPrice ?? attachedProducts[0]?.priceKrw ?? null;
    return {
      studio_state: {
        mode,
        applied_blocks: DECK.filter((b) => applied[b.id]).map((b) => b.label),
        score,
        card_title: cardModel.titleText,
        ...(mode === "commerce" && effectiveProductName ? { product_name: effectiveProductName } : {}),
        ...(mode === "commerce" && effectiveProductPrice != null ? { product_price: effectiveProductPrice } : {}),
        // FIX-29 — 현재 타깃 + 정본 코칭(why/effect) 동봉: 링고AI 답변이 화면 안내와 같은
        //   근거를 쓰게(창작 근거 방지 — 진실 경계).
        ...(currentTarget && currentCoachKey && COACH_NOTES[currentCoachKey]
          ? {
              current_target: {
                block: currentTarget.id,
                why: COACH_NOTES[currentCoachKey].why,
                effect: coachEffect(currentCoachKey) ?? COACH_NOTES[currentCoachKey].effect,
              },
            }
          : {}),
      },
      ...(aiKeyPoints.length > 0
        ? { video_summary: `${selectedVideo?.title ?? "선택한 영상"} — ${aiKeyPoints.join(" / ")}` }
        : {}),
      ...(pickedPoints.length > 0 ? { key_points: pickedPoints } : {}),
      // LINGO-V2 — 계약 v2 §1: 실제 덱 스냅샷(전송 시점 실상태 — 불일치 시 서버가 액션 무음
      //   제거하므로 신선도가 생명). 스튜디오 표면 전용(이 함수 자체가 스튜디오에서만 호출됨 —
      //   홈 등 비스튜디오 바이트 무변경). fields = 실값만(빈 값 미동봉).
      studio: {
        mode,
        deck: DECK.map((b) => ({
          id: b.id,
          label: b.label,
          applied: !!applied[b.id],
          locked: GATED_BLOCK_IDS.has(b.id) || (!!b.isPaid && score < ENHANCE_UNLOCK),
        })),
        fields: {
          ...(cfgTitle.trim() ? { title: cfgTitle.trim() } : {}),
          ...(cfgSubtitle.trim() ? { subtitle: cfgSubtitle.trim() } : {}),
          ...(confirmedClip ? { clip: confirmedClip.label } : {}),
          ...(mode === "commerce" && effectiveProductName
            ? { productName: effectiveProductName }
            : {}),
          ...(mode === "commerce" && effectiveProductPrice != null
            ? { productPrice: String(effectiveProductPrice) }
            : {}),
          ...(selectedCoupon?.title ? { coupon: selectedCoupon.title } : {}),
        },
      },
      // FIX-48+50 P2 — 번호 인터뷰 상태(계약 v2.1 additive). 스텝퍼와 동일 번호 = 발화 번호 강제
      //   일치. 번호·라벨·done·can_set 은 interview-steps45 정본 파생(창작 금지 재료).
      interview: {
        version: "2.1",
        mode,
        ...(mode === "commerce" ? { sales_method: interviewMethod } : {}),
        total: interviewJourney.length,
        current_no: interviewStates.find((x) => x.state === "current")?.step.no ?? null,
        current_label: interviewStates.find((x) => x.state === "current")?.step.label ?? null,
        steps: interviewJourney.map((s) => ({
          no: s.no,
          label: s.label,
          done: resolveInterviewDone(s.key, interviewSignals),
          can_set: interviewSetFieldKey(s.key) != null,
          ...(s.skippable ? { skippable: true } : {}),
          ...(s.publish ? { publish: true } : {}),
        })),
      },
    };
  }

  // ── LINGO-V2 — 액션 적용(확인 게이트 통과 후에만) ────────────────────────
  //   실행은 전부 기존 체인 재사용: equip() = 덱 장착(정직 게이트 포함) /
  //   switchMode() = FIX-35 전환 확인 게이트(우회 금지). 발행·결제·삭제 실행 경로는
  //   여기 자체가 없다(§13 — 서버도 해당 액션을 발행하지 않음).
  //   undo = 1단계(가역 보장). LINGO-V2b D2 — 스냅샷 = "이번 적용이 실제 바꾼 키 + 이전 값"
  //   목록만(전체 맵 복원 금지 — 손 수정분 보존). done 목록과 동일 소스에서 수집.
  //   (기존 정본 헬퍼 lingoUndo()[규칙 기반 장착 되돌리기]와 별개 — 이름 충돌 회피 lingoActUndo.)
  const [lingoActUndo, setLingoActUndo] = useState<{
    blocks: { id: string; prev: boolean }[];
    // FIX-48+50 P2 — field 일반화(title/subtitle = 스튜디오 직접 / 상품 필드 = fieldPatch 복원).
    fields: { field: string; prev: string }[];
  } | null>(null);
  // FIX-48+50 P2 — 상품 폼 setField 브리지: 확인 게이트 통과 값을 폼에 부착 요청(패치). restore =
  //   undo 복원(검증 우회·prev 그대로). 결과(부착 성공 prev / 검증 실패 reason)는 폼이 회신.
  const [productFieldPatch, setProductFieldPatch] = useState<{
    seq: number;
    fields: { field: string; value: string }[];
    restore?: boolean;
  } | null>(null);
  const productPatchSeq = useRef(0);
  // LINGO-V2b E2 — [적용] 연타 재진입 가드: 같은 제안 객체는 1회만 소비(동기 ref —
  //   clearProposal 의 setState 비동기 공백을 막는다). 확인어 경로도 동일 소비 함수 경유.
  const lingoConsumedRef = useRef<object | null>(null);
  function consumeLingoProposal(p: { actions: LingoStudioAction[] }) {
    if (lingoConsumedRef.current === p) return; // 연타 2회차 = no-op(이중 적용·토글 라스 방지).
    lingoConsumedRef.current = p;
    chat.clearProposal();
    applyLingoActions(p.actions);
  }

  // 액션 요약 라벨 — 액션 실값에서만 파생(재작성·창작 0).
  const lingoActionLabel = (a: LingoStudioAction): string => {
    if (a.type === "switchMode") {
      return `모드 전환 → ${LINGO_MODE_LABELS[a.mode ?? ""] ?? a.mode ?? "?"}`;
    }
    if (a.type === "equip" || a.type === "detach") {
      const b = DECK.find((d) => d.id === a.blockId);
      return `${b?.label ?? a.blockId ?? "?"} ${a.type === "equip" ? "장착" : "해제"}`;
    }
    const v = (a.value ?? "").trim();
    return `${LINGO_FIELD_LABELS[a.field ?? ""] ?? a.field ?? "?"}${v ? ` = "${v.slice(0, 40)}"` : ""}`;
  };

  function applyLingoActions(actions: LingoStudioAction[]) {
    // switchMode 동반 시 — 전환은 전체 리셋(FIX-35 doSwitchMode)이라 다른 액션과 동시 실행
    //   불가: 전환만 게이트로 보내고 나머지는 정직 안내(전환 뒤 재요청 유도).
    const sw = actions.find((a) => a.type === "switchMode");
    if (sw) {
      const rest = actions.length - 1;
      const valid =
        (sw.mode === "general" || sw.mode === "reserve" || sw.mode === "commerce") &&
        sw.mode !== mode;
      if (valid) {
        switchMode(sw.mode as BuildMode); // FIX-35 확인 게이트 경유(진행 중이면 확인 1회).
        chat.notify(
          rest > 0
            ? "모드 전환부터 진행할게요 — 전환이 끝나면 나머지는 다시 말씀해 주세요."
            : "모드 전환을 진행할게요 — 화면의 확인을 눌러 주세요.",
        );
      } else {
        chat.notify("그 사이 바뀌었네요, 다시 볼까요?");
      }
      return;
    }
    // 최종 가드(41창 ②) — 스냅샷 이후 손으로 바뀐 대상은 적용 포기(정직). 로컬 미러(cur)로
    //   같은 배치 안 순차 판정(setApplied 비동기 보완).
    const done: string[] = [];
    const stale: string[] = [];
    const manual: string[] = [];
    const cur: Record<string, boolean> = { ...applied };
    // LINGO-V2b D2 — 정밀 undo 수집: 실제 바꾼 키의 이전 값만(전체 스냅샷 금지).
    const undoBlocks: { id: string; prev: boolean }[] = [];
    const undoFields: { field: string; prev: string }[] = [];
    // FIX-48+50 P2 — 상품 폼 필드는 스튜디오가 직접 못 만짐 → 배치 수집 후 fieldPatch 로 폼에 부착
    //   요청(폼이 최종 검증·prev 회신). done 요약과 별개(비동기 결과 = handleFieldPatchResult).
    const productBatch: { field: string; value: string }[] = [];
    for (const a of actions) {
      if (a.type === "equip" || a.type === "detach") {
        const b = DECK.find((d) => d.id === a.blockId);
        const locked = !b || GATED_BLOCK_IDS.has(b.id) || (!!b.isPaid && score < ENHANCE_UNLOCK);
        const already = !!b && (a.type === "equip" ? cur[b.id] : !cur[b.id]);
        if (!b || locked || already) {
          stale.push(lingoActionLabel(a));
          continue;
        }
        undoBlocks.push({ id: b.id, prev: !!cur[b.id] });
        equip(b); // 기존 장착 체인(정직 게이트·버스트 포함) — 신규 장착 경로 0.
        cur[b.id] = a.type === "equip";
        done.push(lingoActionLabel(a));
      } else if (a.type === "setField") {
        if (a.field === "title" || a.field === "subtitle") {
          let v = (a.value ?? "").trim();
          if (!v) {
            stale.push(lingoActionLabel(a));
            continue;
          }
          // LINGO-V2b C2 — 상한 절단. READ 판정: 입력칸·저장측 모두 명시 상한 부재 →
          //   스펙 지시 100자 채택(title·subtitle 동일 준용). 초과 시 절단 + 정직 표기.
          const over = v.length > LINGO_FIELD_MAX;
          if (over) v = v.slice(0, LINGO_FIELD_MAX);
          if (!undoFields.some((f) => f.field === a.field)) {
            undoFields.push({
              field: a.field,
              prev: a.field === "title" ? cfgTitle : cfgSubtitle,
            });
          }
          (a.field === "title" ? setCfgTitle : setCfgSubtitle)(v);
          done.push(
            lingoActionLabel({ ...a, value: v }) +
              (over
                ? ` (${LINGO_FIELD_LABELS[a.field]}이 길어 ${LINGO_FIELD_MAX}자로 줄였어요)`
                : ""),
          );
        } else if (LINGO_PRODUCT_FIELDS.has(a.field ?? "")) {
          // FIX-48+50 P2 — 상품 폼 필드: 배치 수집(폼이 마운트돼 있어야 부착됨 — 미마운트 시
          //   폼 미수신 = 무동작, 인터뷰 persona 가 상품 블록으로 먼저 이동시킴).
          productBatch.push({ field: a.field as string, value: a.value ?? "" });
        } else {
          // 클라 실행 경로가 없는 필드 — 임의 실행 금지(§13), 화면 조작으로 정직 안내.
          manual.push(lingoActionLabel(a));
        }
      }
    }
    if (done.length === 0 && productBatch.length === 0) {
      chat.notify(
        stale.length > 0
          ? "그 사이 바뀌었네요, 다시 볼까요?"
          : "이건 제가 직접 못 만져요 — 화면에서 해주시면 돼요.",
      );
      return;
    }
    // 동기 부분(블록·title/subtitle) undo 확정(새 제안 = undo 리셋). 상품 배치는 결과 회신 시 append.
    setLingoActUndo({ blocks: undoBlocks, fields: undoFields });
    if (done.length > 0) {
      // 적용 결과 요약 — 실적용 값만(§13). 방향등(currentTarget)은 applied 파생이라 자연 이동.
      chat.notify(
        `적용했어요: ${done.join(" · ")}` +
          (stale.length > 0 ? `\n그 사이 바뀐 건 그대로 두었어요: ${stale.join(" · ")}` : "") +
          (manual.length > 0 ? `\n직접 해주셔야 해요: ${manual.join(" · ")}` : ""),
      );
    }
    // FIX-48+50 P2 — 상품 배치 부착 요청(폼 fieldPatch). 성공/실패 알림은 handleFieldPatchResult.
    if (productBatch.length > 0) {
      setProductFieldPatch({ seq: ++productPatchSeq.current, fields: productBatch });
    }
  }

  // FIX-48+50 P2 — 폼 부착 결과 회신 처리: 성공 = undo append + 적용 알림 / 실패 = 정직 안내 발화
  //   (검증 실패 사유 원문 — "달성가는 기본가보다 낮아야 해요" 등). restore(undo 복원)는 폼이 미회신.
  function handleFieldPatchResult(r: {
    seq: number;
    results: { field: string; ok: boolean; prev: string; reason?: string }[];
  }) {
    const ok = r.results.filter((x) => x.ok);
    const bad = r.results.filter((x) => !x.ok);
    if (ok.length > 0) {
      setLingoActUndo((prev) => ({
        blocks: prev?.blocks ?? [],
        fields: [...(prev?.fields ?? []), ...ok.map((x) => ({ field: x.field, prev: x.prev }))],
      }));
      chat.notify(`적용했어요: ${ok.map((x) => LINGO_FIELD_LABELS[x.field] ?? x.field).join(" · ")}`);
    }
    if (bad.length > 0) {
      chat.notify(
        bad.map((x) => x.reason ?? `${LINGO_FIELD_LABELS[x.field] ?? x.field}는 지금 넣을 수 없어요`).join("\n"),
      );
    }
  }

  function undoLingoActions() {
    if (!lingoActUndo) return;
    // LINGO-V2b D2 — 역연산 복원: 이번 적용이 바꾼 키만 이전 값으로(손 수정분 무접촉).
    if (lingoActUndo.blocks.length > 0) {
      setApplied((p) => {
        const next = { ...p };
        for (const b of lingoActUndo.blocks) next[b.id] = b.prev;
        return next;
      });
    }
    // title/subtitle = 스튜디오 직접 복원.
    for (const f of lingoActUndo.fields) {
      if (f.field === "title" || f.field === "subtitle") {
        (f.field === "title" ? setCfgTitle : setCfgSubtitle)(f.prev);
      }
    }
    // FIX-48+50 P2 — 상품 폼 필드는 restore 패치로 prev 그대로 복원(검증 우회 · 폼 미회신).
    const productUndo = lingoActUndo.fields.filter((f) => LINGO_PRODUCT_FIELDS.has(f.field));
    if (productUndo.length > 0) {
      setProductFieldPatch({
        seq: ++productPatchSeq.current,
        fields: productUndo.map((f) => ({ field: f.field, value: f.prev })),
        restore: true,
      });
    }
    setLingoActUndo(null);
    chat.notify("방금 적용한 걸 되돌렸어요.");
  }

  // LINGO-V2 — close 픽스(장기기억 트리거): 실동작 지점 실측 판정 = SPA 라우트 이탈 시
  //   언마운트 cleanup 1곳. beforeunload/pagehide 는 unload 중 비동기 JWT 확보가 신뢰 불가
  //   + 과호출 위험 → 제외. hook 이 세션 ref 를 비워 최대 1회(멱등 서버 + 클라 no-op).
  const lingoCloseRef = useRef(chat.close);
  lingoCloseRef.current = chat.close;
  useEffect(() => () => lingoCloseRef.current(), []);

  // ── FIX-48 — 연속 대화 모드(청취→자동 전송→낭독→재청취 루프). 기본 off — 기존
  //    1회 모드 무변경. 액션 게이트 유지: 자동 전송돼도 적용은 확인어/[적용]만(덱 불변).
  const [convMode, setConvMode] = useState(false);
  const [convPaused, setConvPaused] = useState(false);
  const [convPreview, setConvPreview] = useState<string | null>(null);
  // P3 커밋2 — 연속 대화 0단계(목적 선택). convPurposeRef=true 동안 답변은 서버 전송 대신 로컬
  //   목적 매핑. convPurposeChips=칩(말/탭 병행) 노출.
  const [convPurposeChips, setConvPurposeChips] = useState(false);
  const convPurposeRef = useRef(false);
  const convActiveRef = useRef(false);
  const convFinalRef = useRef<string | null>(null);
  const convBusyRef = useRef(false); // 프리뷰~전송~낭독 동안 재청취 금지(중복·에코 차단).
  const convIdleAtRef = useRef(0); // 마지막 실발화 시각 — 무음 2분 자동 대기 기준.
  const CONV_IDLE_MS = 120_000;

  function convListen() {
    if (!convActiveRef.current || convBusyRef.current) return;
    // 에코 차단 필수 — TTS 낭독 중 STT 완전 정지(speechSynthesis 종료 후에만 청취).
    if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
      setTimeout(convListen, 300);
      return;
    }
    if (Date.now() - convIdleAtRef.current > CONV_IDLE_MS) {
      setConvPaused(true); // 무음 2분 → 자동 대기(안내는 패널이 표시).
      return;
    }
    convFinalRef.current = null;
    setVoiceInterim("");
    voice.startListening(
      (t) => {
        convFinalRef.current = t;
      },
      { onInterim: setVoiceInterim },
    );
  }

  function startConvMode() {
    setConvMode(true);
    convActiveRef.current = true;
    setConvPaused(false);
    convIdleAtRef.current = Date.now();
    // P3 커밋1 — AI 선행 발화: 침묵을 AI 가 먼저 깬다(듣기부터 X). 현재 번호 질문을 음성+텍스트로
    //   발화한 뒤, 낭독 종료(onDone)에서 청취 재개. 첫 voice.speak 는 이 핸들러(사용자 제스처:
    //   VoiceWavePanel 대화 토글 탭) 동기 경로에서 호출 — setTimeout/async 뒤로 미루면 브라우저
    //   자동재생 정책에 막혀 소리가 안 난다. 에코가드·재청취·무음대기·종료(OFF)는 기존 재사용.
    if (voice.listening) voice.stopListening(); // 발화 전 STT 정지(에코 차단).
    // P3 커밋2 — 목적 미확정 진입이면 0단계(무엇을 만들지)부터. 확정이면 바로 번호 인터뷰 리드.
    if (!purposeIsDecided()) {
      startPurposeStage();
      return;
    }
    convLeadSpeak();
  }
  // P3 커밋2 — 목적 확정 판정: ?purpose 진입/탭 전환/0단계 선택으로 확정, 또는 이미 제작 흔적이
  //   있으면(진행 중) 확정으로 간주 → 0단계 생략(과질문 금지).
  function purposeIsDecided() {
    return (
      purposeConfirmedRef.current ||
      !!selectedVideo ||
      formProgress.nameSet ||
      formProgress.photoSet ||
      !!cfgSubtitle.trim() ||
      Object.values(applied).some(Boolean)
    );
  }
  // P3 커밋2 — 0단계 개시: AI 가 먼저 목적을 묻고 칩 노출. 발화는 자연어(①②③ 대신), 번호 선택지는
  //   칩이 담당(말/탭 병행). 첫 speak 는 startConvMode(사용자 제스처) 동기 경로 유지.
  function startPurposeStage() {
    convPurposeRef.current = true;
    setConvPurposeChips(true);
    speakConv("어떤 걸 만들까요? 정보 알리기, 예약·쿠폰, 상품 판매 중에 말씀하거나 아래 버튼을 눌러 주세요.");
  }
  // P3 커밋2 — 목적 스테이지 공용 발화(텍스트 병행 + 낭독 종료 후 재청취). 에코가드 동일.
  function speakConv(text: string) {
    chat.notify(text);
    convBusyRef.current = true;
    voice.speak(text, () => {
      convBusyRef.current = false;
      convListen();
    });
  }
  // P3 커밋2 — 발화 답 처리: 정본 매핑 → 애매면 예시로 되물음, 확정이면 pickPurpose.
  function handleSpokenPurpose(raw: string) {
    const m = mapSpokenPurpose(raw);
    if (m === "ambiguous") {
      speakConv("예를 들어 정보 알리기, 예약·쿠폰, 상품 판매처럼 말씀하거나 아래 버튼을 눌러 주세요. 어떤 걸 만들까요?");
      return;
    }
    pickPurpose(m);
  }
  // P3 커밋2 — 목적 확정(발화·칩 공용). 사업자 전용(reserve/commerce) 권한 없으면 정직 안내 후
  //   목적 스테이지 유지(재질문). 확정 시 모드 세팅(정본 전환) → "○○로 시작할게요 + 1번 질문" 발화 →
  //   번호 인터뷰 진입. 631af55: 기본 판매방식 full(공동구매는 이후 폼 신호로 분기 — 모드 아님).
  function pickPurpose(key: BuildMode) {
    if (voice.listening) voice.stopListening();
    if (key !== "general" && !isBusiness) {
      speakConv("예약·판매 카드는 사업자 인증을 받은 분만 만들 수 있어요. 지금은 정보 알리기로 만들 수 있어요. 정보로 시작할까요?");
      return; // 목적 스테이지 유지(convPurposeRef true) — 재청취.
    }
    convPurposeRef.current = false;
    setConvPurposeChips(false);
    purposeConfirmedRef.current = true;
    if (key !== mode) doSwitchMode(key);
    const first = getInterviewJourney(key, "full")[0];
    const lead = `${PURPOSE_SPEAK_LABEL[key]}로 시작할게요. ${first.no}번 ${first.label}부터 시작해 볼까요?`;
    chat.notify(lead);
    convBusyRef.current = true;
    voice.speak(lead, () => {
      convBusyRef.current = false;
      convListen();
    });
  }
  // P3 커밋1 — 현재 번호 질문 발화(창작 0 — interview-steps45 정본 인용 = 자동인사 seed 와 동일
  //   문구). 발화 동안 convBusyRef=true(재청취 금지) → 낭독 종료 후 convListen. TTS off/미지원이면
  //   speak 가 onDone 즉시 호출 → 듣기부터 시작으로 자연 degrade(계약 무변경).
  function convLeadSpeak() {
    const cur = interviewStates.find((x) => x.state === "current");
    const lead = cur
      ? `${cur.step.no}번 ${cur.step.label}부터 시작해 볼까요?`
      : "카드를 같이 완성해 볼까요? 뭐든 물어보세요.";
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== "lingo" || last.text !== lead) chat.notify(lead); // 텍스트 병행(중복 시드 방지).
    convBusyRef.current = true;
    voice.speak(lead, () => {
      convBusyRef.current = false;
      convListen();
    });
  }

  // [대화 끝내기]/패널 닫기/이탈 — STT·TTS 전체 정지(AudioContext 는 패널 언마운트가 정리).
  function endConvMode() {
    convActiveRef.current = false;
    convBusyRef.current = false;
    convFinalRef.current = null;
    convPurposeRef.current = false; // P3 커밋2 — 0단계 잔여 상태 정리(재진입 청결).
    setConvPurposeChips(false);
    setConvMode(false);
    setConvPaused(false);
    setConvPreview(null);
    voice.stopListening();
    voice.stopSpeaking();
    setVoiceOpen(false);
    setVoiceInterim("");
  }

  function resumeConvMode() {
    convIdleAtRef.current = Date.now();
    setConvPaused(false);
    convListen();
  }

  // 공통 전송(1회 모드·대화 모드 공용) — 확인어 게이트(정본 상수 + FIX-48 구두점 strip) 포함.
  async function sendChatText(text: string, channel: "text" | "voice", conv = false) {
    if (!text || chat.streaming) return;
    if (chat.proposal && LINGO_CONFIRM_WORDS.has(normalizeConfirmWord(text))) {
      const p = chat.proposal;
      consumeLingoProposal(p); // LINGO-V2b E2 — 버튼과 동일 소비 함수(재진입 가드 공유).
      if (conv && convActiveRef.current) {
        convBusyRef.current = false;
        convListen();
      }
      return;
    }
    voice.stopSpeaking(); // 새 입력 시작 = 낭독 즉시 중단.
    const finalText = await chat.send(text, channel, buildLingoContext());
    if (conv && convActiveRef.current) {
      if (finalText) {
        // 낭독 종료(onDone) 후에만 재청취 — 링고가 자기 말을 듣는 루프 금지.
        voice.speak(finalText, () => {
          convBusyRef.current = false;
          convListen();
        });
      } else {
        convBusyRef.current = false;
        convListen();
      }
    } else if (finalText) {
      voice.speak(finalText);
    }
  }

  // T5 — 전송(반이중): 낭독 중단 → 스트림 완주 → done 텍스트 낭독. 실패해도 제작 흐름 비차단.
  async function handleChatSend() {
    const text = chatInput.trim();
    if (!text || chat.streaming || voice.listening) return;
    const channel = chatChannelRef.current;
    setChatInput("");
    chatChannelRef.current = "text";
    await sendChatText(text, channel);
  }

  // T5 — 마이크(반이중): 듣기 시작 → 결과를 입력창에 채움(자동 전송 금지 — [전송]으로 확인).
  function handleMicTap() {
    if (chat.streaming) return;
    voice.stopSpeaking();
    if (voice.listening) {
      voice.stopListening();
      return;
    }
    voice.startListening((t) => {
      setChatInput(t);
      chatChannelRef.current = "voice";
    });
  }

  // FIX-43 — 캡슐 옆 마이크 orb(스트립 뷰): 탭 → 듣는 중 파형 패널로 펼침. 반이중 계약 동일
  //   (인식 텍스트 → 입력창 → 패널에서 [전송] 확인 — 자동 전송 금지). lingo-chat 계약 무변경
  //   (channel 'voice' 는 기존 onText 경로 그대로).
  function handleOrbTap() {
    if (chat.streaming) return;
    // FIX-48 — 무음 대기 중 마이크 탭 = 대화 재개("계속하려면 마이크를 눌러 주세요").
    if (convActiveRef.current && convPaused) {
      resumeConvMode();
      return;
    }
    voice.stopSpeaking();
    if (voice.listening) {
      voice.stopListening();
      setVoiceOpen(false);
      setVoiceInterim("");
      return;
    }
    setVoiceInterim("");
    setVoiceOpen(true);
    voice.startListening(
      (t) => {
        setChatInput(t);
        chatChannelRef.current = "voice";
      },
      { onInterim: setVoiceInterim },
    );
  }
  // [취소] — 인식 텍스트 폐기 + STT 즉시 종료(파형 AudioContext 는 패널 언마운트가 정리).
  //   FIX-48 — 대화 모드 중이면 전체 정지(endConvMode 동일 경로).
  function handleVoiceCancel() {
    if (convActiveRef.current) {
      endConvMode();
      return;
    }
    voice.stopListening();
    setVoiceInterim("");
    setVoiceOpen(false);
  }
  // [말 끝났어요] — 우아한 종료(stop): 최종 인식 텍스트가 onText 로 입력창에 반영된 뒤
  //   패널 뷰로 전환해 사용자가 [전송]으로 확인(기존 플로우 — 자동 전송 금지).
  function handleVoiceDone() {
    voice.finishListening();
    setVoiceOpen(false);
    setVoiceInterim("");
    openPanelAt();
  }
  // 자연 종료(말 멈춤 → 인식 엔진 스스로 종료) — 1회 모드: 패널 닫고 확인 단계(무변경).
  //   FIX-48 대화 모드: 최종 인식분 = 1초 프리뷰(오인식 방어 — 취소는 [대화 끝내기]) 후
  //   자동 전송 / 무음 세그먼트 = 재청취(무음 2분 누적 시 자동 대기).
  useEffect(() => {
    if (!voiceOpen || voice.listening) return;
    if (convActiveRef.current) {
      if (convPaused || convBusyRef.current || chat.streaming) return;
      const t = (convFinalRef.current ?? "").trim();
      convFinalRef.current = null;
      if (t) {
        convIdleAtRef.current = Date.now();
        // P3 커밋2 — 0단계(목적 선택) 답변은 서버 전송 X: 로컬 정본 매핑만(프리뷰·send 우회).
        //   handleSpokenPurpose 가 자체적으로 busy/speak/재청취를 관리(에코가드 동일).
        if (convPurposeRef.current) {
          handleSpokenPurpose(t);
          return;
        }
        convBusyRef.current = true;
        setConvPreview(t);
        const timer = setTimeout(() => {
          setConvPreview(null);
          void sendChatText(t, "voice", true);
        }, 1000);
        return () => clearTimeout(timer);
      }
      convListen();
      return;
    }
    setVoiceOpen(false);
    setVoiceInterim("");
    openPanelAt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen, voice.listening, convPaused, chat.streaming]);

  return (
    // FIX-16 — 하단 스트립 폐지: 본문 패딩은 전송 CTA 기준 원복(pb-[120px]).
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: pageBg,
        // B전환 커밋1 — 하단 스택(발행바 + 링고 독/캡슐) 위로 콘텐츠(미리보기)가 스크롤되도록 예약.
        //   펼침=발행바+독(≤34vh, B 보강 다이어트) / 접힘=발행바+캡슐(64px). 미리보기 겹침 0 유지.
        paddingBottom:
          lingoView === "panel"
            ? `calc(34vh + ${publishBarH + 16}px)`
            : `${publishBarH + 80}px`,
      }}
    >
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

      {/* FIX-48+50 — 번호 인터뷰 스텝퍼(헤더 하단 · interview-steps45 단일 정본). 3상태:
          완료 ✓(액센트 채움) / 현재 테두리+펄스(1.6s) / 대기 회색. 탭 = 해당 덱 섹션 점프. */}
      <style>{`@keyframes sl-num-pulse{0%{box-shadow:inset 0 0 0 2px ${accent},0 0 0 0 ${accent}59}70%{box-shadow:inset 0 0 0 2px ${accent},0 0 0 7px ${accent}00}100%{box-shadow:inset 0 0 0 2px ${accent},0 0 0 0 ${accent}00}}`}</style>
      <div className="border-b border-[#EDEDED] bg-white">
        <div className="mx-auto max-w-md overflow-x-auto px-3 py-2">
          <div className="flex min-w-max items-start gap-0.5">
            {interviewStates.map((x) => (
              <button
                key={x.step.key}
                type="button"
                onClick={() => {
                  if (x.step.publish)
                    document.getElementById("sl-publish-cta")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  else if (x.step.deckBlock) jumpToBlock(x.step.deckBlock);
                  else scrollToDeck();
                }}
                className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-1"
                aria-label={`${x.step.no}. ${x.step.label}${x.done ? " 완료" : x.state === "current" ? " 현재 단계" : " 대기"}`}
              >
                <span
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] font-extrabold tabular-nums"
                  style={
                    x.done
                      ? { backgroundColor: accent, color: "#fff" }
                      : x.state === "current"
                        ? { color: accent, animation: "sl-num-pulse 1.6s ease-out infinite" }
                        : { color: "#94A3B8", boxShadow: "inset 0 0 0 1.5px #E2E8F0" }
                  }
                >
                  {x.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : x.step.no}
                </span>
                <span
                  className="whitespace-nowrap text-[10px] font-semibold leading-none"
                  style={{ color: x.done ? accent : x.state === "current" ? "#0A0A0A" : "#94A3B8" }}
                >
                  {x.step.label}
                  {x.step.skippable ? " (+)" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

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
                  <span className="text-[11px] font-medium text-[#A3A3A3]">담긴 블록 없음</span>
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
        {/* FIX-35 — 제작 진행 중 모드 전환 확인(커스텀 인라인 — Radix 금지). 오터치는 여기서
            차단되고, 의도된 전환만 [바꾸기]로 진행(전체 초기화). */}
        {pendingMode && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white p-3 [box-shadow:0_0_0_1px_#EDEDED,0_8px_20px_-12px_rgba(15,23,42,0.25)]">
            <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-[#0A0A0A] [word-break:keep-all]">
              만들던 카드가 초기화돼요. 목적을 바꿀까요?
            </p>
            <button
              type="button"
              onClick={() => setPendingMode(null)}
              className="flex h-9 shrink-0 items-center rounded-lg bg-[#F4F4F5] px-3 text-[12px] font-bold text-[#525252] active:scale-95"
            >
              계속 만들기
            </button>
            <button
              type="button"
              onClick={() => {
                const next = pendingMode;
                setPendingMode(null);
                doSwitchMode(next);
              }}
              className="flex h-9 shrink-0 items-center rounded-lg px-3 text-[12px] font-bold text-white active:scale-95"
              style={{ backgroundColor: accent }}
            >
              바꾸기
            </button>
          </div>
        )}
        </div>

        {/* FIX-48+50 P1.5 커밋1f — 제2 AI 입구 잔재 제거: "AI로 카드 만들기(오픈 준비 중)" 한줄 입력
            위젯 폐지. 기능은 링고 인터뷰+setField로 구현 완료(중복 입구 · 죽은 placeholder). */}

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
            <CardModelBody
              model={cardModel}
              variant="studio"
              burstKey={burstKey}
              currentSlot={previewCurrentSlot}
            />
          </div>
        </section>

        {/* FIX-48+50 P1.5 커밋3 — 집중모드 2층: 전환력 점수·레버 스트립을 "✨ 카드 더 강하게"
            접힘 섹션으로(기본 접힘, 인라인 펼침 — Radix 금지). 용어 순화는 이 헤더 한정. */}
        <section className="mt-5">
          <button
            type="button"
            onClick={() => setFocusMoreOpen((v) => !v)}
            aria-expanded={focusMoreOpen}
            className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)] active:scale-[0.995]"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold text-[#0A0A0A]">
              <Sparkles className="h-4 w-4" strokeWidth={2.25} style={{ color: accent }} />
              카드 더 강하게
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: accent }}>
                {score}/100
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 text-[#8A8A8A] transition-transform ${focusMoreOpen ? "rotate-180" : ""}`} strokeWidth={2.5} />
          </button>
          {focusMoreOpen && (
            <div className="mt-2 rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#EDEDED,0_1px_2px_rgba(15,23,42,0.04)]">
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
            </div>
          )}
        </section>
        {/* FIX-18 — 본문 링고 코칭 카드 폐지: 티칭(lingo.text)·패널 진입은 플로팅 캡슐이
            단일 창구(캡슐 한줄 안내 + 탭=패널). 정보 소실 0 — 표면만 이동. */}
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
                {/* FIX-20 — 방향등 래퍼: 상시 유지(레이아웃 점프 0), 점등 시 회전 레이어만 렌더.
                    카드(positioned·불투명 bg)가 뒤 형제라 중앙을 덮고 패딩 2px 띠만 노출.
                    스와이프로 화면 밖이어도 lit 은 파생 상태 — 복귀 시 점등(FIX-19 계약 유지). */}
                {/* FIX-48+50 조정A — 덱 방향등(노란 회전 글로우) 렌더 제거: 지금 차례는 번호 배지로만. */}
                <div className="sl-led-wrap">
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
                      {/* FIX-48+50 — 번호 배지 맨 앞 고정(스텝퍼와 동일 26px). 충족 = ✓+번호(액센트 채움) /
                          미충족 = 번호 테두리. 붉은 [필수] 폐지 · 3상태 펄스는 상단 스텝퍼가 담당. */}
                      {(() => {
                        const bb = blockBadge(interviewJourney, block.id, interviewSignals);
                        if (!bb) return null;
                        return (
                          <span
                            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold tabular-nums"
                            style={
                              bb.done
                                ? { backgroundColor: accent, color: "#fff" }
                                : { color: accent, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                            }
                          >
                            {bb.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : bb.no}
                          </span>
                        );
                      })()}
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
                    {/* FIX-48+50 — 붉은 누락 사유 1줄 제거: 상단 번호 스텝퍼 + 발행바 회색 gateMsg 가 대체. */}
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
          {/* FIX-28 — 팔레트 패널: ENABLE_CARD_COLORS 스위치로 숨김(코드 보존 — 재도입 스위치). */}
          {ENABLE_CARD_COLORS && activeBlock.id === "bgcolor" && showColorPicker && (
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
                          아직 활성 쿠폰이 없어요 — 아래 [새 쿠폰 만들기]로 바로 만들 수 있어요.
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
                      {/* ST2b-0 — 새 쿠폰 만들기(구 studio-build 바텀시트 이식 · 인라인 펼침,
                          Radix 0). CouponManageView 무수정 임베드 — 생성 완료 시
                          router.invalidate 로 연결 목록 즉시 갱신(생성→즉시 선택 가능). */}
                      <button
                        type="button"
                        onClick={() => setCouponMakeOpen((v) => !v)}
                        className="flex w-full items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-left"
                      >
                        <Plus className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                        <span className="flex-1 text-[13px] font-semibold text-[#0A0A0A]">
                          새 쿠폰 만들기
                        </span>
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-[#8A8A8A] transition-transform"
                          style={{ transform: couponMakeOpen ? "rotate(180deg)" : "none" }}
                          strokeWidth={2.25}
                        />
                      </button>
                      {couponMakeOpen && (
                        <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-[#F7F7F8] p-3 [scrollbar-width:thin]">
                          <CouponManageView
                            partnerId={store?.id ?? null}
                            coupons={manageCoupons}
                            onChanged={async () => {
                              await router.invalidate();
                            }}
                          />
                        </div>
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
                    onProgress={handleFormProgress}
                    // FIX-48+50 P2 — 링고 인터뷰 setField 브리지(상품 필드 부착·검증·prev 회신).
                    fieldPatch={productFieldPatch ?? undefined}
                    onFieldPatchResult={handleFieldPatchResult}
                    // FIX-37 — 고시표 소비자상담 전화 자동 채움(partners.contact_phone 읽기전용).
                    contactPhone={store?.contact_phone ?? null}
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
                        id="st45-video-query"
                        value={videoQuery}
                        onChange={(e) => setVideoQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            void handleVideoSearch();
                          }
                        }}
                        placeholder="영상 키워드·주소 검색 (YouTube)"
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
                    {/* FIX-44 — 영상 서치 도우미(B안): [영상 찾기] → 매장명 기본 채움(DB 검증
                        display_name만 — 키워드 창작 금지) → Edge youtube-search 후보 3~5 →
                        아래 기존 후보 카드·[이 영상으로 확정] 체인 그대로(자동 장착 0 —
                        선택 전까지 덱 무변경). 인라인 펼침(Radix 0). */}
                    <button
                      type="button"
                      onClick={() =>
                        setFinderOpen((v) => {
                          const next = !v;
                          if (next && !finderQuery.trim() && storeName) setFinderQuery(storeName);
                          return next;
                        })
                      }
                      className="flex w-full items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-left"
                    >
                      <Clapperboard className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                      <span className="flex-1 text-[13px] font-semibold text-[#0A0A0A]">영상 찾기</span>
                      <span className="text-[10.5px] font-medium text-[#8A8A8A]">매장 영상 검색</span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-[#8A8A8A] transition-transform"
                        style={{ transform: finderOpen ? "rotate(180deg)" : "none" }}
                        strokeWidth={2.25}
                      />
                    </button>
                    {finderOpen && (
                      <div className="space-y-1.5 rounded-xl bg-[#F7F7F8] p-2.5">
                        <div
                          className="flex items-center gap-1.5 rounded-xl bg-white py-1.5 pl-3 pr-1.5"
                          style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                        >
                          <input
                            value={finderQuery}
                            onChange={(e) => setFinderQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                void handleFinderSearch();
                              }
                            }}
                            placeholder="매장명으로 영상을 찾아요"
                            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:text-[#9A9A9A]"
                          />
                          <button
                            type="button"
                            onClick={() => void handleFinderSearch()}
                            disabled={finderLoading || !finderQuery.trim()}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40"
                            style={{ backgroundColor: accent }}
                            aria-label="영상 찾기 검색"
                          >
                            {finderLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                            ) : (
                              <Search className="h-4 w-4" strokeWidth={2.5} />
                            )}
                          </button>
                        </div>
                        <p className="text-[10.5px] font-medium text-[#A3A3A3] [word-break:keep-all]">
                          후보 중에서 고른 뒤 [이 영상으로 확정]을 눌러야 카드에 담겨요.
                        </p>
                        {finderNotice && (
                          <p className="rounded-lg bg-white px-2.5 py-2 text-[11.5px] font-medium leading-relaxed text-[#525252] [word-break:keep-all]">
                            {finderNotice}
                          </p>
                        )}
                      </div>
                    )}
                    {/* FIX-38 B — 영상 출처 [AI로 만들기] 진입점: 노출은 하되 누르면 준비 중
                        정직 게이트(인라인 펼침 — Radix 아님). 가격·캐시 숫자 절대 미표기.
                        "준비 중" 칩 = 기존 게이트 배지 문법(:2225) 재사용. */}
                    <button
                      type="button"
                      onClick={() => setAiVideoGateOpen((v) => !v)}
                      className="flex w-full items-center gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-left"
                    >
                      <Clapperboard
                        className="h-4 w-4 shrink-0 text-[#8A8A8A]"
                        strokeWidth={2.25}
                      />
                      <span className="flex-1 text-[13px] font-semibold text-[#0A0A0A]">
                        AI로 만들기
                      </span>
                      <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-bold text-[#64748B]">
                        준비 중
                      </span>
                    </button>
                    {aiVideoGateOpen && (
                      <p className="rounded-xl bg-[#F7F7F8] px-3 py-2.5 text-[11px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
                        AI 영상 제작은 준비 중이에요. 지금은 사진이나 영상 링크로 만들 수 있어요.
                      </p>
                    )}
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
                    {/* FIX-27 — 핵심구간 표준 선택확정(FIX-1/4 동형): 초안(시작·끝·문구) →
                        [구간 적용] → 요약행 + [변경]. 확정값만 미리보기·발행 payload 에 결합. */}
                    {confirmedClip && collapsedPanels["clip"] ? (
                      <AppliedRow
                        accent={accent}
                        label={`적용됨 · 핵심구간 ${confirmedClip.label}${confirmedClip.note ? ` · '${confirmedClip.note}'` : ""}`}
                        onEdit={() => setCollapsedPanels((p) => ({ ...p, clip: false }))}
                      />
                    ) : (
                      <div className="space-y-2 rounded-xl bg-[#F4F4F5] p-3">
                        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#525252]">
                          <Video className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                          핵심 구간 (시작~끝)
                        </p>
                        {/* FIX-32 — 타이핑 제거: 영상 길이를 알면 범위 슬라이더(놓을 때 5초
                            스냅) + ±5초 미세조정, 불명이면 스텝퍼 폴백. 클램프는 stepClip/
                            슬라이더가 담당(끝-5초 ≤ 시작 불가). */}
                        {clipDurSec != null && clipDurSec >= 10 ? (
                          <>
                            <ClipRangeSlider
                              durSec={clipDurSec}
                              startSec={clipSel.start}
                              endSec={clipSel.end}
                              accent={accent}
                              onChange={(s, e2) => setClipSel({ start: s, end: e2 })}
                            />
                            <p className="text-center text-[13px] font-bold tabular-nums text-[#0A0A0A]">
                              {formatDuration(clipSel.start)} ~ {formatDuration(clipSel.end)}
                              <span className="ml-1 font-semibold text-[#8A8A8A]">· 구간 {clipSel.end - clipSel.start}초</span>
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1">
                                <span className="text-[11px] font-semibold text-[#8A8A8A]">시작</span>
                                <HoldButton label="−5초" onStep={() => stepClip("start", -5)} />
                                <HoldButton label="+5초" onStep={() => stepClip("start", 5)} />
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-[11px] font-semibold text-[#8A8A8A]">끝</span>
                                <HoldButton label="−5초" onStep={() => stepClip("end", -5)} />
                                <HoldButton label="+5초" onStep={() => stepClip("end", 5)} />
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="w-7 shrink-0 text-[11px] font-semibold text-[#8A8A8A]">시작</span>
                              <HoldButton label="−30" onStep={() => stepClip("start", -30)} />
                              <HoldButton label="−5" onStep={() => stepClip("start", -5)} />
                              <span className="flex-1 text-center text-[13px] font-bold tabular-nums text-[#0A0A0A]">
                                {formatDuration(clipSel.start)}
                              </span>
                              <HoldButton label="+5" onStep={() => stepClip("start", 5)} />
                              <HoldButton label="+30" onStep={() => stepClip("start", 30)} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-7 shrink-0 text-[11px] font-semibold text-[#8A8A8A]">끝</span>
                              <HoldButton label="−30" onStep={() => stepClip("end", -30)} />
                              <HoldButton label="−5" onStep={() => stepClip("end", -5)} />
                              <span className="flex-1 text-center text-[13px] font-bold tabular-nums text-[#0A0A0A]">
                                {formatDuration(clipSel.end)}
                              </span>
                              <HoldButton label="+5" onStep={() => stepClip("end", 5)} />
                              <HoldButton label="+30" onStep={() => stepClip("end", 30)} />
                            </div>
                            <p className="text-center text-[12px] font-semibold tabular-nums text-[#8A8A8A]">
                              {formatDuration(clipSel.start)} ~ {formatDuration(clipSel.end)} · 구간 {clipSel.end - clipSel.start}초
                            </p>
                          </>
                        )}
                        <input
                          value={clipDraftNote}
                          onChange={(e) => setClipDraftNote(e.target.value)}
                          placeholder="구간 문구 (선택) — 예: 여기가 하이라이트"
                          className="w-full rounded-lg bg-white px-3 py-2 text-[12px] font-medium text-[#0A0A0A] outline-none placeholder:text-[#B4B4B4]"
                          style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                        />
                        {clipError && <p className="text-[11px] font-medium text-[#DC2626]">{clipError}</p>}
                        <button
                          type="button"
                          onClick={applyClip}
                          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-white text-[12px] font-bold text-[#0A0A0A] [box-shadow:inset_0_0_0_1px_#E5E5E5] active:translate-y-px"
                        >
                          <Check className="h-4 w-4" strokeWidth={2.5} style={{ color: accent }} />
                          구간 적용
                        </button>
                      </div>
                    )}

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
                    {/* FIX-37 — partners 실존 데이터 요약(매장명·주소·연락처). 없는 필드 미렌더
                        (placeholder 창작 금지). link 블록은 예약·커머스 두 덱(DECK_IDS)에 모두
                        포함된 공용 패널 — 중복 구현 없이 이 1곳에서 양 모드를 함께 충족. */}
                    {store && (store.display_name || store.address || store.contact_phone) && (
                      <div className="space-y-1 rounded-xl bg-[#F4F4F5] p-3">
                        {[
                          { k: "매장명", v: store.display_name },
                          { k: "주소", v: store.address },
                          { k: "연락처", v: store.contact_phone },
                        ]
                          .filter((r) => !!r.v && r.v.trim().length > 0)
                          .map((r) => (
                            <p key={r.k} className="flex gap-2 text-[12px]">
                              <span className="w-12 shrink-0 font-semibold text-[#8A8A8A]">
                                {r.k}
                              </span>
                              <span className="min-w-0 flex-1 font-semibold text-[#0A0A0A]">
                                {r.v}
                              </span>
                            </p>
                          ))}
                      </div>
                    )}
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

      {/* 카드 드롭하기 (고정 CTA) — B전환: 링고 독/캡슐은 이 발행바 위에 스택(publishBarH 실측). */}
      <div ref={publishBarRef} className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EDEDED] pb-[env(safe-area-inset-bottom)]" style={{ backgroundColor: pageBg }}>
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
              <>
                {/* FIX-28 — 게시 게이트: 필수패키지 미완이면 비활성 + 사유 1줄(첫 미완 항목).
                    방향등은 currentTarget 이 같은 항목을 이미 가리킴(단일 기준).
                    FIX-42 — 잠금 클릭 시도 = 링고 능동 안내 트리거 ①: disabled 버튼은 클릭이
                    죽으므로 pointer-events-none + 래퍼 onClick 으로 시도를 감지(게이트 무변경). */}
                <div
                  id="sl-publish-cta"
                  onClick={() => {
                    if (!canPublish) handleGateBlockedClick();
                  }}
                >
                  <button
                    type="button"
                    disabled={!canPublish}
                    onClick={() => setMirrorOpen(true)}
                    className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[14px] font-bold tracking-[-0.01em] text-white transition-all duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100"
                    style={{ backgroundColor: accent, boxShadow: canPublish ? `0 6px 18px -8px ${accent}80` : "none" }}
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <Send className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.25} />
                    발행하기
                  </button>
                </div>
                {!canPublish && gateMsg && (
                  <p className="text-center text-[11px] font-medium text-[#8A8A8A]">{gateMsg}</p>
                )}
              </>
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
              {/* FIX-28 — 거울 시트 게시 CTA 도 동일 게이트(미리보기는 허용, 게시만 잠금). */}
              {!canPublish && gateMsg && (
                <p className="mb-2 text-center text-[11px] font-medium text-[#8A8A8A]">{gateMsg}</p>
              )}
              <button
                type="button"
                disabled={saving || !canPublish}
                onClick={() => {
                  void handlePublish().then((ok) => {
                    if (ok) setMirrorOpen(false);
                  });
                }}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: accent, boxShadow: `0 10px 30px -8px ${accent}80` }}
              >
                {saving ? <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.25} /> : <Send className="h-[18px] w-[18px]" strokeWidth={2.25} />}
                {saving ? "발행 중…" : "발행하기"}
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
              {/* B전환 커밋1 — 펼침 = 하단 고정 독(dock). 부유 패널·백드롭·⠿ 드래그·fabPos 위치계산
                  전량 폐기(스튜디오 한정). 화면 하단 고정, 위 영역(스텝퍼+미리보기)은 그대로 노출.
                  내부 스크롤(대화가 길어져도 독 높이 ≤52vh). 접기=헤더 ChevronDown(백드롭 클릭 없음).
                  시안 정본 .lingo: 흰 배경·상단 보더 #E3E1DA·상단 그림자·라운드 18px 상단만. */}
              <div className="sl-slide-up fixed inset-x-0 z-40" style={{ bottom: publishBarH }}>
                <div className="mx-auto w-full max-w-md rounded-t-[18px] border-t border-[#E3E1DA] bg-white [box-shadow:0_-3px_12px_rgba(0,0,0,0.05)]">
                  {/* B 보강 — 독 높이 다이어트: 콘텐츠 기반 + 상한 34vh(화면 1/3 초과 금지). 초과분은
                      이 컨테이너 내부 스크롤. 상하 패딩 8pt 그리드 최소(pt-2/pb-3). */}
                  <div className="relative max-h-[34vh] overflow-y-auto px-4 pb-3 pt-2">
                  {/* 독 헤더 — 번호 배지(펄스)+지금 N번 라벨+스피커 토글(드래그 폐기 → 정적 행). */}
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
                      <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
                      <Sparkles className="absolute -right-0.5 -top-0.5 h-[11px] w-[11px]" strokeWidth={2.5} fill="currentColor" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold leading-tight text-[#0A0A0A]">링고AI</p>
                      {/* FIX-48+50 P1.5 커밋1g — 현재 번호 = 원형 배지(펄스) + 라벨(정본 인용, 창작 0). */}
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {chat.streaming ? (
                          <span className="text-[11px] font-medium text-[#9A9A9A]">생각 중…</span>
                        ) : voice.speaking ? (
                          <span className="text-[11px] font-medium text-[#9A9A9A]">말하는 중…</span>
                        ) : interviewCurrent ? (
                          <>
                            {renderNumBadge(interviewCurrent.step.no)}
                            <span className="truncate text-[12px] font-bold text-[#0A0A0A]">{interviewCurrent.step.label}</span>
                          </>
                        ) : (
                          <span className="text-[11px] font-medium text-[#9A9A9A]">전환 코칭 · 대화 — 무엇이든 물어보세요</span>
                        )}
                      </div>
                    </div>
                    {/* B-lite 작업10 — 스피커 헤더 토글(공용 부품, 입력줄 낭독 pill 대체). 드래그 제외. */}
                    <span className="flex items-center" onPointerDown={(e) => e.stopPropagation()}>
                      <SpeakerToggle ttsOn={voice.ttsOn} speaking={voice.speaking} onToggle={voice.toggleTts} accent={accent} />
                    </span>
                    {/* FIX-48+50 P1.5 — 링고 단일 박스: 접힘(캡슐)↔펼침(패널) 2상태만. 완전닫기(closed
                        점) 폐지 → 접기(캡슐)로 일원화(별도 플로팅 개체 0). */}
                    <button
                      type="button"
                      aria-label="캡슐로 접기"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setLingoView("strip")}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] transition-transform active:scale-90"
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* 정적 가이드 문구(규칙 기반 코칭) — FIX-16: 비동기/플래시도 여기서 갱신.
                      B 보강 — 패딩 다이어트(p-3.5→p-3, mt-3→mt-2) 독 총높이 축소. */}
                  <div className="mt-2 rounded-2xl bg-[#F7F7F8] p-3">
                    <p className="flex items-start gap-1.5 text-pretty text-[13px] font-medium leading-relaxed text-[#404040] [word-break:keep-all]">
                      {stripBusy ? (
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={2.5} style={{ color: accent }} />
                      ) : (
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A3A3A3]" strokeWidth={2.5} fill="currentColor" />
                      )}
                      <span>{stripBusy ?? stripFlash ?? lingo.text}</span>
                    </p>
                    {/* FIX-48+50 P1.5 커밋1d — 코치 = 안내 1문장 기본. 왜/효과 부가설명은 "왜요?" 인라인
                        펼침(문구 무변경 — 접힘만). {N}=실보유 숫자 치환(진실 경계) 유지. */}
                    {!stripBusy && !dropped && currentCoachKey && COACH_NOTES[currentCoachKey] && (
                      <div className="mt-2 space-y-0.5 text-[12px] font-medium leading-relaxed text-[#6B6B6B] [word-break:keep-all]">
                        <button
                          type="button"
                          onClick={() => setCoachWhyOpen((v) => !v)}
                          aria-expanded={coachWhyOpen}
                          className="flex items-center gap-1 text-[11px] font-bold" style={{ color: accent }}
                        >
                          왜요?
                          <ChevronDown className={`h-3 w-3 transition-transform ${coachWhyOpen ? "rotate-180" : ""}`} strokeWidth={2.5} />
                        </button>
                        {coachWhyOpen && <p>왜 좋냐면: {COACH_NOTES[currentCoachKey].why}</p>}
                        {coachWhyOpen && <p>{coachEffect(currentCoachKey)}</p>}
                        {/* FIX-33 — 도킹 단계(비필수) 건너뛰기: 캡슐 칩이 닫힌 상태(블록만 장착
                            후 미연결 등)에서도 항상 도달 가능한 두 번째 창구. */}
                        {currentCoachKey === "dock" && !dockSkipped && dockedProducts.length === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setDockSkipped(true);
                              setSuggestVisible(false);
                              flashStrip("도킹은 건너뛰었어요 — 발행으로 마무리해요");
                            }}
                            className="mt-1 flex h-8 items-center rounded-lg bg-white px-2.5 text-[11px] font-bold text-[#525252] [box-shadow:inset_0_0_0_1px_#E5E5E5] active:scale-95"
                          >
                            이번엔 건너뛰기
                          </button>
                        )}
                        {/* FIX-44 — 콘텐츠 단계 제안(B안 — 정본 상수 문법 · lingo-chat 호출 0):
                            상시 층 1줄 + [영상 찾기] 열기. 영상 확정 시 소멸 — 무시 시 침묵(§13,
                            FIX-33 dock 버튼 문법 동형 — 재발화·재촉 없음). */}
                        {currentCoachKey === "content" && !selectedVideo && (
                          <>
                            <p>매장 영상을 찾아볼까요?</p>
                            <button
                              type="button"
                              onClick={() => {
                                jumpToBlock("content");
                                if (!finderQuery.trim() && storeName) setFinderQuery(storeName);
                                setFinderOpen(true);
                              }}
                              className="mt-1 flex h-8 items-center rounded-lg bg-white px-2.5 text-[11px] font-bold text-[#525252] [box-shadow:inset_0_0_0_1px_#E5E5E5] active:scale-95"
                            >
                              영상 찾기
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {/* FIX-29 — 게시 마무리 코칭: 장착·확정된 항목 상위 3개의 effect 요약(사실 기반). */}
                    {dropped && finishCoach.length > 0 && (
                      <div className="mt-2.5 border-t border-[#ECECEE] pt-2.5">
                        <p className="text-[12px] font-bold text-[#404040]">이 카드가 잘 되는 이유</p>
                        <ul className="mt-1 space-y-0.5">
                          {finishCoach.map((f) => (
                            <li key={f.key} className="text-[12px] font-medium leading-relaxed text-[#6B6B6B] [word-break:keep-all]">
                              {f.label} — {coachEffect(f.key)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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

                  {/* FIX-48+50 P1.5 — 중복 "바로 장착" 대형 CTA 제거: 장착 기능은 행동 칩("블록 담기"→덱)
                      + 캡슐 접힘 시 [장착] 제안 칩으로 일원화(코치 칩과 기능 중복 해소). */}

                  {/* T5 — 링고 대화 실배선: 말풍선 리스트(가이드 아래 공존, 내부 스크롤) + 입력행
                      (텍스트·낭독 토글·마이크·전송/중지). 반이중 — 스트리밍/듣기 중 입력 잠금,
                      [중지] = 스트림 abort. 대화 실패해도 제작 흐름은 차단하지 않는다. */}
                  <div className="mt-3">
                    {chat.messages.length > 0 && (
                      <div
                        ref={chatListRef}
                        // B 보강 — 대화 스트림 = 최신 발화(AI 1 + 사용자 직전 1, 약 2~3 말풍선)만 시야.
                        //   이전 기록은 이 영역 내부 스크롤(위로 당겨 열람). 새 발화 시 하단 자동 고정.
                        className="max-h-[124px] space-y-2 overflow-y-auto rounded-2xl bg-[#FAFAFA] p-2.5 [box-shadow:inset_0_0_0_1px_#EFEFEF]"
                      >
                        {chat.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <p
                              className={`max-h-[22vh] max-w-[85%] overflow-y-auto whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] font-medium leading-relaxed [word-break:keep-all] ${
                                m.role === "user"
                                  ? "rounded-br-md text-white"
                                  : "rounded-bl-md bg-white text-[#404040] [box-shadow:inset_0_0_0_1px_#ECECEE]"
                              }`}
                              style={m.role === "user" ? { backgroundColor: accent } : undefined}
                            >
                              {m.text ||
                                (m.streaming ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} style={{ color: accent }} />
                                ) : null)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* FIX-47 — 인앱 WebView 음성 게이트 안내 1줄(카톡 = 락 문구 원문 · 기타
                        인앱 = 동일 톤 일반형). 텍스트 대화는 그대로 — 음성만 게이트. */}
                    {inAppNoMic && (
                      <p className="mt-1.5 px-1 text-[11px] font-medium text-[#8A8A8A] [word-break:keep-all]">
                        {inAppNoMic === "kakao"
                          ? "카카오톡 브라우저에서는 음성을 쓸 수 없어요. 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 누르면 쓸 수 있어요"
                          : "앱 속 브라우저에서는 음성을 쓸 수 없어요 — 크롬·삼성인터넷으로 열면 쓸 수 있어요"}
                      </p>
                    )}
                    {/* 음성 상태 1줄 — 미지원·인식 폴백 안내 / 듣는 중 / 말하는 중 (일반 톤). */}
                    {(voice.notice || voice.listening || voice.speaking) && (
                      <p className="mt-1.5 px-1 text-[11px] font-medium text-[#8A8A8A]">
                        {voice.notice ??
                          (voice.listening
                            ? "듣고 있어요 — 끝나면 입력창에 채워드려요"
                            : "말하는 중이에요 — 새로 입력하면 멈춰요")}
                      </p>
                    )}
                    {/* LINGO-V2 — 액션 제안 카드(확인 게이트): 제안 발화는 위 delta 말풍선
                        그대로(재작성 0) — 카드는 액션 실값 요약 + [적용]/[안 할래요]만.
                        확인어("확인"/"응"/"좋아"/"해줘") 입력·음성도 [적용]과 동일 판정
                        (handleChatSend 게이트). 거절 = 조용히 닫기(재제안 금지는 서버 §13). */}
                    {chat.proposal && !chat.streaming && (
                      <div className="mt-2 rounded-xl bg-white p-2.5 [box-shadow:inset_0_0_0_1px_#ECECEE]">
                        <p className="text-[11px] font-bold text-[#525252]">
                          카드에 이렇게 반영할까요?
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {chat.proposal.actions.map((a, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-[#F4F4F5] px-2 py-1 text-[11px] font-semibold text-[#404040]"
                            >
                              {lingoActionLabel(a)}
                            </span>
                          ))}
                        </div>
                        {chat.proposal.steps.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {chat.proposal.steps.map((s, i) => (
                              <li
                                key={i}
                                className="text-[10.5px] font-medium text-[#8A8A8A] [word-break:keep-all]"
                              >
                                {i + 1}. {s.label}
                                {s.note ? ` — ${s.note}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                        {/* LINGO-V2b B3 — 확인 방법 힌트(§13 톤 — 사실 안내 1줄). */}
                        <p className="mt-1.5 text-[10.5px] font-medium text-[#A3A3A3] [word-break:keep-all]">
                          적용하려면 [적용]을 누르거나 &ldquo;확인&rdquo;이라고 답해 주세요.
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              // LINGO-V2b E2 — 소비는 동기 ref 가드 함수로(연타 이중 적용 방지).
                              const p = chat.proposal;
                              if (p) consumeLingoProposal(p);
                            }}
                            className="flex h-9 flex-1 items-center justify-center rounded-lg text-[12px] font-bold text-white active:translate-y-px"
                            style={{ backgroundColor: accent }}
                          >
                            적용
                          </button>
                          <button
                            type="button"
                            onClick={() => chat.clearProposal()}
                            className="flex h-9 flex-1 items-center justify-center rounded-lg bg-[#F4F4F5] text-[12px] font-bold text-[#525252]"
                          >
                            안 할래요
                          </button>
                        </div>
                      </div>
                    )}
                    {/* LINGO-V2 — 되돌리기 1단계(가역 보장): 마지막 적용 스냅샷 복원. */}
                    {lingoActUndo && !chat.proposal && (
                      <button
                        type="button"
                        onClick={undoLingoActions}
                        className="mt-1.5 flex h-8 items-center rounded-lg bg-white px-2.5 text-[11px] font-bold text-[#525252] [box-shadow:inset_0_0_0_1px_#E5E5E5] active:scale-95"
                      >
                        방금 적용 되돌리기
                      </button>
                    )}
                    {/* FIX-48+50 P1.5 커밋1c — 마이크 A안: 56px VoiceOrb 주 버튼(오른쪽 크게) +
                        텍스트 입력칸(왼쪽 보조 pill: 입력·낭독·전송). !inAppNoMic 게이트 유지. */}
                    <div className="mt-2 flex items-end gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-[#F4F4F5] py-1.5 pl-4 pr-1.5">
                        <input
                          value={chatInput}
                          maxLength={2000}
                          disabled={chat.streaming || voice.listening}
                          placeholder={chat.streaming ? "링고가 생각 중…" : "링고AI에게 물어보기"}
                          onChange={(e) => {
                            setChatInput(e.target.value);
                            chatChannelRef.current = "text"; // 손으로 고치면 텍스트 채널로 복귀.
                          }}
                          onFocus={() => voice.stopSpeaking()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              void handleChatSend();
                            }
                          }}
                          className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#9A9A9A] disabled:opacity-60"
                        />
                        {/* B-lite 작업10 — 낭독 pill 제거(헤더 스피커 토글로 이동). */}
                        {chat.streaming ? (
                          <button
                            type="button"
                            aria-label="응답 중지"
                            onClick={chat.stop}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#404040] text-white active:scale-95"
                          >
                            <Square className="h-3.5 w-3.5" strokeWidth={2.5} fill="currentColor" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            aria-label="전송"
                            onClick={() => void handleChatSend()}
                            disabled={!chatInput.trim() || voice.listening}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white active:scale-95 disabled:opacity-40"
                            style={{ backgroundColor: accent }}
                          >
                            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                      {/* FIX-47 게이트 유지 — 인앱 WebView 는 마이크 미렌더(권한 루프 차단).
                          B-lite 작업11 — 슬라이드 레일(ON/OFF 각인). handleMicTap 시작/종료 재사용. */}
                      {!inAppNoMic && (
                        <SlideToMic
                          listening={voice.listening}
                          disabled={chat.streaming}
                          accent={accent}
                          onStart={() => { if (!voice.listening) handleMicTap(); }}
                          onStop={() => { if (voice.listening) handleMicTap(); }}
                        />
                      )}
                    </div>
                  </div>

                  {/* FIX-48+50 P1.5 커밋1d — 행동 칩 = 최대 2개(담기·편집) + 되돌리기(undo 가능 시에만 렌더). */}
                  {(() => {
                  const tools = [
                    { key: "add", icon: Plus, label: "블록 담기", onClick: () => { scrollToDeck(); setLingoView("strip"); }, disabled: false },
                    { key: "edit", icon: Pencil, label: "내용 편집", onClick: lingoEdit, disabled: !canEdit },
                  ];
                  if (lastEquipped || lingoActUndo) {
                    tools.push({ key: "undo", icon: Undo2, label: "되돌리기", onClick: lingoUndo, disabled: false });
                  }
                  return (
                  <div className="mt-2.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}>
                    {tools.map((tool) => {
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
                  );
                  })()}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* B전환 커밋1 — 접힘 = 하단 고정 캡슐(부유·드래그·⠿·fabPos·엣지스냅 폐기). 아바타/번호
              배지 + 한줄 안내(truncate) + 제안 칩 + 마이크 레일. 탭 = 하단 독 펼침.
              FIX-43 — 듣는 중: 파형 패널(VoiceWavePanel45)로 교체(발행바 위 동일 고정 위치). */}
          {lingoView === "strip" && !mirrorOpen && voiceOpen && (
            <div className="fixed inset-x-0 z-40 flex justify-center px-3 pb-3" style={{ bottom: publishBarH }}>
              {/* B전환 커밋1 — 듣는 중 파형 패널도 하단 중앙 고정(발행바 위 스택, fabPos 폐기). */}
              <VoiceWavePanel45
                listening={voice.listening}
                interimText={voiceInterim}
                accent={accent}
                onCancel={handleVoiceCancel}
                onDone={handleVoiceDone}
                // FIX-48 — 연속 대화 모드(인앱 게이트 환경은 orb 미렌더라 진입 불가 — 토글도
                //   이중 가드 미노출).
                convMode={convMode}
                speaking={voice.speaking}
                paused={convPaused}
                previewText={convPreview}
                onToggleConv={inAppNoMic ? undefined : startConvMode}
                onEndConv={endConvMode}
                onResume={resumeConvMode}
                // P3 커밋2 — 0단계 목적 칩(말/탭 병행). 사업자 아님이면 예약·판매는 잠금 안내로 흡수되나
                //   칩은 3종 노출(탭 시 pickPurpose 가 권한 정직 안내). 정본 라벨(①②③)만.
                purposeChoices={
                  convPurposeChips
                    ? [
                        { key: "general", label: "① 정보 알리기", onPick: () => pickPurpose("general") },
                        { key: "reserve", label: "② 예약·쿠폰", onPick: () => pickPurpose("reserve") },
                        { key: "commerce", label: "③ 상품 판매", onPick: () => pickPurpose("commerce") },
                      ]
                    : undefined
                }
              />
            </div>
          )}
          {lingoView === "strip" && !mirrorOpen && !voiceOpen && (
            <div
              role="button"
              tabIndex={0}
              aria-label="링고AI — 탭하면 대화 독이 열려요"
              onClick={() => openPanelAt()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openPanelAt();
                }
              }}
              className="fixed inset-x-0 z-40 mx-auto flex h-[64px] w-full max-w-md cursor-pointer select-none items-center gap-2 rounded-t-[18px] border-t border-[#E3E1DA] bg-white px-3.5 [box-shadow:0_-3px_12px_rgba(0,0,0,0.05)]"
              style={{ bottom: publishBarH }}
            >
              {/* B전환 커밋1 — 접힘 = 하단 고정 캡슐(부유·드래그·⠿·fabPos 폐기). 탭=독 펼침. 마이크
                  레일 유지. 우측 칩/마이크는 stopPropagation 으로 바 탭(펼침)과 분리. */}
              {/* FIX-48+50 P1.5 커밋1g — 캡슐 아바타 자리에 현재 번호 배지(패널과 동일 배지·펄스로 통일).
                  busy=스피너 / 현재 단계 있음=번호 배지 / 없음(완주)=기존 아바타. */}
              {stripBusy ? (
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} style={{ color: accent }} />
                </span>
              ) : interviewCurrent ? (
                renderNumBadge(interviewCurrent.step.no)
              ) : (
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#525252]">
                  <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
                  <Sparkles className="absolute -right-0.5 -top-0.5 h-[9px] w-[9px]" strokeWidth={2.5} fill="currentColor" />
                </span>
              )}
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold leading-tight text-[#0A0A0A]">
                  {/* FIX-18→23→28→31 — 필수 구간 = step.teach / 권장 구간 = 제안 문구(칩 노출 시) /
                      필수 전부 충족 = "이제 발행할 수 있어요" 전환. 발행 완료 후 전송(카톡)은 별개 단계. */}
                  {stripBusy ??
                    stripFlash ??
                    (dropped
                      ? "발행 완료!"
                      : showSuggest && suggestion
                        ? lingo.text
                        : readyToSend
                          ? "이제 발행할 수 있어요"
                          : lingo.text)}
                </span>
              </span>
              {/* FIX-48+50 P1.5 커밋1d — 캡슐 점 진행표시·"계속" 버튼 삭제(진행=화면 스텝퍼 단독).
                  제안 칩([장착]/[연결하기])만 조건부 유지(현재 단계 맞춤). */}
              {showSuggest && suggestion && (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const idx = DECK.findIndex((b) => b.id === suggestion.id);
                      if (idx >= 0) setDeckIndex(idx);
                      equip(suggestion);
                      // FIX-19 — 장착 즉시 소등(flash 가 showSuggest 를 끔) → flash 종료 후
                      //   재계산된 다음 제안으로 점등 이동(suggestVisible 유지). 없으면 그대로 소등.
                      flashStrip(
                        suggestion.id === "dock"
                          ? "함께 보낼 카드를 골라 연결해요"
                          : `+${suggestion.power}점! ${suggestion.label} 장착됐어요`,
                      );
                    }}
                    className="relative flex h-8 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold text-white active:scale-95"
                    style={{ backgroundColor: accent }}
                  >
                    {suggestion.id === "dock" ? "연결하기" : "장착"}
                  </button>
                  {/* FIX-28 — 필수는 거절(쿨다운) 불가: X 는 권장 제안에서만.
                      FIX-33 — 도킹(정식 단계·비필수)은 X 대신 [건너뛰기]: 단계 done 처리 →
                      다음 단계(발행)로 진행. 건너뛴 뒤 덱에서 수동 연결해도 done 유지. */}
                  {!firstRequiredStep &&
                    (suggestion.id === "dock" ? (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDockSkipped(true);
                          setSuggestVisible(false);
                          flashStrip("도킹은 건너뛰었어요 — 발행으로 마무리해요");
                        }}
                        className="relative flex h-8 shrink-0 items-center rounded-full bg-[#F4F4F5] px-2.5 text-[11px] font-bold text-[#737373] active:scale-95"
                      >
                        건너뛰기
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="제안 닫기"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissedSuggests((d) => [...d, suggestion.id]);
                          setSuggestVisible(false);
                        }}
                        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] active:scale-95"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    ))}
                </>
              )}
              {/* FIX-48+50 P1.5 커밋1c — 캡슐 오른쪽 끝 56px 마이크 상시 노출. 탭=패널 펼침+즉시 듣기.
                  드래그와 분리(stopPropagation) — 캡슐 이동 중에도 마이크 탭 가능. */}
              {!inAppNoMic && (
                <SlideToMic
                  listening={voice.listening}
                  disabled={chat.streaming}
                  accent={accent}
                  onStart={() => { openPanelAt(); if (!voice.listening) handleMicTap(); }}
                  onStop={() => { if (voice.listening) handleMicTap(); }}
                />
              )}
            </div>
          )}

          {/* FIX-48+50 P1.5 — 최소화(closed 아바타 점) 상태 폐지: 링고 박스는 캡슐(접힘)↔패널(펼침)
              2상태만. 캡슐이 곧 최소 상태 — 별도 플로팅 점 개체 제거(closed·캡슐 동시 표시 조합 0). */}
        </>
      )}
    </div>
  );
}
