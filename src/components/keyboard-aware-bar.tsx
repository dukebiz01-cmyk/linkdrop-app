import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * KeyboardAwareBar — 키보드(입력 포커스) 중 하단 고정 바를 표시만 숨기는 공용 래퍼.
 *   STUDIO-fix3 H4⑵에서 studio-build 발행바용으로 만든 패턴을 NAV-fix1 에서 공용 추출
 *   (하단 네비도 동일 혜택 — 입력이 있는 모든 화면).
 *
 * 동작: document focusin/focusout 자체 구독(input/textarea/select 만) → 입력 중 children 을
 *   display:none. focusout 은 120ms 지연 해제(필드 간 이동 깜빡임 방지).
 * 성능: 상태가 이 래퍼에 갇혀 있어 호스트 트리 리렌더 0(리렌더 격리). 애니 없음(정적 토글).
 * 보존: children 은 언마운트되지 않음 — 내부 상태(탭 활성·토글·게시 상태) 완전 보존.
 */
export function KeyboardAwareBar({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && t.matches("input, textarea, select");
    const onIn = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      if (timerRef.current != null) clearTimeout(timerRef.current);
      setHidden(true);
    };
    const onOut = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      if (timerRef.current != null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHidden(false), 120);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);
  return <div className={hidden ? "hidden" : ""}>{children}</div>;
}
