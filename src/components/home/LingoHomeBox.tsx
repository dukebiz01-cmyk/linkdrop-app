// HOME-LINGO — 홈 링고 박스(P1.5 완성형 셸 재사용 패턴: 캡슐↔패널 2상태·드래그+경계 스냅·56px
//   마이크·다이어트 패널). 스튜디오 박스 무접촉(이관은 배포 후 별도 슬라이스) — 홈 전용 셸.
//   분기(발행 카드 수): 0장=스타터("시작해 볼까요?"→카드 만들기) / 1장+=메이커("성과 볼까요?"→성과 진단).
//   자동 펼침 없음 — 홈은 사용자 개시(스튜디오 자동 인사와 구분). surface='home'(T-B/T-D 기존 배선 소비).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircle, Sparkles, ChevronDown, GripVertical, ArrowUp, Square, Loader2, Mic, Rocket, TrendingUp } from "lucide-react";
import { useLingoChat, useLingoVoice } from "@/components/card-model/useLingoChat";
import { SlideToMic } from "@/components/lingo/SlideToMic";
import { SpeakerToggle } from "@/components/lingo/SpeakerToggle";
import { HomePerformanceFacts } from "@/components/home/HomePerformanceFacts";
import { getInAppBrowser, type InAppBrowser } from "@/lib/pwa-install";
// KAKAO-LINGO-1b — 인앱 [음성으로 만들기] = 크롬 세션 핸드오프(스튜디오와 공용 헬퍼).
import { startVoiceHandoff } from "@/lib/voice-handoff";

const ACCENT = "#2563EB"; // 홈 링고 목적색(스튜디오 mode accent 없음 — 브랜드 블루 고정).
const FAB_MARGIN = 12;
const FAB_SIZE = 56;
const FAB_BOTTOM_RESERVE = 96; // 홈 하단(탭바 등) 예약.
const PANEL_MAXW = 332; // 작업8c — 패널 폭 ≈ 화면 85%(상한). 좌우 이동 여백 확보(스튜디오 동일 공식).
const panelWidth = () => Math.min(PANEL_MAXW, Math.round(window.innerWidth * 0.85));

