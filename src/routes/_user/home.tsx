import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HomePageV3 } from "@/components/home-page-v3";

export const Route = createFileRoute("/_user/home")({
  head: () => ({ meta: [{ title: "홈" }] }),
  component: HomeRoute,
});

// v0 home-page-v3 의 3 purpose id → /create-wizard validateSearch.purpose (영문).
// create-wizard 의 PURPOSE_EN_TO_KO 가 한국어 DropPurpose 로 변환 (info→정보 /
// coupon→쿠폰 / purchase→구매). reservation_benefit 은 PURPOSE_EN_TO_KO 키에
// 없어 'coupon' 으로 매핑(혜택·예약 묶음 의도).
const V0_PURPOSE_TO_EN: Record<string, string> = {
  info: "info",
  reservation_benefit: "coupon",
  purchase: "purchase",
};

function HomeRoute() {
  const navigate = useNavigate();

  // v0 home-page-v3 (v0.26) 내부 fixed bottom 4탭 nav 를 CSS 셀렉터로 숨김.
  // repo BottomNav 3탭 (홈·만들기·나) 가 _user.tsx 에서 별도 렌더 — 4탭 노출은
  // 별도 유닛 (_user.tsx 의 hideNav 분기 + max-w-md 너비 조정 필요).
  return (
    <div className="[&_.fixed.bottom-0]:hidden">
      <HomePageV3
        onCreateDrop={(url, purpose) => {
          const en = purpose ? V0_PURPOSE_TO_EN[purpose] : undefined;
          void navigate({
            to: "/create-wizard",
            search: {
              url,
              ...(en ? { purpose: en } : {}),
            } as never,
          });
        }}
        onViewDrop={() => {
          // dropId (info_drops.id) → share_uuid 매핑 미구현 — /me 로 이동
          // (사용자가 "성과 보기"로 share_uuid 기반 진입). 별도 유닛.
          void navigate({ to: "/me" });
        }}
        onViewAllDrops={() => {
          void navigate({ to: "/me" });
        }}
        onTabChange={(tab) => {
          if (tab === "home") return;
          if (tab === "create") {
            void navigate({ to: "/create-wizard" });
            return;
          }
          if (tab === "me") {
            void navigate({ to: "/me" });
            return;
          }
          // explore: 라우트 미존재 — no-op (별도 유닛에서 라우트 신설 시 연결)
        }}
        onSearch={() => {
          // 검색 라우트 미존재 — no-op
        }}
        onNotifications={() => {
          // 알림 라우트 미존재 — no-op
        }}
      />
    </div>
  );
}
