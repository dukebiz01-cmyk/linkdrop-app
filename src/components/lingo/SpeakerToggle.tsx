// SpeakerToggle — 낭독(TTS) on/off 헤더 토글. 공용 부품(홈·스튜디오 동일). 작업10 사양 · 정본 §3.
//   소리 계열 = 목적색 스위치(마이크 레일 SlideToMic 와 같은 문법). 34px 원(44px 터치).
//   OFF=서피스+보더+회색 / ON=목적색 12~15% 배경+목적색 아이콘. 재생 중(speaking)에만 음파 호 점멸.
//   이모지 0, lucide SVG. aria-pressed 부착. 낭독 로직은 밖에서 주입(ttsOn/onToggle 무변경).
import { Volume2, VolumeX } from "lucide-react";

export function SpeakerToggle({
  ttsOn,
  speaking,
  onToggle,
  accent,
}: {
  ttsOn: boolean;
  speaking: boolean;
  onToggle: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      aria-label={ttsOn ? "응답 낭독 끄기" : "응답 낭독 켜기"}
      aria-pressed={ttsOn}
      onClick={onToggle}
      className="relative flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
    >
      {ttsOn && speaking && (
        <span className="absolute inset-1.5 animate-ping rounded-full" style={{ boxShadow: `0 0 0 2px ${accent}55` }} aria-hidden="true" />
      )}
      <span
        className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full"
        style={ttsOn ? { backgroundColor: `${accent}22`, color: accent } : { backgroundColor: "#F7F6F2", boxShadow: "inset 0 0 0 1px #D8D6CE", color: "#9A988F" }}
      >
        {ttsOn ? <Volume2 className="h-[18px] w-[18px]" strokeWidth={2.25} /> : <VolumeX className="h-[18px] w-[18px]" strokeWidth={2.25} />}
      </span>
    </button>
  );
}
