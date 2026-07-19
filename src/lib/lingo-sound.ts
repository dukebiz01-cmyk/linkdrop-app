// lingo-sound — 링고 청취 효과음 2종 (UI-4d · Web Audio 합성 — 외부 자산·라이브러리 0).
//   AudioContext 는 사용자 제스처 내 최초 생성(자동재생 정책) 후 재사용. 실패는 조용히 무음.
let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, gainPeak = 0.12) {
  const c = ensureCtx();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gainPeak, c.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  } catch {
    // 무음 폴백.
  }
}

/** UI-4d-FIX-1 — 오디오 언락: 탭 핸들러 최상단(제스처 컨텍스트)에서 호출해 AudioContext 를
 *  생성·resume. 효과음이 비동기 콜백(낭독 완료 뒤 = 제스처 밖) 시점에 최초 생성되면 autoplay
 *  정책으로 suspended → 무음이 되는 것을 방지. 실패는 조용히(소리는 보조, 사슬 무중단). */
export function primeAudio() {
  ensureCtx();
}

/** 청취 시작 — 밝은 띵(~0.15s). */
export function playListenStart() {
  tone(880, 0.15);
}
/** 청취 종료 — 낮은 톤(~0.12s). */
export function playListenStop() {
  tone(392, 0.12);
}
