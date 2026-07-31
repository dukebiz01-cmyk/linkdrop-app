import { createFileRoute, redirect } from "@tanstack/react-router";

// UI-5-T6b — /studio-build49 = 본선(/studio-build) 리다이렉트로 전환.
//   판단 근거(지시 3번 — 두 안 중 덜 파괴적인 쪽): 동일 렌더 존치는 같은 화면이 두 주소로 살아
//   가드 정책·히스토리·공유 링크가 이원화됨 → 리다이렉트가 단일 정본 주소 유지 + 파일럿 북마크/
//   기존 링크 무해화 + 유지비 0. 구 파일럿 라우트의 가드·loader(F3-10b)는 본선 라우트가 승계 완료.
//   롤백 = T-6b 커밋 revert(구 라우트 원문 복원).
export const Route = createFileRoute("/studio-build49")({
  beforeLoad: () => {
    throw redirect({ to: "/studio-build", replace: true });
  },
});
