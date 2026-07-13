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
  convMode = false,
  speaking = false,
  paused = false,
  previewText = null,
  onToggleConv,
  onEndConv,
  onResume,
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
  /** FIX-48 — 대화 모드(연속): 켜면 자동 전송 루프. 기본 false = 기존 1회 모드 무변경. */
  convMode?: boolean;
  /** FIX-48 — TTS 낭독 중(STT 정지 상태) — "말하는 중…" 구분 표시. */
  speaking?: boolean;
  /** FIX-48 — 무음 2분 자동 대기. */
  paused?: boolean;
  /** FIX-48 — 전송 직전 1초 표시(오인식 방어 — 실인식 텍스트만). */
  previewText?: string | null;
  onToggleConv?: () => void;
  onEndConv?: () => void;
  onResume?: () => void;
}) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  // null = 초기화 중(막대 바닥 상태) / true = 실입력 파형 / false = 폴백(점 3개).
  const [waveOk, setWaveOk] = useState<boolean | null>(null);

  useEffect(() => {
    let raf = 0;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    // window.AudioContext 는 DOM lib 에 Window 프로퍼티로 선언돼 있지 않아 구조 캐스트로 접근.
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    if (
      !hasWaveSupport({
        AudioContext: w.AudioContext,
        webkitAudioContext: w.webkitAudioContext,
        navigator: window.navigator,
      })
    ) {
      setWaveOk(false);
      return;
    }
    const AC = (w.AudioContext ?? w.webkitAudioContext)!;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const ac = new AC();
        ctx = ac; // cleanup 용 보관 — 사용은 로컬 const(let 클로저 내로잉 유실 방지).
        const analyser = ac.createAnalyser();
        analyser.fftSize = 64; // 32 bins — 막대 14개엔 충분.
        ac.createMediaStreamSource(stream).connect(analyser);
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
      {/* FIX-48 — 상태 3분기 정직 표기: 청취=빨간 점 상시(몰래 듣기 금지) /
          낭독="말하는 중…" / 무음 대기 안내. */}
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#0A0A0A]">
        <span
          className={`h-2 w-2 rounded-full ${listening ? "animate-pulse bg-[#EF4444]" : "bg-[#C4C4C4]"}`}
          aria-hidden="true"
        />
        {paused
          ? "대화를 잠시 쉬어요"
          : listening
            ? "듣고 있어요"
            : speaking
              ? "말하는 중…"
              : convMode
                ? "잠시만요…"
                : "마이크 준비 중…"}
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
        {paused ? (
          <span className="text-[#525252]">대화를 잠시 쉬어요. 계속하려면 마이크를 눌러 주세요</span>
        ) : previewText ? (
          <span className="font-bold" style={{ color: accent }}>
            &ldquo;{previewText}&rdquo; 전송 중…
          </span>
        ) : (
          interimText || <span className="text-[#A3A3A3]">말씀하시면 여기에 글로 보여드려요</span>
        )}
      </p>

      {/* FIX-48 — 버튼: 1회 모드 = [취소|말 끝났어요](무변경) / 대화 모드 = [대화 끝내기]
          (+대기 시 [계속하기]). [대화 모드] 토글은 1회 모드에서만 노출. */}
      {convMode ? (
        <div className="mt-3 flex gap-1.5">
          {paused && onResume ? (
            <button
              type="button"
              onClick={onResume}
              onPointerDown={(e) => e.stopPropagation()}
              className="h-11 flex-[1.4] rounded-xl text-[13px] font-bold text-white active:scale-[0.98]"
              style={{ backgroundColor: accent }}
            >
              계속하기
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEndConv}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-11 flex-1 rounded-xl bg-[#F4F4F5] text-[13px] font-bold text-[#525252] active:scale-[0.98]"
          >
            대화 끝내기
          </button>
        </div>
      ) : (
        <>
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
          {onToggleConv ? (
            <button
              type="button"
              onClick={onToggleConv}
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-1.5 h-9 w-full rounded-xl text-[12px] font-bold text-[#525252] [box-shadow:inset_0_0_0_1px_#E5E5E5] active:scale-[0.98]"
            >
              대화 모드로 이어서 말하기
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
