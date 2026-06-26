import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { getAuthClient } from "@/lib/auth-context";
import { YouTubeLiteEmbed } from "@/components/receiver/youtube-lite-embed";
import { CouponPreview } from "@/components/receiver/CouponPreview";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { CouponManageView, type CouponRow } from "@/routes/_partner/partner.coupons";
import { PartnerCalendarPage } from "@/components/partner/PartnerCalendarPage";
import type { DiscoverCandidate } from "@/components/explore/DiscoverSection";
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
  Store,
  X,
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
  MapPin,
  ExternalLink,
} from "lucide-react";

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

// 영상 슬롯 데이터 형태 — YouTubeLiteEmbed 시그니처. selectedVideo state 가 보유.
type VideoSlot = {
  videoId: string;
  thumbnailUrl: string;
  title: string;
  isShorts: boolean;
  durationLabel?: string;
  sourceLabel?: string;
};

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
    thumbnailUrl: c.source_id ? `https://i.ytimg.com/vi/${c.source_id}/mqdefault.jpg` : (c.thumbnail_url ?? ""),
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
    detail: "고객이 카드 안에서 날짜·시간을 골라 바로 예약해요. 전화나 DM 없이 전환되는 가장 강한 레버예요.",
    icon: Calendar,
    category: "purpose",
    power: 30,
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
    label: "쿠폰 연결",
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
    detail: "내 네이버 블로그·인스타·유튜브에 발행해 더 많은 사람을 카드로 데려와요. 전환 설계가 끝난 뒤 마지막으로 더하는 단계예요.",
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

const ENHANCE_UNLOCK = 75;
const POINT = "#1D4ED8"; // 전환력 지표(게이지·별·파워)에만
const INK = "#0A0A0A";
const TAGLINE_MAX = 20; // 한마디(카드 부제) 글자수 — headline 20자 기준과 통일

function getStage(score: number) {
  if (score >= ENHANCE_UNLOCK) return { stars: 3, label: "완성", tone: "전환 준비 완료" };
  if (score >= 40) return { stars: 2, label: "괜찮음", tone: "조금만 더" };
  return { stars: 1, label: "기본", tone: "아직 약해요" };
}

// 덱 순서: 주 제작 → 일반 레버 → 강화
const DECK = [
  ...STUDIO_BLOCKS.filter((b) => b.isMain),
  ...STUDIO_BLOCKS.filter((b) => !b.isMain && !b.isPaid),
  ...STUDIO_BLOCKS.filter((b) => b.isPaid),
];

// 블록 설정 아코디언 대상 — 설정이 필요한 5개만. bgcolor(색=덱 팔레트)·강화 3종 제외.
const SETTING_BLOCK_IDS = ["calendar", "content", "coupon", "image", "link"];

