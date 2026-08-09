// ════════════════════════════════════════════════════════════════════════════
// CardStudioPage50 — C-매직 전환(한 문장 + 상주 카드 + 휘리릭).
//
// DIRECTOR_MENTS_50 — Duke 확정(54창) · CC 재량 작문 금지 · 용어 락: 카드 단독 금지,
//   공유카드/공유할 수 있는 카드
//
// P2.5 범위: 1막(경로별 차등 재료 받기) + 휘리릭(AI 1콜 · 타임아웃 15s) + 확인 1탭.
//   저장·발행 0건 · registerProduct 0 · Radix 0(#418 SSR) · Edge·라우트·49·거울 파일 무수정.
//   디자인 = LINKDROP-DESIGN-LOCK-v2 토큰만(패턴 5종 그대로 복제 · 토큰 밖 발명 0).
//   지니 = brand/lingo-mascot 정본 위 LingoGenie 래퍼 재사용(신규 아이콘 제작 0 · §0 실측분).
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Globe,
  Calendar,
  Store,
  CalendarCheck,
  Megaphone,
  PenLine,
  Mic,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  parseKrwInput,
  parseOneLiner,
  buildGbProposal,
  gbRowsInvalid,
  DROPY_PCT_MAX,
} from "@/lib/studio-contract";
import {
  DECK_IDS,
  DIRECTOR_DROPPY_RATE_DEFAULT,
  isAiActionAllowed,
  V6_INAPP_NOTICE,
} from "@/components/card-model/CardStudioPage49";
import type { LingoContext } from "@/components/card-model/useLingoChat";
// P2.7 — 음성은 공용 훅 재사용(신규 STT/TTS 구현 0). 반환 계약:
//   { listening, speaking, notice, ttsOn, startListening, stopListening, finishListening,
//     speak, stopSpeaking, toggleTts }  — useLingoChat.ts:408
import { useLingoVoice } from "@/components/card-model/useLingoChat";
// 음성 공용 가드 — 탭 시점 재판정·미지원 안내(한 글자 락)·인앱 WebView 판정.
import { canUseSpeechRecognition, VOICE_UNSUPPORTED_NOTICE } from "@/lib/lingo-voice-tap";
import { getInAppBrowser, type InAppBrowser } from "@/lib/pwa-install";
// 인앱 [음성으로 만들기] — 크롬 핸드오프 공용 헬퍼(49 :3035 동형 · WebView 우회 아님).
import { startVoiceHandoff } from "@/lib/voice-handoff";
// §0 실측 — 링고 지니 정본(brand/lingo-mascot v0(51) 심볼 + L6b 연출 래퍼). 신규 아이콘 제작 0.
import { LingoGenie } from "@/components/lingo/LingoGenie";
// §C 상주 거울 카드 — 어댑터·렌더러 모두 거울 파일(읽기·import만 · 무수정).
import { CardModelBody } from "@/components/card-model/CardModelBody";
import {
  studio49ToCardModel,
  type Studio49Input,
  type Studio49VideoSlot,
} from "@/components/card-studio/studio49-to-card";
import { CARD_CATEGORY_LABELS } from "@/components/card-model/card-model-adapters";
// P2.6 §1 — 조립 연출은 49 정본 오버레이를 그대로 쓴다(자작 안무 폐기 · 49 :5152 사용 방식 복제).
import {
  LingoAssembleOverlay,
  type AssembleStep,
} from "@/components/card-studio/LingoAssembleOverlay49";

// ── 멘트 정본 ───────────────────────────────────────────────────────────────
// Duke 확정 문구 — 한 글자도 재량 작문 금지.
//   기존 19키 + droppyRange·name 유지(매직에서 안 쓰는 스텝 멘트도 "하나씩" 후퇴로가 쓴다 — 삭제 금지).
export const DIRECTOR_MENTS_50 = {
  start: "사장님, 오셨네요. 오늘은 어떤 공유카드를 만들어 드릴까요? — 카톡으로 손님께 보내는, 공유할 수 있는 카드예요.",
  sellHow: "어떻게 파실 건가요?",
  hostHow: "손님이 오게 만들어 볼게요. 어떤 걸로 할까요?",
  reserveCouponNote: "예약에는 쿠폰이 같이 붙어요 — 오신 손님께 드릴 혜택이에요.",
  video: "영상 하나만 주세요. 보고 제가 공유카드를 짜요.",
  name: "무엇을 파는지 이름을 알려주세요 — 예: 찰옥수수 10개입. 공유카드의 재료가 돼요.",
  photo: "사진 한 장 주세요. 공유카드의 얼굴이 돼요.",
  price: "한 개(한 박스)에 얼마로 할까요?",
  qty: "몇 개까지 파실 건가요?",
  droppy: "전해준 분께 얼마나 나눠 드릴까요? 비율은 사장님이 정해요 — 최대 20%예요.",
  gbPropose: "모임 단계는 이렇게 짜봤어요. 제가 지어낸 숫자가 아니라 계산기예요 — 이대로 갈까요, 바꿀까요?",
  gbFail: "인원이 다 안 모이면 어떻게 할까요?",
  numEmpty: "숫자를 적어 주세요 — 예: 25000",
  numMixed: "숫자로만 적어 주세요 — \"3만원\"이 아니라 30000처럼요.",
  droppyRange: "0부터 20 사이로 적어 주세요 — 예: 10",
  assembleReady: "재료 다 받았어요. 이제 제가 만들게요 — 만드는 동안은 아무것도 안 물어봐요.",
  assembleTimeout: "지금 좀 느리네요. 잠시 뒤 다시 하거나, 직접 만드실 수도 있어요.",
  reviewReady: "다 됐어요. 고칠 곳이 있으면 말로 하시거나 눌러서 바꿔 주세요.",
  reviewNumberGuard: "가격·수량은 사장님만 바꿀 수 있어요 — 칸에 직접 적어 주세요.",
  publishReady: "마음에 드시면 카톡으로 내보내 주세요. 발행은 사장님만 누를 수 있어요.",
  done: "나갔어요. 손님이 누르는 순간부터 이 공유카드가 일해요.",
  // ── P2.5 §D 추가분 ──
  oneLiner: "사진 받았어요. 이제 뭘 얼마에 몇 개 파실지 한 줄로 말해 주세요 — 예: 찰옥수수 25000원 50박스, 나눔 10%",
  assembling: "받았어요 — 지금 만들게요. 촤르륵.",
  askName: "이름을 못 읽었어요 — 뭘 파시는 건가요?",
  askPrice: "가격을 못 읽었어요 — 얼마인가요? 예: 25000",
  askQty: "수량을 못 읽었어요 — 몇 개까지 파실 건가요?",
  askDroppy: "나눔 몫을 못 읽었어요 — 몇 %로 할까요? 0에서 20 사이예요.",
  confirmNumbers: "숫자만 확인해 주세요 — 사장님 문장에서 그대로 읽었어요.",
  gbFailInline: "안 모이면 어떻게 할까요?",
  assembleOrder: "받은 재료로 공유카드를 완성해 주세요. 제목과 한마디, 상품 한마디를 하나로 정해 도구로 바로 반영해 주세요. 후보를 나열하며 묻지 마세요. 영상과 입력값에 없는 사실은 쓰지 마세요. 가격·수량은 건드리지 마세요.",
} as const;

