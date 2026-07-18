// startVoiceHandoff — 인앱 [음성으로 만들기] 공용 헬퍼 (KAKAO-LINGO-1b — 스튜디오·홈 공유).
//
// 1회용 코드 발급(POST /api/handoff/create, 쿠키 세션 인증) → /handoff?code&next URL 조립
// → escapeToBrowser 로 크롬 탈출. 실패·스킴 부재("manual")는 기존 배너와 동일한 수동 안내를
// notify 콜백(링고 말풍선)으로 — 문구는 KAKAO-LINGO-1 스튜디오 구현 원문 그대로(동작 변화 0).
// next = 크롬 도착 후 복귀 경로(스튜디오 "/studio-build" · 홈 "/home") — handoff 라우트가
// 같은-오리진 가드로 재검증한다.

import { escapeToBrowser } from "@/lib/escape-to-browser";

export async function startVoiceHandoff(
  next: string,
  notify: (text: string) => void,
): Promise<void> {
  try {
    const res = await fetch("/api/handoff/create", { method: "POST" });
    const json = (await res.json().catch(() => null)) as { code?: string } | null;
    if (!res.ok || !json?.code) {
      notify("크롬으로 여는 준비가 안 됐어요 — 오른쪽 위 메뉴의 '다른 브라우저로 열기'로 이어 주세요.");
      return;
    }
    const url = `${window.location.origin}/handoff?code=${json.code}&next=${encodeURIComponent(next)}`;
    if (escapeToBrowser(url) === "manual") {
      notify("오른쪽 위 메뉴의 '다른 브라우저로 열기'를 누르면 음성으로 이어져요.");
    }
  } catch {
    notify("크롬으로 여는 준비가 안 됐어요 — 잠시 후 다시 시도해 주세요.");
  }
}
