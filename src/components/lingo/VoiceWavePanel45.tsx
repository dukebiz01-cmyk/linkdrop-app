// VoiceWavePanel45 — 링고 "듣는 중" 파형 패널(FIX-43). 순수 컴포넌트(공용 — 홈 링고 재사용 대비):
//   STT 자체는 밖(useLingoVoice)이 소유 — 여기는 표시(파형·인식 텍스트)와 [취소|말 끝났어요]만.
//   파형 = Web Audio AnalyserNode 로 마이크 실입력 볼륨 연동(외부 라이브러리 0, rAF 직접 구동).
//   정직 폴백: AudioContext/getUserMedia 불가·권한 거부 시 가짜 파형 금지 → 점 3개 깜빡임.
//   언마운트 시 rAF 취소 + MediaStream 트랙 stop + AudioContext.close (누수 금지).
import { useEffect, useRef, useState } from "react";

export const WAVE_BARS = 14; // 막대 12~16개 스펙 — 14 고정.
const BAR_MIN_PX = 3;
const BAR_MAX_PX = 28;

/** 주파수 스냅샷(0~255) → 막대 높이(px) 배열. 순수 — 실측 검증 대상. */
export function levelsToBarHeights(data: ArrayLike<number>, bars: number = WAVE_BARS): number[] {
  const out: number[] = [];
  const n = data.length;
  for (let i = 0; i < bars; i++) {
    const v = n > 0 ? (data[Math.floor((i * n) / bars)] ?? 0) / 255 : 0;
    out.push(Math.max(BAR_MIN_PX, Math.round(v * BAR_MAX_PX)));
  }
  return out;
}

/** 파형 지원 판정(순수 — 폴백 분기 실측 대상): AudioContext + getUserMedia 둘 다 있어야 시도. */
export function hasWaveSupport(w: {
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
  navigator?: { mediaDevices?: { getUserMedia?: unknown } };
}): boolean {
  return !!(w.AudioContext ?? w.webkitAudioContext) && !!w.navigator?.mediaDevices?.getUserMedia;
}

export function VoiceWavePanel45({
  listening,
  interimText,
  accent,
  onCancel,
  onDone,
}: {
  /** STT 실동작 여부 — "듣고 있어요" 라벨은 이때만(§0 정직 표기). */
  listening: boolean;
  /** 실시간 인식 텍스트(STT interim) — 없으면 안내 문구. */
  interimText: string;
  accent: string;
  /** 인식 텍스트 폐기 + STT·AudioContext 즉시 종료. */
  onCancel: () => void;
  /** 인식 텍스트 입력창 반영 → 기존 확인 후 전송 플로우(자동 전송 금지). */
  onDone: () => void;
}) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  // null = 초기화 중(막대 바닥 상태) / true = 실입력 파형 / false = 폴백(점 3개).
  const [waveOk, setWaveOk] = useState<boolean | null>(null);

  useEffect(() => {
    let raf = 0;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    if (!hasWaveSupport({ ...w, navigator: w.navigator })) {
      setWaveOk(false);
      return;
    }
    const AC = w.AudioContext ?? w.webkitAudioContext!;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx = new AC();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64; // 32 bins — 막대 14개엔 충분.
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        setWaveOk(true);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const heights = levelsToBarHeights(data);
          for (let i = 0; i < WAVE_BARS; i++) {
            const el = barsRef.current[i];
            if (el) el.style.height = `${heights[i]}px`;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        // 권한 거부 등 — 가짜 파형 금지(§0) → 점 3개 폴백.
        if (!cancelled) setWaveOk(false);
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="w-[280px] max-w-[80vw] rounded-3xl border border-[#E5E5E5] bg-white p-4 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.35)]">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#0A0A0A]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#EF4444]" aria-hidden="true" />
        {listening ? "듣고 있어요" : "마이크 준비 중…"}
      </p>

      {/* 파형(실입력) 또는 폴백(점 3개 — 가짜 파형 금지). */}
      <div className="mt-3 flex h-8 items-center justify-center gap-1">
        {waveOk === false ? (
          <span className="flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-pulse rounded-full bg-[#C4C4C4]"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </span>
        ) : (
          Array.from({ length: WAVE_BARS }, (_, i) => (
            <span
              key={i}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              className="w-[5px] rounded-full transition-[height] duration-75"
              style={{ height: BAR_MIN_PX, backgroundColor: accent }}
              aria-hidden="true"
            />
          ))
        )}
      </div>

      {/* 실시간 인식 텍스트 — 비어 있으면 안내(창작 텍스트 금지 — 실인식분만 표시). */}
      <p className="mt-2 min-h-[36px] rounded-xl bg-[#F7F7F8] px-3 py-2 text-[12.5px] font-medium leading-relaxed text-[#404040] [word-break:keep-all]">
        {interimText || <span className="text-[#A3A3A3]">말씀하시면 여기에 글로 보여드려요</span>}
      </p>

      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          onPointerDown={(e) => e.stopPropagation()}
          className="h-11 flex-1 rounded-xl bg-[#F4F4F5] text-[13px] font-bold text-[#525252] active:scale-[0.98]"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onDone}
          onPointerDown={(e) => e.stopPropagation()}
          className="h-11 flex-[1.4] rounded-xl text-[13px] font-bold text-white active:scale-[0.98]"
          style={{ backgroundColor: accent }}
        >
          말 끝났어요
        </button>
      </div>
    </div>
  );
}
