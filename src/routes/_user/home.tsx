import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HomePageV3 } from "@/components/home-page-v3";
import { getAuthClient } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  // 손님이 잠긴 "혜택·예약" 카드를 탭하면 사업자 등록 유도 시트를 띄운다.
  const [showBizUpsell, setShowBizUpsell] = useState(false);

  // phase1-#1 마무리: home-page-v3 내장 nav 제거됨 → CSS 숨김 셀렉터 불필요.
  // 공통 BottomNav (v0 검정 4탭, URL 파생 active) 가 _user.tsx 에서 별도 렌더.
  // phase1 B: isBusiness=true 만 [혜택·예약] 카드 노출.
  return (
    <div>
      <HomePageV3
        isBusiness={isBusiness}
        onLockedBenefitTap={() => setShowBizUpsell(true)}
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
        onGoStore={() => {
          // 사업자(isBusiness=true)만 상단 Store 아이콘 노출 → 내 매장으로.
          void navigate({ to: "/partner" });
        }}
        onNotifications={() => {
          // 알림 라우트 미존재 — no-op
        }}
      />

      <Dialog open={showBizUpsell} onOpenChange={setShowBizUpsell}>
        <DialogContent className="w-[90vw] max-w-sm rounded-2xl border border-[#E5E5E5] bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-ko text-[#0A0A0A]">
              혜택·예약 카드 만들기
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-[#737373]">
              사업자로 등록하면 할인·쿠폰·예약 버튼을 붙인 카드로 손님을 모을 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex-col gap-2 sm:flex-col">
            <button
              type="button"
              onClick={() => {
                setShowBizUpsell(false);
                void navigate({ to: "/partner/register" });
              }}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#0A0A0A] px-5 text-sm font-semibold tracking-ko text-white transition-colors hover:bg-[#171717]"
            >
              사업자 등록하기
            </button>
            <button
              type="button"
              onClick={() => setShowBizUpsell(false)}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm font-medium tracking-ko text-[#A3A3A3] transition-colors hover:text-[#525252]"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