// v0 globals 부재 keyframes 동봉 — 룩 보존용(기존 파일 무수정).
const STUDIO_BUILD_CSS = `
@keyframes sb-forge-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.forge-float { animation: sb-forge-float 4s ease-in-out infinite; }
@keyframes sb-holo-sweep { 0% { transform: translateX(0); opacity: 0; } 18% { opacity: 1; } 100% { transform: translateX(360%); opacity: 0; } }
.holo-sweep { animation: sb-holo-sweep 3.6s ease-in-out infinite; }
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

export function CardStudioPage() {
  // loader 데이터 수신만 — 이번 단계는 배선까지. 화면 하드코딩 치환은 다음 단계.
  const { isBusiness, store, coupons, manageCoupons } = Route.useLoaderData();
  const router = useRouter();
  // 쿠폰 만들기 바텀시트(CouponManageView 임베드) 노출 상태.
  const [couponSheetOpen, setCouponSheetOpen] = useState(false);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [cardColor, setCardColor] = useState(CARD_COLORS[1].value);
  const [showColorPicker, setShowColorPicker] = useState(false);
  // 쿠폰 피커 — 내 쿠폰 여러 개 중 선택(인라인, 색상 팔레트 showColorPicker 패턴 동일).
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const [showCouponPicker, setShowCouponPicker] = useState(false);
  const [dropped, setDropped] = useState(false);
  // S2-a 저장 — POST /api/drops(영상+한마디만). 단축 URL 반환 확인까지.
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  // 카피 AI(B-2) — 영상 선택 시 백그라운드로 키포인트 리드(B-3에서 한마디 후보로 사용).
  const [aiKeyPoints, setAiKeyPoints] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  // 경쟁조건 가드 — 영상 빨리 바꿀 때 stale 응답이 키포인트 덮어쓰지 않게(최신 선택 videoId).
  const aiVideoRef = useRef<string | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const [burstKey, setBurstKey] = useState(0);

  const touchStart = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHold = useRef(false);

  // 선택된 쿠폰 — 미선택이면 첫 쿠폰 fallback(장착 시 자동 첫 쿠폰). coupons 비면 undefined.
  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId) ?? coupons[0];

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
    const nextLever = [...STUDIO_BLOCKS]
      .filter((b) => !b.isPaid && !applied[b.id])
      .sort((a, b) => b.power - a.power)[0];

    if (!applied["content"]) {
      return {
        text: "친구가 0.5초 안에 멈추게 하려면 영상 핵심구간부터. 후크가 없으면 아무도 안 눌러요.",
        action: "content",
      };
    }
    if (!applied["calendar"]) {
      return {
        text: "예약 카드인데 누를 곳이 없어요. 예약 캘린더를 장착해야 친구가 바로 행동해요.",
        action: "calendar",
      };
    }
    if (!applied["coupon"]) {
      return { text: "왜 지금 예약해야 하죠? 쿠폰 한 장이면 '누를 이유'가 생겨요.", action: "coupon" };
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
  }, [applied, score]);

  // 블록 설정 아코디언 토글 — 같은 걸 다시 누르면 접힘, 다른 걸 누르면 그것만 펼침.
  const toggleBlockSettings = (id: string) =>
    setExpandedBlockId((cur) => (cur === id ? null : id));

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
  async function handleSaveDrop() {
    if (!selectedVideo) {
      setSaveError("영상을 먼저 선택해주세요.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const mediaUrl = `https://www.youtube.com/watch?v=${selectedVideo.videoId}`;
      // 쿠폰 붙음 단일 판정 — purpose 결정 + 쿠폰 RPC 둘 다 같은 조건(일관성).
      //   selectedCouponId(원본)로 판단(selectedCoupon fallback 거짓 양성 회피).
      const hasCoupon = applied["coupon"] && !!selectedCouponId;
      // 예약 장착 — 캘린더 블록 장착이면 예약 의도. 슬롯은 캘린더 인라인이 매장 단위로 이미 저장,
      //   손님 화면이 drop.partner_id 로 get_available_slots 조회(슬롯 0개여도 purpose="예약" 유효).
      const hasReservation = !!applied["calendar"];
      // purpose 우선순위: 예약 > 쿠폰 > 정보. 예약+쿠폰 = "예약"(우선) + 쿠폰은 funnel_coupon_id
      //   로 같이 붙는 통합카드(손님 화면 isReservation + isCoupon&&partnerId).
      const dropPurpose = hasReservation ? "예약" : hasCoupon ? "쿠폰" : "정보";
      const res = await fetch("/api/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_url: mediaUrl,
          purpose: dropPurpose,
          curator_message: tagline.trim() || null,
          is_public: false,
          // 예약 슬롯 조회(손님 get_available_slots)가 drop.partner_id 기준 — 매장 연결 필수.
          //   쿠폰·정보에도 매장 연결로 유용. studio-build 는 비즈니스 전제(store 있음).
          partner_id: store?.id ?? null,
        }),
      });
      const json = (await res.json()) as {
        drop?: { id?: string; share_uuid?: string };
        shareable_url?: string;
        message?: string;
      };
      if (!res.ok || !json.drop?.share_uuid) {
        setSaveError(json.message ?? "카드 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const dropId = json.drop.id ?? null;

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

      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
      setSavedUrl(json.shareable_url ?? `${origin}/d/${json.drop.share_uuid}`);
      setDropped(true);
    } catch (e) {
      console.error("[studio-build] handleSaveDrop", e);
      setSaveError("카드 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
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
    if (!applied[block.id]) setBurstKey((k) => k + 1);
  }

  // 히어로 카드 틸트 (포인터 위치 → 3D 회전 + 광택 위치)
  function handleTilt(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({
      rx: (0.5 - py) * 12,
      ry: (px - 0.5) * 14,
      gx: px * 100,
      gy: py * 100,
    });
  }
  function resetTilt() {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-[150px]">
      <style>{STUDIO_BUILD_CSS}</style>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#EDEDED] bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#525252] transition-colors hover:bg-[#F5F5F5]">
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
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
                  style={{ backgroundColor: INK }}
                >
                  예약
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
                  fill: i < stage.stars ? POINT : "transparent",
                  color: i < stage.stars ? POINT : "#D4D4D4",
                }}
                strokeWidth={2}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* ───────── 히어로: 홀로그래픽 메인 카드 (3D 틸트) ───────── */}
        <section className="pt-7" style={{ perspective: "1100px" }}>
          <div className="forge-float">
            <div
              onPointerMove={handleTilt}
              onPointerLeave={resetTilt}
              className="relative mx-auto w-full select-none rounded-[26px] p-5 text-white transition-transform duration-150 ease-out will-change-transform"
              style={{
                backgroundColor: cardColor,
                transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                transformStyle: "preserve-3d",
                boxShadow: `0 22px 60px -12px rgba(15,23,42,${0.28 + stage.stars * 0.07}), 0 0 0 1px rgba(255,255,255,0.08) inset`,
              }}
            >
              {/* 홀로그래픽 레이어 (등급 높을수록 진해짐) */}
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]"
                style={{ opacity: 0.1 + stage.stars * 0.07 }}
              >
                {/* 포인터 따라가는 스페큘러 */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.5), transparent 45%)`,
                  }}
                />
                {/* 무지개 홀로 틴트 */}
                <div
                  className="absolute inset-0 mix-blend-overlay"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 20%, rgba(56,189,248,0.7) 38%, rgba(168,85,247,0.6) 52%, rgba(244,114,182,0.6) 64%, transparent 82%)",
                  }}
                />
                {/* 광택 스윕 */}
                <div className="holo-sweep absolute -inset-y-4 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              </div>

              {/* 레벨업 버스트 */}
              <div
                key={burstKey}
                className="pointer-events-none absolute right-5 top-5 z-10"
                style={{ transform: "translateZ(40px)" }}
              >
                {burstKey > 0 && (
                  <div className="forge-burst flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
                    <Zap className="h-4 w-4" style={{ color: POINT }} strokeWidth={2.5} fill={POINT} />
                  </div>
                )}
              </div>

              {/* 콘텐츠 (살짝 떠 있는 깊이감) */}
              <div className="relative" style={{ transform: "translateZ(30px)" }}>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/75">
                  <Play className="h-3 w-3 fill-white/75" strokeWidth={0} />
                  YouTube · 괴산 호수 캠핑
                </div>

                <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
                  {applied["content"] ? (
                    selectedVideo ? (
                      // 영상 선택됨 = 손님이 볼 실제 임베드 미리보기(아래 설정에서 고른 영상).
                      <YouTubeLiteEmbed {...selectedVideo} />
                    ) : (
                      // 영상 블록 장착했지만 미선택 — 아래 설정에서 검색·선택 유도(가짜 영상 표시 안 함).
                      <div className="flex flex-col items-center gap-1.5 text-white/45">
                        <Video className="h-7 w-7" strokeWidth={1.5} />
                        <span className="text-[11px] font-medium">아래에서 영상을 검색해 선택하세요</span>
                      </div>
                    )
                  ) : applied["image"] ? (
                    // 대표 이미지만 장착(영상 아님) — 기존 placeholder 보존.
                    <div className="relative flex h-full w-full items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 backdrop-blur animate-scale-in">
                        <Play className="ml-0.5 h-5 w-5 fill-[#0A0A0A] text-[#0A0A0A]" strokeWidth={0} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-white/45">
                      <ImageIcon className="h-7 w-7" strokeWidth={1.5} />
                      <span className="text-[11px] font-medium">덱에서 콘텐츠를 장착하세요</span>
                    </div>
                  )}
                </div>

                <h3 className="mt-4 text-xl font-bold tracking-tight">{store?.display_name ?? "내 매장"}</h3>
                {/* 부제 = 메이커 한마디(아래 입력). 가짜 하드코딩 제거(§0). 비면 흐린 안내. */}
                {tagline ? (
                  <p className="mt-0.5 text-[13px] text-white/75">{tagline}</p>
                ) : (
                  <p className="mt-0.5 text-[13px] text-white/40">한마디를 입력하면 여기 표시돼요</p>
                )}

                <div className="mt-4 space-y-2">
                  {applied["coupon"] && (
                    <div className="animate-slide-up space-y-2">
                      {selectedCouponId && selectedCoupon ? (
                        // 실제 선택된 쿠폰만 미리보기(selectedCouponId 기준 — fallback 첫 쿠폰 거짓 표시 제거).
                        <CouponPreview
                          coupon={{ ...selectedCoupon, title: selectedCoupon.title ?? "" }}
                        />
                      ) : coupons.length > 0 ? (
                        // 쿠폰은 있으나 미선택 — 아래 설정에서 고르도록 안내.
                        <div className="rounded-xl border border-dashed border-white/25 py-3 text-center text-[12px] text-white/55">
                          아래에서 쿠폰을 선택하세요
                        </div>
                      ) : (
                        // 매장에 활성 쿠폰 없음.
                        <div className="rounded-xl border border-dashed border-white/25 py-3 text-center text-[12px] text-white/55">
                          매장에 활성 쿠폰이 없어요
                        </div>
                      )}
                    </div>
                  )}
                  {/* 예약 설정 → S3b에서 아래 설정 영역(인라인)으로 이전 예정 */}
                  {applied["link"] && (
                    // 매장 실데이터 연락처(손님 화면 info-drop-page 와 동일 항목) — 미리보기라 시각만.
                    store?.contact_phone || store?.address || store?.reservation_url ? (
                      <div className="flex gap-2 animate-slide-up">
                        {store?.contact_phone ? (
                          <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/12 py-2 text-center text-[12px] font-semibold backdrop-blur">
                            <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                            전화
                          </span>
                        ) : null}
                        {store?.address ? (
                          <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/12 py-2 text-center text-[12px] font-semibold backdrop-blur">
                            <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                            길찾기
                          </span>
                        ) : null}
                        {store?.reservation_url ? (
                          <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/12 py-2 text-center text-[12px] font-semibold backdrop-blur">
                            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                            예약
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/25 py-3 text-center text-[12px] text-white/55 animate-slide-up">
                        매장 정보를 등록하면 표시돼요
                      </div>
                    )
                  )}
                  {!applied["calendar"] && !applied["coupon"] && !applied["link"] && (
                    <div className="rounded-xl border border-dashed border-white/25 py-3 text-center text-[12px] text-white/55">
                      목적 카드를 장착하면 여기에 행동 버튼이 생겨요
                    </div>
                  )}
                </div>
              </div>
            </div>
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
            placeholder="우리 가게를 한마디로 소개해보세요"
            className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2.5 text-[14px] outline-none focus:border-[#0A0A0A]"
          />
          {/* 링고AI 넛지 — 안내만(비활성). AI 제안 연결은 다음 단계. */}
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#A3A3A3]">
            <Sparkles className="h-3 w-3" strokeWidth={1.75} />
            막히면 링고AI가 도와드려요
          </div>
        </div>

        {/* 블록 설정 영역 — 장착한 블록을 인라인으로 다듬기 (S2 골격, S3에서 내부 채움) */}
        {STUDIO_BLOCKS.filter((b) => SETTING_BLOCK_IDS.includes(b.id) && applied[b.id]).length > 0 && (
          <section className="mt-5">
            <div className="mb-2 flex items-center gap-1.5 px-0.5 text-[12px] font-medium text-[#737373]">
              <Sliders className="h-3.5 w-3.5" strokeWidth={2} />
              블록 설정 · 장착한 블록을 여기서 다듬어요
            </div>
            <div className="flex flex-col gap-2">
              {STUDIO_BLOCKS.filter((b) => SETTING_BLOCK_IDS.includes(b.id) && applied[b.id]).map((block) => {
                const Icon = block.icon;
                const isExpanded = expandedBlockId === block.id;
                return (
                  <div
                    key={block.id}
                    className="overflow-hidden rounded-2xl bg-white"
                    style={{ boxShadow: isExpanded ? "0 0 0 1.5px #0A0A0A" : "0 0 0 1px #EDEDED" }}
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
                        <span className="block text-[14px] font-bold leading-tight text-[#0A0A0A]">{block.label}</span>
                        <span className="mt-0.5 block text-[12px] leading-[1.4] text-[#5C5C5C]">{block.desc}</span>
                      </span>
                      {block.power > 0 ? (
                        <span
                          className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold tabular-nums"
                          style={{ color: POINT }}
                        >
                          <Zap className="h-3.5 w-3.5" strokeWidth={2.5} fill={POINT} />+{block.power}
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
                      <div className={`animate-slide-up pb-3.5 ${block.id === "calendar" ? "px-0" : "px-3.5"}`}>
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
                                          boxShadow: isSel ? "0 0 0 1.5px #0A0A0A" : "0 0 0 0.5px #E5E5E5",
                                        }}
                                      >
                                        {isSel ? (
                                          <CircleCheck className="h-4 w-4 shrink-0 text-[#0A0A0A]" strokeWidth={2} />
                                        ) : (
                                          <Circle className="h-4 w-4 shrink-0 text-[#C4C4C4]" strokeWidth={2} />
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
                              <p className="text-center text-[12px] text-[#A3A3A3]">아직 등록한 쿠폰이 없어요</p>
                            )}
                            <div className={coupons.length > 0 ? "border-t border-dashed border-[#D4D4D4] pt-3" : ""}>
                              <button
                                type="button"
                                onClick={() => setCouponSheetOpen(true)}
                                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D4D4D4] py-2.5 text-[13px] font-medium text-[#525252] transition-colors hover:bg-[#FAFAFA]"
                              >
                                <Plus className="h-4 w-4" strokeWidth={2} />
                                새 쿠폰 만들기
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
                                <Check className="h-4 w-4" strokeWidth={2.5} />
                                이 영상으로 정했어요
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
                                  <Search className="h-4 w-4 shrink-0 text-[#A3A3A3]" strokeWidth={2} />
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
                                <p className="text-center text-[12px] text-[#B91C1C]">{videoError}</p>
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
                                <p className="text-center text-[12px] text-[#A3A3A3]">검색 결과가 없어요</p>
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
                                  <Phone className="h-4 w-4 shrink-0 text-[#0A0A0A]" strokeWidth={2} />
                                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0A0A0A]">
                                    {store.contact_phone}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-[#A3A3A3]">카드에 표시됨</span>
                                </li>
                              ) : null}
                              {store?.address ? (
                                <li className="flex items-center gap-2.5 rounded-lg bg-white p-2.5 [box-shadow:0_0_0_0.5px_#E5E5E5]">
                                  <MapPin className="h-4 w-4 shrink-0 text-[#0A0A0A]" strokeWidth={2} />
                                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0A0A0A]">
                                    {store.address}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-[#A3A3A3]">길찾기</span>
                                </li>
                              ) : null}
                              {store?.reservation_url ? (
                                <li className="flex items-center gap-2.5 rounded-lg bg-white p-2.5 [box-shadow:0_0_0_0.5px_#E5E5E5]">
                                  <ExternalLink className="h-4 w-4 shrink-0 text-[#0A0A0A]" strokeWidth={2} />
                                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0A0A0A]">
                                    {store.reservation_url}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-[#A3A3A3]">예약 링크</span>
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
                        ) : (
                          <div className="rounded-xl border border-dashed border-[#D4D4D4] bg-[#FAFAFA] px-3 py-5 text-center">
                            <Wrench className="mx-auto h-5 w-5 text-[#A3A3A3]" strokeWidth={1.75} />
                            <p className="mt-1.5 text-[13px] font-medium text-[#525252]">여기에 {block.label} 설정이 들어갑니다</p>
                            <p className="mt-0.5 text-[11px] text-[#A3A3A3]">다음 단계에서 제작</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
            <span className="text-[22px] font-bold tabular-nums" style={{ color: POINT }}>
              {score}
              <span className="text-[13px] font-semibold text-[#A3A3A3]">/100</span>
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#F0F0F0]">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${score}%`,
                background: `linear-gradient(90deg, ${POINT}, #60A5FA, ${POINT})`,
                backgroundSize: "200% 100%",
                animation: score > 0 ? "gauge-shine 2.4s linear infinite" : undefined,
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: INK }}
          >
            <Lightbulb className="h-[18px] w-[18px]" strokeWidth={2} />
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
                        ? `0 22px 48px -12px rgba(15,23,42,0.3), 0 0 0 2px ${INK}`
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
                      style={block.isMain && !block.isPaid ? { backgroundColor: INK } : undefined}
                    >
                      {block.isPaid ? "강화" : block.isMain ? "핵심" : "레버"}
                    </span>
                    {block.power > 0 ? (
                      <span
                        className="flex items-center gap-0.5 text-[15px] font-bold tabular-nums"
                        style={{ color: POINT }}
                      >
                        <Zap className="h-4 w-4" strokeWidth={2.5} fill={POINT} />+{block.power}
                      </span>
                    ) : (
                      <span className="text-[12px] font-bold text-[#A3A3A3]">도달↑</span>
                    )}
                  </div>

                  {/* 아이콘 */}
                  <div className="mt-2 flex flex-1 items-center justify-center">
                    <div
                      className={`flex h-[76px] w-[76px] items-center justify-center rounded-2xl transition-colors ${
                        locked ? "bg-[#F5F5F5] text-[#C4C4C4]" : "bg-[#0A0A0A]/[0.05] text-[#0A0A0A]"
                      }`}
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
                      style={{ backgroundColor: INK, boxShadow: "0 4px 10px rgba(15,23,42,0.25)" }}
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
                      <Sparkles className="h-3.5 w-3.5" style={{ color: POINT }} strokeWidth={2.5} />
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
                backgroundColor: i === deckIndex ? INK : "#D4D4D4",
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

      {/* ───────── 카드 드롭하기 ───────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-none h-6 bg-gradient-to-t from-[#FAFAFA] to-transparent" />
        <div className="bg-[#FAFAFA]/95 backdrop-blur-md">
          <div className="mx-auto max-w-md px-5 pb-4">
            <button
              onClick={() => void handleSaveDrop()}
              disabled={score < 40 || saving}
              className={`group flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-bold transition-all duration-300 ${
                score >= 40
                  ? "text-white shadow-[0_8px_24px_rgba(15,23,42,0.22)] active:scale-[0.985]"
                  : "border border-[#EDEDED] bg-white text-[#A3A3A3]"
              }`}
              style={score >= 40 ? { backgroundColor: INK } : undefined}
            >
              {saving ? (
                <>저장 중…</>
              ) : dropped ? (
                <>
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                  카드를 저장했어요!
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
            {/* S2-a 저장 결과 — 단축 URL 반환 확인(카톡 공유 연결은 다음 단계). */}
            {saveError ? (
              <p className="mt-2 text-center text-[12px] text-[#B91C1C]">{saveError}</p>
            ) : savedUrl ? (
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
            ) : null}
          </div>
        </div>
      </div>

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
};

