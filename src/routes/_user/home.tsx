import { createFileRoute } from "@tanstack/react-router";
import { HomePageV3 } from "@/components/home-page-v3";

export const Route = createFileRoute("/_user/home")({
  head: () => ({ meta: [{ title: "홈" }] }),
  component: HomeRoute,
});

function HomeRoute() {
  // A 단계 임시 — B+C 와이어링에서 navigate·purpose 매핑·라우트 분기 정식 적용.
  // v0 home-page-v3 (v0.26) 내부 fixed bottom nav 를 CSS 셀렉터로 숨김 (메모리 #25 패턴
  // 그대로). repo BottomNav 3탭 (홈·만들기·나) 가 _user.tsx 에서 별도 렌더.
  return (
    <div className="[&_.fixed.bottom-0]:hidden">
      <HomePageV3
        onCreateDrop={(url, purpose) => {
          console.log("[home] onCreateDrop", { url, purpose });
        }}
        onViewDrop={(dropId) => {
          console.log("[home] onViewDrop", { dropId });
        }}
        onViewAllDrops={() => {
          console.log("[home] onViewAllDrops");
        }}
        onTabChange={(tab) => {
          console.log("[home] onTabChange", { tab });
        }}
        onSearch={() => {
          console.log("[home] onSearch");
        }}
        onNotifications={() => {
          console.log("[home] onNotifications");
        }}
      />
    </div>
  );
}
