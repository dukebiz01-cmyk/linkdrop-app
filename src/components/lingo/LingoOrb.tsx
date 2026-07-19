// LingoOrb — 링고 물방울 오브 공용 (LINGO-UI-3a).
//   물방울 실루엣(원형 + 좌하 꼬리) · 배경 #1D4ED8(D-1 락 신규 산출물 색) · 내부 Droplet 흰색.
//   상태 4종: idle(반투명 0.55) / busy(오브 내 스피너) / speaking(불투명 + 외곽 펄스 링) /
//   active(패널 열림 — 불투명). 애니메이션 CSS만 · 이모지 0 · Lucide만.
//   onClick 미주입 = 순수 표시(span — 중첩 button 방지: 홈 아코디언 헤더가 button 안에서 사용).
import { Droplet, Loader2, Mic } from "lucide-react";

// LINGO-UI-3c — listening 신설: 마이크 아이콘 + 바깥 파형 링 2겹(CSS만 — 레이어드 모드에서
//   파형 패널을 대신하는 상태 표현).
export type LingoOrbState = "idle" | "busy" | "speaking" | "active" | "listening";

const ORB_BG = "#1D4ED8";

export function LingoOrb({
  size,
  state = "idle",
  onClick,
  ariaLabel,
}: {
  size: number;
  state?: LingoOrbState;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const icon = Math.round(size * 0.5);
  const body = (
    <span
      className={`relative flex shrink-0 items-center justify-center text-white transition-opacity duration-300 ${
        state === "idle" ? "opacity-55" : "opacity-100"
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: ORB_BG,
        borderRadius: "50% 50% 50% 12px", // 물방울 — 좌하 꼬리.
        ...(state === "speaking" ? { animation: "lingo-orb-pulse 1.6s ease-out infinite" } : {}),
      }}
    >
      {state === "listening" && (
        <>
          {/* 파형 링 2겹 — 오브 실루엣 그대로 확산(스태거 0/0.7s). */}
          <span
            className="pointer-events-none absolute inset-0"
            style={{ borderRadius: "50% 50% 50% 12px", boxShadow: `0 0 0 2px ${ORB_BG}66`, animation: "lingo-orb-ring 1.4s ease-out infinite" }}
          />
          <span
            className="pointer-events-none absolute inset-0"
            style={{ borderRadius: "50% 50% 50% 12px", boxShadow: `0 0 0 2px ${ORB_BG}66`, animation: "lingo-orb-ring 1.4s ease-out 0.7s infinite" }}
          />
        </>
      )}
      {state === "busy" ? (
        <Loader2 className="animate-spin" style={{ width: icon, height: icon }} strokeWidth={2.5} />
      ) : state === "listening" ? (
        <Mic style={{ width: icon, height: icon }} strokeWidth={2.5} />
      ) : (
        <Droplet style={{ width: icon, height: icon }} strokeWidth={2.25} fill="currentColor" />
      )}
    </span>
  );
  return (
    <>
      <style>{`@keyframes lingo-orb-pulse{0%{box-shadow:0 0 0 0 ${ORB_BG}55}70%{box-shadow:0 0 0 8px ${ORB_BG}00}100%{box-shadow:0 0 0 0 ${ORB_BG}00}}@keyframes lingo-orb-ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.55);opacity:0}}`}</style>
      {onClick ? (
        <button type="button" onClick={onClick} aria-label={ariaLabel ?? "링고AI"} className="shrink-0 transition-transform active:scale-95">
          {body}
        </button>
      ) : (
        body
      )}
    </>
  );
}
