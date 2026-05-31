import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HomePageV3 } from "@/components/home-page-v3";
import { getAuthClient } from "@/lib/auth-context";

// phase1 B: 비지니스 게이팅. me.tsx:117 동일 패턴 (is_active_partner_owner RPC).
type HomeLoaderData = { isBusiness: boolean };

export const Route = createFileRoute("/_user/home")({
  head: () => ({ meta: [{ title: "홈" }] }),
  loader: async (): Promise<HomeLoaderData> => {
    const supabase = await getAuthClient();
    if (!supabase) return { isBusiness: false };
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return { isBusiness: false };
    const { data: isBusiness } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });
    return { isBusiness: Boolean(isBusiness) };
  },
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
  const { isBusiness } = Route.useLoaderData();

  // phase1-#1 마무리: home-page-v3 내장 nav 제거됨 → CSS 숨김 셀렉터 불필요.
  // 공통 BottomNav (v0 검정 4탭, URL 파생 active) 가 _user.tsx 에서 별도 렌더.
  // phase1 B: isBusiness=true 만 [혜택·예약] 카드 노출.
  return (
    <div>
      <HomePageV3
        isBusiness={isBusiness}
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
