// HOME-LINGO — 홈 링고 박스(P1.5 완성형 셸 재사용 패턴: 캡슐↔패널 2상태·드래그+경계 스냅·56px
//   마이크·다이어트 패널). 스튜디오 박스 무접촉(이관은 배포 후 별도 슬라이스) — 홈 전용 셸.
//   분기(발행 카드 수): 0장=스타터("시작해 볼까요?"→카드 만들기) / 1장+=메이커("성과 볼까요?"→성과 진단).
//   자동 펼침 없음 — 홈은 사용자 개시(스튜디오 자동 인사와 구분). surface='home'(T-B/T-D 기존 배선 소비).
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Sparkles, ChevronDown, GripVertical, ArrowUp, Square, Loader2, Volume2, VolumeX, Rocket, TrendingUp } from "lucide-react";
import { useLingoChat, useLingoVoice } from "@/components/card-model/useLingoChat";
import { VoiceOrb45 } from "@/components/lingo/VoiceOrb45";
import { getInAppBrowser } from "@/lib/pwa-install";

const ACCENT = "#2563EB"; // 홈 링고 목적색(스튜디오 mode accent 없음 — 브랜드 블루 고정).
const FAB_MARGIN = 12;
const FAB_SIZE = 56;
const FAB_BOTTOM_RESERVE = 96; // 홈 하단(탭바 등) 예약.

