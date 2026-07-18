// HOME-LINGO — 홈 링고 박스.
// LINGO-UI-2 — 부유(fixed) 캡슐↔패널 독 폐기 → 수익배너 바로 밑 인라인 아코디언 수납.
//   기능 전량 보존: GREET 3분기(칩)·음성(SlideToMic+자동전송)·핸드오프·intent 칩·성과 진단.
//   접힘 = 언마운트 아님(상시 마운트, open 만 토글) — 대화 상태·close() 장기기억 계약 유지.
//   훅은 useLingo 창구 경유(세션 승계 트랙에서 내부 스토어 교체 예정 — UI는 창구만 바라봄).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircle, Sparkles, ChevronDown, ArrowUp, Square, Loader2, Mic, Rocket, TrendingUp } from "lucide-react";
import { useLingo } from "@/components/lingo/useLingo";
import { SlideToMic } from "@/components/lingo/SlideToMic";
import { SpeakerToggle } from "@/components/lingo/SpeakerToggle";
import { HomePerformanceFacts } from "@/components/home/HomePerformanceFacts";
import { getInAppBrowser, type InAppBrowser } from "@/lib/pwa-install";
// KAKAO-LINGO-1b — 인앱 [음성으로 만들기] = 크롬 세션 핸드오프(스튜디오와 공용 헬퍼).
import { startVoiceHandoff } from "@/lib/voice-handoff";

const ACCENT = "#2563EB"; // 홈 링고 목적색(버튼·칩 — 기존 유지).
const BORDER_ACCENT = "#1D4ED8"; // LINGO-UI-2 §3-4 — 아코디언 컨테이너 테두리(D-1 락).

// §3-3 카피 락 — 한 글자도 임의 변경 금지.
const HEADER_COPY = "링고AI와 같이 링크드롭을 시작해 볼까요?"; // LINGO-UI-2-FIX-1 — 한 글자 락.
const GREETING_COPY =
  "안녕하세요, 링고AI예요. 저는 링크드롭의 안내자이자 어드바이저입니다. 무엇을 도와드릴까요? 링크드롭 사용법, 저와 함께 시작해볼까요?";
// LINGO-UI-2b-1 — 카드 소개 1줄(한 글자 락).
const GREETING_COPY_CARD_LINE = "영상 링크 하나로 쿠폰·예약이 되는 카드를 만들어 드려요.";

