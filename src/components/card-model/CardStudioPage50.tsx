// ════════════════════════════════════════════════════════════════════════════
// CardStudioPage50 — 50 트랙 골격 + 1막(재료 받기) 대화.
//
// DIRECTOR_MENTS_50 — Duke 확정(54창) · CC 재량 작문 금지 · 용어 락: 카드 단독 금지,
//   공유카드/공유할 수 있는 카드
//
// P1 범위: 1막(purpose → … → summary)까지. 2막(조립)·3막(검수)·4막(발행)은 다음 업데이트.
//   발행·저장·AI 호출 0건 · registerProduct 호출 0건 · Radix(Sheet/Dialog/Drawer) import 0(#418 SSR).
//   49 에서 가져오는 것은 DIRECTOR_DROPPY_RATE_DEFAULT 1개뿐 — 49 의 DIRECTOR_MENTS 는 쓰지 않는다.
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  parseKrwInput,
  buildGbProposal,
  gbRowsInvalid,
  DROPY_PCT_MAX,
} from "@/lib/studio-contract";
import { DIRECTOR_DROPPY_RATE_DEFAULT } from "@/components/card-model/CardStudioPage49";

// ── 멘트 정본 ───────────────────────────────────────────────────────────────
// Duke 확정 문구 — 한 글자도 재량 작문 금지.
//   droppyRange 만 P1 지시서 §1막 UI 규칙에서 신규 허용된 1건(범위 위반 인라인 문구).
export const DIRECTOR_MENTS_50 = {
  start: "사장님, 오셨네요. 오늘은 어떤 공유카드를 만들어 드릴까요? — 카톡으로 손님께 보내는, 공유할 수 있는 카드예요.",
  sellHow: "어떻게 파실 건가요?",
  hostHow: "손님이 오게 만들어 볼게요. 어떤 걸로 할까요?",
  reserveCouponNote: "예약에는 쿠폰이 같이 붙어요 — 오신 손님께 드릴 혜택이에요.",
  video: "영상 하나만 주세요. 보고 제가 공유카드를 짜요.",
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
//   purpose → (sellHow | hostHow) → video → photo → price → qty → droppy
//     → [gb 분기: gbPropose → gbFail] → summary(P1 종점)
//   tell 경로: purpose → video → summary
//   host 경로: purpose → hostHow → video → summary  (예약 상세·쿠폰 상세는 P2)
type Step50 =
  | "purpose"
  | "sellHow"
  | "hostHow"
  | "video"
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

export type CardStudioPage50Store = {
  id: string;
  display_name: string;
  contact_phone?: string | null;
};

export function CardStudioPage50({ store }: { store?: CardStudioPage50Store | null }) {
  const navigate = useNavigate();

  const [act] = useState<Act>(1); // P1은 1막 고정.
  const [step, setStep] = useState<Step50>("purpose");
  const [log, setLog] = useState<Bubble[]>(() => [
    { role: "lingo", text: DIRECTOR_MENTS_50.start },
  ]);

  const [purpose, setPurpose] = useState<Purpose>(null);
  const [sellHow, setSellHow] = useState<SellHow>(null);
  const [hostHow, setHostHow] = useState<HostHow>(null);

  // 받은 재료
  const [videoUrl, setVideoUrl] = useState("");
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
    // tell·host 는 P1 종점이 summary(예약 상세·쿠폰 상세는 P2). sell 만 재료 수집 계속.
    go(purpose === "sell" ? "photo" : "summary");
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
  }, [purpose, sellHow, hostHow, videoUrl, photoName, priceKrw, qtyNum, droppyPct, gbRows, gbFailMode]);

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

        {/* 칩·입력 — 링고 말풍선 아래(화면당 최대 4개). */}
        <div className="mt-4 space-y-2">
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
                disabled
                className="flex min-h-[48px] w-full cursor-not-allowed items-center justify-center rounded-2xl bg-[#F0F0F0] text-[14px] font-bold text-[#9A9A9A]"
              >
                ✦ 만들어 주세요
              </button>
              <p className="text-center text-[11px] font-semibold text-[#8A8A8A]">
                2막은 다음 업데이트
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 오브 — 컨테이너 하단 중앙 absolute(fixed 금지 · 드래그·추적 없음).
          연출 자산 통합은 P2 — 지금은 단순 그라데이션 원. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle at 32% 28%, #93C5FD 0%, #2563EB 58%, #1D4ED8 100%)",
          boxShadow: "0 12px 28px -10px rgba(29,78,216,0.55)",
        }}
      />
    </div>
  );
}

export default CardStudioPage50;
