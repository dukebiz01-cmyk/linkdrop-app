// escapeToBrowser — 인앱 브라우저에서 외부(기본) 브라우저로 현재 작업을 넘기는 앱 이탈 스킴.
// KAKAO-LINGO-1: 카톡 인앱에서 [음성으로 만들기] → 크롬에서 핸드오프 URL 을 열 때 사용.
//
// 우선순위:
//   1) 카톡 인앱 — 공식 외부열기 스킴 kakaotalk://web/openExternal?url=… (카카오 문서 경로)
//   2) 그 외 Android 인앱 — Chrome intent:// 스킴(package=com.android.chrome)
//   3) 폴백 "manual" — 스킴이 없는 환경(iOS 기타 인앱 등). 호출부가 기존 배너와 동일한
//      수동 안내("오른쪽 위 메뉴 → 다른 브라우저로 열기")를 표시한다.
//
// ※ window.open 락(외부 페이지 진입 시 noopener 새 탭)과 별개 — 본 모듈은 새 탭 열기가
//   아니라 "앱 자체를 이탈"하는 스킴 네비게이션(location.href)이라 락 대상이 아니다.

import { getInAppBrowser } from "@/lib/pwa-install";

export type EscapeResult = "kakao" | "intent" | "manual";

export function escapeToBrowser(url: string): EscapeResult {
  if (typeof window === "undefined") return "manual";
  const inApp = getInAppBrowser();
  if (inApp === "kakao") {
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    return "kakao";
  }
  if (/Android/i.test(window.navigator.userAgent)) {
    const u = new URL(url);
    window.location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;end`;
    return "intent";
  }
  return "manual";
}
