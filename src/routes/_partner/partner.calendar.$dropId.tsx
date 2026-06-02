import { createFileRoute, notFound } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import { PartnerCalendarPage } from "@/components/partner/PartnerCalendarPage";

type LoaderData = {
  dropId: string;
  dropLabel: string;
  calendarMode: string;
  partnerName: string | null;
};

export const Route = createFileRoute("/_partner/partner/calendar/$dropId")({
  head: () => ({ meta: [{ title: "예약 캘린더 — LinkDrop" }] }),
  loader: async ({ params }): Promise<LoaderData> => {
    const fallback: LoaderData = {
      dropId: params.dropId,
      dropLabel: "예약 드롭",
      calendarMode: "date_range",
      partnerName: null,
    };
    const supabase = await getAuthClient();
    if (!supabase) return fallback;

    const { data: sessionData } = await supabase.auth.getSession();
    const ownerUserId = sessionData.session?.user.id;
    if (!ownerUserId) return fallback;

    const { data: partner } = await supabase
      .from("partners")
      .select("id, display_name")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (!partner?.id) return fallback;

    // owner 의 드롭인지 검증 + calendar_mode SELECT.
    // intent_types(label) 조인 제거 — partner.calendar.tsx 와 동일 400 원인.
    // 드롭 제목은 ai_summary 로.
    const { data: drop } = await supabase
      .from("info_drops")
      .select("id, calendar_mode, ai_summary")
      .eq("id", params.dropId)
      .eq("partner_id", partner.id)
      .maybeSingle();

    if (!drop) {
      throw notFound();
    }

    return {
      dropId: drop.id,
      dropLabel: drop.ai_summary?.trim() || "예약 드롭",
      calendarMode: drop.calendar_mode ?? "date_range",
      partnerName: partner.display_name ?? null,
    };
  },
  component: PartnerCalendarDropPage,
});

function PartnerCalendarDropPage() {
  const data = Route.useLoaderData();
  return (
    <PartnerCalendarPage
      dropId={data.dropId}
      dropLabel={data.dropLabel}
      calendarMode={data.calendarMode}
      partnerName={data.partnerName}
    />
  );
}
