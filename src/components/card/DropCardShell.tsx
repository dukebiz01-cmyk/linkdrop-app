"use client";

import { useState } from "react";

/**
 * DropCardShell — 색을 입은 3D 카드 프레임(표시 전용, 재사용).
 *
 * CouponPreview 와 동일한 presentational 패턴: 콜백/부모상태 없음, 데이터는 prop 주입.
 * studio-build 미리보기 카드의 외곽(tilt 카드 div + 홀로그래픽 광택 레이어 +
 * translateZ 콘텐츠 래퍼)을 추출. 스튜디오·손님 둘 다 재사용.
 *
 * ★ 색 중립: backgroundColor 는 반드시 cardColor prop 으로 주입(하드코딩 0).
 *    초록은 그냥 기본 스킨 — 메이커가 고른 어떤 색이든 입혀주는 중립 그릇.
 * ★ 게임화 0: 레벨업 버스트·등급 그림자·홀로 강도(stage 의존)·forge-float 는
 *    셸에 박지 않는다. 그림자/홀로강도는 옵션 prop, 버스트는 overlay slot,
 *    forge-float 플로팅은 호출부가 셸을 감싼다.
 *
 * 의존: 광택 스윕은 `holo-sweep` CSS 클래스(키프레임)를 호출부 컨텍스트가
 *       제공해야 한다(현재 studio-build 의 <style> 가 정의). 손님 채택 시 동반 필요.
 */
export function DropCardShell({
  cardColor,
  interactive = false,
  boxShadow,
  holoOpacity = 0.1,
  overlay,
  children,
}: {
  /** 카드 배경색 — 메이커가 고른 색 주입(중립 그릇). */
  cardColor: string;
  /** true 면 포인터 위치로 3D 틸트 + 스페큘러 광택 추적. */
  interactive?: boolean;
  /** 등급 그림자 등 — stage 의존 값은 호출부가 계산해 넘김(셸 중립 유지). */
  boxShadow?: string;
  /** 홀로그래픽 레이어 불투명도 — stage 의존 시 호출부가 계산해 넘김. */
  holoOpacity?: number;
  /** 버스트 등 절대배치 오버레이 slot(게임화 요소는 여기로). */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  // 틸트 캡슐화 — 포인터 위치 → 3D 회전 + 광택 위치(스튜디오 원본 감도 보존).
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });

  function handleTilt(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({
      rx: (0.5 - py) * 12,
      ry: (px - 0.5) * 14,
      gx: px * 100,
      gy: py * 100,
    });
  }
  function resetTilt() {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
  }

  return (
    <div
      onPointerMove={interactive ? handleTilt : undefined}
      onPointerLeave={interactive ? resetTilt : undefined}
      className="relative mx-auto w-full select-none rounded-[26px] p-5 text-white transition-transform duration-150 ease-out will-change-transform"
      style={{
        backgroundColor: cardColor,
        transform: interactive ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` : undefined,
        transformStyle: "preserve-3d",
        boxShadow: boxShadow ?? "0 0 0 1px rgba(255,255,255,0.08) inset",
      }}
    >
      {/* 홀로그래픽 레이어 (강도는 holoOpacity prop) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]"
        style={{ opacity: holoOpacity }}
      >
        {/* 포인터 따라가는 스페큘러 */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.5), transparent 45%)`,
          }}
        />
        {/* 무지개 홀로 틴트 */}
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{
            background:
              "linear-gradient(115deg, transparent 20%, rgba(56,189,248,0.7) 38%, rgba(168,85,247,0.6) 52%, rgba(244,114,182,0.6) 64%, transparent 82%)",
          }}
        />
        {/* 광택 스윕 */}
        <div className="holo-sweep absolute -inset-y-4 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      </div>

      {/* 게임화 오버레이 slot(레벨업 버스트 등) — 셸 중립 유지 */}
      {overlay}

      {/* 콘텐츠 (살짝 떠 있는 깊이감) */}
      <div className="relative" style={{ transform: "translateZ(30px)" }}>
        {children}
      </div>
    </div>
  );
}