export const Route = createFileRoute("/_user/studio-build")({
  head: () => ({ meta: [{ title: "카드 스튜디오 — LinkDrop" }] }),
  // S1 — 실데이터 로딩 길 + 비즈니스 게이트. 화면 하드코딩 치환은 다음 단계.
  //   인증은 부모 _user.tsx beforeLoad 담당 → 세션 throw 금지(graceful). 매장 없으면 등록 유도.
  loader: async (): Promise<StudioBuildLoaderData> => {
    const empty: StudioBuildLoaderData = {
      isBusiness: false,
      store: null,
      coupons: [],
      manageCoupons: [],
    };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty; // 인증은 _user.tsx 담당 — 여기선 throw 안 함(graceful).

    // 비즈니스 여부 (create-wizard.tsx:77 패턴).
    const { data: isBusinessRaw } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });
    const isBusiness = Boolean(isBusinessRaw);

    // 내 매장 (partner.register.tsx:57-61 패턴) — display_name 은 다음 단계 표시용.
    const { data: store } = await supabase
      .from("partners")
      .select("id, display_name, verification_status, contact_phone, address, reservation_url")
      .eq("owner_user_id", userId)
      .maybeSingle();

    // 비즈니스 게이트 — 매장 없거나 비즈니스 아니면 사업자 등록으로 유도(소프트 게이트).
    if (!isBusiness || !store) {
      throw redirect({ to: "/partner/register" });
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

    return { isBusiness, store, coupons, manageCoupons };
  },
  component: CardStudioPage,
});