// ── 상태 골격 ───────────────────────────────────────────────────────────────
type Act = 1 | 2 | 3 | 4;
type Purpose = "sell" | "host" | "tell" | null;
type SellHow = "solo" | "gb" | null;
type HostHow = "reserve" | "coupon" | null;
// mode 파생: sell→"commerce" · host→"reserve" · tell→"general" (StudioMode 3값 무접촉)
function modeOf(p: Purpose): "commerce" | "reserve" | "general" | null {
  return p === "sell" ? "commerce" : p === "host" ? "reserve" : p === "tell" ? "general" : null;
}

// §B — 경로별 시퀀스:
//   팔기(매직): purpose → sellHow → photo → oneLiner → [missing 조각만 ask*] → 휘리릭 → confirm
//   손님받기:   purpose → hostHow → video → 휘리릭 → confirm
//   알리기:     purpose → video → 휘리릭 → confirm
//   후퇴로("하나씩"): 기존 단계 스텝 재사용(name·price·qty·droppy·gbPropose·gbFail) — 삭제 금지.
type Step50 =
  | "purpose"
  | "sellHow"
  | "hostHow"
  | "video"
  | "photo"
  | "oneLiner"
  | "askName"
  | "askPrice"
  | "askQty"
  | "askDroppy"
  | "name"
  | "price"
  | "qty"
  | "droppy"
  | "gbPropose"
  | "gbFail"
  | "confirm";

const STEP_MENT: Record<Step50, string> = {
  purpose: DIRECTOR_MENTS_50.start,
  sellHow: DIRECTOR_MENTS_50.sellHow,
  hostHow: DIRECTOR_MENTS_50.hostHow,
  video: DIRECTOR_MENTS_50.video,
  photo: DIRECTOR_MENTS_50.photo,
  oneLiner: DIRECTOR_MENTS_50.oneLiner,
  askName: DIRECTOR_MENTS_50.askName,
  askPrice: DIRECTOR_MENTS_50.askPrice,
  askQty: DIRECTOR_MENTS_50.askQty,
  askDroppy: DIRECTOR_MENTS_50.askDroppy,
  name: DIRECTOR_MENTS_50.name,
  price: DIRECTOR_MENTS_50.price,
  qty: DIRECTOR_MENTS_50.qty,
  droppy: DIRECTOR_MENTS_50.droppy,
  gbPropose: DIRECTOR_MENTS_50.gbPropose,
  gbFail: DIRECTOR_MENTS_50.gbFail,
  confirm: DIRECTOR_MENTS_50.confirmNumbers,
};

type GbRow = { qty: string; price: string };

// 1차 칩 4개 — Duke 확정 문구·아이콘(P2.6 §2). 이모지 폐기 · lucide 아이콘 전환.
const PURPOSE_CHIPS: {
  key: "sell" | "host" | "tell" | "form";
  Icon: typeof Store;
  label: string;
}[] = [
  { key: "sell", Icon: Store, label: "상품판매 — 농산물·가공품을 주문받아요" },
  { key: "host", Icon: CalendarCheck, label: "예약·쿠폰 — 손님이 찾아오게 해요" },
  { key: "tell", Icon: Megaphone, label: "소식 알리기 — 다양한 소식을 친구에게 전해요" },
  { key: "form", Icon: PenLine, label: "직접 만들기 — 링고 없이 폼으로 만들어요" },
];
// 하위 칩 라벨 = 기존 확정분 재사용(신규 작문 0): 49 S1 목적 게이트(:4998·:5016·:4928·:4929).
const SELLHOW_CHIPS: { key: "solo" | "gb"; label: string; desc: string }[] = [
  { key: "solo", label: "혼자 팔기", desc: "내가 정한 가격 그대로 팔아요" },
  { key: "gb", label: "모일수록 싸게", desc: "많이 모이면 가격이 내려가요" },
];
const HOSTHOW_CHIPS: { key: "reserve" | "coupon"; label: string; desc: string }[] = [
  { key: "reserve", label: "예약 받기", desc: "날짜를 정해 손님을 받아요" },
  { key: "coupon", label: "쿠폰 주기", desc: "할인 혜택으로 오게 만들어요" },
];
// 미달 처리 = 49 지휘자 gbFail 칩 라벨 그대로(:7819·:7823).
const GBFAIL_CHIPS: { key: "base" | "cancel"; label: string }[] = [
  { key: "base", label: "기본가로 정산" },
  { key: "cancel", label: "자동 취소" },
];

// ── SSE 파서·경량 재가드 ────────────────────────────────────────────────────
// 49 :818-837 구조 승계(49 쪽이 비export 모듈 함수라 복제 — 49 무접촉 락 준수).
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

// ── 타임아웃 ────────────────────────────────────────────────────────────────
const ASSEMBLE_TIMEOUT_MS = 15_000; // §F — 제목 빛줄 상한.
const VIDEO_LEAD_TIMEOUT_MS = 8_000;
const ASSEMBLE_MAX_RETRY = 2;

// ── §F 휘리릭 모션 토큰 (한 곳 집약 — whoosh-motion-demo.html 값으로 교체 시 여기만 수정) ──
//   출처 표기: [F]=P2.5 §F 본문 명시 · [G]=LingoGenie 기존 keyframes 재사용 · [L]=DESIGN-LOCK v2 §6
const M = {
  swallowMs: 1200, // [G] lg-breathe(2.4s ease-in-out)의 반주기 = scale 1.28 도달 시점
  swallowScale: 1.28, // [F] "오브 scale 1.28" (= lg-breathe 50% 값과 동일)
  brushMs: 1000, // [Duke 확정 비트표] 붓질 0.4~1.4s — P2.6: 자작 sweep 폐기, 오버레이 전 대기 비트로 존속
  stampStaggerMs: 250, // [F] "250ms stagger"
  stampRingMs: 150, // [F] "블루 링 0.15s"
  easeOut: "ease-out", // [G]
} as const;
// §F 도장 4연타 대상 — 이름·가격수량·몫·단계표.
const STAMP_KEYS = ["name", "priceQty", "droppy", "tiers"] as const;
type StampKey = (typeof STAMP_KEYS)[number];
// 오버레이 스텝 라벨 = 49 DIRECTOR_CHECK 기존 확정 라벨 재사용(신규 작문 0).
//   note 는 빈 문자열 — 오버레이가 `{cur?.note && …}` 로 생략 처리(실측 :296).
//   anchor — 49 실측 복제: 49 는 전 스텝에 anchor 를 준다(:4061 planAnchor). 규칙(:3893-3897)은
//   review=gauge / block==="content"=hero / 그 외=deck. 50 의 도장 4대상은 전부 카드 본체에 박히는
//   값이므로 49 규칙의 hero 갈래에 해당 — 50 에 실재하는 앵커도 hero 하나(:773).
const ASSEMBLE_STEPS: AssembleStep[] = [
  { label: "상품 이름", note: "", anchor: "hero" },
  { label: "판매 가격 · 준비 수량", note: "", anchor: "hero" },
  { label: "공유 보상", note: "", anchor: "hero" },
  { label: "모임 단계", note: "", anchor: "hero" },
];

