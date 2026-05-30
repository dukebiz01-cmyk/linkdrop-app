/**
 * /d/ 수신자 행동 추적 — POST /api/events 핸들러로 fire-and-forget 호출.
 *
 * 인프라(`track_drop_event` SECURITY DEFINER RPC)는 이미 lifecycle_events INSERT를
 * 담당. 이 헬퍼는 4가지 행동(예약 클릭·전화·길찾기·재공유)을 lifecycle_events에
 * 흘려 넣어 B3 리포트의 "추정 전환"을 채운다.
 *
 * 원칙:
 * - fire-and-forget — await 없이 호출, 실패해도 throw 안 함
 * - 사용자 외부 링크 행동(window.open)을 절대 막지 않음
 * - visitor_anon_id는 localStorage에 1회 생성·저장 (수신자 신원 유지용)
 * - 서버 측 /api/events는 RPC 실패해도 200 반환 (best-effort)
 *
 * event_type 내부 키 (메모리 #16 — 화면 노출 X, 한글 라벨은 리포트 컴포넌트에서):
 *   reservation_click · phone_click · directions_click · share_click
 *   naver_booking_click · naver_booking_returned (EVENTS-FIX — 실제 네이버 이동·복귀)
 *
 * ⚠️ 클릭=성과 지표(멱등 아님, 한 사람 N번 가능). reward_ledger 미접촉(#2).
 */

const VISITOR_STORAGE_KEY = "ld_visitor_id";

function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!id) {
      // crypto.randomUUID는 secure context(HTTPS)에서 사용 가능. fallback은 timestamp + Math.random.
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(VISITOR_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage 차단(시크릿 모드 일부·iframe 등) — 추적 없이 진행
    return null;
  }
}

export type ReceiverEventType =
  | "reservation_click"
  | "phone_click"
  | "directions_click"
  | "share_click"
  | "naver_booking_click"
  | "naver_booking_returned";

/**
 * 수신자 행동을 lifecycle_events에 비동기 기록한다.
 * dropId 가 없으면 호출 자체 skip (mock/preview 화면 보호).
 * 반환 X — fire-and-forget.
 */
export function trackReceiverEvent(
  eventType: ReceiverEventType,
  dropId: string | null | undefined,
  metadata?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!dropId) return;
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;

  // fetch는 promise를 반환 — await 없이 catch만 swallow. 본 흐름을 절대 막지 않는다.
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      drop_id: dropId,
      visitor_anon_id: visitorId,
      event_type: eventType,
      metadata: metadata ?? {},
    }),
  }).catch(() => {
    /* best-effort */
  });
}
