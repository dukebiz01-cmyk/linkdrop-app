import { createFileRoute, redirect } from "@tanstack/react-router";

// v7.1 — 매장별 캘린더 전환. 드롭별 라우트는 더이상 의미 없음. 북마크/기존
// 링크 호환을 위해 파일 자체는 유지하고 /partner/calendar 로 redirect.
export const Route = createFileRoute("/_partner/partner/calendar/$dropId")({
  head: () => ({ meta: [{ title: "예약 캘린더 — LinkDrop" }] }),
  loader: () => {
    throw redirect({ to: "/partner/calendar", replace: true });
  },
  component: () => null,
});
