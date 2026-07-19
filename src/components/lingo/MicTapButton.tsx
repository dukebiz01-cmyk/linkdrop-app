// MicTapButton — 음성 탭 문법(UI-4d): 원형 탭 버튼(내비식).
//   variant "listen" = 청취 토글 표시(청취 중 accent 배경 + 파형 링 2겹 — absolute overflow,
//   레이아웃 영향 0) / "handoff" = 탭 시 크롬 핸드오프(효과음 없음 — 호출부 몫).
//   탭 시퀀스(안내 낭독→띵→청취)·효과음은 호출부(onTap) 소유 — 이 컴포넌트는 표시·탭만.
import { Mic } from "lucide-react";

export function MicTapButton({
  variant = "listen",
  listening = false,
  disabled,
  accent,
  size = 36,
  onTap,
  ariaLabel,
}: {
  variant?: "listen" | "handoff";
  listening?: boolean;
  disabled?: boolean;
  accent: string;
  size?: number;
  onTap: () => void;
  ariaLabel?: string;
}) {
  const active = variant === "listen" && listening;
  const icon = Math.round(size * 0.5);
  return (
    <>
      <style>{`@keyframes lingo-mic-ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.7);opacity:0}}`}</style>
      <button
        type="button"
        disabled={disabled}
        onClick={onTap}
        aria-label={
          ariaLabel ?? (variant === "handoff" ? "누르면 크롬에서 음성으로" : active ? "말하기 끄기" : "말하기 켜기")
        }
        aria-pressed={variant === "listen" ? active : undefined}
        className="relative flex shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 disabled:opacity-40"
        style={{
          width: size,
          height: size,
          backgroundColor: active ? accent : "#F4F4F5",
          color: active ? "#FFFFFF" : "#525252",
        }}
      >
        {active && (
          <>
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ boxShadow: `0 0 0 2px ${accent}66`, animation: "lingo-mic-ring 1.4s ease-out infinite" }}
            />
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ boxShadow: `0 0 0 2px ${accent}66`, animation: "lingo-mic-ring 1.4s ease-out 0.7s infinite" }}
            />
          </>
        )}
        <Mic style={{ width: icon, height: icon }} strokeWidth={2.25} />
      </button>
    </>
  );
}