// 영상 ID 파싱 — 결정 규칙 3패턴(watch?v= | youtu.be/ | /shorts/). 실패 = null(추측 금지).
function parseVideoId(url: string): string | null {
  const m =
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ??
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ??
    url.match(/\/shorts\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

// §C — categoryIcon: 49 MODE_CONTENT 실측 복제 · 비export라 값 복제(:4640 Globe / :4655 Calendar / :4670 Store).
const CATEGORY_ICON = { general: Globe, reserve: Calendar, commerce: Store } as const;
// 정본 DEFAULT_PAGE_BG(card-model-adapters) 비export라 값 복제.
const PAGE_BG = "#F8FAFC";
const LINGO_BLUE = "#1D4ED8"; // DESIGN-LOCK v2 §1 — 링고 블루(유채 2역할 중 하나).

export type CardStudioPage50Store = {
  id: string;
  display_name: string;
  contact_phone?: string | null;
};

export function CardStudioPage50({ store }: { store?: CardStudioPage50Store | null }) {
  const navigate = useNavigate();

  const [act, setAct] = useState<Act>(1);
  const [step, setStep] = useState<Step50>("purpose");
  // §C — 대화 스크롤 제거: 하단 링고 존의 말풍선 1개만 유지.
  const [bubble, setBubble] = useState<string>(DIRECTOR_MENTS_50.start);

  const [purpose, setPurpose] = useState<Purpose>(null);
  const [sellHow, setSellHow] = useState<SellHow>(null);
  const [hostHow, setHostHow] = useState<HostHow>(null);
  const [stepwise, setStepwise] = useState(false); // 후퇴로("하나씩 물어봐 주세요") 진입 여부.

  // 받은 재료
  const [videoUrl, setVideoUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [priceKrw, setPriceKrw] = useState<number | null>(null);
  const [qtyNum, setQtyNum] = useState<number | null>(null);
  const [droppyPct, setDroppyPct] = useState<number | null>(null);
  const [gbRows, setGbRows] = useState<GbRow[]>([]);
  const [gbEditing, setGbEditing] = useState(false);
  const [gbFailMode, setGbFailMode] = useState<"base" | "cancel" | null>(null);

  const [textInput, setTextInput] = useState("");
  const [inlineErr, setInlineErr] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);

  // ── P2.7 음성 ─────────────────────────────────────────────────────────────
  const voice = useLingoVoice();
  const [interim, setInterim] = useState(""); // 인식 중 회색 미리보기(49 :2363 동형).
  // 인앱 WebView(카톡 등) 음성 정직 게이트 — 마운트 후 판정(SSR=null · hydration 안전).
  //   49 :2298-2303 동형. ⚠️ WebView 우회 시도 금지(영구 락) — 마이크 진입점 자체를 렌더하지 않는다.
  const [inAppNoMic, setInAppNoMic] = useState<InAppBrowser | null>(null);
  useEffect(() => {
    setInAppNoMic(getInAppBrowser());
  }, []);
  // 마이크 노출 조건 — 지원 + 인앱 아님. 둘 중 하나라도 아니면 버튼 미렌더(가짜 버튼 금지).
  const [micUsable, setMicUsable] = useState(false);
  useEffect(() => {
    setMicUsable(canUseSpeechRecognition());
  }, []);
  const showMic = micUsable && !inAppNoMic;

  // 2막(휘리릭)
  const videoAiRef = useRef<{ title: string; summary: string; keyPoints: string[] } | null>(null);
  const videoLeadRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const [assembling, setAssembling] = useState(false);
  const assemblingRef = useRef(false); // say 의 낭독 게이트 라이브 참조(오버레이 중 낭독 생략).
  const [assembleFailed, setAssembleFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [aiTitle, setAiTitle] = useState("");
  const [aiSubtitle, setAiSubtitle] = useState("");
  const [aiHeadline, setAiHeadline] = useState("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  // 실슬롯 — 4필드(videoId·thumbnailUrl·title·isShorts)가 전부 확보될 때만 구성(하나라도 없으면 null).
  const [videoSlot, setVideoSlot] = useState<Studio49VideoSlot | null>(null);
  // §F 연출 — 오브 삼키기만 50 소유(카드 무대는 49 오버레이가 담당).
  const [swallow, setSwallow] = useState(false);
  const [stamped, setStamped] = useState<StampKey[]>([]);
  const [overlayStep, setOverlayStep] = useState(0); // 49 오버레이 step 인덱스(호출부 타이머 구동 — 49 :3251 동형).
  // §E 확인 1탭
  const [confirmed, setConfirmed] = useState(false);
  const [editField, setEditField] = useState<null | "price" | "qty" | "droppy">(null);

  assemblingRef.current = assembling; // 렌더마다 동기(say 의 낭독 게이트 라이브 참조).

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);
  useEffect(() => {
    return () => {
      for (const t of timersRef.current) clearTimeout(t);
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    };
  }, []);

  // 말풍선 갱신 = 낭독 1회(ttsOn OFF·미지원이면 speak 내부가 무음 통과 — 호출부 검사 불요).
  //   ⚠️ 조립 오버레이 중에는 낭독 생략 — 오버레이 자체 연출과 겹치지 않게(assemblingRef 로 판정).
  const say = useCallback(
    (text: string) => {
      setBubble(text);
      if (!assemblingRef.current) voice.speak(text);
    },
    [voice],
  );

  // 마이크 탭 — 49 handleOrbTap(:3028-3067) 시퀀스 복제(인앱 분기는 버튼 미렌더가 대체).
  //   결과는 입력 state 에 채우기만 — 자동 전송 금지(숫자 자물쇠 · 홈 패턴 :479-481).
  function onMicTap() {
    if (voice.listening) {
      voice.finishListening(); // 재탭 = 확정 종료(FIX-43 — abort 아닌 stop).
      setInterim("");
      return;
    }
    if (!canUseSpeechRecognition()) {
      say(VOICE_UNSUPPORTED_NOTICE); // 탭 시점 재판정 폴백(글 입력 유지).
      return;
    }
    voice.stopSpeaking(); // 낭독 중 탭 = 끊고 청취(에코 차단).
    setInterim("");
    voice.startListening(
      (t) => {
        setInterim("");
        setTextInput((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t)); // 채우기만.
      },
      { onInterim: (t) => setInterim(t) },
    );
  }
  const go = useCallback(
    (next: Step50) => {
      setStep(next);
      setTextInput("");
      setInlineErr(null);
      say(STEP_MENT[next]);
    },
    [say],
  );

  // ── 1차: 목적 ─────────────────────────────────────────────────────────────
  function pickPurpose(key: "sell" | "host" | "tell" | "form") {
    if (key === "form") {
      void navigate({ to: "/studio-build" }); // 죽은 버튼 금지 — 실제 이동.
      return;
    }
    setPurpose(key);
    if (key === "sell") go("sellHow");
    else if (key === "host") go("hostHow");
    else go("video");
  }
  function pickSellHow(key: "solo" | "gb") {
    setSellHow(key);
    go("photo"); // §B 매직: 사진 → 한 문장.
  }
  function pickHostHow(key: "reserve" | "coupon") {
    setHostHow(key);
    go("video");
    if (key === "reserve") say(DIRECTOR_MENTS_50.reserveCouponNote);
  }

  // ── 영상 ─────────────────────────────────────────────────────────────────
  function submitVideo() {
    const v = textInput.trim();
    if (!v) return;
    setVideoUrl(v);
    void loadVideoLead(v);
    // 팔기(사진 보조 영상)는 한 문장으로, 손님받기·알리기는 바로 휘리릭.
    if (purpose === "sell") go("oneLiner");
    else void runWhoosh();
  }
  // oembed → generate-summary 선행 체인(49 :3595-3619 실배선 복제 · 8s 타임아웃 · 실패 무음).
  async function loadVideoLead(url: string) {
    videoLeadRef.current = url;
    videoAiRef.current = null;
    setVideoSlot(null);
    try {
      const oembedRes = await fetch("/api/oembed?url=" + encodeURIComponent(url), {
        signal: AbortSignal.timeout(VIDEO_LEAD_TIMEOUT_MS),
      });
      const oembedJson = (await oembedRes.json()) as {
        source_id?: string;
        title?: string | null;
        thumbnail_url?: string | null;
      };
      const sourceId = oembedJson?.source_id;
      if (!oembedRes.ok || !sourceId || videoLeadRef.current !== url) return;
      const title = typeof oembedJson.title === "string" ? oembedJson.title.trim() : "";
      videoAiRef.current = { title, summary: "", keyPoints: [] };
      // 실슬롯 구성 — 결정 규칙만 사용(추측 0). 한 조각이라도 없으면 null 유지 = 기존 폴백.
      const videoId = parseVideoId(url);
      const thumbnailUrl =
        typeof oembedJson.thumbnail_url === "string" ? oembedJson.thumbnail_url.trim() : "";
      if (videoId && thumbnailUrl && title) {
        setVideoSlot({ videoId, thumbnailUrl, title, isShorts: url.includes("/shorts/") });
      }
      const sumRes = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
        signal: AbortSignal.timeout(VIDEO_LEAD_TIMEOUT_MS),
      });
      const sumJson = (await sumRes.json()) as { ai_summary?: unknown; ai_key_points?: unknown };
      if (!sumRes.ok || videoLeadRef.current !== url) return;
      const points = Array.isArray(sumJson?.ai_key_points)
        ? (sumJson.ai_key_points as unknown[]).filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0,
          )
        : [];
      const summary =
        typeof sumJson.ai_summary === "string" && sumJson.ai_summary.trim()
          ? sumJson.ai_summary.trim()
          : "";
      videoAiRef.current = { title, summary, keyPoints: points };
      setKeyPoints(points);
    } catch {
      /* 선행 체인 실패는 무음 — 조립은 입력값만으로 진행(가짜 안내 금지). */
    }
  }

  // ── 사진 ─────────────────────────────────────────────────────────────────
  function submitPhoto(file: File) {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    setPhotoPreview(url);
    setPhotoName(file.name);
    go(stepwise ? "name" : "oneLiner");
  }

  // ── §A 한 문장 ────────────────────────────────────────────────────────────
  // 결정적 파서만 사용(AI 0). 못 읽은 조각만 ask* 로 되묻는다 — 전부 읽히면 질문 0.
  function submitOneLiner() {
    const v = textInput.trim();
    if (!v) return;
    const r = parseOneLiner(v);
    if (r.name) setProductName(r.name);
    if (r.priceKrw != null) setPriceKrw(r.priceKrw);
    if (r.qty != null) setQtyNum(r.qty);
    // 몫은 범위 밖이면 채택하지 않는다(0~DROPY_PCT_MAX 검증은 호출부 책임 — §A 계약).
    if (r.droppyPct != null && Number.isInteger(r.droppyPct) && r.droppyPct >= 0 && r.droppyPct <= DROPY_PCT_MAX) {
      setDroppyPct(r.droppyPct);
    }
    setTextInput("");
    askNextMissing({
      name: r.name ?? null,
      price: r.priceKrw,
      qty: r.qty,
      droppy:
        r.droppyPct != null && r.droppyPct >= 0 && r.droppyPct <= DROPY_PCT_MAX ? r.droppyPct : null,
    });
  }
  // 못 읽은 조각을 순서대로 하나씩만 되묻는다(한 화면 한 질문).
  function askNextMissing(cur: {
    name: string | null;
    price: number | null;
    qty: number | null;
    droppy: number | null;
  }) {
    if (!cur.name) return go("askName");
    if (cur.price == null) return go("askPrice");
    if (cur.qty == null) return go("askQty");
    if (cur.droppy == null) return go("askDroppy");
    void runWhoosh();
  }
  function currentMaterials() {
    return { name: productName.trim() || null, price: priceKrw, qty: qtyNum, droppy: droppyPct };
  }

  // ask* / 단계 스텝 공용 제출 — 숫자는 전부 parseKrwInput 경유(무언 실패 금지).
  function submitAsk() {
    const v = textInput.trim();
    if (!v) return;
    if (step === "askName" || step === "name") {
      setProductName(v);
      setTextInput("");
      if (stepwise) return go("price");
      return askNextMissing({ ...currentMaterials(), name: v });
    }
    const parsed = parseKrwInput(v);
    if (!parsed.ok) {
      say(parsed.reason === "empty" ? DIRECTOR_MENTS_50.numEmpty : DIRECTOR_MENTS_50.numMixed);
      setTextInput("");
      return;
    }
    const n = parsed.value;
    if (step === "askPrice" || step === "price") {
      setPriceKrw(n);
      setTextInput("");
      if (stepwise) return go("qty");
      return askNextMissing({ ...currentMaterials(), price: n });
    }
    if (step === "askQty" || step === "qty") {
      setQtyNum(n);
      setTextInput("");
      if (stepwise) return go("droppy");
      return askNextMissing({ ...currentMaterials(), qty: n });
    }
    // droppy — 0~DROPY_PCT_MAX 정수(위반 = 인라인 문구).
    if (!Number.isInteger(n) || n < 0 || n > DROPY_PCT_MAX) {
      setInlineErr(DIRECTOR_MENTS_50.droppyRange);
      return;
    }
    setDroppyPct(n);
    setTextInput("");
    if (stepwise) {
      if (sellHow === "gb") {
        setGbRows(buildGbProposal(priceKrw ?? 0, qtyNum ?? 0));
        return go("gbPropose");
      }
      return void runWhoosh();
    }
    return askNextMissing({ ...currentMaterials(), droppy: n });
  }

  // ── gb 단계표(후퇴로 전용 스텝 · 매직은 §E 확인 바에서 편입) ────────────────
  const gbCellsBad = useMemo(
    () => gbRows.some((r) => !parseKrwInput(r.qty).ok || !parseKrwInput(r.price).ok),
    [gbRows],
  );
  const gbBad = gbCellsBad || gbRowsInvalid(gbRows, qtyNum ?? 0);

  // ── §C 상주 거울 카드 ─────────────────────────────────────────────────────
  const mode50 = modeOf(purpose) ?? "general";
  const cardModel = useMemo(() => {
    const input: Studio49Input = {
      mode: mode50,
      applied: {
        content: videoUrl.trim().length > 0,
        productimage: !!photoPreview,
        product: productName.trim().length > 0 || (priceKrw ?? 0) > 0 || (qtyNum ?? 0) > 0,
      },
      // P3에서 업로드 배선 — 지금은 로컬 objectURL(발행 payload 미편입).
      ...(photoPreview ? { productImageUrl: photoPreview } : {}),
      title: aiTitle,
      subtitle: aiSubtitle,
      clip: "",
      brand: "",
      party: 0,
      couponLabel: null,
      // 연출 중에는 재료를 감춘다("삼키기") → 오버레이 종료 시 파서값+AI값이 함께 등장(일괄 반영).
      productName: assembling ? "" : productName.trim(),
      productPrice: !assembling && priceKrw != null ? String(priceKrw) : "",
      productHeadline: aiHeadline,
      productPoints: [],
      ...(keyPoints.length > 0 ? { keyPoints } : {}),
      productUnitLabel: "",
      facilities: [],
      saleStart: "",
      saleEnd: "",
      dates: [],
      times: [],
      slotsByDate: {},
      // 실슬롯 — 결정 규칙(URL 3패턴 + oembed thumbnail_url·title)으로 4필드가 전부 확보될 때만.
      //   하나라도 없으면 null = CardModelBody 히어로 폴백 유지(가짜 썸네일 합성 0).
      selectedVideo: videoSlot,
      shipping: null,
      categoryLabel: CARD_CATEGORY_LABELS[mode50 === "commerce" ? "commerce" : mode50 === "reserve" ? "reserve" : "info"],
      // 49 MODE_CONTENT 실측 복제 · 비export라 값 복제.
      categoryIcon: CATEGORY_ICON[mode50],
      storeName: store?.display_name ?? "",
      pageBg: PAGE_BG,
    };
    return studio49ToCardModel(input);
  }, [mode50, videoUrl, videoSlot, photoPreview, productName, priceKrw, qtyNum, aiTitle, aiSubtitle, aiHeadline, keyPoints, store, assembling]);

  // ── 휘리릭(§F) + AI 1콜(§3 계약 승계) ──────────────────────────────────────
  function buildAssembleContext(): LingoContext {
    const lead = videoAiRef.current;
    const nameForAi = productName.trim();
    const deckIds = DECK_IDS[mode50];
    const isApplied = (id: string) =>
      id === "content"
        ? videoUrl.trim().length > 0
        : id === "productimage"
          ? !!photoName
          : id === "product"
            ? nameForAi.length > 0 || (priceKrw ?? 0) > 0 || (qtyNum ?? 0) > 0
            : false;
    const fields: Record<string, string> = {};
    if (nameForAi) {
      fields.title = nameForAi;
      fields.productName = nameForAi;
    }
    return {
      studio_state: {
        mode: mode50,
        applied_blocks: deckIds.filter(isApplied),
        score: 0,
        card_title: nameForAi,
        ...(nameForAi ? { product_name: nameForAi } : {}),
        ...((priceKrw ?? 0) > 0 ? { product_price: priceKrw as number } : {}),
      },
      studio: {
        mode: mode50,
        deck: deckIds.map((id) => ({ id, label: id, applied: isApplied(id), locked: false })),
        fields,
      },
      ...(lead?.summary ? { video_summary: lead.summary } : lead?.title ? { video_summary: lead.title } : {}),
      ...(lead?.keyPoints?.length ? { key_points: lead.keyPoints } : {}),
    };
  }

  // 게이트 통과분만 · 배선 3필드(title·subtitle·headline). 숫자·쿠폰·이미지 case 자체를 만들지 않는다.
  function applyActions50(actions: unknown[]) {
    for (const raw of actions) {
      if (!isAiActionAllowed(mode50, raw)) continue;
      const a = raw as { type?: string; field?: string; value?: string };
      if (a.type !== "setField" || !a.field) continue;
      const v = a.value ?? "";
      switch (a.field) {
        case "title":
          setAiTitle(v);
          break;
        case "subtitle":
          setAiSubtitle(v);
          break;
        case "headline":
          setAiHeadline(v);
          break;
        default:
          continue; // 미배선 필드 = 무적용·무기록.
      }
    }
  }

  // §F 비트: 삼키기(오브) → 대기 → 도장 4연타(250ms stagger = 오버레이 step + 값 반영 동시 구동).
  //   카드 무대(딤·스포트라이트·말풍선)는 49 오버레이 소관 — 자작 sweep/빛줄/링 폐기.
  function startWhooshChoreography() {
    clearTimers();
    setStamped([]);
    setOverlayStep(0);
    setSwallow(true);
    const push = (fn: () => void, ms: number) => {
      timersRef.current.push(window.setTimeout(fn, ms));
    };
    push(() => setSwallow(false), M.swallowMs);
    const stampStart = M.swallowMs + M.brushMs;
    STAMP_KEYS.forEach((k, i) => {
      push(() => {
        setStamped((s) => (s.includes(k) ? s : [...s, k]));
        setOverlayStep(i);
      }, stampStart + M.stampStaggerMs * (i + 1));
    });
  }
  // 건너뛰기 — 타이머 전소거 + 즉시 최종 상태(결과 동일). 오버레이 onSkip 도 이 함수.
  function skipWhoosh() {
    clearTimers();
    setSwallow(false);
    setStamped([...STAMP_KEYS]);
    setOverlayStep(ASSEMBLE_STEPS.length - 1);
  }

  function failWhoosh() {
    clearTimers();
    setSwallow(false);
    setAssembling(false);
    setAssembleFailed(true);
    setRetryCount((c) => c + 1);
    say(DIRECTOR_MENTS_50.assembleTimeout);
  }

  async function runWhoosh() {
    if (assembling) return;
    setAct(2);
    setAssembling(true);
    setAssembleFailed(false);
    setConfirmed(false);
    say(DIRECTOR_MENTS_50.assembling);
    startWhooshChoreography();
    let proposalActions: unknown[] = [];
    try {
      const res = await fetch("/api/lingo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(ASSEMBLE_TIMEOUT_MS),
        body: JSON.stringify({
          message: DIRECTOR_MENTS_50.assembleOrder,
          surface: "studio",
          input_channel: "text",
          context: buildAssembleContext(),
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) return failWhoosh();
      const reader = res.body?.getReader();
      if (!reader) return failWhoosh();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
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
            if (typeof d?.session_id === "string") sessionRef.current = d.session_id;
          } else if (ev.event === "delta") {
            const d = safeJson(ev.data);
            if (typeof d?.text === "string" && d.text) {
              acc += d.text;
              setBubble(acc); // 말풍선 1개에 스트리밍.
            }
          } else if (ev.event === "actions") {
            const d = safeJson(ev.data);
            const raw = Array.isArray(d?.actions) ? (d!.actions as unknown[]) : [];
            const acts: unknown[] = [];
            for (const r of raw) {
              if (acts.length >= 8) break;
              if (!r || typeof r !== "object") continue;
              const a = r as { type?: unknown };
              if (typeof a.type !== "string" || !LINGO_ACTION_TYPES.has(a.type)) continue;
              acts.push(r);
            }
            proposalActions = acts;
          } else if (ev.event === "error") {
            const d = safeJson(ev.data);
            if (typeof d?.friendly === "string" && d.friendly && !acc) setBubble(d.friendly);
          }
        }
      }
    } catch {
      return failWhoosh();
    }
    // 빈 actions 로 done — 결과만 두고 확인으로 진행(중단 없음).
    // 오버레이 종료 후 카드에 일괄 반영(파서값 + AI값) — 연출 중에는 감춰 두었다가 여기서 등장.
    applyActions50(proposalActions);
    clearTimers();
    setSwallow(false);
    setStamped([...STAMP_KEYS]);
    setAssembling(false); // active=false → 오버레이 종료(스크롤 잠금 원복은 오버레이 소관).
    setAct(3);
    go("confirm");
  }

  // ── §E 확인 1탭 ───────────────────────────────────────────────────────────
  function submitEdit() {
    if (!editField) return;
    const parsed = parseKrwInput(textInput);
    if (!parsed.ok) {
      say(parsed.reason === "empty" ? DIRECTOR_MENTS_50.numEmpty : DIRECTOR_MENTS_50.numMixed);
      return;
    }
    const n = parsed.value;
    if (editField === "droppy" && (!Number.isInteger(n) || n < 0 || n > DROPY_PCT_MAX)) {
      setInlineErr(DIRECTOR_MENTS_50.droppyRange);
      return;
    }
    if (editField === "price") setPriceKrw(n);
    if (editField === "qty") setQtyNum(n);
    if (editField === "droppy") setDroppyPct(n);
    setEditField(null);
    setTextInput("");
    setInlineErr(null);
  }

  // ── 렌더 조각 ─────────────────────────────────────────────────────────────
  const isAskStep =
    step === "askName" || step === "askPrice" || step === "askQty" || step === "askDroppy";
  const isStepInput = step === "name" || step === "price" || step === "qty" || step === "droppy";
  const showSlotOverlay = !aiTitle && !aiSubtitle;
  // 히어로 빈 상태 = CardModelBody 가 자체 플레이스홀더를 그리는 조건(applied content/image/productimage 전무).
  const heroEmpty = !photoPreview && !videoSlot && videoUrl.trim().length === 0;
  const gbTiers = sellHow === "gb" ? buildGbProposal(priceKrw ?? 0, qtyNum ?? 0) : [];

  // 입력칸/주버튼 — DESIGN-LOCK v2 §3 패턴 원문 복제.
  const INPUT_CLS =
    "min-w-0 flex-1 rounded-xl bg-[#F4F4F5] px-3 py-3 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white";
  const INPUT_STYLE = { boxShadow: "inset 0 0 0 1px #E5E5E5" } as const;
  const PRIMARY_CLS =
    "flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-[#1D4ED8] px-4 text-[13px] font-bold text-white disabled:opacity-40 active:scale-[0.98]";
  const CARD_CLS =
    "rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)]";
  // 마이크 버튼 — 49 입력줄 실측 복제(2분기).
  //   인앱(:8274-8283) = [음성으로 만들기] 크롬 핸드오프 — WebView 안에서 마이크를 켜지 않는다(영구 락).
  //   정상(:8285-8296) = 원형 마이크. 미지원(인앱 아님 + SR 부재)이면 렌더 자체를 안 한다(가짜 버튼 0).
  const MicButton = () =>
    inAppNoMic ? (
      <button
        type="button"
        onClick={() => void startVoiceHandoff("/studio-lab", say)}
        aria-label="음성으로 만들기 — 크롬에서 이어져요"
        className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-[12px] font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
        style={{ backgroundColor: LINGO_BLUE }}
      >
        <Mic className="h-[14px] w-[14px]" strokeWidth={2.5} />
        음성으로 만들기
      </button>
    ) : showMic ? (
      <button
        type="button"
        onClick={onMicTap}
        aria-label={voice.listening ? "음성 입력 종료" : "음성으로 말하기"}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-50"
        style={{ backgroundColor: voice.listening ? "#DC2626" : LINGO_BLUE }}
      >
        {voice.listening && (
          <span
            className="absolute inset-0 animate-ping rounded-full"
            style={{ backgroundColor: "rgba(220,38,38,0.4)" }}
          />
        )}
        <Mic className="relative h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>
    ) : null;

  // 인식 중 회색 미리보기 — 49 :8228-8233 마크업 복제(우측 정렬 · italic · #A3A3A3).
  const InterimGhost = () =>
    interim ? (
      <div className="flex justify-end">
        <span className="max-w-[82%] rounded-2xl bg-[#F4F4F5] px-3 py-2 text-[13px] italic text-[#A3A3A3]">
          {interim}
        </span>
      </div>
    ) : null;

  const CHIP_CLS =
    "flex w-full min-h-[44px] items-center rounded-2xl bg-white p-4 text-left text-[14px] font-bold tracking-ko text-[#0A0A0A] [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.99] [word-break:keep-all]";

  return (
    <div className="min-h-screen pb-[240px]" style={{ backgroundColor: PAGE_BG }}>
      {/* §F 연출 keyframes — transform/opacity 전용 · 깜빡임 0 · reduced-motion 페이드만. */}
      {/* 도장 칩 등장·링만 50 소유(카드 무대 연출은 49 오버레이). transform/opacity 전용. */}
      <style>{`
        @keyframes w-ring{0%{transform:scale(.86);opacity:.9}100%{transform:scale(1.06);opacity:0}}
        .w-ring{animation:w-ring ${M.stampRingMs}ms ${M.easeOut} both}
        @keyframes w-in{0%{transform:translateY(4px);opacity:0}100%{transform:translateY(0);opacity:1}}
        .w-in{animation:w-in ${M.stampStaggerMs}ms ${M.easeOut} both}
        @media (prefers-reduced-motion: reduce){
          .w-ring,.w-in{animation:none!important;opacity:1!important;transform:none!important}
        }
      `}</style>

      <div className="mx-auto max-w-md px-5 pt-6">
        {/* 헤더 — 랩 전용(운영 링크 0). */}
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-bold tracking-ko text-[#0A0A0A]">스튜디오 랩</p>
          <span className="text-[11px] font-semibold text-[#8A8A8A]">
            {store?.display_name ?? "매장 미연결"} · {act}막
          </span>
        </div>

        {/* ── §C 상주 거울 카드 — 화면 상단 고정. 슬롯은 최종 값과 같은 높이 선점(시프트 0).
            연출 = 49 정본 오버레이(딤·스포트라이트·말풍선·체크리스트) — 49 :5150-5164 배치 복제. ── */}
        <div className="relative mt-4" data-assemble-anchor="hero">
          <CardModelBody model={cardModel} variant="studio" showShareFooter={false} />

          {/* 제목·한마디 미도착 = 점선 슬롯 오버레이(CardModelBody 는 폴백이 없다 — 실측 계약).
              히어로가 빈 상태면 CardModelBody 자체 플레이스홀더("덱에서 콘텐츠를 장착하세요")와
              겹치므로, 그때는 히어로 영역 밖(카드 하단 본문 슬롯 자리)으로 한정한다. */}
          {showSlotOverlay && (
            <div
              className={`pointer-events-none absolute inset-x-0 flex justify-center ${
                heroEmpty ? "bottom-5" : "top-0 pt-[46%]"
              }`}
            >
              <span className="rounded-full border-[1.5px] border-dashed px-3 py-1 text-[11px] font-bold" style={{ borderColor: LINGO_BLUE, color: LINGO_BLUE, backgroundColor: "#EEF3FE" }}>
                제목·한마디 — 링고가 채워요
              </span>
            </div>
          )}

          <LingoAssembleOverlay
            active={assembling}
            steps={ASSEMBLE_STEPS}
            step={overlayStep}
            accent={LINGO_BLUE}
            onSkip={skipWhoosh}
          />
        </div>

        {/* ── 도장 4연타 결과 — 재료 칩(값이 실제로 있을 때만) ── */}
        {act >= 2 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {productName.trim() && stamped.includes("name") && (
              <span className="w-in relative rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                {productName.trim()} ✦
                <span className="w-ring pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 2px ${LINGO_BLUE}` }} />
              </span>
            )}
            {stamped.includes("priceQty") && (priceKrw != null || qtyNum != null) && (
              <span className="w-in rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                {priceKrw != null ? `${priceKrw.toLocaleString("ko-KR")}원` : ""}
                {priceKrw != null && qtyNum != null ? " · " : ""}
                {qtyNum != null ? `${qtyNum.toLocaleString("ko-KR")}개` : ""}
              </span>
            )}
            {stamped.includes("droppy") && droppyPct != null && (
              <span className="w-in rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                나눔 {droppyPct}%
              </span>
            )}
            {stamped.includes("tiers") && gbTiers.length > 0 && (
              <span className="w-in rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                단계 {gbTiers.length}
              </span>
            )}
          </div>
        )}

        {/* ── §E 확인 1탭 ── */}
        {step === "confirm" && !confirmed && (
          <div className="mt-4 rounded-2xl border border-[#C7D7FB] bg-[#EEF3FE] p-4">
            <p className="text-[12px] font-bold text-[#1D4ED8] [word-break:keep-all]">
              {DIRECTOR_MENTS_50.confirmNumbers}
            </p>
            <p className="mt-1.5 text-[12.5px] font-semibold tabular-nums text-[#0A0A0A] [word-break:keep-all]">
              가격 {priceKrw != null ? priceKrw.toLocaleString("ko-KR") : "—"}원 · 수량{" "}
              {qtyNum != null ? qtyNum.toLocaleString("ko-KR") : "—"}개 · 몫 {droppyPct ?? "—"}%
              {gbTiers.length > 0 ? " · 단계표는 계산기" : ""}
            </p>

            {sellHow === "gb" && (
              <div className="mt-3">
                <p className="text-[12px] font-bold text-[#0A0A0A]">{DIRECTOR_MENTS_50.gbFailInline}</p>
                <div className="mt-1.5 flex gap-2">
                  {GBFAIL_CHIPS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setGbFailMode(c.key)}
                      className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl text-[13px] font-bold active:scale-[0.98] ${
                        gbFailMode === c.key
                          ? "bg-[#1D4ED8] text-white"
                          : "bg-white text-[#0A0A0A] [box-shadow:0_0_0_1px_#E8E8EC]"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editField && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={textInput}
                    onChange={(e) => { setTextInput(e.target.value); setInlineErr(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submitEdit(); } }}
                    inputMode="numeric"
                    placeholder={editField === "price" ? "25000" : editField === "qty" ? "50" : String(DIRECTOR_DROPPY_RATE_DEFAULT)}
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                  />
                  <button type="button" onClick={submitEdit} disabled={!textInput.trim()} className={PRIMARY_CLS}>
                    입력
                  </button>
                </div>
                {inlineErr && (
                  <p className="px-1 text-[11.5px] font-semibold text-[#DC2626] [word-break:keep-all]">{inlineErr}</p>
                )}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // §3 — 재료 확정(로컬 상태만). 저장·발행 호출 0(P3 범위) · 기존 멘트로 응답.
                  setConfirmed(true);
                  setEditField(null);
                  say(DIRECTOR_MENTS_50.reviewReady);
                }}
                className={`${PRIMARY_CLS} flex-1`}
              >
                맞아요 — 다음
              </button>
              <button
                type="button"
                onClick={() => setEditField(editField ? null : "price")}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#525252] [box-shadow:0_0_0_1px_#E8E8EC] active:scale-[0.98]"
              >
                숫자 고칠래요
              </button>
            </div>
            {editField && (
              <div className="mt-2 flex gap-2">
                {(["price", "qty", "droppy"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setEditField(f); setTextInput(""); }}
                    className={`flex min-h-[36px] flex-1 items-center justify-center rounded-xl text-[12px] font-bold ${
                      editField === f ? "bg-[#16161D] text-white" : "bg-white text-[#525252] [box-shadow:0_0_0_1px_#E8E8EC]"
                    }`}
                  >
                    {f === "price" ? "가격" : f === "qty" ? "수량" : "몫"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* §3 — 확정 상태 표시(죽은 버튼 해소). 저장·발행 호출 0(P3 범위). */}
        {confirmed && (
          <div className="mt-4 rounded-2xl border border-[#C7D7FB] bg-[#EEF3FE] p-4">
            <p className="text-[12px] font-bold text-[#1D4ED8]">재료 확정 ✓</p>
            <p className="mt-1.5 text-[12.5px] font-semibold tabular-nums text-[#0A0A0A] [word-break:keep-all]">
              가격 {priceKrw != null ? priceKrw.toLocaleString("ko-KR") : "—"}원 · 수량{" "}
              {qtyNum != null ? qtyNum.toLocaleString("ko-KR") : "—"}개 · 몫 {droppyPct ?? "—"}%
            </p>
            <p className="mt-2 text-[11px] font-semibold text-[#8A8A8A]">
              3막 검수·발행은 다음 업데이트
            </p>
          </div>
        )}
      </div>

      {/* ── 하단 링고 존 — 지니 + 말풍선 1개 + 입력줄/칩 (DESIGN-LOCK v2 §3 하단 바) ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E8E8EC] pb-[env(safe-area-inset-bottom)]"
        style={{ backgroundColor: PAGE_BG }}
      >
        <div className="mx-auto max-w-md px-5 pb-4 pt-3">
          <div className="flex items-start gap-2.5">
            {/* §0 실측 지니 — 직접 그린 원 제거. 조립 중 talking. */}
            <span
              className="shrink-0 transition-transform duration-500"
              style={{ transform: swallow ? `scale(${M.swallowScale})` : "scale(1)" }}
            >
              <LingoGenie size={40} variant="avatar" talking={voice.speaking || assembling} />
            </span>
            <p className="min-w-0 flex-1 rounded-2xl bg-white px-3.5 py-2.5 text-[13px] font-semibold leading-relaxed tracking-ko text-[#16161D] [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)] [word-break:keep-all]">
              {bubble}
            </p>
            {/* 낭독 토글 — 49 :8138-8150 실측 복제(OFF 시 대기분 절단). */}
            <button
              type="button"
              aria-label={voice.ttsOn ? "낭독 끄기" : "낭독 켜기"}
              aria-pressed={voice.ttsOn}
              onClick={() => {
                if (voice.ttsOn) voice.stopSpeaking();
                voice.toggleTts();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
              style={
                voice.ttsOn
                  ? { backgroundColor: "#EEF3FE", color: "#1D4ED8" }
                  : { backgroundColor: "#F4F4F5", color: "#9A9A9A" }
              }
            >
              {voice.ttsOn ? <Volume2 className="h-4 w-4" strokeWidth={2.5} /> : <VolumeX className="h-4 w-4" strokeWidth={2.5} />}
            </button>
          </div>

          {/* 인식 중 미리보기 — 입력줄 위. */}
          {interim && <div className="mt-2">{InterimGhost()}</div>}

          {/* 인앱 안내 1줄 — 49 :8311-8320 동형. 인앱 전용 안내가 구 미지원 문구를 대체(이중 안내 방지). */}
          {inAppNoMic ? (
            <p className="mt-1.5 text-center text-[10px] font-medium text-[#B4B4B4] [word-break:keep-all]">
              {V6_INAPP_NOTICE}
            </p>
          ) : (
            !micUsable && (
              <p className="mt-1.5 text-center text-[10px] font-medium text-[#B4B4B4]">
                음성은 크롬에서 쓸 수 있어요. 지금은 입력으로 편집해요.
              </p>
            )
          )}

          <div className="mt-2.5 space-y-2">
            {/* 목적 4택 */}
            {step === "purpose" &&
              PURPOSE_CHIPS.map((c) => (
                <button key={c.key} type="button" onClick={() => pickPurpose(c.key)} className={`${CHIP_CLS} gap-2.5`}>
                  <c.Icon className="h-[18px] w-[18px] shrink-0 text-[#525252]" strokeWidth={2.25} />
                  {c.label}
                </button>
              ))}

            {step === "sellHow" &&
              SELLHOW_CHIPS.map((c) => (
                <button key={c.key} type="button" onClick={() => pickSellHow(c.key)} className={`${CHIP_CLS} flex-col items-start`}>
                  <span className="text-[15px] font-bold text-[#0A0A0A]">{c.label}</span>
                  <span className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all]">{c.desc}</span>
                </button>
              ))}

            {step === "hostHow" &&
              HOSTHOW_CHIPS.map((c) => (
                <button key={c.key} type="button" onClick={() => pickHostHow(c.key)} className={`${CHIP_CLS} flex-col items-start`}>
                  <span className="text-[15px] font-bold text-[#0A0A0A]">{c.label}</span>
                  <span className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all]">{c.desc}</span>
                </button>
              ))}

            {step === "photo" && (
              <>
                <label className={`${CHIP_CLS} cursor-pointer justify-center text-[#1D4ED8]`}>
                  사진 고르기
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) submitPhoto(f); }} />
                </label>
                {/* 보조 칩 — 영상도 있으면 기존 선행 체인 재사용. */}
                <button type="button" onClick={() => go("video")} className={CHIP_CLS}>
                  🔗 영상도 있어요
                </button>
              </>
            )}

            {step === "video" && (
              <div className="flex items-center gap-2">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submitVideo(); } }}
                  inputMode="url"
                  placeholder="영상 링크 붙여넣기"
                  className={INPUT_CLS}
                  style={INPUT_STYLE}
                />
                <button type="button" onClick={submitVideo} disabled={!textInput.trim()} className={PRIMARY_CLS}>입력</button>
              </div>
            )}

            {step === "oneLiner" && (
              <div className="flex items-center gap-2">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submitOneLiner(); } }}
                  placeholder="찰옥수수 25000원 50박스, 나눔 10%"
                  className={INPUT_CLS}
                  style={INPUT_STYLE}
                />
                {MicButton()}
                <button type="button" onClick={submitOneLiner} disabled={!textInput.trim()} className={PRIMARY_CLS}>입력</button>
              </div>
            )}

            {(isAskStep || isStepInput) && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={textInput}
                    onChange={(e) => { setTextInput(e.target.value); setInlineErr(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submitAsk(); } }}
                    inputMode={step === "askName" || step === "name" ? "text" : "numeric"}
                    placeholder={
                      step === "askName" || step === "name"
                        ? "찰옥수수 10개입"
                        : step === "askPrice" || step === "price"
                          ? "25000"
                          : step === "askQty" || step === "qty"
                            ? "50"
                            : String(DIRECTOR_DROPPY_RATE_DEFAULT)
                    }
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                  />
                  {MicButton()}
                  <button type="button" onClick={submitAsk} disabled={!textInput.trim()} className={PRIMARY_CLS}>입력</button>
                </div>
                {inlineErr && <p className="px-1 text-[11.5px] font-semibold text-[#DC2626] [word-break:keep-all]">{inlineErr}</p>}
              </div>
            )}

            {step === "gbPropose" && (
              <div className="space-y-2">
                <span className="inline-flex items-center rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">제안</span>
                {gbRows.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-xl bg-white p-2 [box-shadow:0_0_0_1px_#E8E8EC] ${gbEditing && gbBad ? "ring-1 ring-inset ring-[#DC2626]" : ""}`}>
                    <input value={r.qty} readOnly={!gbEditing} inputMode="numeric" onChange={(e) => setGbRows((d) => d.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="h-10 w-0 min-w-0 flex-1 rounded-lg bg-[#F4F4F5] px-2 text-center text-[13px] font-semibold text-[#0A0A0A] outline-none" />
                    <span className="text-[11px] font-semibold text-[#8A8A8A]">개</span>
                    <input value={r.price} readOnly={!gbEditing} inputMode="numeric" onChange={(e) => setGbRows((d) => d.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="h-10 w-0 min-w-0 flex-1 rounded-lg bg-[#F4F4F5] px-2 text-center text-[13px] font-semibold text-[#0A0A0A] outline-none" />
                    <span className="text-[11px] font-semibold text-[#8A8A8A]">원</span>
                  </div>
                ))}
                {gbEditing && gbBad && (
                  <p className="px-1 text-[11.5px] font-semibold text-[#DC2626] [word-break:keep-all]">
                    {/* Duke 확정 문구 — 재량 수정 금지. */}
                    수량은 늘고 가격은 내려가야 해요 — 마지막 단계는 준비 수량을 넘을 수 없어요.
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { if (!gbBad) go("gbFail"); }} disabled={gbBad} className={`${PRIMARY_CLS} flex-1`}>이대로</button>
                  {!gbEditing && (
                    <button type="button" onClick={() => setGbEditing(true)} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#525252] [box-shadow:0_0_0_1px_#E8E8EC] active:scale-[0.98]">바꿀래요</button>
                  )}
                </div>
              </div>
            )}

            {step === "gbFail" && (
              <div className="flex gap-2">
                {GBFAIL_CHIPS.map((c) => (
                  <button key={c.key} type="button" onClick={() => { setGbFailMode(c.key); void runWhoosh(); }} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#0A0A0A] [box-shadow:0_0_0_1px_#E8E8EC] active:scale-[0.98]">
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* 연출 중 건너뛰기는 오버레이 내부 버튼으로 단일화(P2.6) — 하단 중복 버튼 제거.
                딤(z-76) 아래라 실제로 눌리지도 않던 유령 버튼이었다. */}

            {/* 실패 — 재시도 2회까지. */}
            {assembleFailed && (
              <div className="flex gap-2">
                {retryCount <= ASSEMBLE_MAX_RETRY && (
                  <button type="button" onClick={() => void runWhoosh()} className={`${PRIMARY_CLS} flex-1`}>다시 시도</button>
                )}
                <button type="button" onClick={() => void navigate({ to: "/studio-build" })} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#525252] [box-shadow:0_0_0_1px_#E8E8EC] active:scale-[0.98]">
                  직접 할게요
                </button>
              </div>
            )}

            {/* 후퇴로 상시 — "하나씩"(기존 단계 스텝 재사용) · "직접 할게요". */}
            {!assembling && act === 1 && step !== "purpose" && (
              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => { setStepwise(true); go(purpose === "sell" ? (photoName ? "name" : "photo") : "video"); }}
                  className="flex min-h-[36px] flex-1 items-center justify-center text-[12px] font-semibold text-[#8A8A8A] active:text-[#525252]"
                >
                  하나씩 물어봐 주세요
                </button>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/studio-build" })}
                  className="flex min-h-[36px] flex-1 items-center justify-center text-[12px] font-semibold text-[#8A8A8A] active:text-[#525252]"
                >
                  직접 할게요
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardStudioPage50;
