import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CouponManageView, type CouponRow } from "@/routes/_partner/partner.coupons";
import { CouponRedeemView } from "@/routes/_partner/partner.redeem";

// 프로모션관리 (IA Phase 2) — 쿠폰 만들기/처리를 한 진입의 탭 2개로 묶음.
//   본문은 기존 /partner/coupons·/partner/redeem 에서 추출한 CouponManageView·CouponRedeemView
//   를 그대로 재사용(중복 0). 데이터/RPC 무변경. 기존 두 라우트도 같은 view 를 호스팅한다.
//   _partner.tsx beforeLoad 가 인증/파트너 가드 → 이 loader 는 세션 없으면 graceful(throw 금지).

type LoaderData = {
  partnerId: string | null;
  coupons: CouponRow[];
  ownerUserId: string | null;
};

export const Route = createFileRoute("/_partner/partner/promotion")({
  head: () => ({ meta: [{ title: "프로모션관리 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = { partnerId: null, coupons: [], ownerUserId: null };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const ownerUserId = sessionData.session?.user.id ?? null;
    if (!ownerUserId) return empty;

    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();
    if (!partner?.id) return { ...empty, ownerUserId };

    const { data: coupons } = await supabase
      .from("coupons")
      .select(
        "id, title, coupon_type, discount_value, discount_unit, conditions, valid_until, total_count, is_active, created_at, gift_item",
      )
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false });

    return {
      partnerId: partner.id,
      coupons: (coupons as CouponRow[] | null) ?? [],
      ownerUserId,
    };
  },
  component: PromotionPage,
});

function PromotionPage() {
  const data = Route.useLoaderData();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <Link
          to="/partner"
          className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          매장 홈
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[#0F172A]">프로모션관리</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">쿠폰을 만들고 손님 코드를 처리해요</p>
      </header>

      <div className="px-5 pt-4">
        <Tabs defaultValue="create">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-[#F1F5F9] p-1">
            <TabsTrigger
              value="create"
              className="min-h-[40px] rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0F172A]"
            >
              쿠폰 만들기
            </TabsTrigger>
            <TabsTrigger
              value="redeem"
              className="min-h-[40px] rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0F172A]"
            >
              쿠폰 처리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <CouponManageView
              partnerId={data.partnerId}
              coupons={data.coupons}
              onChanged={() => router.invalidate()}
            />
          </TabsContent>

          <TabsContent value="redeem" className="mt-0">
            <CouponRedeemView ownerUserId={data.ownerUserId} />
          </TabsContent>
        </Tabs>
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
