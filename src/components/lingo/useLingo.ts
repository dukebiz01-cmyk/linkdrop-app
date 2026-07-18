// useLingo — 링고 소비자(UI) 단일 창구 훅 (LINGO-UI-2 신설).
// 세션 승계 트랙에서 내부를 단일 스토어로 교체 예정 — 소비자(UI)는 이 훅만 바라볼 것.
// 지금은 기존 훅 2종의 얇은 조합만 — 반환 계약(시그니처)은 기존 훅 그대로 통과(동작 변화 0).
import { useLingoChat, useLingoVoice } from "@/components/card-model/useLingoChat";

export function useLingo(_surface: "home" | "studio") {
  const chat = useLingoChat();
  const voice = useLingoVoice();
  return { chat, voice };
}
