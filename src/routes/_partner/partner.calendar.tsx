import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { EmptyState } from "@/components/EmptyState";

type ReservationDropRow = {
  id: string;
  calendar_mode: string;
  ai_summary: string | null;
};

type LoaderData = {
  partnerName: string | null;
  drops: ReservationDropRow[];
};

export const Route = createFileRoute("/_partner/partner/calendar")({
  head: () => ({ meta: [{ title: "예약 캘린더 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = { partnerName: null, drops: [] };
    // #17 자식 graceful — 부모(_partner) 가드가 세션 보장. 여기선 throw 금지.
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

    // 예약 드롭만 (purpose='예약') — published.
    // intent_types(label) 조인 제거 — label 컬럼 미존재로 400 발생 + 예약 라벨이
    // 다 '예약' 이라 무의미. 드롭 구분은 ai_summary 로.
    const { data: drops } = await supabase
      .from("info_drops")
      .select("id, calendar_mode, ai_summary")
      .eq("partner_id", partner.id)
      .eq("purpose", "예약")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    const mapped: ReservationDropRow[] = (drops ?? []).map((d) => ({
      id: d.id,
      calendar_mode: d.calendar_mode ?? "date_range",
      ai_summary: d.ai_summary ?? null,
    }));

    // 드롭 1개면 바로 해당 달력으로.
    if (mapped.length === 1) {
      throw redirect({
        to: "/partner/calendar/$dropId",
        params: { dropId: mapped[0].id },
      });
    }

    return {
      partnerName: partner.display_name ?? null,
      drops: mapped,
    };
  },
  component: PartnerCalendarSelectPage,
});

function PartnerCalendarSelectPage() {
  const { drops } = Route.useLoaderData();

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

      <div className="px-5 pt-4">
        {drops.length === 0 ? (
          <EmptyState
            title="예약 드롭이 없어요"
            description="예약 드롭을 만들면 여기서 가능한 날짜를 마킹할 수 있어요."
          />
        ) : (
          <>
            <p className="mb-3 px-1 text-xs font-medium text-[#64748B]">
              캘린더를 설정할 드롭을 선택해 주세요.
            </p>
            <ul className="space-y-3">
              {drops.map((d) => (
                <li key={d.id}>
                  <Link
                    to="/partner/calendar/$dropId"
                    params={{ dropId: d.id }}
                    className="flex w-full min-h-[44px] items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-[#FAFAFA]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-[#FAFAFA]">
                        <CalendarIcon
                          className="size-5 text-[#0A0A0A]"
                          strokeWidth={2}
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">
                          {d.ai_summary?.trim() || "예약 드롭"}
                        </p>
                        <p className="mt-0.5 text-xs text-[#64748B]">
                          {d.calendar_mode === "date_time_slot"
                            ? "시간형 (준비 중)"
                            : "숙박형 (날짜 범위)"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-5 text-[#94A3B8]" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
