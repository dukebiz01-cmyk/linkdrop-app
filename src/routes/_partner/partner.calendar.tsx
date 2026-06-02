import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { PartnerCalendarPage } from "@/components/partner/PartnerCalendarPage";

// v7.1 — 매장별 캘린더. 드롭 목록 제거, 로그인 업주의 partner_id 로 바로 진입.
type LoaderData = {
  partnerId: string | null;
  partnerName: string | null;
};

export const Route = createFileRoute("/_partner/partner/calendar")({
  head: () => ({ meta: [{ title: "예약 캘린더 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    // #17 — 부모 _partner beforeLoad 가 인증/owner 가드 담당. 자식에서 throw 금지.
    const empty: LoaderData = { partnerId: null, partnerName: null };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const ownerUserId = sessionData.session?.user.id;
    if (!ownerUserId) return empty;

    const { data: partner } = await supabase
      .from("partners")
      .select("id, display_name")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (!partner?.id) return empty;

    return {
      partnerId: partner.id,
      partnerName: partner.display_name ?? null,
    };
  },
  component: PartnerCalendarRoute,
});

function PartnerCalendarRoute() {
  const { partnerId, partnerName } = Route.useLoaderData();

  // partner 행이 없으면 (매장 미등록 또는 로그인 누락) "매장 등록 먼저" 안내.
  // 드롭 목록 X (매장별이라 매장 1개면 충분), partner 부재 케이스만 분기.
  if (!partnerId) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
        <header className="bg-white px-5 py-4 border-b border-[#F1F5F9] flex items-center gap-3">
          <Link
            to="/partner"
            className="flex size-10 min-h-[44px] min-w-[44px] items-center justify-center -ml-2"
          >
            <ArrowLeft className="size-5 text-[#0A0A0A]" strokeWidth={2} />
          </Link>
          <h1 className="text-lg font-bold text-[#0F172A]">예약 캘린더</h1>
        </header>
        <div className="px-5 pt-6">
          <section className="rounded-2xl bg-white p-6 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-semibold text-[#0F172A]">매장 등록이 먼저예요</p>
            <p className="mt-2 text-xs text-[#64748B]">
              매장 등록 후 예약 캘린더를 사용할 수 있어요.
            </p>
            <Link
              to="/partner/register"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#0A0A0A] px-5 py-2 text-sm font-bold text-white"
            >
              매장 등록하기
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return <PartnerCalendarPage partnerId={partnerId} partnerName={partnerName} />;
}