export function LingoHomeBox({
  cardCount,
  onGoStudio,
  openSignal,
  onOpenChange,
}: {
  /** 내 발행 카드 수(user.myCreatedDrops.length). 0=스타터 / 1+=메이커. */
  cardCount: number;
  /** 스튜디오 배웅(카드 만들기 · 3층 행동 칩). purpose 선택. */
  onGoStudio: (purpose?: string) => void;
  /** 작업5 — 외부(마케팅 배너 "시작해 볼까요") 개시 신호. 값이 바뀌면 패널 펼침. */
  openSignal?: number;
  /** 작업5c — 패널 열림 상태 보고(배너 세모 방향 동기 ▲접힘/▼펼침). */
  onOpenChange?: (open: boolean) => void;
}) {
  const chat = useLingoChat();
  const voice = useLingoVoice();
  const navigate = useNavigate(); // LINGO-DRIVE-1 D-4 — explore 인텐트 이동용.
  const isMaker = cardCount > 0;
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
  // KAKAO-LINGO-1 K-3 — 렌더 중 판정 → 마운트 후 판정(스튜디오 :783-786 패턴 통일).
  //   SSR(null=마이크 렌더)과 인앱 첫 클라 렌더가 갈리던 hydration 불일치 제거.
  const [inAppNoMic, setInAppNoMic] = useState<InAppBrowser | null>(null);
  useEffect(() => {
    setInAppNoMic(getInAppBrowser());
  }, []);

  const [view, setView] = useState<"strip" | "panel">("strip");
  const [perfOpen, setPerfOpen] = useState(false); // 커밋2 — 메이커 성과 진단(1층 사실+3층 칩) 개시 여부.
  const [chatInput, setChatInput] = useState("");
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const [fabDragging, setFabDragging] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const fabDrag = useRef({ active: false, moved: false, dx: 0, dy: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  const clampPos = (x: number, y: number, w: number, h: number) => {
    const maxX = window.innerWidth - w - FAB_MARGIN;
    const maxY = window.innerHeight - h - FAB_BOTTOM_RESERVE;
    return { x: Math.min(Math.max(FAB_MARGIN, x), maxX), y: Math.min(Math.max(FAB_MARGIN, y), maxY) };
  };
  const onDown = (e: React.PointerEvent<HTMLElement>) => {
    const r = fabRef.current?.getBoundingClientRect();
    if (!r) return;
    fabDrag.current = { active: true, moved: false, dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!fabDrag.current.active) return;
    const r = fabRef.current?.getBoundingClientRect();
    if (r && !fabDrag.current.moved) {
      const dist = Math.hypot(e.clientX - (r.left + fabDrag.current.dx), e.clientY - (r.top + fabDrag.current.dy));
      if (dist > 6) { fabDrag.current.moved = true; setFabDragging(true); }
    }
    if (fabDrag.current.moved && r) setFabPos(clampPos(e.clientX - fabDrag.current.dx, e.clientY - fabDrag.current.dy, r.width, r.height));
  };
  const onUp = (onTap: () => void) => {
    if (!fabDrag.current.active) return;
    const wasDrag = fabDrag.current.moved;
    fabDrag.current.active = false; fabDrag.current.moved = false; setFabDragging(false);
    if (wasDrag) {
      setFabPos((p) => { if (!p) return p; const snapX = p.x + FAB_SIZE / 2 < window.innerWidth / 2 ? FAB_MARGIN : window.innerWidth - FAB_SIZE - FAB_MARGIN; return clampPos(snapX, p.y, FAB_SIZE, FAB_SIZE); });
    } else onTap();
  };
  const openPanel = () => {
    const vh = window.innerHeight;
    let base = fabPos;
    if (!base) {
      const r = fabRef.current?.getBoundingClientRect();
      base = r ? clampPos(r.left, r.top, FAB_SIZE, FAB_SIZE) : { x: FAB_MARGIN, y: vh - FAB_BOTTOM_RESERVE - FAB_SIZE };
      setFabPos(base);
    }
    // 작업8 — 펼침 방향(위/아래)을 열 때 1회 고정(드래그 중 중점 교차로 튀는 것 방지).
    setOpenUp(base.y > vh * 0.5);
    setView("panel");
  };

  // 작업8 — 패널 헤더 ⠿ 드래그 = fabPos 공유(캡슐과 같은 좌표 이동 + 경계 스냅). 홈 유실분 복구.
  const [openUp, setOpenUp] = useState(false);
  const [panelDragging, setPanelDragging] = useState(false);
  const panelDrag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const onPanelDown = (e: React.PointerEvent) => {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    // 재판정 수술 — x 원점을 렌더된(패널 폭 기준 클램프) left 와 일치. fabPos.x 는 캡슐 좌표계라
    //   openPanel(캡슐 탭)로 연 패널은 그 값이 패널 범위 밖(우측) → 첫 좌드래그가 클램프에 먹혀
    //   "안 움직임". 클램프 후 원점=렌더 left 로 첫 픽셀부터 1:1. (스튜디오 동일 미러)
    const pw = panelWidth();
    const maxX = Math.max(FAB_MARGIN, window.innerWidth - pw - FAB_MARGIN);
    const ox = Math.min(Math.max(FAB_MARGIN, fabPos?.x ?? Math.round((window.innerWidth - pw) / 2)), maxX);
    const oy = fabPos?.y ?? vh - 200;
    panelDrag.current = { active: true, sx: e.clientX, sy: e.clientY, ox, oy };
    setPanelDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPanelMove = (e: React.PointerEvent) => {
    if (!panelDrag.current.active) return;
    const nx = panelDrag.current.ox + (e.clientX - panelDrag.current.sx);
    const ny = panelDrag.current.oy + (e.clientY - panelDrag.current.sy);
    // 작업8c — 자유 2축: x는 패널 폭 기준 클램프, y는 캡슐 기준. 강제 스냅 없음.
    const vw = window.innerWidth;
    const maxX = Math.max(FAB_MARGIN, vw - panelWidth() - FAB_MARGIN);
    const maxY = window.innerHeight - FAB_SIZE - FAB_BOTTOM_RESERVE;
    setFabPos({ x: Math.min(Math.max(FAB_MARGIN, nx), maxX), y: Math.min(Math.max(FAB_MARGIN, ny), maxY) });
  };
  const onPanelUp = () => {
    if (!panelDrag.current.active) return;
    panelDrag.current.active = false;
    setPanelDragging(false);
    // 작업8c — x 강제 엣지 스냅 해제(자유 2축): 옆으로 민 자리에 그대로 → 접으면 캡슐도 그 자리.
  };

  // 작업5 — 마케팅 배너 "시작해 볼까요" 개시 신호 → 패널 펼침(캡슐 자리 앵커). 최초 0 은 무시.
  useEffect(() => {
    if (openSignal && openSignal > 0) openPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  // 작업5c — 패널 열림 상태를 배너로 보고(세모 방향 ▲/▼ 동기).
  useEffect(() => { onOpenChange?.(view === "panel"); }, [view, onOpenChange]);

  // 채팅 전송 — surface='home'(T-B 홈 인텐트). 메이커면 context.performance=true(T-D 성과 진단 재료).
  const sendChat = async (text: string) => {
    const t = text.trim();
    if (!t || chat.streaming || voice.listening) return;
    setChatInput("");
    await chat.send(t, "text", isMaker ? { performance: true } : {}, "home");
  };
  // 작업6 — 슬라이드 토글 트리거(로직 무변경, 시작/종료만 분리 노출).
  const startMic = () => { voice.stopSpeaking(); if (!voice.listening) voice.startListening((final) => { void sendChat(final); }); };
  const stopMic = () => voice.stopListening();

  // 성과 진단 개시(메이커): 1층 사실(RPC 실값) 노출 + 2층 링고 해석 발화 1회(빈 대화면).
  const askPerformance = () => {
    openPanel();
    setPerfOpen(true);
    if (chat.messages.length === 0) void chat.send("내 카드 성과 어때?", "text", { performance: true }, "home");
  };

  const statusLine = chat.streaming ? "생각 중…" : voice.speaking ? "말하는 중…" : isMaker ? "성과 진단 · 다음 행동" : "카드 만들기 도우미";

  return (
    <>
      <style>{`@keyframes sl-home-pulse{0%{box-shadow:0 0 0 0 ${ACCENT}55}70%{box-shadow:0 0 0 7px ${ACCENT}00}100%{box-shadow:0 0 0 0 ${ACCENT}00}}`}</style>

      {view === "panel" && (() => {
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const vw = typeof window !== "undefined" ? window.innerWidth : 390;
        const fy = fabPos?.y ?? vh - 200;
        // 작업8c — 좌우 자유 이동: left = fabPos.x(패널 폭 기준 클램프), width = 85vw(≤332).
        const pw = Math.min(PANEL_MAXW, Math.round(vw * 0.85));
        const fx = fabPos?.x ?? Math.round((vw - pw) / 2);
        let left = Math.min(Math.max(FAB_MARGIN, fx), Math.max(FAB_MARGIN, vw - pw - FAB_MARGIN));
        // 3차 열림 보정 — 클램프 후에도 좌/우 여백이 12px 미만이면(초협폭) 중앙 수납. 정상 경로
        //   (여백 ≥12)에선 미개입 = fabPos 공유 계약 유지(과보정 금지).
        if (left < FAB_MARGIN || vw - (left + pw) < FAB_MARGIN) left = Math.max(FAB_MARGIN, Math.round((vw - pw) / 2));
        const vert = openUp ? { bottom: Math.max(FAB_MARGIN, vh - fy + 8) } : { top: fy + FAB_SIZE + 8 };
        const posStyle = { left, width: pw, ...vert };
        return (
          <>
            <div className="sl-fade-in fixed inset-0 z-40 bg-black/25" onClick={() => setView("strip")} />
            <div className="sl-slide-up fixed z-40" style={posStyle}>
              <div className="relative rounded-3xl border border-[#E5E5E5] bg-white p-4 [box-shadow:0_24px_60px_-16px_rgba(15,23,42,0.45)]">
                <div className="relative max-h-[58vh] overflow-y-auto">
                  {/* 작업8 — 패널 헤더 ⠿ 드래그 핸들(그래버 바) = fabPos 공유 이동. */}
                  <div
                    className={`mx-auto mb-2 flex h-4 w-full max-w-[120px] touch-none items-center justify-center ${panelDragging ? "cursor-grabbing" : "cursor-grab"}`}
                    onPointerDown={onPanelDown}
                    onPointerMove={onPanelMove}
                    onPointerUp={onPanelUp}
                    onPointerCancel={onPanelUp}
                  >
                    <span className="h-1.5 w-10 rounded-full bg-[#D8D6CE]" />
                  </div>
                  {/* 3차 히트영역 수술 — 드래그 시작 = 헤더 행 전체(⠿ 한 점 → 행 전체). ⠿는 시각
                      안내로 존치. 스피커·접기 버튼만 stopPropagation(그 위에선 드래그 대신 토글). */}
                  <div
                    className={`flex touch-none select-none items-center gap-2.5 ${panelDragging ? "cursor-grabbing" : "cursor-grab"}`}
                    onPointerDown={onPanelDown}
                    onPointerMove={onPanelMove}
                    onPointerUp={onPanelUp}
                    onPointerCancel={onPanelUp}
                  >
                    <span className="flex h-9 shrink-0 items-center justify-center" aria-hidden="true">
                      <GripVertical className="h-4 w-4 text-[#C4C2B9]" strokeWidth={2} />
                    </span>
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
                      <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
                      <Sparkles className="absolute -right-0.5 -top-0.5 h-[11px] w-[11px]" strokeWidth={2.5} fill="currentColor" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold leading-tight text-[#0A0A0A]">링고AI</p>
                      <p className="text-[11px] font-medium text-[#9A9A9A]">{statusLine}</p>
                    </div>
                    {/* 작업10 — 스피커 헤더 토글(공용 부품 SpeakerToggle). 드래그 제외(stopPropagation). */}
                    <span className="flex items-center" onPointerDown={(e) => e.stopPropagation()}>
                      <SpeakerToggle ttsOn={voice.ttsOn} speaking={voice.speaking} onToggle={voice.toggleTts} accent={ACCENT} />
                    </span>
                    <button type="button" aria-label="캡슐로 접기" onPointerDown={(e) => e.stopPropagation()} onClick={() => setView("strip")} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] active:scale-90">
                      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* 분기 안내 1문장 + 배웅 칩 (성과 진단 개시 전에만 — 개시 후엔 1층 사실이 대체) */}
                  {!(isMaker && perfOpen) && (
                    <div className="mt-3 rounded-2xl bg-[#F7F7F8] p-3.5">
                      <p className="flex items-start gap-1.5 text-[13px] font-medium leading-relaxed text-[#404040] [word-break:keep-all]">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A3A3A3]" strokeWidth={2.5} fill="currentColor" />
                        <span>{isMaker ? "지금까지 성과를 같이 볼까요? 실제 숫자부터 보여드릴게요." : "첫 카드를 같이 만들어 볼까요? 무엇을 알리고 싶은지 알려주세요."}</span>
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {isMaker ? (
                          <button type="button" onClick={askPerformance} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white active:scale-95" style={{ backgroundColor: ACCENT }}>
                            <TrendingUp className="h-4 w-4" strokeWidth={2.25} /> 성과 볼까요?
                          </button>
                        ) : (
                          <button type="button" onClick={() => onGoStudio()} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white active:scale-95" style={{ backgroundColor: ACCENT }}>
                            <Rocket className="h-4 w-4" strokeWidth={2.25} /> 카드 만들기
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 1층 사실 — 메이커 성과 개시 시 server 실값(LLM 0). 데이터 0 = 정직 안내 내장. */}
                  {isMaker && perfOpen && <HomePerformanceFacts />}

                  {/* 2층 링고 해석 — 대화 스트림(실숫자 서술만, BLOCK_P 라이브) */}
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

                  {/* LINGO-DRIVE-1 D-4 — 홈 intent 칩: create=스튜디오 / explore=둘러보기.
                      미지 값은 훅이 걸러 미노출. 세션 승계는 4단계 스코프 — 이번엔 이동까지. */}
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
                        <Rocket className="h-4 w-4" strokeWidth={2.25} /> 새 카드 만들기
                      </button>
                    </div>
                  )}

                  {/* 입력줄 — 텍스트(보조) + 56px 마이크(주) */}
                  <div className="mt-3 flex items-end gap-2">
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
              </div>
            </div>
          </>
        );
      })()}

      {view === "strip" && (
        <div
          ref={fabRef}
          role="button"
          aria-label="링고AI — 탭하면 열려요 · 끌면 옮겨요"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => onUp(openPanel)}
          onPointerCancel={() => onUp(openPanel)}
          // 작업4(A안 목업) — 56px 마이크 완전 수납: 캡슐 h-[72px](56+8·8 상하패딩) + pr-2(우 8px)로
          //   마이크가 라운드 박스 안에 여백 두고 완전히 들어오게(구 h-14=56px는 마이크와 동일 높이 → 모서리 붙음).
          className={`fixed z-40 flex h-[72px] w-[300px] max-w-[86vw] touch-none select-none items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white pl-2 pr-2 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.35)] ${fabDragging ? "scale-[1.03] cursor-grabbing" : "cursor-grab transition-transform duration-200"}`}
          style={fabPos ? { left: fabPos.x, top: fabPos.y } : { right: 20, bottom: 96 }}
        >
          <GripVertical className="h-4 w-4 shrink-0 text-[#C4C4C4]" strokeWidth={2} aria-hidden="true" />
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
            <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
            <Sparkles className="absolute -right-0.5 -top-0.5 h-[9px] w-[9px]" strokeWidth={2.5} fill="currentColor" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-bold leading-tight text-[#0A0A0A]">링고AI</span>
            <span className="block truncate text-[11px] font-medium text-[#8A8A8A]">{isMaker ? "성과 볼까요?" : "링고AI와 같이 시작해 볼까요?"}</span>
          </span>
          {/* KAKAO-LINGO-1b — 인앱은 컴팩트 [음성] 버튼 = 크롬 핸드오프. 캡슐 드래그/탭(펼침)과
              분리(stopPropagation — 스튜디오 캡슐 동일 패턴). */}
          {!inAppNoMic ? (
            <SlideToMic
              listening={voice.listening}
              disabled={chat.streaming}
              accent={ACCENT}
              onStart={() => { openPanel(); startMic(); }}
              onStop={stopMic}
            />
          ) : (
            <button
              type="button"
              aria-label="음성으로 만들기 — 크롬에서 이어져요"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                void startVoiceHandoff("/home", chat.notify);
              }}
              className="flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-bold text-white active:scale-95"
              style={{ backgroundColor: ACCENT }}
            >
              <Mic className="h-4 w-4" strokeWidth={2.5} />
              음성
            </button>
          )}
        </div>
      )}
    </>
  );
}
