import { createFileRoute, redirect } from "@tanstack/react-router";

// P6-1(형님 확정 A) — 전면 대체: /studio 는 studio-build 리다이렉트만 잔류(북마크·딥링크 보호).
// P6-2 — 구 셸(AI 코치·내 캐쉬 헤더·도구 3섹션·loader)은 studio-build 상단으로 이식 완료 → 잔재 제거.
//   비사업자 처리는 P6-3 소관 — studio-build loader 의 현행 게이트(비사업자 → /partner/register)가 담당.

export const Route = createFileRoute("/_user/studio")({
  head: () => ({ meta: [{ title: "스튜디오 — LinkDrop" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/studio-build" });
  },
});
