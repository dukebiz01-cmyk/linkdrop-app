// SlideToMic — 마이크 = 슬라이드 토글(밀면 켜짐/되밀면 꺼짐). 작업6 + 작업11(정본 정렬).
//   레일 각인: 꺼짐=손잡이 우측·회색·"OFF" / 켜짐=손잡이 좌측·목적색 레일·"ON"(흰색).
//   청취 표시 = 손잡이 내 파형만(돌출 0). "밀어서 말하기" 힌트·‹화살표·"듣고 있어요" 문구 전부 제거
//   (정본 §2 카피 대신 상태: ON/OFF·색·모션으로 상태 전달). 음성 시작/종료 로직은 밖에서 주입(무변경).
//   제스처 분리: 레일 pointer stopPropagation + pointerCapture → 캡슐 드래그(fabPos) 전파 0.
//   폴백: 길게(600ms) 누르면 동일 토글(UI 표기 없음). 수납: 레일 56px·손잡이 전부 박스 외곽선 안.
import { useRef, useState, useEffect } from "react";
import { Mic } from "lucide-react";

const HANDLE = 52;
const RAIL_W = 104; // ≈ 2× 지름(한 칸 이동)
const RAIL_H = 56;
const PAD = 2;
const THRESH = 0.6; // 레일 60% 넘겨야 확정

export function SlideToMic({
  listening,
  disabled,
  accent,
  onStart,
  onStop,
  variant = "listen",
  onHandoff,
}: {
  listening: boolean;
  disabled?: boolean;
  accent: string;
  onStart?: () => void;
  onStop?: () => void;
  /** UI-4c — "handoff": 밀기 완료 시 onStart 대신 onHandoff(원샷 · 손잡이 스냅백 — ON 고정 없음).
   *  레일 디자인·제스처 코드 공유, 분기는 완료 콜백뿐. 라벨 수납 위해 레일만 확장. */
  variant?: "listen" | "handoff";
  onHandoff?: () => void;
}) {
  const isHandoff = variant === "handoff";
  const railW = isHandoff ? 168 : RAIL_W; // 라벨("밀어서 음성으로") 수납 — 손잡이·이동 문법 동일.
  const travel = railW - HANDLE - PAD * 2;
  // hx: 손잡이 위치 0(좌=ON rest) ~ travel(우=OFF rest). 라이브 값은 ref 로도 추적(놓는 순간 판정).
  const [hx, setHx] = useState(listening ? 0 : travel);
  const hxRef = useRef(hx);
  const setH = (v: number) => { hxRef.current = v; setHx(v); };
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, startHx: 0, moved: false });
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 외부 listening 변화 → rest 위치 동기(드래그 중엔 무시).
  useEffect(() => { if (!drag.current.active) setH(listening ? 0 : travel); }, [listening]);

  const clamp = (v: number) => Math.max(0, Math.min(travel, v));

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
        if (isHandoff) onHandoff?.();
        else if (listening) onStop?.();
        else onStart?.();
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
    if (!moved) { setH(listening ? 0 : travel); return; } // 순수 탭 = 무동작(오발동 방지)
    const pos = hxRef.current;
    if (!listening) {
      // OFF→ON: 좌로 60%+ 이동(hx ≤ travel×0.4) → 듣기 시작·좌 고정, 아니면 스냅백(우).
      //   UI-4c handoff — 완료 시 onHandoff(원샷) + 스냅백(ON 고정 없음).
      if (pos <= travel * (1 - THRESH)) {
        if (isHandoff) {
          setH(travel);
          onHandoff?.();
        } else {
          setH(0);
          onStart?.();
        }
      } else setH(travel);
    } else {
      // ON→OFF: 우로 60%+ 이동(hx ≥ travel×0.6) → 종료·우 복귀, 아니면 스냅백(좌).
      if (pos >= travel * THRESH) { setH(travel); onStop?.(); }
      else setH(0);
    }
  };

  return (
    <div className="relative shrink-0" style={{ width: railW, height: RAIL_H }}>
      <style>{`@keyframes sl-mic-wave{0%,100%{transform:scaleY(0.35)}50%{transform:scaleY(1)}}`}</style>
      {/* 레일 — OFF: 서피스+보더 / ON: 목적색 채움 */}
      <div
        className={`absolute inset-0 rounded-full border ${dragging ? "" : "transition-colors duration-200"}`}
        style={{ borderColor: listening ? accent : "#D8D6CE", backgroundColor: listening ? accent : "#F7F6F2" }}
      >
        {/* 각인 — 손잡이 반대편. OFF=좌·회색 / ON=우·흰색. UI-4c handoff = 라벨(한 글자 락). */}
        {isHandoff ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-[-0.01em] text-[#9A988F]">밀어서 음성으로</span>
        ) : !listening ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-[0.08em] text-[#9A988F]">OFF</span>
        ) : (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-[0.08em] text-white">ON</span>
        )}
      </div>
      {/* 손잡이(마이크 원) — OFF: 흰 원+회색 마이크 / ON: 흰 원+목적색 파형(손잡이 내부, 돌출 0) */}
      <button
        type="button"
        aria-label={isHandoff ? "밀어서 음성으로" : listening ? "말하기 끄기" : "말하기 켜기"}
        aria-pressed={listening}
        disabled={disabled}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={`absolute top-1/2 flex items-center justify-center rounded-full ${dragging ? "cursor-grabbing" : "cursor-grab transition-[left] duration-200"} touch-none select-none active:scale-95 disabled:opacity-40`}
        style={{
          width: HANDLE, height: HANDLE, left: PAD + hx, transform: "translateY(-50%)",
          backgroundColor: "#FFFFFF",
          color: listening ? accent : "#525252",
          boxShadow: listening ? `0 6px 16px -6px ${accent}` : "inset 0 0 0 1px #E5E5E5, 0 6px 16px -8px rgba(15,23,42,0.35)",
        }}
      >
        {listening ? (
          <span className="flex items-center gap-[3px]" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-[3px] rounded-full" style={{ height: 16, backgroundColor: accent, animation: `sl-mic-wave 0.9s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </span>
        ) : (
          <Mic className="h-[24px] w-[24px]" strokeWidth={2.25} />
        )}
      </button>
    </div>
  );
}
