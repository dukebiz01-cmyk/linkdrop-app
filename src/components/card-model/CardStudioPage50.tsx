// ════════════════════════════════════════════════════════════════════════════
// CardStudioPage50 — 50 트랙 골격 + 1막(재료 받기) 대화.
//
// DIRECTOR_MENTS_50 — Duke 확정(54창) · CC 재량 작문 금지 · 용어 락: 카드 단독 금지,
//   공유카드/공유할 수 있는 카드
//
// P2 범위: 1막(재료 받기) + 2막(조립 — AI 1콜·타임아웃·연출). 3막(검수)·4막(발행)은 다음 업데이트.
//   저장·발행 0건 · registerProduct 호출 0건 · Radix(Sheet/Dialog/Drawer) import 0(#418 SSR).
//   AI 호출 = /api/lingo/chat 1콜뿐(Edge·라우트 무수정 — 기존 계약 소비만).
//   49 에서 가져오는 것은 DIRECTOR_DROPPY_RATE_DEFAULT · isAiActionAllowed 2개뿐 —
//   49 의 DIRECTOR_MENTS 는 쓰지 않는다(50 대화는 DIRECTOR_MENTS_50 단일 소스).
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  parseKrwInput,
  buildGbProposal,
  gbRowsInvalid,
  DROPY_PCT_MAX,
} from "@/lib/studio-contract";
import {
  DIRECTOR_DROPPY_RATE_DEFAULT,
  isAiActionAllowed,
} from "@/components/card-model/CardStudioPage49";
// P2 §51 — 요청 context 는 기존 계약 타입에 맞춘다(타입만 import · 훅 미사용).
import type { LingoContext } from "@/components/card-model/useLingoChat";

// ── 멘트 정본 ───────────────────────────────────────────────────────────────
// Duke 확정 문구 — 한 글자도 재량 작문 금지.
//   droppyRange 만 P1 지시서 §1막 UI 규칙에서 신규 허용된 1건(범위 위반 인라인 문구).
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
  assembleOrder: "지금까지 받은 재료와 영상 요약으로 공유카드의 제목과 한마디, 상품 한마디를 지어 주세요. 영상과 입력값에 없는 사실은 쓰지 마세요. 가격·수량은 건드리지 마세요.",
  assembleTimeout: "지금 좀 느리네요. 잠시 뒤 다시 하거나, 직접 만드실 수도 있어요.",
  reviewReady: "다 됐어요. 고칠 곳이 있으면 말로 하시거나 눌러서 바꿔 주세요.",
  reviewNumberGuard: "가격·수량은 사장님만 바꿀 수 있어요 — 칸에 직접 적어 주세요.",
  publishReady: "마음에 드시면 카톡으로 내보내 주세요. 발행은 사장님만 누를 수 있어요.",
  done: "나갔어요. 손님이 누르는 순간부터 이 공유카드가 일해요.",
} as const;

// ── 상태 골격(명세 §3) ─────────────────────────────────────────────────────
type Act = 1 | 2 | 3 | 4; // P1은 1만 사용
type Purpose = "sell" | "host" | "tell" | null;
type SellHow = "solo" | "gb" | null;
type HostHow = "reserve" | "coupon" | null;
// mode 파생: sell→"commerce" · host→"reserve" · tell→"general" (StudioMode 3값 무접촉)
function modeOf(p: Purpose): "commerce" | "reserve" | "general" | null {
  return p === "sell" ? "commerce" : p === "host" ? "reserve" : p === "tell" ? "general" : null;
}

// 1막 시퀀스(50 자체 — 49 DirectorStep 재사용 아님):
//   purpose → (sellHow | hostHow) → video → name → photo → price → qty → droppy
//     → [gb 분기: gbPropose → gbFail] → summary
//   tell 경로: purpose → video → summary
//   host 경로: purpose → hostHow → video → summary  (예약 상세·쿠폰 상세는 P3+)
//   ※ name 은 sell 전용(host·tell 경로 무영향) — 2막 조립의 product_name 재료.
type Step50 =
  | "purpose"
  | "sellHow"
  | "hostHow"
  | "video"
  | "name"
  | "photo"
  | "price"
  | "qty"
  | "droppy"
  | "gbPropose"
  | "gbFail"
  | "summary";

