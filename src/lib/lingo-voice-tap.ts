// lingo-voice-tap — 음성 탭 시퀀스 공용 가드 (UI-4d-FIX-1 · 홈/스튜디오 수렴).
//   진단: 훅(useLingoChat)의 speak 는 모든 분기(ttsOn OFF·미지원·onerror·catch)에서 onDone 을
//   호출하지만, Chrome 의 cancel()→speak() 연속 호출 직후 utterance 가 onstart/onend/onerror
//   0건으로 drop 되는 케이스(브라우저 버그 — 훅 밖)가 있어 onDone 이 영영 오지 않을 수 있다.
//   수복 원칙: 낭독은 보조, 청취가 본체 — 타임아웃 가드로 사슬을 반드시 잇는다.
//   AudioContext 언락(primeAudio)은 lingo-sound 쪽 — 탭 핸들러 최상단에서 별도 호출.

/** 탭 시점 재판정 — SpeechRecognition 지원 여부(훅 내부 판정과 동일 기준, 훅 무접촉). */
export function canUseSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

/** 음성 불능 1회 안내 (한 글자 락). */
export const VOICE_UNSUPPORTED_NOTICE = "이 브라우저에서는 음성을 쓸 수 없어요. 글로 말씀해 주세요.";

/** 안내 낭독 → 진행(띵→청취)을 타임아웃 가드와 병행. onDone 미도착 시 강제 진행 — 이때만
 *  stopSpeaking 으로 지각 낭독을 끊어 에코를 차단. proceed 는 fired 플래그로 정확히 1회.
 *
 *  UI-5-T7-F4-8(b) — 가드 고정 3초 → 텍스트 길이 비례(L3 낭독 완주 락 정합):
 *  구 가드는 utterance drop(Chrome 버그 — 위 진단) 방어가 목적이었는데, 타이머가 낭독 길이와
 *  무관한 고정 3초라 "정상 낭독 중인 긴 응답"까지 3초에 절단했다(AI 말 끊김의 실기전).
 *  가드 = max(3초, 글자수×80ms), 상한 30초 — 짧은 안내는 기존 3초 방어 그대로, 긴 응답은
 *  낭독 시간만큼 기다린 뒤에만 강제 진행(절단은 drop/지연 병리 케이스로 한정).
 *  timeoutMs 명시 전달 시 그 값 우선(기존 호출 계약 무변). */
const GUARD_MIN_MS = 3000;
const GUARD_PER_CHAR_MS = 80;
const GUARD_MAX_MS = 30000;
export function speakThenProceed(opts: {
  speak: (text: string, onDone?: () => void) => void;
  stopSpeaking?: () => void;
  text: string;
  proceed: () => void;
  timeoutMs?: number;
}) {
  let fired = false;
  const go = (fromTimeout: boolean) => {
    if (fired) return;
    fired = true;
    if (fromTimeout) {
      try {
        opts.stopSpeaking?.();
      } catch {
        // 낭독 중단 실패도 사슬은 계속(청취가 본체).
      }
    }
    opts.proceed();
  };
  const guardMs =
    opts.timeoutMs ??
    Math.min(Math.max(GUARD_MIN_MS, opts.text.length * GUARD_PER_CHAR_MS), GUARD_MAX_MS);
  const timer = setTimeout(() => go(true), guardMs);
  opts.speak(opts.text, () => {
    clearTimeout(timer);
    go(false);
  });
}