export function LingoHomeBox({
  cardCount,
  onGoStudio,
}: {
  /** 내 발행 카드 수(user.myCreatedDrops.length). 0=스타터 / 1+=메이커. */
  cardCount: number;
  /** 스튜디오 배웅(카드 만들기 · 3층 행동 칩). purpose 선택. */
  onGoStudio: (purpose?: string) => void;
}) {
  const chat = useLingoChat();
  const voice = useLingoVoice();
  const isMaker = cardCount > 0;
  const inAppNoMic = typeof window !== "undefined" ? getInAppBrowser() : null;

  const [view, setView] = useState<"strip" | "panel">("strip");
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
    if (!fabPos) {
      const r = fabRef.current?.getBoundingClientRect();
      setFabPos(r ? clampPos(r.left, r.top, FAB_SIZE, FAB_SIZE) : { x: FAB_MARGIN, y: window.innerHeight - FAB_BOTTOM_RESERVE - FAB_SIZE });
    }
    setView("panel");
  };

  // 채팅 전송 — surface='home'(T-B 홈 인텐트). 메이커면 context.performance=true(T-D 성과 진단 재료).
  const sendChat = async (text: string) => {
    const t = text.trim();
    if (!t || chat.streaming || voice.listening) return;
    setChatInput("");
    await chat.send(t, "text", isMaker ? { performance: true } : {}, "home");
  };
  const handleMicTap = () => {
    voice.stopSpeaking();
    if (voice.listening) { voice.stopListening(); return; }
    voice.startListening((final) => { void sendChat(final); });
  };

  // 성과 진단 발화 트리거(메이커): 캡슐/CTA 탭 시 1회 발화(빈 대화면).
  const askPerformance = () => {
    openPanel();
    if (chat.messages.length === 0) void chat.send("내 카드 성과 어때?", "text", { performance: true }, "home");
  };

  const statusLine = chat.streaming ? "생각 중…" : voice.speaking ? "말하는 중…" : isMaker ? "성과 진단 · 다음 행동" : "카드 만들기 도우미";

  return (
    <>
      <style>{`@keyframes sl-home-pulse{0%{box-shadow:0 0 0 0 ${ACCENT}55}70%{box-shadow:0 0 0 7px ${ACCENT}00}100%{box-shadow:0 0 0 0 ${ACCENT}00}}`}</style>

      {view === "panel" && (() => {
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const fy = fabPos?.y ?? vh - 200;
        const openUp = fy > vh * 0.5;
        const posStyle = openUp ? { bottom: Math.max(FAB_MARGIN, vh - fy + 8) } : { top: fy + FAB_SIZE + 8 };
        return (
          <>
            <div className="sl-fade-in fixed inset-0 z-40 bg-black/25" onClick={() => setView("strip")} />
            <div className="sl-slide-up fixed inset-x-0 z-40 px-5" style={posStyle}>
              <div className="relative mx-auto max-w-md rounded-3xl border border-[#E5E5E5] bg-white p-4 [box-shadow:0_24px_60px_-16px_rgba(15,23,42,0.45)]">
                <div className="relative max-h-[58vh] overflow-y-auto">
                  <div className="mx-auto mb-2 flex h-4 w-full max-w-[120px] items-center justify-center"><span className="h-1.5 w-10 rounded-full bg-[#E0E0E0]" /></div>
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
                      <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
                      <Sparkles className="absolute -right-0.5 -top-0.5 h-[11px] w-[11px]" strokeWidth={2.5} fill="currentColor" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold leading-tight text-[#0A0A0A]">링고AI</p>
                      <p className="text-[11px] font-medium text-[#9A9A9A]">{statusLine}</p>
                    </div>
                    <button type="button" aria-label="캡슐로 접기" onClick={() => setView("strip")} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F5] text-[#737373] active:scale-90">
                      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* 분기 안내 1문장 + 배웅 칩 */}
                  <div className="mt-3 rounded-2xl bg-[#F7F7F8] p-3.5">
                    <p className="flex items-start gap-1.5 text-[13px] font-medium leading-relaxed text-[#404040] [word-break:keep-all]">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A3A3A3]" strokeWidth={2.5} fill="currentColor" />
                      <span>{isMaker ? "지금까지 성과를 같이 볼까요? 다음 행동도 제안해 드릴게요." : "첫 카드를 같이 만들어 볼까요? 무엇을 알리고 싶은지 알려주세요."}</span>
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

                  {/* 대화 스트림 */}
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

                  {/* 입력줄 — 텍스트(보조) + 56px 마이크(주) */}
                  <div className="mt-3 flex items-end gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-[#F4F4F5] py-1.5 pl-4 pr-1.5">
                      <input
                        value={chatInput}
                        maxLength={2000}
                        disabled={chat.streaming || voice.listening}
                        placeholder={chat.streaming ? "링고가 생각 중…" : voice.listening ? "듣고 있어요…" : "링고AI에게 물어보기"}
                        onChange={(e) => setChatInput(e.target.value)}
                        onFocus={() => voice.stopSpeaking()}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void sendChat(chatInput); } }}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#9A9A9A] disabled:opacity-60"
                      />
                      <button type="button" aria-label={voice.ttsOn ? "응답 낭독 끄기" : "응답 낭독 켜기"} onClick={voice.toggleTts} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#525252] [box-shadow:inset_0_0_0_1px_#E5E5E5] active:scale-95">
                        {voice.ttsOn ? <Volume2 className="h-4 w-4" strokeWidth={2.25} /> : <VolumeX className="h-4 w-4 text-[#A3A3A3]" strokeWidth={2.25} />}
                      </button>
                      {chat.streaming ? (
                        <button type="button" aria-label="응답 중지" onClick={chat.stop} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#404040] text-white active:scale-95"><Square className="h-3.5 w-3.5" strokeWidth={2.5} fill="currentColor" /></button>
                      ) : (
                        <button type="button" aria-label="전송" onClick={() => void sendChat(chatInput)} disabled={!chatInput.trim() || voice.listening} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white active:scale-95 disabled:opacity-40" style={{ backgroundColor: ACCENT }}><ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} /></button>
                      )}
                    </div>
                    {!inAppNoMic && <VoiceOrb45 listening={voice.listening} disabled={chat.streaming} accent={ACCENT} onTap={handleMicTap} />}
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
          className={`fixed z-40 flex h-14 w-[300px] max-w-[86vw] touch-none select-none items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white pl-2 pr-1 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.35)] ${fabDragging ? "scale-[1.03] cursor-grabbing" : "cursor-grab transition-transform duration-200"}`}
          style={fabPos ? { left: fabPos.x, top: fabPos.y } : { right: 20, bottom: 96 }}
        >
          <GripVertical className="h-4 w-4 shrink-0 text-[#C4C4C4]" strokeWidth={2} aria-hidden="true" />
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
            <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
            <Sparkles className="absolute -right-0.5 -top-0.5 h-[9px] w-[9px]" strokeWidth={2.5} fill="currentColor" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-bold leading-tight text-[#0A0A0A]">링고AI</span>
            <span className="block truncate text-[11px] font-medium text-[#8A8A8A]">{isMaker ? "성과 볼까요?" : "시작해 볼까요?"}</span>
          </span>
          {!inAppNoMic && (
            <span onPointerDown={(e) => e.stopPropagation()} className="shrink-0">
              <VoiceOrb45 listening={voice.listening} disabled={chat.streaming} accent={ACCENT} onTap={() => { openPanel(); if (!voice.listening) handleMicTap(); }} />
            </span>
          )}
        </div>
      )}
    </>
  );
}