// 스텝 → 멘트(진입 시 링고 말풍선). summary 진입 = assembleReady.
const STEP_MENT: Record<Step50, string> = {
  purpose: DIRECTOR_MENTS_50.start,
  sellHow: DIRECTOR_MENTS_50.sellHow,
  hostHow: DIRECTOR_MENTS_50.hostHow,
  video: DIRECTOR_MENTS_50.video,
  name: DIRECTOR_MENTS_50.name,
  photo: DIRECTOR_MENTS_50.photo,
  price: DIRECTOR_MENTS_50.price,
  qty: DIRECTOR_MENTS_50.qty,
  droppy: DIRECTOR_MENTS_50.droppy,
  gbPropose: DIRECTOR_MENTS_50.gbPropose,
  gbFail: DIRECTOR_MENTS_50.gbFail,
  summary: DIRECTOR_MENTS_50.assembleReady,
};

type Bubble = { role: "lingo" | "owner"; text: string };
type GbRow = { qty: string; price: string };

// 1차 칩 4개 — 지시서 원문 그대로(라벨 락).
const PURPOSE_CHIPS: { key: "sell" | "host" | "tell" | "form"; label: string }[] = [
  { key: "sell", label: "🌾 팔기 — 우리 것을 팔아 택배로 보내요" },
  { key: "host", label: "🏕 손님 받기 — 예약·쿠폰으로 손님이 찾아와요" },
  { key: "tell", label: "📣 알리기 — 소식만 전해요, 영상 하나면 돼요" },
  { key: "form", label: "🛠 직접 할게요 — 링고 없이 폼으로 만들어요" },
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
// P2 §58 — 49 :818-837 구조 승계(49 쪽이 비export 모듈 함수라 복제 — 49 무접촉 락 준수).
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

// 2막 타임아웃(§3·§5) — 조립 1콜 15s / 영상 선행 체인 8s.
const ASSEMBLE_TIMEOUT_MS = 15_000;
const VIDEO_LEAD_TIMEOUT_MS = 8_000;
// 연출 시차(§6) — 제목 → 한마디 → 포인트 예고, 각 300ms.
const REVEAL_STEP_MS = 300;
// 재시도 상한(§5) — 2회까지 [다시 시도], 3회째 실패면 [직접 할게요]만.
const ASSEMBLE_MAX_RETRY = 2;

export type CardStudioPage50Store = {
  id: string;
  display_name: string;
  contact_phone?: string | null;
};

export function CardStudioPage50({ store }: { store?: CardStudioPage50Store | null }) {
  const navigate = useNavigate();

  const [act, setAct] = useState<Act>(1); // P2 = 1막·2막. 3막·4막은 다음 업데이트.
  const [step, setStep] = useState<Step50>("purpose");
  const [log, setLog] = useState<Bubble[]>(() => [
    { role: "lingo", text: DIRECTOR_MENTS_50.start },
  ]);

  const [purpose, setPurpose] = useState<Purpose>(null);
  const [sellHow, setSellHow] = useState<SellHow>(null);
  const [hostHow, setHostHow] = useState<HostHow>(null);

  // 받은 재료
  const [videoUrl, setVideoUrl] = useState("");
  const [productName, setProductName] = useState(""); // sell 전용 — 2막 product_name 재료.
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [priceKrw, setPriceKrw] = useState<number | null>(null);
  const [qtyNum, setQtyNum] = useState<number | null>(null);
  const [droppyPct, setDroppyPct] = useState<number | null>(null);
  const [gbRows, setGbRows] = useState<GbRow[]>([]);
  const [gbEditing, setGbEditing] = useState(false);
  const [gbFailMode, setGbFailMode] = useState<"base" | "cancel" | null>(null);

  // 입력 버퍼 + 인라인 사유(무언 실패 금지 — 되물음은 말풍선, 범위 위반은 인라인).
  const [textInput, setTextInput] = useState("");
  const [inlineErr, setInlineErr] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);

  // ── 2막 상태 ──────────────────────────────────────────────────────────────
  // §1 — 영상 선행 체인 결과(state 아님 — 리렌더 불필요 · 실패 시 null 유지).
  const videoAiRef = useRef<{ title: string; summary: string; keyPoints: string[] } | null>(null);
  const videoLeadRef = useRef<string | null>(null); // 영상 교체 레이스 가드(49 :3594 관례).
  const sessionRef = useRef<string | null>(null); // SSE meta 의 session_id(P3 이어가기용 보관).
  const revealTimersRef = useRef<number[]>([]);
  const [assembling, setAssembling] = useState(false);
  const [assembleFailed, setAssembleFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  // AI 조립 결과 — 배선 3필드만(§60). 숫자·쿠폰·이미지는 case 자체를 만들지 않는다.
  const [aiTitle, setAiTitle] = useState("");
  const [aiSubtitle, setAiSubtitle] = useState("");
  const [aiHeadline, setAiHeadline] = useState("");
  // §7 — 셀링포인트 후보는 보관만(칩 UI 는 P3 검수 범위 — 이번엔 렌더 안 함).
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  // 연출 단계: 0=빈 프레임 / 1=제목 / 2=한마디 / 3=포인트 예고(종료).
  const [revealStep, setRevealStep] = useState(0);

  const clearRevealTimers = useCallback(() => {
    for (const t of revealTimersRef.current) clearTimeout(t);
    revealTimersRef.current = [];
  }, []);
  // 언마운트 정리 — 타이머 누수·사진 objectURL 회수.
  useEffect(() => {
    return () => {
      for (const t of revealTimersRef.current) clearTimeout(t);
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    };
  }, []);

  const say = useCallback((text: string) => {
    setLog((l) => [...l, { role: "lingo", text }]);
  }, []);
  const echo = useCallback((text: string) => {
    setLog((l) => [...l, { role: "owner", text }]);
  }, []);
  // 스텝 이동 = 그 스텝 멘트 1개 발화(대화가 곧 진행 지도).
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
  function pickPurpose(key: "sell" | "host" | "tell" | "form", label: string) {
    echo(label);
    if (key === "form") {
      // 죽은 버튼 금지 — 실제 이동(P1은 폼 임베드 안 함).
      void navigate({ to: "/studio-build" });
      return;
    }
    setPurpose(key);
    if (key === "sell") go("sellHow");
    else if (key === "host") go("hostHow");
    else go("video");
  }

  function pickSellHow(key: "solo" | "gb", label: string) {
    setSellHow(key);
    echo(label);
    go("video");
  }

  function pickHostHow(key: "reserve" | "coupon", label: string) {
    setHostHow(key);
    echo(label);
    if (key === "reserve") say(DIRECTOR_MENTS_50.reserveCouponNote);
    go("video");
  }

  // ── 영상 링크 ─────────────────────────────────────────────────────────────
  function submitVideo() {
    const v = textInput.trim();
    if (!v) return; // 빈칸은 버튼 disabled 로 이미 차단(표시 정직).
    setVideoUrl(v);
    echo(v);
    void loadVideoLead(v); // §1 — 백그라운드 선행 체인(대화는 기다리지 않는다).
    // tell·host 는 요약으로 직행(예약 상세·쿠폰 상세는 P3+). sell 만 재료 수집 계속.
    go(purpose === "sell" ? "name" : "summary");
  }

  // ── 상품명(sell 전용) ─────────────────────────────────────────────────────
  function submitName() {
    const v = textInput.trim();
    if (!v) return; // 빈칸은 버튼 disabled 로 이미 차단(표시 정직).
    setProductName(v);
    echo(v);
    go("photo");
  }

  // §1 — oembed → generate-summary 선행 체인(49 :3595-3619 실배선 복제).
  //   AbortSignal.timeout(8s) + 실패 시 무음(대화 계속 · ref 는 null 유지 = 조립이 폴백 처리).
  async function loadVideoLead(url: string) {
    videoLeadRef.current = url;
    videoAiRef.current = null;
    try {
      const oembedRes = await fetch("/api/oembed?url=" + encodeURIComponent(url), {
        signal: AbortSignal.timeout(VIDEO_LEAD_TIMEOUT_MS),
      });
      const oembedJson = (await oembedRes.json()) as { source_id?: string; title?: string | null };
      const sourceId = oembedJson?.source_id;
      if (!oembedRes.ok || !sourceId || videoLeadRef.current !== url) return;
      const title = typeof oembedJson.title === "string" ? oembedJson.title.trim() : "";
      // 제목만이라도 확보(요약 실패 시 video_summary 폴백 재료 — §44-45).
      videoAiRef.current = { title, summary: "", keyPoints: [] };
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
      setKeyPoints(points); // §7 — 보관만(P3 검수에서 칩으로 소비).
    } catch {
      /* 선행 체인 실패는 무음 — 조립은 videoUrl·입력값만으로 진행(빈 껍데기·가짜 안내 금지). */
    }
  }

  // ── 사진(로컬 미리보기만 — 업로드·저장 0건) ────────────────────────────────
  function submitPhoto(file: File) {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    setPhotoPreview(url);
    setPhotoName(file.name);
    echo(file.name);
    go("price");
  }

  // ── 숫자 스텝(price·qty·droppy) — parseKrwInput 경유 ───────────────────────
  function submitNumber() {
    const parsed = parseKrwInput(textInput);
    if (!parsed.ok) {
      // 되물음 말풍선 — 무언 실패 금지.
      say(parsed.reason === "empty" ? DIRECTOR_MENTS_50.numEmpty : DIRECTOR_MENTS_50.numMixed);
      setInlineErr(null);
      setTextInput("");
      return;
    }
    const n = parsed.value;
    if (step === "price") {
      setPriceKrw(n);
      echo(`${n.toLocaleString("ko-KR")}원`);
      go("qty");
      return;
    }
    if (step === "qty") {
      setQtyNum(n);
      echo(`${n.toLocaleString("ko-KR")}개`);
      go("droppy");
      return;
    }
    // droppy — 정수 0~DROPY_PCT_MAX 추가 검증(0 허용 = studio-contract buildDropyPayload 정본 일치).
    //   위반 = 인라인 문구(말풍선 아님).
    if (!Number.isInteger(n) || n < 0 || n > DROPY_PCT_MAX) {
      setInlineErr(DIRECTOR_MENTS_50.droppyRange);
      return;
    }
    setDroppyPct(n);
    echo(`${n}%`);
    if (sellHow === "gb") {
      setGbRows(buildGbProposal(priceKrw ?? 0, qtyNum ?? 0));
      setGbEditing(false);
      go("gbPropose");
      return;
    }
    go("summary");
  }

  // ── gb 단계표 ─────────────────────────────────────────────────────────────
  // 셀 단위 parseKrwInput(“3만” 절삭 차단) + 행 관계 검증(gbRowsInvalid) 이중.
  const gbCellsBad = useMemo(
    () => gbRows.some((r) => !parseKrwInput(r.qty).ok || !parseKrwInput(r.price).ok),
    [gbRows],
  );
  const gbBad = gbCellsBad || gbRowsInvalid(gbRows, qtyNum ?? 0);

  function confirmGbRows() {
    if (gbBad) return;
    echo(gbRows.map((r) => `${r.qty}개 ${Number(r.price).toLocaleString("ko-KR")}원`).join(" · "));
    go("gbFail");
  }

  function pickGbFail(key: "base" | "cancel", label: string) {
    setGbFailMode(key);
    echo(label);
    go("summary");
  }

  // ── 요약 재료(라벨 = 49 DIRECTOR_CHECK 기존 확정분 재사용) ─────────────────
  const summaryRows = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    const pLabel = PURPOSE_CHIPS.find((c) => c.key === purpose)?.label;
    if (pLabel) rows.push({ label: "목적", value: pLabel });
    if (sellHow) {
      rows.push({
        label: "판매 방식",
        value: SELLHOW_CHIPS.find((c) => c.key === sellHow)?.label ?? "",
      });
    }
    if (hostHow) {
      rows.push({
        label: "손님 맞이",
        value: HOSTHOW_CHIPS.find((c) => c.key === hostHow)?.label ?? "",
      });
    }
    if (videoUrl) rows.push({ label: "영상 링크", value: videoUrl });
    if (productName.trim()) rows.push({ label: "상품 이름", value: productName.trim() });
    if (photoName) rows.push({ label: "상품 사진", value: photoName });
    if (priceKrw != null) rows.push({ label: "판매 가격", value: `${priceKrw.toLocaleString("ko-KR")}원` });
    if (qtyNum != null) rows.push({ label: "준비 수량", value: `${qtyNum.toLocaleString("ko-KR")}개` });
    if (droppyPct != null) rows.push({ label: "공유 보상", value: `${droppyPct}%` });
    if (sellHow === "gb" && gbRows.length > 0) {
      rows.push({
        label: "모임 단계",
        value: gbRows.map((r) => `${r.qty}개 ${Number(r.price).toLocaleString("ko-KR")}원`).join(" · "),
      });
    }
    if (gbFailMode) {
      rows.push({
        label: "미달 처리",
        value: GBFAIL_CHIPS.find((c) => c.key === gbFailMode)?.label ?? "",
      });
    }
    return rows;
  }, [purpose, sellHow, hostHow, videoUrl, productName, photoName, priceKrw, qtyNum, droppyPct, gbRows, gbFailMode]);

  // ── 2막: 조립 ─────────────────────────────────────────────────────────────
  const mode50 = modeOf(purpose); // StudioMode 3값과 동형(49 무확장 락).

  // §3 — 요청 context. 타입은 기존 계약(LingoContext) 그대로 — 신규 키 0.
  function buildAssembleContext(): LingoContext {
    const m = mode50 ?? "general";
    const lead = videoAiRef.current;
    // 1막 name 스텝(sell 전용) 수집값. host·tell 경로는 빈 값 → 조건부 스프레드로 키 생략
    //   (없는 재료를 지어내지 않는다 — 그 경로의 제목은 video_summary 기반으로 짓는다).
    const nameForAi = productName.trim();
    const fields: Record<string, string> = {};
    // 1막 수집값만. 가격·수량은 넣지 않는다 — assembleOrder 가 "건드리지 마세요"를 명시하고
    //   클라 게이트(AI_BLOCKED_FIELDS)도 숫자 setField 를 차단한다(이중 정합).
    if (nameForAi) {
      fields.title = nameForAi; // 제목 후보 = 상품명(모델이 고쳐 쓸 출발점).
      fields.productName = nameForAi;
    }
    return {
      studio_state: {
        mode: m,
        applied_blocks: [],
        score: 0,
        card_title: nameForAi,
        ...(nameForAi ? { product_name: nameForAi } : {}),
        ...((priceKrw ?? 0) > 0 ? { product_price: priceKrw as number } : {}),
      },
      studio: { mode: m, deck: [], fields },
      ...(lead?.summary
        ? { video_summary: lead.summary }
        : lead?.title
          ? { video_summary: lead.title }
          : {}),
      ...(lead?.keyPoints?.length ? { key_points: lead.keyPoints } : {}),
    };
  }

  // §4 — 게이트 통과분만 50 로컬 state 로. 배선 3필드(title·subtitle·headline) 외 default return.
  //   숫자·쿠폰·이미지 case 는 만들지 않는다(49 이중 방어 승계 — 도달해도 무적용·무기록).
  function applyActions50(actions: unknown[]): boolean {
    const m = mode50 ?? "general";
    let applied = false;
    for (const raw of actions) {
      if (!isAiActionAllowed(m, raw)) continue;
      const a = raw as { type?: string; field?: string; value?: string };
      if (a.type !== "setField" || !a.field) continue;
      const v = a.value ?? "";
      switch (a.field) {
        case "title":
          setAiTitle(v);
          applied = true;
          break;
        case "subtitle":
          setAiSubtitle(v);
          applied = true;
          break;
        case "headline":
          setAiHeadline(v);
          applied = true;
          break;
        default:
          continue; // 미배선 필드 = 무적용·무기록("채워진 척" 금지).
      }
    }
    return applied;
  }

  // §6 — 슬롯 시차 공개(제목 → 한마디 → 포인트 예고, 300ms). [건너뛰기]는 즉시 종료.
  function startReveal() {
    clearRevealTimers();
    setRevealStep(0);
    for (let i = 1; i <= 3; i++) {
      const t = window.setTimeout(() => setRevealStep(i), REVEAL_STEP_MS * i);
      revealTimersRef.current.push(t);
    }
  }
  function skipReveal() {
    clearRevealTimers();
    setRevealStep(3); // 결과 즉시 반영 — AI 결과는 동일(연출만 종료).
  }

  function failAssemble() {
    setAssembling(false);
    setAssembleFailed(true);
    setRetryCount((c) => c + 1);
    say(DIRECTOR_MENTS_50.assembleTimeout);
  }

  // §3·§4·§5 — AI 조립 1콜.
  async function runAssemble() {
    if (assembling) return;
    setAct(2);
    setAssembling(true);
    setAssembleFailed(false);
    clearRevealTimers();
    setRevealStep(0);
    // 스트리밍 자리 말풍선 1개(delta 가 여기에 누적 — §61).
    setLog((l) => [...l, { role: "lingo", text: "" }]);
    const appendBot = (t: string) =>
      setLog((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "lingo") {
            next[i] = { ...next[i], text: next[i].text + t };
            break;
          }
        }
        return next;
      });
    let acc = "";
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
      if (!ct.includes("text/event-stream")) {
        failAssemble();
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        failAssemble();
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
            if (typeof d?.session_id === "string") sessionRef.current = d.session_id;
          } else if (ev.event === "delta") {
            const d = safeJson(ev.data);
            if (typeof d?.text === "string" && d.text) {
              acc += d.text;
              appendBot(d.text);
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
            if (typeof d?.friendly === "string" && d.friendly && !acc) appendBot(d.friendly);
          }
          // intent/done — 무시(done = reader 종료로 처리).
        }
      }
    } catch {
      // 타임아웃(AbortSignal)·네트워크 — 무언 실패 금지.
      failAssemble();
      return;
    }
    // §5 — 빈 actions 로 done: 말풍선 결과만 두고 진행은 허용(제목 비면 3막에서 직접 입력 — P3).
    applyActions50(proposalActions);
    setAssembling(false);
    setAssembleFailed(false);
    startReveal();
    say(DIRECTOR_MENTS_50.reviewReady);
  }

  const isNumberStep = step === "price" || step === "qty" || step === "droppy";
  const numPlaceholder =
    step === "price" ? "25000" : step === "qty" ? "50" : String(DIRECTOR_DROPPY_RATE_DEFAULT);

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    // 오브가 컨테이너 하단 absolute 로 붙으므로 relative + 하단 여백 확보(fixed 금지).
    <div className="relative min-h-screen bg-[#F7F7F9] pb-[168px]">
      <div className="mx-auto max-w-md px-5 pt-6">
        {/* 헤더 — 랩 전용(운영 링크 0). */}
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-bold tracking-ko text-[#0A0A0A]">스튜디오 랩</p>
          <span className="text-[11px] font-semibold text-[#8A8A8A]">
            {store?.display_name ?? "매장 미연결"} · {act}막
          </span>
        </div>

        {/* ── 2막 무대(§6) — 대화 영역 위. 진입 = 빈 공유카드 프레임, 슬롯이 시차로 채워진다.
            깜빡임 금지·가짜 로딩(프로그레스/퍼센트) 금지 — 대기 표시는 오브 펄스 하나뿐. */}
        {act === 2 && (
          <div className="mt-4">
            <div className="rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)]">
              {/* 제목 슬롯 */}
              <div className="min-h-[24px]">
                {revealStep >= 1 && aiTitle ? (
                  <p className="text-[16px] font-extrabold leading-snug tracking-ko text-[#0A0A0A] [word-break:keep-all]">
                    {aiTitle}
                  </p>
                ) : (
                  <div className="h-6 w-2/3 rounded-lg border border-dashed border-[#E0E0E4]" />
                )}
              </div>
              {/* 한마디 슬롯 */}
              <div className="mt-2 min-h-[20px]">
                {revealStep >= 2 && aiSubtitle ? (
                  <p className="text-[13px] font-semibold leading-relaxed tracking-ko text-[#525252] [word-break:keep-all]">
                    {aiSubtitle}
                  </p>
                ) : (
                  <div className="h-5 w-full rounded-lg border border-dashed border-[#E0E0E4]" />
                )}
              </div>
              {/* 상품 한마디(있을 때만 — 빈 껍데기 금지) */}
              {revealStep >= 2 && aiHeadline && (
                <p className="mt-2 text-[12.5px] font-semibold leading-relaxed tracking-ko text-[#1D4ED8] [word-break:keep-all]">
                  {aiHeadline}
                </p>
              )}
              {/* 사진 — 1막에서 받은 실물(가짜 플레이스홀더 아님) */}
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="상품 사진 미리보기"
                  className="mt-3 h-32 w-full rounded-xl object-cover"
                />
              )}
              {/* 포인트 도착 예고 칩 — 키포인트가 실제로 있을 때만(칩 UI 본체는 P3). */}
              {revealStep >= 3 && keyPoints.length > 0 && (
                <span className="mt-3 inline-flex items-center rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                  포인트 {keyPoints.length}개 도착
                </span>
              )}
            </div>

            {/* 건너뛰기 — 연출 중 상시(§72). 결과는 동일, 연출만 즉시 종료. */}
            {revealStep < 3 && !assembleFailed && (
              <button
                type="button"
                onClick={skipReveal}
                className="mt-2 flex min-h-[36px] w-full items-center justify-center text-[12px] font-semibold text-[#8A8A8A] active:text-[#525252]"
              >
                건너뛰기
              </button>
            )}

            {/* 실패(§5) — 타임아웃·네트워크·error 이벤트 공통. 3회째부터 [다시 시도] 제거. */}
            {assembleFailed && (
              <div className="mt-2 flex gap-2">
                {retryCount <= ASSEMBLE_MAX_RETRY && (
                  <button
                    type="button"
                    onClick={() => void runAssemble()}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#1D4ED8] text-[13px] font-bold text-white active:scale-[0.98]"
                  >
                    다시 시도
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/studio-build" })}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#525252] [box-shadow:0_0_0_1px_#E8E8EC] active:scale-[0.98]"
                >
                  직접 할게요
                </button>
              </div>
            )}

            {/* P2 종점 — 3막 자리 표시(버튼 없음). */}
            {!assembling && !assembleFailed && revealStep >= 3 && (
              <p className="mt-3 text-center text-[11px] font-semibold text-[#8A8A8A]">
                3막 검수는 다음 업데이트
              </p>
            )}
          </div>
        )}

        {/* 대화 스크롤 — 링고 좌 / 사장님 우. */}
        <div className="mt-4 space-y-2">
          {log.map((b, i) => (
            <div key={i} className={`flex ${b.role === "owner" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold leading-relaxed tracking-ko [word-break:keep-all] ${
                  b.role === "owner"
                    ? "bg-[#1D4ED8] text-white"
                    : "bg-white text-[#16161D] [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)]"
                }`}
              >
                {b.text}
              </p>
            </div>
          ))}
        </div>

        {/* 칩·입력 — 링고 말풍선 아래(화면당 최대 4개). 2막 진입 시 1막 입력면은 닫는다
            ("만드는 동안은 아무것도 안 물어봐요" — assembleReady 계약). */}
        <div className={`mt-4 space-y-2 ${act === 1 ? "" : "hidden"}`}>
          {step === "purpose" &&
            PURPOSE_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => pickPurpose(c.key, c.label)}
                className="flex w-full min-h-[44px] items-center rounded-2xl bg-white p-4 text-left text-[14px] font-bold tracking-ko text-[#0A0A0A] [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.99] [word-break:keep-all]"
              >
                {c.label}
              </button>
            ))}

          {step === "sellHow" &&
            SELLHOW_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => pickSellHow(c.key, c.label)}
                className="flex w-full min-h-[44px] flex-col items-start rounded-2xl bg-white p-4 text-left [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.99]"
              >
                <span className="text-[15px] font-bold text-[#0A0A0A]">{c.label}</span>
                <span className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
                  {c.desc}
                </span>
              </button>
            ))}

          {step === "hostHow" &&
            HOSTHOW_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => pickHostHow(c.key, c.label)}
                className="flex w-full min-h-[44px] flex-col items-start rounded-2xl bg-white p-4 text-left [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.99]"
              >
                <span className="text-[15px] font-bold text-[#0A0A0A]">{c.label}</span>
                <span className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
                  {c.desc}
                </span>
              </button>
            ))}

          {step === "video" && (
            <div className="flex items-center gap-2">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitVideo();
                  }
                }}
                inputMode="url"
                placeholder="영상 링크 붙여넣기"
                className="min-w-0 flex-1 rounded-xl bg-white px-3 py-3 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
                style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
              />
              <button
                type="button"
                onClick={submitVideo}
                disabled={!textInput.trim()}
                className="flex min-h-[44px] shrink-0 items-center rounded-xl bg-[#1D4ED8] px-4 text-[13px] font-bold text-white disabled:opacity-40 active:scale-[0.98]"
              >
                입력
              </button>
            </div>
          )}

          {step === "name" && (
            <div className="flex items-center gap-2">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitName();
                  }
                }}
                inputMode="text"
                placeholder="찰옥수수 10개입"
                className="min-w-0 flex-1 rounded-xl bg-white px-3 py-3 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
                style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
              />
              <button
                type="button"
                onClick={submitName}
                disabled={!textInput.trim()}
                className="flex min-h-[44px] shrink-0 items-center rounded-xl bg-[#1D4ED8] px-4 text-[13px] font-bold text-white disabled:opacity-40 active:scale-[0.98]"
              >
                입력
              </button>
            </div>
          )}

          {step === "photo" && (
            <label className="flex w-full min-h-[44px] cursor-pointer items-center justify-center rounded-2xl bg-white p-4 text-[14px] font-bold text-[#1D4ED8] [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)]">
              사진 고르기
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) submitPhoto(f);
                }}
              />
            </label>
          )}

          {isNumberStep && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  value={textInput}
                  onChange={(e) => {
                    setTextInput(e.target.value);
                    setInlineErr(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      submitNumber();
                    }
                  }}
                  inputMode="numeric"
                  /* S0 원칙 — 프리필 금지: 추천값은 placeholder 로만 보여준다. */
                  placeholder={numPlaceholder}
                  className="min-w-0 flex-1 rounded-xl bg-white px-3 py-3 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
                  style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                />
                <button
                  type="button"
                  onClick={submitNumber}
                  disabled={!textInput.trim()}
                  className="flex min-h-[44px] shrink-0 items-center rounded-xl bg-[#1D4ED8] px-4 text-[13px] font-bold text-white disabled:opacity-40 active:scale-[0.98]"
                >
                  입력
                </button>
              </div>
              {inlineErr && (
                <p className="px-1 text-[11.5px] font-semibold text-[#DC2626] [word-break:keep-all]">
                  {inlineErr}
                </p>
              )}
            </div>
          )}

          {step === "gbPropose" && (
            <div className="space-y-2">
              {/* "제안" 라벨 명시 — 확정 전 표시 전용(49 :7781 관례 동형). */}
              <span className="inline-flex items-center rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                제안
              </span>
              {gbRows.map((r, i) => {
                const bad =
                  !parseKrwInput(r.qty).ok ||
                  !parseKrwInput(r.price).ok ||
                  gbRowsInvalid(gbRows.slice(0, i + 1), i === gbRows.length - 1 ? (qtyNum ?? 0) : 0);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-xl bg-white p-2 [box-shadow:0_0_0_1px_#E8E8EC] ${
                      gbEditing && bad ? "ring-1 ring-inset ring-[#DC2626]" : ""
                    }`}
                  >
                    <input
                      value={r.qty}
                      readOnly={!gbEditing}
                      inputMode="numeric"
                      onChange={(e) =>
                        setGbRows((d) => d.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))
                      }
                      className="h-10 w-0 min-w-0 flex-1 rounded-lg bg-[#F4F4F5] px-2 text-center text-[13px] font-semibold text-[#0A0A0A] outline-none"
                    />
                    <span className="text-[11px] font-semibold text-[#8A8A8A]">개</span>
                    <input
                      value={r.price}
                      readOnly={!gbEditing}
                      inputMode="numeric"
                      onChange={(e) =>
                        setGbRows((d) => d.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                      }
                      className="h-10 w-0 min-w-0 flex-1 rounded-lg bg-[#F4F4F5] px-2 text-center text-[13px] font-semibold text-[#0A0A0A] outline-none"
                    />
                    <span className="text-[11px] font-semibold text-[#8A8A8A]">원</span>
                  </div>
                );
              })}
              {gbEditing && gbBad && (
                <p className="px-1 text-[11.5px] font-semibold text-[#DC2626] [word-break:keep-all]">
                  {/* Duke 확정 문구 — 재량 수정 금지. */}
                  수량은 늘고 가격은 내려가야 해요 — 마지막 단계는 준비 수량을 넘을 수 없어요.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmGbRows}
                  disabled={gbBad}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#1D4ED8] text-[13px] font-bold text-white disabled:opacity-40 active:scale-[0.98]"
                >
                  이대로
                </button>
                {!gbEditing && (
                  <button
                    type="button"
                    onClick={() => setGbEditing(true)}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#525252] [box-shadow:0_0_0_1px_#E8E8EC] active:scale-[0.98]"
                  >
                    바꿀래요
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "gbFail" && (
            <div className="flex gap-2">
              {GBFAIL_CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pickGbFail(c.key, c.label)}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#0A0A0A] [box-shadow:0_0_0_1px_#E8E8EC] active:scale-[0.98]"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {step === "summary" && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white p-4 [box-shadow:0_0_0_1px_#E8E8EC,0_1px_2px_rgba(15,23,42,0.04)]">
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#737373]">받은 재료</p>
                <div className="mt-2 space-y-1.5">
                  {summaryRows.map((r) => (
                    <div key={r.label} className="flex items-start gap-3">
                      <span className="w-[64px] shrink-0 text-[12px] font-semibold text-[#8A8A8A]">
                        {r.label}
                      </span>
                      <span className="min-w-0 flex-1 break-all text-[12.5px] font-semibold text-[#0A0A0A] [word-break:keep-all]">
                        {r.value}
                      </span>
                    </div>
                  ))}
                </div>
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="상품 사진 미리보기"
                    className="mt-3 h-32 w-full rounded-xl object-cover"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => void runAssemble()}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#1D4ED8] text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
              >
                ✦ 만들어 주세요
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 오브 — 컨테이너 하단 중앙 absolute(fixed 금지 · 드래그·추적 없음).
          §6 — 2막에는 프레임 하단(위쪽)으로 이동하고, 대기 중에는 opacity 펄스만 준다.
          프로그레스 바·퍼센트 금지 — 진행 표시는 이 펄스 하나뿐. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 h-16 w-16 -translate-x-1/2 rounded-full transition-all duration-500 ${
          act === 2 ? "top-[168px] h-10 w-10" : "bottom-8"
        } ${assembling ? "animate-pulse" : ""}`}
        style={{
          background: "radial-gradient(circle at 32% 28%, #93C5FD 0%, #2563EB 58%, #1D4ED8 100%)",
          boxShadow: "0 12px 28px -10px rgba(29,78,216,0.55)",
        }}
      />
    </div>
  );
}

export default CardStudioPage50;
