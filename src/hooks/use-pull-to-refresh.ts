import { useEffect, useRef, useState } from "react";

/**
 * PTR-1 — 당겨서 새로고침 경량 훅(라이브러리 0, 모바일 터치 제스처 전용).
 *
 * 활성 조건: touchstart 시점에 페이지 스크롤(scrollingElement.scrollTop)이 0일 때만.
 *   중간 위치·위로 스크롤에서는 완전 무개입(기존 스크롤 0간섭 — 리스너는 조기 return).
 * 당김: 아래로 dy > 0 이동을 저항 계수 0.5로 환산, maxPull 캡. threshold 넘긴 채 놓으면
 *   refreshing=true → await onRefresh() → finally 해제.
 * preventDefault: scrollTop===0 && 당김 중일 때만(touchmove, {passive:false}) — iOS 바운스와의
 *   이중 스크롤 충돌 차단. 그 외 상황은 기본 스크롤 그대로.
 * SSR 가드: window 접근은 전부 effect 내부. 데스크톱 마우스는 미지원(모바일 전용).
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 64,
  maxPull = 96,
}: {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
}): { pullDistance: number; refreshing: boolean; ready: boolean } {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // 최신 onRefresh 참조(리스너 재등록 없이 교체).
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const distRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollTop = () =>
      (document.scrollingElement ?? document.documentElement).scrollTop;

    function reset() {
      pullingRef.current = false;
      distRef.current = 0;
      setPullDistance(0);
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (scrollTop() > 0) return; // 최상단에서만 활성
      startYRef.current = e.touches[0]?.clientY ?? null;
      pullingRef.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (refreshingRef.current || startYRef.current == null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startYRef.current;
      if (dy <= 0 || scrollTop() > 0) {
        // 위로 스크롤 전환·스크롤 발생 → 당김 취소(무개입 복귀).
        if (pullingRef.current) reset();
        return;
      }
      pullingRef.current = true;
      const dist = Math.min(maxPull, dy * 0.5); // 저항 계수 0.5 + 캡
      distRef.current = dist;
      setPullDistance(dist);
      // scrollTop 0 && 당김>0 일 때만 기본 스크롤 차단(그 외 무개입).
      if (e.cancelable) e.preventDefault();
    }

    function onTouchEnd() {
      if (startYRef.current == null) return;
      startYRef.current = null;
      if (!pullingRef.current) return;
      const dist = distRef.current;
      if (dist >= threshold && !refreshingRef.current) {
        pullingRef.current = false;
        distRef.current = 0;
        refreshingRef.current = true;
        setRefreshing(true);
        setPullDistance(threshold); // refreshing 동안 인디케이터 높이 유지
        void (async () => {
          try {
            await onRefreshRef.current();
          } finally {
            refreshingRef.current = false;
            setRefreshing(false);
            setPullDistance(0);
          }
        })();
      } else {
        reset();
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [threshold, maxPull]);

  return { pullDistance, refreshing, ready: pullDistance >= threshold };
}
