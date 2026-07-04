import { useEffect, useState } from "react";

/**
 * useCountdown — 마감 카운트다운 훅 (Phase 1-A · fix3 = L7 최종판).
 *
 * 하드락(L7 최종판 — 형님 확정):
 *   빨강 = 임박 1h 한정 · 펄스 금지 · 1초 틱 · 진짜 expiresAt만.
 *   L1/L3 — 기준은 expiresAt 하나: 리셋·재계산 없음(새로고침해도 동일 기준값).
 *   L2 — 만료 후 연장 렌더 금지: expired=true 로 고정, 인터벌 정지.
 *   L6 — serverNow 수신 시 서버 시각 권위: 클라 시계 offset 1회 보정(고정 offset).
 *   하이드레이션 안전 — now 계산은 마운트 후(useEffect)만. SSR/첫 페인트 = null(미렌더).
 *   fix3 — 0.1초 틱·공유 티커 회수: 1초 틱 단일 인터벌(1-A 원형) 복귀. imminent 는
 *   표시층 톤(빨강 임계) 판정용 플래그로만 유지.
 */

export type CountdownState = {
  expired: boolean;
  /** 잔여 일수(만료 시 0). */
  days: number;
  /** "HH:MM:SS" (일수 제외 나머지 — 초 단위 고정, 소수점 없음). */
  hms: string;
  /** 잔여 ≤ 24h — 표시층 앰버 전환 기준. */
  urgent: boolean;
  /** 잔여 ≤ 1h — 표시층 빨강 임계(L7 최종판: 빨강은 이 구간 한정). */
  imminent: boolean;
};

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// 순수 계산부 — 훅과 분리(테스트 가능·결정적: 같은 입력 = 같은 출력).
export function computeCountdown(expiresAtMs: number, nowMs: number): CountdownState {
  const diff = expiresAtMs - nowMs;
  if (diff <= 0) return { expired: true, days: 0, hms: "00:00:00", urgent: false, imminent: false };
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86_400);
  const h = Math.floor((totalSec % 86_400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    expired: false,
    days,
    hms: `${pad2(h)}:${pad2(m)}:${pad2(s)}`,
    urgent: diff <= DAY_MS,
    imminent: diff <= HOUR_MS,
  };
}

export function useCountdown(expiresAt?: string, serverNow?: string): CountdownState | null {
  const [state, setState] = useState<CountdownState | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setState(null);
      return;
    }
    const target = Date.parse(expiresAt);
    if (!Number.isFinite(target)) {
      setState(null);
      return;
    }
    // L6 — serverNow 권위: offset = 서버시각 - 클라시각(마운트 시 1회 고정. L1/L3: 이후 재보정 없음).
    const serverMs = serverNow ? Date.parse(serverNow) : NaN;
    const offset = Number.isFinite(serverMs) ? serverMs - Date.now() : 0;

    const initial = computeCountdown(target, Date.now() + offset);
    setState(initial);
    if (initial.expired) return; // L2 — 이미 만료: 인터벌 불필요("마감" 고정)

    // fix3(L7 최종판) — setInterval 1개/컴포넌트, 1초 틱 고정. 언마운트 clearInterval.
    const id = setInterval(() => {
      const next = computeCountdown(target, Date.now() + offset);
      setState(next);
      if (next.expired) clearInterval(id); // L2 — 만료 도달 시 정지(연장 렌더 금지)
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, serverNow]);

  if (!expiresAt) return null;
  return state;
}
