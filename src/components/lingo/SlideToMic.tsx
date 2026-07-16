// SlideToMic — 작업6(Duke 확정): 마이크 = 탭 아닌 슬라이드 토글. 밀면 켜짐, 되밀면 꺼짐.
//   손잡이(52px 마이크 원)를 짧은 레일(≈2×지름) 위에서 좌로 임계치(60%+) 넘기면 듣기 시작,
//   우로 되밀면 종료. 임계 미달 = 스냅백(오발동 방지). 음성 시작/종료 로직은 밖에서 주입(무변경).
//   제스처 분리: 레일 pointer 는 stopPropagation + pointerCapture 로 캡슐 드래그(fabPos) 전파 0.
//   폴백: 길게(600ms) 누르면 동일 토글(UI 표기 없음). 수납: 레일·손잡이 전부 박스 외곽선 안(56px 레일).
import { useEffect, useRef, useState } from "react";
import { Mic, ChevronLeft } from "lucide-react";

const HANDLE = 52;
const RAIL_W = 104; // ≈ 2× 지름(한 칸 이동)
const RAIL_H = 56;
const PAD = 2;
const TRAVEL = RAIL_W - HANDLE - PAD * 2; // 48px 이동 폭
const THRESH = 0.6; // 레일 60% 넘겨야 확정

export function SlideToMic({
  listening,
  disabled,
  accent,
  onStart,
  onStop,
}: {
  listening: boolean;
  disabled?: boolean;
  accent: string;
  onStart: () => void;
  onStop: () => void;
}) {
  // hx: 손잡이 위치 0(좌=ON rest) ~ TRAVEL(우=OFF rest). 라이브 값은 ref 로도 추적(놓는 순간 판정용).
  const [hx, setHx] = useState(listening ? 0 : TRAVEL);
  const hxRef = useRef(hx);
  const setH = (v: number) => { hxRef.current = v; setHx(v); };
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, startHx: 0, moved: false });
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHint, setShowHint] = useState(false);

  // 외부 listening 변화 → rest 위치 동기(드래그 중엔 무시).
  useEffect(() => { if (!drag.current.active) setH(listening ? 0 : TRAVEL); }, [listening]);

  // 발견성 — 최초 1회 "밀어서 말하기" (sessionStorage 가드, 이후 미표시).
  useEffect(() => { try { if (!sessionStorage.getItem("sl-slide-hint")) setShowHint(true); } catch { /* noop */ } }, []);
  const dismissHint = () => { setShowHint(false); try { sessionStorage.setItem("sl-slide-hint", "1"); } catch { /* noop */ } };

  const clamp = (v: number) => Math.max(0, Math.min(TRAVEL, v));

  const onDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.stopPropagation(); // 캡슐 fabPos 드래그로 전파 금지
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { active: true, startX: e.clientX, startHx: hxRef.current, moved: false };
    lpTimer.current = setTimeout(() => {
      // 폴백 — 슬라이드 없이 길게 누름 = 토글(숨은 접근성 경로).
      if (drag.current.active && !drag.current.moved) {
        drag.current.active = false;
        setDragging(false);
        if (listening) onStop(); else onStart();
        dismissHint();
      }
    }, 600);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    e.stopPropagation();
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(dx) > 3) { drag.current.moved = true; setDragging(true); if (lpTimer.current) clearTimeout(lpTimer.current); }
    setH(clamp(drag.current.startHx + dx));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    e.stopPropagation();
    if (lpTimer.current) clearTimeout(lpTimer.current);
    drag.current.active = false;
    const moved = drag.current.moved;
    setDragging(false);
    if (!moved) { setH(listening ? 0 : TRAVEL); return; } // 순수 탭 = 무동작(오발동 방지)
    const pos = hxRef.current;
    if (!listening) {
      // OFF→ON: 좌로 60%+ 이동(hx ≤ TRAVEL×0.4) → 듣기 시작·좌 고정, 아니면 스냅백(우).
      if (pos <= TRAVEL * (1 - THRESH)) { setH(0); onStart(); dismissHint(); }
      else setH(TRAVEL);
    } else {
      // ON→OFF: 우로 60%+ 이동(hx ≥ TRAVEL×0.6) → 종료·우 복귀, 아니면 스냅백(좌).
      if (pos >= TRAVEL * THRESH) { setH(TRAVEL); onStop(); }
      else setH(0);
    }
  };

  const fillPct = ((TRAVEL - hx) / TRAVEL) * 100; // 좌로 갈수록(켜질수록) 채움 증가

  return (
    <div className="relative shrink-0" style={{ width: RAIL_W, height: RAIL_H }}>
      <style>{`@keyframes sl-mic-wave{0%,100%{transform:scaleY(0.4)}50%{transform:scaleY(1)}}`}</style>
      {/* 레일 */}
      <div
        className={`absolute inset-0 rounded-full border transition-colors ${dragging ? "" : "duration-200"}`}
        style={{ borderColor: listening ? accent : "#E5E5E5", backgroundColor: listening ? `${accent}14` : "#F4F4F5" }}
      >
        {/* 목적색 채움(좌→우, 켜짐 비율) */}
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150" style={{ width: `${fillPct}%`, backgroundColor: `${accent}${listening ? "" : "22"}`, opacity: listening ? 0.22 : 1 }} />
        {/* ‹ 발견성 화살표(옅게, 좌측) */}
        {!listening && (
          <ChevronLeft className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B4B4B8]" strokeWidth={2.5} aria-hidden="true" />
        )}
        {/* 듣는 중 파형(레일 좌측 채움 위) */}
        {listening && (
          <div className="pointer-events-none absolute left-[10px] top-1/2 flex -translate-y-1/2 items-center gap-[3px]" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-[3px] rounded-full" style={{ height: 16, backgroundColor: accent, animation: `sl-mic-wave 0.9s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
        )}
      </div>
      {/* 손잡이(마이크 원) */}
      <button
        type="button"
        aria-label={listening ? "밀어서 말하기 끄기(듣는 중)" : "밀어서 말하기"}
        disabled={disabled}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={`absolute top-1/2 flex items-center justify-center rounded-full ${dragging ? "cursor-grabbing" : "cursor-grab transition-[left] duration-200"} touch-none select-none active:scale-95 disabled:opacity-40`}
        style={{
          width: HANDLE, height: HANDLE, left: PAD + hx, transform: "translateY(-50%)",
          backgroundColor: listening ? accent : "#FFFFFF",
          color: listening ? "#FFFFFF" : "#525252",
          boxShadow: listening ? `0 6px 16px -6px ${accent}` : "inset 0 0 0 1px #E5E5E5, 0 6px 16px -8px rgba(15,23,42,0.35)",
        }}
      >
        <Mic className="h-[24px] w-[24px]" strokeWidth={2.25} />
      </button>
      {/* 최초 1회 미니 라벨 */}
      {showHint && !listening && (
        <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-bold text-white">
          밀어서 말하기
        </span>
      )}
    </div>
  );
}
