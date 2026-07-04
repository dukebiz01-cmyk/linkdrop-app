import { useEffect, useState } from "react";

/**
 * useCountdown — 마감 카운트다운 훅 (Phase 1-A · 1-A-fix2).
 *
 * 하드락:
 *   L1/L3 — 기준은 expiresAt 하나: 리셋·재계산 없음(새로고침해도 동일 기준값).
 *           fix2 는 틱 해상도만 변경 — 기준값·offset 계산 무수정.
 *   L2 — 만료 후 연장 렌더 금지: expired=true 로 고정, 티커 정지.
 *   L6 — serverNow 수신 시 서버 시각 권위: 클라 시계 offset 1회 보정(고정 offset).
 *   하이드레이션 안전 — now 계산은 마운트 후(useEffect)만. SSR/첫 페인트 = null(미렌더).
 *
 * fix2 — 임박(잔여 ≤1h) 구간: 100ms 틱 + "HH:MM:SS.d"(십분의 일초). 그 외 = 1s 틱(성능).
 *   100ms 구간은 모듈 공유 티커 1개를 전 카드가 구독(카드 N장 = interval 1개, 과도 타이머 방지).
 */

export type CountdownState = {
  expired: boolean;
  /** 잔여 일수(만료 시 0). */
  days: number;
  /** "HH:MM:SS" — 임박(≤1h) 구간은 "HH:MM:SS.d"(0.1초 1자리). */
  hms: string;
  /** 잔여 ≤ 24h — 표시층 앰버 전환 기준(L7: 빨강 금지). */
  urgent: boolean;
  /** fix2 — 잔여 ≤ 1h: 0.1초 틱 + 임박 톤(표시층). */
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
  const imminent = diff <= HOUR_MS;
  // fix2 — 임박 구간만 0.1초 자리 노출(그 외 표기 현행 유지).
  const hms = imminent
    ? `${pad2(h)}:${pad2(m)}:${pad2(s)}.${Math.floor((diff % 1000) / 100)}`
    : `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return { expired: false, days, hms, urgent: diff <= DAY_MS, imminent };
}

// fix2 — 임박(100ms) 공유 티커: 구독자 N명이 setInterval 1개 공유. 구독 0명이면 정지.
const fastSubs = new Set<() => void>();
let fastTickerId: ReturnType<typeof setInterval> | undefined;
function subscribeFastTick(fn: () => void): () => void {
  fastSubs.add(fn);
  if (fastTickerId === undefined) {
    fastTickerId = setInterval(() => {
      fastSubs.forEach((f) => f());
    }, 100);
  }
  return () => {
    fastSubs.delete(fn);
    if (fastSubs.size === 0 && fastTickerId !== undefined) {
      clearInterval(fastTickerId);
      fastTickerId = undefined;
    }
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

    let slowId: ReturnType<typeof setInterval> | undefined;
    let unsubFast: (() => void) | undefined;
    const stopAll = () => {
      if (slowId !== undefined) {
        clearInterval(slowId);
        slowId = undefined;
      }
      if (unsubFast) {
        unsubFast();
        unsubFast = undefined;
      }
    };
    // 구간 동기화 — 임계(1h) 통과 시 자동 전환: 1s 인터벌 ↔ 100ms 공유 티커(리로드 불필요).
    const sync = (s: CountdownState) => {
      if (s.expired) {
        stopAll(); // L2 — 만료 도달: 정지("마감" 고정, 연장 렌더 없음)
        return;
      }
      if (s.imminent) {
        if (slowId !== undefined) {
          clearInterval(slowId);
          slowId = undefined;
        }
        if (!unsubFast) unsubFast = subscribeFastTick(tick);
      } else if (slowId === undefined) {
        if (unsubFast) {
          unsubFast();
          unsubFast = undefined;
        }
        slowId = setInterval(tick, 1000);
      }
    };
    function tick() {
      const next = computeCountdown(target, Date.now() + offset);
      setState(next);
      sync(next);
    }
    const initial = computeCountdown(target, Date.now() + offset);
    setState(initial);
    if (!initial.expired) sync(initial);
    return stopAll;
  }, [expiresAt, serverNow]);

  if (!expiresAt) return null;
  return state;
}