export function LingoHomeBox({
  cardCount,
  conversions30d,
  onGoStudio,
  openSignal,
  onOpenChange,
}: {
  /** 내 발행 카드 수(user.myCreatedDrops.length). 0=스타터 / 1+=메이커. */
  cardCount: number;
  /** LINGO-HOME-GREET-1 — 최근 30일 전환 실값(PerformanceBanner 단일 fetch 중계). null=미로드/오류. */
  conversions30d?: number | null;
  /** 스튜디오 배웅(카드 만들기 · 3층 행동 칩). purpose 선택. */
  onGoStudio: (purpose?: string) => void;
  /** 작업5 — 외부(마케팅 배너 "시작해 볼까요") 개시 신호. 값이 바뀌면 아코디언 펼침. */
  openSignal?: number;
  /** 작업5c — 열림 상태 보고(배너 세모 방향 동기 ▲접힘/▼펼침). */
  onOpenChange?: (open: boolean) => void;
}) {
  const { chat, voice } = useLingo("home");
  const navigate = useNavigate(); // LINGO-DRIVE-1 D-4 — explore 인텐트 이동용.
  const isMaker = cardCount > 0;
  // LINGO-HOME-GREET-1 — 상태 인지형 3분기(전부 클라 템플릿 — LLM 0). 폴백(전환 미로드/오류)
  //   = 카드 0장 분기(스타터 기준이 가장 무해 — 명세 확정). LINGO-UI-2 — 문구는 상태 칩으로 교체.
  const greet: "starter" | "share" | "perf" =
    cardCount === 0 || conversions30d == null
      ? "starter"
      : conversions30d === 0
        ? "share"
        : "perf";
  // LINGO-DRIVE-1 D-4 — intent 수신 시 안내 1줄(값당 1회 — 새 send 가 intent 를 리셋하면 재무장).
  const intentNotifiedRef = useRef<"create" | "explore" | null>(null);
  useEffect(() => {
    if (!chat.intent) {
      intentNotifiedRef.current = null;
      return;
    }
    if (intentNotifiedRef.current === chat.intent) return;
    intentNotifiedRef.current = chat.intent;
    chat.notify(
      chat.intent === "create"
        ? "스튜디오로 갈까요? 아래 버튼으로 바로 이어져요."
        : "둘러보러 갈까요? 아래 버튼으로 이어져요.",
    );
  }, [chat.intent, chat.notify, chat]);
  // KAKAO-LINGO-1 K-3 — 마운트 후 인앱 판정(hydration 안전 — 스튜디오 패턴 동형).
  const [inAppNoMic, setInAppNoMic] = useState<InAppBrowser | null>(null);
  useEffect(() => {
    setInAppNoMic(getInAppBrowser());
  }, []);

  // LINGO-UI-2 §3-1 — 구 view 이원 상태(캡슐/패널) → open 단일화. 접힘 = 헤더만(탭=토글).
  const [open, setOpen] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false); // 커밋2 — 메이커 성과 진단(1층 사실+3층 칩) 개시 여부.
  const [chatInput, setChatInput] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  // 작업5 — 마케팅 배너 "시작해 볼까요" 개시 신호 → 아코디언 펼침 + 화면 인입. 최초 0 은 무시.
  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setOpen(true);
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [openSignal]);

  // 작업5c — 열림 상태를 배너로 보고(세모 방향 ▲/▼ 동기).
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // 채팅 전송 — surface='home'(T-B 홈 인텐트). 메이커면 context.performance=true(T-D 성과 진단 재료).
  //   LINGO-UI-2-FIX-2 — 완주 응답 낭독 배선(원천 미배선 수복 · 스튜디오 sendChatText 패턴 복제):
  //   채널 무관(텍스트·마이크 유래 모두 이 함수 경유). ttsOn 게이트는 speak 내부가 담당.
  const sendChat = async (text: string) => {
    const t = text.trim();
    if (!t || chat.streaming || voice.listening) return;
    voice.stopSpeaking(); // 새 입력 = 진행 중 낭독 즉시 중단(기존 관례).
    setChatInput("");
    const finalText = await chat.send(t, "text", isMaker ? { performance: true } : {}, "home");
    if (finalText) voice.speak(finalText);
  };
  // LINGO-MIC-AUTOSEND-1 — final → 입력창 잠깐 표시(600ms) → 기존 sendChat(자동 전송). 빈 final=무전송.
  const micAutoSendRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startMic = () => {
    voice.stopSpeaking();
    if (voice.listening) return;
    voice.startListening((final) => {
      const t = final.trim();
      if (!t) return;
      setChatInput(t);
      if (micAutoSendRef.current) clearTimeout(micAutoSendRef.current);
      micAutoSendRef.current = setTimeout(() => {
        micAutoSendRef.current = null;
        void sendChat(t); // sendChat 이 입력창 비움·빈값·streaming 가드 담당(신규 전송 로직 0).
      }, 600);
    });
  };
  const stopMic = () => voice.stopListening();

  // 성과 진단 개시(메이커): 1층 사실(RPC 실값) 노출 + 2층 링고 해석 발화 1회(빈 대화면).
  const askPerformance = () => {
    setOpen(true);
    setPerfOpen(true);
    if (chat.messages.length === 0) void chat.send("내 카드 성과 어때?", "text", { performance: true }, "home");
  };

  // LINGO-UI-2 §3-2 ② — 상태 칩(3분기 로직 재사용). LINGO-UI-2b-1 — 신규 사용자 카피(한 글자 락).
  const chips =
    greet === "starter"
      ? [
          // LINGO-UI-2b-1 — 임시로 기존 학습형 sendChat 유지(b2에서 예시 카드 흐름으로 교체 예정).
          { key: "learn", label: "카드가 뭔지 볼래요", primary: true, onTap: () => void sendChat("링크드롭 사용법을 처음부터 알려주세요") },
          { key: "make", label: "같이 만들어 볼래요", primary: false, onTap: () => onGoStudio() },
        ]
      : greet === "share"
        ? [
            { key: "how-share", label: "친구에게 보내는 법", primary: true, onTap: () => void sendChat("만든 카드를 카톡으로 공유하는 방법을 알려주세요") },
            { key: "new", label: "새로 만들어 볼래요", primary: false, onTap: () => onGoStudio() },
          ]
        : [
            { key: "perf", label: "내 성과 보기", primary: true, onTap: askPerformance },
            { key: "new", label: "새로 만들어 볼래요", primary: false, onTap: () => onGoStudio() },
          ];

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]"
      style={{ borderColor: BORDER_ACCENT }}
    >
      {/* 접힘 헤더 — 항상 표시, 탭=토글(LingoAiHomeCard 아코디언 패턴 차용 — 코드는 자체 작성). */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
          <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
          <Sparkles className="absolute -right-0.5 -top-0.5 h-[11px] w-[11px]" strokeWidth={2.5} fill="currentColor" />
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-[#0F172A] [word-break:keep-all]">
          {HEADER_COPY}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
      </button>

      {/* 펼침 — 헤더 아래 인라인 확장(조건부 렌더 = 코드베이스 관례 · Radix 금지 준수). */}
      {open && (
        <div className="border-t border-[#E8EDF3] px-4 pb-4 pt-3">
          {/* ① 인사 전문(정적 템플릿 — LLM 0) — 대화 0건일 때만, 시작되면 메시지 영역이 대체. */}
          {chat.messages.length === 0 && (
            <>
              <p className="text-[13px] font-medium leading-relaxed text-[#404040] [word-break:keep-all]">
                {GREETING_COPY}
              </p>
              {/* LINGO-UI-2b-1 — 인사 전문 끝 카드 소개 1줄. */}
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#404040] [word-break:keep-all]">
                {GREETING_COPY_CARD_LINE}
              </p>
            </>
          )}

          {/* ② 상태 칩 — GREET 3분기(성과 진단 개시 후엔 1층 사실·3층 칩이 대체). */}
          {!(isMaker && perfOpen) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((c) =>
                c.primary ? (
                  <button key={c.key} type="button" onClick={c.onTap} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white active:scale-95" style={{ backgroundColor: ACCENT }}>
                    {c.key === "perf" ? <TrendingUp className="h-4 w-4" strokeWidth={2.25} /> : <Sparkles className="h-4 w-4" strokeWidth={2.25} />}
                    {c.label}
                  </button>
                ) : (
                  <button key={c.key} type="button" onClick={c.onTap} className="flex h-9 items-center rounded-full bg-white px-3 text-[12px] font-bold text-[#0A0A0A] [box-shadow:inset_0_0_0_1px_#E5E5E5] active:scale-95">
                    {c.label}
                  </button>
                ),
              )}
            </div>
          )}

          {/* 1층 사실 — 메이커 성과 개시 시 server 실값(LLM 0). 데이터 0 = 정직 안내 내장. */}
          {isMaker && perfOpen && <HomePerformanceFacts />}

          {/* ③ 대화 메시지 영역 — 기존 패널 렌더 이식(2층 링고 해석 포함). */}
          {chat.messages.length > 0 && (
            <div ref={listRef} className="mt-3 max-h-[220px] space-y-2 overflow-y-auto rounded-2xl bg-[#FAFAFA] p-3 [box-shadow:inset_0_0_0_1px_#EFEFEF]">
              {chat.messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] font-medium leading-relaxed [word-break:keep-all] ${m.role === "user" ? "rounded-br-md text-white" : "rounded-bl-md bg-white text-[#404040] [box-shadow:inset_0_0_0_1px_#ECECEE]"}`} style={m.role === "user" ? { backgroundColor: ACCENT } : undefined}>
                    {m.text || (m.streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} style={{ color: ACCENT }} /> : "")}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* LINGO-DRIVE-1 D-4 — 홈 intent 칩: create=스튜디오 / explore=둘러보기. */}
          {chat.intent && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (chat.intent === "create") onGoStudio();
                  else void navigate({ to: "/explore" });
                }}
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white active:scale-95"
                style={{ backgroundColor: ACCENT }}
              >
                <Rocket className="h-4 w-4" strokeWidth={2.25} />
                {chat.intent === "create" ? "만들러 가기" : "둘러보러 가기"}
              </button>
            </div>
          )}

          {/* 3층 다음 행동 — 스튜디오 배웅 칩(이동만). 메이커 성과 개시 시. */}
          {isMaker && perfOpen && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => onGoStudio()} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white active:scale-95" style={{ backgroundColor: ACCENT }}>
                <Rocket className="h-4 w-4" strokeWidth={2.25} /> 새로 만들어 볼래요
              </button>
            </div>
          )}

          {/* ④ 입력줄 — 기존 삼항 그대로 이식(마이크/핸드오프) + 스피커 토글(낭독 on/off 보존). */}
          <div className="mt-3 flex items-end gap-2">
            <span className="flex h-11 shrink-0 items-center">
              <SpeakerToggle ttsOn={voice.ttsOn} speaking={voice.speaking} onToggle={voice.toggleTts} accent={ACCENT} />
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-[#F4F4F5] py-1.5 pl-4 pr-1.5">
              <input
                value={chatInput}
                maxLength={2000}
                disabled={chat.streaming || voice.listening}
                placeholder={chat.streaming ? "링고가 생각 중…" : "링고AI에게 물어보기"}
                onChange={(e) => setChatInput(e.target.value)}
                onFocus={() => voice.stopSpeaking()}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void sendChat(chatInput); } }}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#9A9A9A] disabled:opacity-60"
              />
              {chat.streaming ? (
                <button type="button" aria-label="응답 중지" onClick={chat.stop} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#404040] text-white active:scale-95"><Square className="h-3.5 w-3.5" strokeWidth={2.5} fill="currentColor" /></button>
              ) : (
                <button type="button" aria-label="전송" onClick={() => void sendChat(chatInput)} disabled={!chatInput.trim() || voice.listening} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white active:scale-95 disabled:opacity-40" style={{ backgroundColor: ACCENT }}><ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} /></button>
              )}
            </div>
            {/* KAKAO-LINGO-1b — 인앱은 마이크 자리에 [음성으로 만들기] = 크롬 핸드오프(next=/home). */}
            {!inAppNoMic ? (
              <SlideToMic listening={voice.listening} disabled={chat.streaming} accent={ACCENT} onStart={startMic} onStop={stopMic} />
            ) : (
              <button
                type="button"
                onClick={() => void startVoiceHandoff("/home", chat.notify)}
                className="flex h-11 min-w-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white active:scale-95"
                style={{ backgroundColor: ACCENT }}
              >
                <Mic className="h-4 w-4" strokeWidth={2.5} />
                음성으로 만들기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
