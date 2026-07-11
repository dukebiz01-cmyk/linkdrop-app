// VoiceOrb45 — 링고 음성 마이크 분리 버튼(FIX-43). 순수 컴포넌트(공용 — 홈 링고 재사용 대비):
//   스튜디오 종속(캡슐 위치·드래그·STT 훅)은 전부 밖에서 prop 주입. Radix 미사용.
//   56px 원형(터치 44px 초과) + 마이크 아이콘 26px. 듣는 중 = accent 채움 + 펄스.
import { Mic } from "lucide-react";

export function VoiceOrb45({
  listening,
  disabled,
  accent,
  onTap,
  className,
}: {
  listening: boolean;
  disabled?: boolean;
  accent: string;
  onTap: () => void;
  /** 배치용(호스트가 absolute 등 주입) — 컴포넌트 자체는 위치 무지. */
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={listening ? "듣기 중지" : "음성으로 말하기"}
      onClick={onTap}
      disabled={disabled}
      // 캡슐 드래그(호스트 fixed 컨테이너)와 충돌 방지 — 기존 칩 문법(stopPropagation) 재사용.
      onPointerDown={(e) => e.stopPropagation()}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40 ${
        listening
          ? "animate-pulse text-white"
          : "bg-white text-[#525252] shadow-[0_10px_24px_-10px_rgba(15,23,42,0.35)] [box-shadow:inset_0_0_0_1px_#E5E5E5,0_10px_24px_-10px_rgba(15,23,42,0.35)]"
      } ${className ?? ""}`}
      style={listening ? { backgroundColor: accent } : undefined}
    >
      <Mic className="h-[26px] w-[26px]" strokeWidth={2.25} />
    </button>
  );
}
